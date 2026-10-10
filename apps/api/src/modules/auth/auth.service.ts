/**
 * AUTH BUSINESS LOGIC used by auth.routes.ts (and admin → users):
 * passwords (argon2id hashing), login lockout, one-time email secrets (reset links, 6-digit codes, tickets),
 * admin authenticator codes (TOTP) and one-time recovery codes, and sessions (refresh-token cookies + short access tokens).
 * Security reasoning for each part: docs/SECURITY.md.
 */
import crypto from 'node:crypto';
import argon2 from 'argon2';
import type { CookieOptions, Request, Response } from 'express';
import { authenticator } from 'otplib';
import { env } from '../../config/env';
import { decrypt, hmac, randomCode, randomToken, sha256, timingSafeEqualHex, type EncryptedValue } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { signAccessToken } from '../../lib/tokens';
import { invalidateUser } from '../../lib/userCache';
import { EmailTokenModel, LoginThrottleModel, RefreshTokenModel } from '../../models/auth';
import { emails, sendInBackground } from '../../providers/email';
import { UserModel, type UserDoc } from '../../models/user';

export type SessionKind = 'user' | 'admin';

const REFRESH_REUSE_GRACE_MS = 10_000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_LOCK_MS = 15 * 60_000;

/* ---------------- passwords (argon2id, OWASP parameters) ---------------- */

const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => argon2.hash(password, ARGON_OPTIONS);

/** A real hash of a random value, so unknown emails take as long as wrong passwords (no timing leak). */
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= argon2.hash(randomToken(16), ARGON_OPTIONS));

export async function verifyPassword(hash: string | null | undefined, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash ?? (await getDummyHash()), password);
  } catch {
    return false;
  }
}

/**
 * Sets a new password (used by: reset link, "change password", and an admin setting it for a user).
 * Side effects, all on purpose: every device is logged out, login lockouts are cleared,
 * and the owner gets a "your password was changed" email so they notice if it wasn't them.
 */
export async function setPassword(user: UserDoc, password: string) {
  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.emailVerifiedAt ??= new Date(); // reset links prove email ownership
  await user.save();
  await endAllSessions(String(user._id), 'password_changed');
  await clearLoginFailures(user.email);
  sendInBackground(emails.passwordChanged(user.email, user.name));
}

/* ---------------- login throttling (per email, whether or not it exists) ---------------- */

const throttleKey = (email: string) => sha256(`login:${email.toLowerCase()}`);

export async function assertLoginAllowed(email: string) {
  const t = await LoginThrottleModel.findOne({ key: throttleKey(email) }).lean();
  if (t?.lockedUntil && t.lockedUntil.getTime() > Date.now()) {
    throw new AppError('RATE_LIMITED', 'errors.loginLocked', undefined, Math.ceil((t.lockedUntil.getTime() - Date.now()) / 1000));
  }
}

export async function registerLoginFailure(email: string) {
  const key = throttleKey(email);
  const now = new Date();
  const t = await LoginThrottleModel.findOne({ key });
  if (!t || now.getTime() - t.windowStart.getTime() > LOGIN_WINDOW_MS) {
    await LoginThrottleModel.findOneAndUpdate(
      { key },
      { $set: { failures: 1, windowStart: now, purgeAt: new Date(now.getTime() + 2 * 3_600_000) }, $unset: { lockedUntil: 1 } },
      { upsert: true },
    );
    return;
  }
  t.failures += 1;
  if (t.failures >= LOGIN_MAX_FAILURES) {
    t.lockedUntil = new Date(now.getTime() + LOGIN_LOCK_MS);
    logger.warn('login locked after repeated failures');
  }
  await t.save();
}

export const clearLoginFailures = (email: string) => LoginThrottleModel.deleteOne({ key: throttleKey(email) });

/**
 * Checks email + password. Every failure (unknown email, wrong password) looks identical.
 * Returns the user with passwordHash loaded.
 */
export async function checkCredentials(email: string, password: string): Promise<UserDoc> {
  await assertLoginAllowed(email);
  const user = await UserModel.findOne({ email }).select('+passwordHash');
  const ok = await verifyPassword(user?.passwordHash, password);
  if (!user || !ok) {
    await registerLoginFailure(email);
    throw new AppError('UNAUTHENTICATED', 'errors.badCredentials');
  }
  await clearLoginFailures(email);
  return user;
}

/* ---------------- email links ---------------- */

/** How long each kind of one-time email secret stays valid. */
const LINK_TTL = { reset_password: 60 * 60_000, signup_ticket: 60 * 60_000 } as const;

/** Details from a repeated, unfinished signup, applied only after the emailed code is entered. */
export interface PendingSignup { name: string; passwordHash: string }

export async function createEmailToken(userId: unknown, purpose: keyof typeof LINK_TTL, pending?: PendingSignup): Promise<string> {
  // Older unused links for the same purpose stop working. Signup tickets are the exception: each open
  // tab keeps its own (the emailed code is the real secret), so a second tab never breaks the first.
  if (purpose !== 'signup_ticket') await EmailTokenModel.updateMany({ userId, purpose, usedAt: null }, { $set: { usedAt: new Date() } });
  const raw = randomToken(32); // 43 url-safe characters
  await EmailTokenModel.create({ userId, purpose, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + LINK_TTL[purpose]), pending });
  return raw;
}

/** Atomically consumes a link. Returns the user id, or throws a generic "link invalid/expired". */
export async function consumeEmailToken(raw: string, purpose: keyof typeof LINK_TTL): Promise<string> {
  const doc = await EmailTokenModel.findOneAndUpdate(
    { tokenHash: sha256(raw), purpose, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!doc) throw await linkProblem(raw, purpose);
  return String(doc.userId);
}

/** Checks a link is still usable WITHOUT using it up (so a rejected form submission doesn't burn the link). */
export async function peekEmailToken(raw: string, purpose: keyof typeof LINK_TTL): Promise<string> {
  const doc = await EmailTokenModel.findOne({ tokenHash: sha256(raw), purpose, usedAt: null, expiresAt: { $gt: new Date() } }).lean();
  if (!doc) throw await linkProblem(raw, purpose);
  return String(doc.userId);
}

/** Tells the user exactly why a link doesn't work (only the link holder sees this). */
async function linkProblem(raw: string, purpose: keyof typeof LINK_TTL): Promise<AppError> {
  const doc = await EmailTokenModel.findOne({ tokenHash: sha256(raw), purpose }).lean();
  if (doc?.usedAt) return new AppError('VALIDATION_ERROR', 'errors.linkUsed');
  if (doc && doc.expiresAt.getTime() <= Date.now()) return new AppError('VALIDATION_ERROR', 'errors.linkExpired');
  return new AppError('VALIDATION_ERROR', 'errors.linkInvalid');
}

/* ---------------- 6-digit email codes (OTP) ---------------- */

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const otpHash = (userId: string, code: string) => hmac(env.JWT_ACCESS_SECRET, `email-otp:${userId}:${code}`);

/** Creates a new 6-digit code for the user (older codes stop working) and returns it for emailing. */
export async function createEmailOtp(userId: unknown): Promise<string> {
  await EmailTokenModel.updateMany({ userId, purpose: 'verify_otp', usedAt: null }, { $set: { usedAt: new Date() } });
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await EmailTokenModel.create({
    userId, purpose: 'verify_otp', tokenHash: sha256(randomToken(32)), codeHash: otpHash(String(userId), code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  return code;
}

/** Checks a code: max 5 tries per code, constant-time compare, single use. */
export async function checkEmailOtp(userId: string, code: string): Promise<void> {
  // 1. Find this user's newest unused, unexpired code and count this attempt (atomically, so parallel
  //    guesses can't sneak past the limit).
  const doc = await EmailTokenModel.findOneAndUpdate(
    { userId, purpose: 'verify_otp', usedAt: null, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { sort: { createdAt: -1 }, new: true },
  );
  if (!doc) throw new AppError('VALIDATION_ERROR', 'errors.otpExpired');
  // 2. Too many tries on this code → burn it; the user must ask for a new one.
  if ((doc.attempts ?? 0) > OTP_MAX_ATTEMPTS) {
    await EmailTokenModel.updateOne({ _id: doc._id }, { $set: { usedAt: new Date() } });
    throw new AppError('VALIDATION_ERROR', 'errors.otpTooMany');
  }
  // 3. Compare fingerprints in constant time (so response timing reveals nothing about the code).
  if (!doc.codeHash || !timingSafeEqualHex(doc.codeHash, otpHash(userId, code))) {
    throw new AppError('VALIDATION_ERROR', 'errors.otpInvalid');
  }
  // 4. Mark it used; if another request used it a millisecond earlier, this one fails.
  const used = await EmailTokenModel.updateOne({ _id: doc._id, usedAt: null }, { $set: { usedAt: new Date() } });
  if (used.modifiedCount !== 1) throw new AppError('VALIDATION_ERROR', 'errors.otpInvalid');
}

/** Looks up a signup ticket without using it up. Returns the user id, or null. */
export async function peekSignupTicket(raw: string): Promise<{ userId: string; pending?: PendingSignup } | null> {
  const doc = await EmailTokenModel.findOne({ tokenHash: sha256(raw), purpose: 'signup_ticket', usedAt: null, expiresAt: { $gt: new Date() } }).lean();
  return doc ? { userId: String(doc.userId), pending: (doc.pending ?? undefined) as PendingSignup | undefined } : null;
}

/** Links use the URL fragment (#token=…) so the token never reaches server logs or Referer headers. */
export function emailLink(path: '/reset-password', token: string, area: 'app' | 'admin' = 'app') {
  return `${area === 'admin' ? env.ADMIN_BASE_URL : env.APP_BASE_URL}${path}#token=${token}`;
}

/* ---------------- TOTP (admins) ---------------- */

authenticator.options = { window: 1 };

export async function verifyTotp(userId: string, code: string): Promise<void> {
  const user = await UserModel.findById(userId).select('+totpSecret +totpLastStep');
  if (!user || !user.totpEnabled || !user.totpSecret) throw new AppError('INVALID_OTP', 'errors.invalidOtp');
  const secret = decrypt(user.totpSecret as unknown as EncryptedValue);
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) throw new AppError('INVALID_OTP', 'errors.invalidOtp');
  const step = Math.floor(Date.now() / 30_000) + delta;
  // Replay protection: each TOTP code works once.
  const updated = await UserModel.updateOne(
    { _id: user._id, $or: [{ totpLastStep: { $exists: false } }, { totpLastStep: null }, { totpLastStep: { $lt: step } }] },
    { $set: { totpLastStep: step } },
  );
  if (updated.modifiedCount !== 1) throw new AppError('INVALID_OTP', 'errors.invalidOtp');
}

/* ---------------- recovery codes (admins) ---------------- */

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 letters/digits, no look-alikes (0/O, 1/I)
// 12 characters × 5 bits = 60 bits per code: far too many to guess, so a plain SHA-256 fingerprint is safe to store.
const recoveryHash = (code: string) => sha256(`recovery:${code.toUpperCase().replace(/[\s-]/g, '')}`);

/** Makes a fresh set of 10 codes (older codes stop working) and returns them ONCE for the admin to save. */
export async function newRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomCode(RECOVERY_ALPHABET, 12);
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  });
  await UserModel.updateOne({ _id: userId }, { $set: { recoveryCodes: codes.map((c) => ({ hash: recoveryHash(c), usedAt: null })) } });
  return codes;
}

export async function recoveryCodesLeft(userId: string): Promise<number> {
  const u = await UserModel.findById(userId).select('+recoveryCodes').lean();
  return (u?.recoveryCodes ?? []).filter((c) => !c.usedAt).length;
}

/** Uses up one recovery code (atomically, so the same code can't work twice). Returns how many are left. */
export async function useRecoveryCode(userId: string, code: string): Promise<number> {
  const used = await UserModel.updateOne(
    { _id: userId, recoveryCodes: { $elemMatch: { hash: recoveryHash(code), usedAt: null } } },
    { $set: { 'recoveryCodes.$.usedAt': new Date() } },
  );
  if (used.modifiedCount !== 1) throw new AppError('INVALID_OTP', 'errors.invalidRecoveryCode');
  return recoveryCodesLeft(userId);
}

/* ---------------- sessions ---------------- */

export const COOKIE_NAME: Record<SessionKind, string> = { user: 'bn_rt', admin: 'bn_admin_rt' };

function cookieOptions(kind: SessionKind): CookieOptions {
  const maxAge = kind === 'admin' ? env.REFRESH_TTL_ADMIN_HOURS * 3_600_000 : env.REFRESH_TTL_USER_DAYS * 86_400_000;
  return { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'strict', path: '/api/v1/auth', domain: env.COOKIE_DOMAIN, maxAge };
}

async function createRefresh(req: Request, res: Response, userId: string, kind: SessionKind, familyId: string) {
  const raw = randomToken(32);
  const opts = cookieOptions(kind);
  await RefreshTokenModel.create({
    userId, kind, familyId, tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + (opts.maxAge ?? 0)),
    ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 300),
  });
  res.cookie(COOKIE_NAME[kind], raw, opts);
}

export async function startSession(req: Request, res: Response, user: UserDoc, kind: SessionKind): Promise<string> {
  await createRefresh(req, res, String(user._id), kind, crypto.randomUUID());
  await UserModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return signAccessToken(String(user._id), user.tokenVersion, kind === 'admin' ? 'bluenova-admin' : 'bluenova-app');
}

export function clearSessionCookie(res: Response, kind: SessionKind) {
  const { maxAge: _maxAge, ...opts } = cookieOptions(kind);
  res.clearCookie(COOKIE_NAME[kind], opts);
}

/**
 * Rotates the refresh token. Reuse of an already-rotated token (outside a short grace window
 * for parallel tabs) revokes the whole token family: that indicates theft.
 */
export async function refreshSession(req: Request, res: Response, kind: SessionKind) {
  // 1. Read the httpOnly cookie the browser sent (JavaScript on the page can't read it).
  const raw: string | undefined = req.cookies?.[COOKIE_NAME[kind]];
  if (!raw || raw.length > 200) throw new AppError('UNAUTHENTICATED');
  const tokenHash = sha256(raw);
  const now = new Date();

  // 2. Normal case: the token is valid → mark it used ("rotated") in the same database step.
  const current = await RefreshTokenModel.findOneAndUpdate(
    { tokenHash, kind, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, revokedReason: 'rotated' } },
    { new: false },
  );

  let familyId: string;
  let userId: string;
  if (current) {
    familyId = current.familyId;
    userId = String(current.userId);
  } else {
    // 3. The token was already used or revoked. Only a token rotated a few seconds ago (two tabs refreshing
    //    together) is forgiven; any other reuse means it was probably stolen → log out that whole login.
    const old = await RefreshTokenModel.findOne({ tokenHash, kind });
    if (!old || old.expiresAt <= now || old.revokedReason !== 'rotated') {
      clearSessionCookie(res, kind);
      throw new AppError('UNAUTHENTICATED');
    }
    const revokedAgo = old.revokedAt ? now.getTime() - old.revokedAt.getTime() : Infinity;
    if (revokedAgo > REFRESH_REUSE_GRACE_MS) {
      await RefreshTokenModel.updateMany({ familyId: old.familyId, revokedAt: null }, { $set: { revokedAt: now, revokedReason: 'reuse_detected' } });
      logger.warn({ userId: String(old.userId) }, 'refresh token reuse detected; family revoked');
      clearSessionCookie(res, kind);
      throw new AppError('UNAUTHENTICATED');
    }
    // Benign race (two tabs refreshing at once): issue a new token in the same family.
    familyId = old.familyId;
    userId = String(old.userId);
  }

  // 4. Is the person still allowed in (not suspended, right area, email verified)?
  const user = await UserModel.findById(userId);
  const roleOk = kind === 'admin' ? user?.role === 'admin' : user?.role !== 'admin';
  if (!user || user.status !== 'active' || !roleOk || (kind === 'user' && !user.emailVerifiedAt)) {
    await RefreshTokenModel.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: now, revokedReason: 'inactive' } });
    clearSessionCookie(res, kind);
    throw new AppError('UNAUTHENTICATED');
  }
  // 5. Issue the next cookie (same "family") and a fresh 15-minute access token.
  await createRefresh(req, res, userId, kind, familyId);
  return {
    user,
    accessToken: signAccessToken(userId, user.tokenVersion, kind === 'admin' ? 'bluenova-admin' : 'bluenova-app'),
  };
}

export async function endSession(req: Request, res: Response, kind: SessionKind) {
  const raw: string | undefined = req.cookies?.[COOKIE_NAME[kind]];
  if (raw && raw.length <= 200) {
    await RefreshTokenModel.updateOne({ tokenHash: sha256(raw), revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: 'logout' } });
  }
  clearSessionCookie(res, kind);
}

/** Logs the user out everywhere: old access tokens stop working immediately. */
export async function endAllSessions(userId: string, reason: 'logout_all' | 'password_changed' = 'logout_all') {
  await UserModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  await RefreshTokenModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
  invalidateUser(userId);
}
