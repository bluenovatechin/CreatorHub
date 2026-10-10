/**
 * AUTH ROUTES (/api/v1/auth/*): sign up, email code, Google, login, logout, passwords, role choice,
 * and the admin panel's two-step login (authenticator code, or a one-time recovery code for a lost phone).
 * Each route here is thin: validate input → call auth.service.ts → reply.
 * Full step-by-step flows with diagrams: docs/FLOWS.md (section "Accounts & login").
 */
import { Router, type Request } from 'express';
import type { ClientSession } from 'mongoose';
import {
  POLICY_VERSION, adminLoginSchema, adminRecoverySchema, adminTotpSchema, changePasswordSchema, emailOnlySchema, loginSchema, passwordProblem,
  preferencesSchema, resetPasswordSchema, roleSelectSchema, signupSchema, tokenSchema,
  type SignupInput, type UiLanguage,
} from '@bluenova/shared';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/auth';
import { originCheck, rateLimits } from '../../middleware/security';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import { randomCode, randomToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { h, input, ok, withTransaction } from '../../lib/http';
import { signMfaToken, verifyToken } from '../../lib/tokens';
import { getAuthUser, invalidateUser } from '../../lib/userCache';
import { audit } from '../../lib/audit';
import { EmailTokenModel } from '../../models/auth';
import { BrandProfileModel } from '../../models/brandProfile';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { UserModel, type UserDoc } from '../../models/user';
import { emails, sendInBackground } from '../../providers/email';
import {
  checkCredentials, checkEmailOtp, consumeEmailToken, createEmailOtp, createEmailToken, emailLink,
  endAllSessions, endSession, hashPassword, peekEmailToken, peekSignupTicket, type PendingSignup, refreshSession, setPassword, startSession,
  useRecoveryCode, verifyPassword, verifyTotp,
} from './auth.service';
import { verifyGoogleCredential } from '../../providers/google';

export const authRouter = Router();

/** At most one email of each kind per minute per account. */
async function recentlySent(userId: unknown, purpose: 'verify_otp' | 'reset_password') {
  const last = await EmailTokenModel.findOne({ userId, purpose }).sort({ createdAt: -1 }).lean();
  return !!last && Date.now() - last.createdAt.getTime() < 60_000;
}

/** Creates the empty creator or brand profile that onboarding fills in later. */
async function createProfile(userId: string, role: 'creator' | 'brand', name: string, session: ClientSession) {
  if (role === 'creator') {
    await CreatorProfileModel.create([{
      userId, fullName: name, slug: `c-${randomCode('abcdefghijkmnpqrstuvwxyz23456789', 10)}`,
      referralCode: randomCode('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8),
    }], { session });
  } else {
    await BrandProfileModel.create([{ userId, contactName: name }], { session });
  }
}

/**
 * Starts email verification: a 6-digit code by email, plus a ticket only this browser tab holds.
 * If a code went out in the last minute, that code is still valid, so no second email is sent.
 */
async function startEmailVerification(user: UserDoc, pending?: PendingSignup) {
  if (!(await recentlySent(user._id, 'verify_otp'))) {
    const code = await createEmailOtp(user._id);
    sendInBackground(emails.otp(user.email, code));
  }
  return createEmailToken(user._id, 'signup_ticket', pending);
}

const ticketSchema = z.object({ ticket: tokenSchema.shape.token });
const otpSchema = z.object({ ticket: tokenSchema.shape.token, code: z.string().trim().regex(/^\d{6}$/, 'errors.otp') });

/* ---------- signup & email verification (6-digit code on the same page) ---------- */

/**
 * POST /auth/signup  { name, email, password, confirmPassword, acceptTerms }
 * Reply: { otpSent: true, ticket }  → the page shows "enter the 6-digit code".
 * (TEST_MODE: { accessToken, user } instead → logged in straight away.)
 * The reply looks the same whether or not the email is already registered, so nobody can use this
 * form to find out who has an account.
 */
authRouter.post('/signup', rateLimits.signup, validate({ body: signupSchema }), h(async (req, res) => {
  const d = input<SignupInput>(req);
  const existing = await UserModel.findOne({ email: d.email });
  const passwordHash = await hashPassword(d.password); // always hashed, so every branch takes the same time
  if (existing) {
    if (!existing.emailVerifiedAt && existing.status === 'active' && existing.role !== 'admin' && !existing.googleId) {
      // An unfinished signup (closed the tab, refreshed, lost the code): send a fresh code.
      // The name/password typed now are applied only after the code from the inbox is entered.
      const ticket = await startEmailVerification(existing, { name: d.name, passwordHash });
      return ok(res, { otpSent: true, ticket }, 201);
    }
    // Same response as a new signup (with a ticket that can never verify), so nobody can test
    // which emails are registered. The real owner gets a heads-up email instead of a code.
    sendInBackground(emails.alreadyRegistered(d.email, `${env.APP_BASE_URL}/login`));
    return ok(res, { otpSent: true, ticket: randomToken(32) }, 201);
  }
  const now = new Date();
  const user = await UserModel.create({
    // role stays null: the user picks "creator" or "brand" on the next screen (POST /auth/role).
    name: d.name, email: d.email, role: null, passwordHash, passwordChangedAt: now,
    preferredLanguage: req.get('accept-language')?.startsWith('en') ? 'en' : 'gu',
    consents: [
      { type: 'terms', version: POLICY_VERSION, acceptedAt: now, ip: req.ip },
      { type: 'privacy', version: POLICY_VERSION, acceptedAt: now, ip: req.ip },
    ],
  });
  if (env.TEST_MODE) {
    // Testing without an email service: verified straight away and logged in (next screen: choose a role).
    user.emailVerifiedAt = new Date();
    await user.save();
    const accessToken = await startSession(req, res, user, 'user');
    return ok(res, { accessToken, user: await meView(String(user._id)) }, 201);
  }
  ok(res, { otpSent: true, ticket: await startEmailVerification(user) }, 201);
}));

/**
 * POST /auth/signup/verify-otp  { ticket, code }
 * Correct code → email marked verified + logged in: { accessToken, user } (+ refresh cookie).
 * Wrong code → 400 errors.otpInvalid · old/replaced code → errors.otpExpired · 5 wrong tries → errors.otpTooMany
 */
authRouter.post('/signup/verify-otp', rateLimits.otpVerify, validate({ body: otpSchema }), h(async (req, res) => {
  const { ticket, code } = input<{ ticket: string; code: string }>(req);
  const t = await peekSignupTicket(ticket);
  const user = t ? await UserModel.findById(t.userId) : null;
  if (!t || !user || user.status !== 'active' || user.role === 'admin') throw new AppError('VALIDATION_ERROR', 'errors.otpExpired');
  await checkEmailOtp(String(user._id), code);
  if (t.pending && !user.emailVerifiedAt) {
    // A repeated signup: the details typed this time win.
    user.name = t.pending.name;
    user.passwordHash = t.pending.passwordHash;
    user.passwordChangedAt = new Date();
  }
  user.emailVerifiedAt ??= new Date();
  await user.save();
  invalidateUser(String(user._id));
  // This ticket and any other open signup tabs for this account are done.
  await EmailTokenModel.updateMany({ userId: user._id, purpose: 'signup_ticket', usedAt: null }, { $set: { usedAt: new Date() } });
  const accessToken = await startSession(req, res, user, 'user');
  ok(res, { accessToken, user: await meView(String(user._id)) });
}));

/** POST /auth/signup/resend-otp  { ticket } → a new code (at most one per minute). Always replies { sent: true }. */
authRouter.post('/signup/resend-otp', rateLimits.emailLinks, validate({ body: ticketSchema }), h(async (req, res) => {
  const t = await peekSignupTicket(input<{ ticket: string }>(req).ticket);
  const user = t ? await UserModel.findById(t.userId) : null;
  if (user && !user.emailVerifiedAt && user.status === 'active') {
    if (await recentlySent(user._id, 'verify_otp')) throw new AppError('RATE_LIMITED', 'errors.otpCooldown', undefined, 60);
    const code = await createEmailOtp(user._id);
    sendInBackground(emails.otp(user.email, code));
  }
  ok(res, { sent: true });
}));

/* ---------- Continue with Google ---------- */

// `credential` = the signed ID token Google sent back to the website; `nonce` = the random value the website put
// into that sign-in request. Both must match, so an old or stolen token can't be replayed.
const googleSchema = z.object({
  credential: z.string().min(100).max(5000),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/),
});

/**
 * POST /auth/google  { credential, nonce }  (sent by the website's /auth/google/callback page)
 * Verifies the Google token, then: existing account (same Google id or same email) → logged in;
 * new person → account created (email already verified by Google, no role yet) → logged in.
 * Linking to an account whose email was never verified removes its password first (see the comment inside).
 */
authRouter.post('/google', rateLimits.login, validate({ body: googleSchema }), h(async (req, res) => {
  const { credential, nonce } = input<{ credential: string; nonce: string }>(req);
  const g = await verifyGoogleCredential(credential);
  if (g.nonce !== nonce) throw new AppError('UNAUTHENTICATED', 'errors.googleFailed');
  if (!g.emailVerified) throw new AppError('FORBIDDEN', 'errors.googleNotVerified');
  let user = await UserModel.findOne({ $or: [{ googleId: g.sub }, { email: g.email }] });
  if (user) {
    // Team accounts use the admin panel. Saying so is safe here: Google has just proven this person owns the email.
    if (user.role === 'admin') throw new AppError('FORBIDDEN', 'errors.googleTeamAccount');
    if (user.status !== 'active') throw new AppError('FORBIDDEN', 'errors.accountInactive');
    // Google has proven this person owns the email, so linking and verifying is safe.
    // But if the email was NEVER verified, someone else may have signed up with it (and their own password)
    // before the real owner arrived. That unproven password must stop working, or it would open this account.
    const neverVerified = !user.emailVerifiedAt;
    user.googleId ??= g.sub;
    user.emailVerifiedAt ??= new Date();
    if (neverVerified) {
      user.passwordHash = undefined; // the owner can set their own later with "Forgot password"
      user.name = g.name.slice(0, 60);
    }
    await user.save();
    if (neverVerified) {
      // Unused signup codes/tickets (which may carry that stranger's password) and any old sessions end here.
      await EmailTokenModel.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: new Date() } });
      await endAllSessions(String(user._id), 'password_changed');
      user = (await UserModel.findById(user._id))!; // fresh tokenVersion for the new session
    }
    invalidateUser(String(user._id));
  } else {
    const now = new Date();
    user = await UserModel.create({
      // No password (Google-only account) and no role yet: the next screen asks "creator or brand?".
      name: g.name.slice(0, 60), email: g.email, googleId: g.sub, role: null, emailVerifiedAt: now,
      preferredLanguage: req.get('accept-language')?.startsWith('en') ? 'en' : 'gu',
      consents: [
        { type: 'terms', version: POLICY_VERSION, acceptedAt: now, ip: req.ip },
        { type: 'privacy', version: POLICY_VERSION, acceptedAt: now, ip: req.ip },
      ],
    });
  }
  const accessToken = await startSession(req, res, user, 'user');
  ok(res, { accessToken, user: await meView(String(user._id)) });
}));

/* ---------- login ---------- */

/**
 * POST /auth/login  { email, password }
 * Right password + verified email → { accessToken, user } (+ refresh cookie).
 * Right password but email never verified → { needsVerification, ticket, email } and a code is emailed.
 * Wrong email or password → 401 errors.badCredentials (same message for both, on purpose).
 */
authRouter.post('/login', rateLimits.login, validate({ body: loginSchema }), h(async (req, res) => {
  const { email: addr, password } = input<{ email: string; password: string }>(req);
  const user = await checkCredentials(addr, password);
  if (user.role === 'admin') throw new AppError('UNAUTHENTICATED', 'errors.badCredentials'); // admins use the admin panel
  if (user.status !== 'active') throw new AppError('FORBIDDEN', 'errors.accountInactive');
  if (!user.emailVerifiedAt) {
    // Correct password but email never verified: send a code and let the same page ask for it.
    const ticket = await startEmailVerification(user);
    return ok(res, { needsVerification: true, ticket, email: user.email });
  }
  const accessToken = await startSession(req, res, user, 'user');
  ok(res, { accessToken, user: await meView(String(user._id)) });
}));

/** POST /auth/refresh  (no body; uses the httpOnly cookie) → new access token. Called on page load and after 401s. */
authRouter.post('/refresh', originCheck(true), rateLimits.refresh, h(async (req, res) => {
  const { user, accessToken } = await refreshSession(req, res, 'user');
  ok(res, { accessToken, user: await meView(String(user._id)) });
}));

authRouter.post('/logout', originCheck(true), h(async (req, res) => {
  await endSession(req, res, 'user');
  ok(res, { loggedOut: true });
}));

authRouter.post('/logout-all', authenticate('app'), h(async (req, res) => {
  await endAllSessions(req.auth!.id);
  await endSession(req, res, 'user');
  ok(res, { loggedOut: true });
}));

/* ---------- forgot / reset / change password ---------- */

/** POST /auth/password/forgot  { email } → emails a 1-hour reset link if the account exists. Same reply either way. */
authRouter.post('/password/forgot', rateLimits.emailLinks, validate({ body: emailOnlySchema }), h(async (req, res) => {
  const user = await UserModel.findOne({ email: input<{ email: string }>(req).email });
  if (user && user.status === 'active' && !(await recentlySent(user._id, 'reset_password'))) {
    const token = await createEmailToken(user._id, 'reset_password');
    const area = user.role === 'admin' ? 'admin' : 'app';
    sendInBackground(emails.reset(user.email, user.name, emailLink('/reset-password', token, area)));
  }
  ok(res, { sent: true }); // identical whether or not the email exists
}));

/** POST /auth/password/reset  { token, password, confirmPassword } → new password, every device logged out. */
authRouter.post('/password/reset', rateLimits.emailLinks, validate({ body: resetPasswordSchema }), h(async (req, res) => {
  const d = input<{ token: string; password: string }>(req);
  // Check everything first; only use up the link when the new password is accepted.
  const userId = await peekEmailToken(d.token, 'reset_password');
  const user = await UserModel.findById(userId);
  if (!user || user.status !== 'active') throw new AppError('VALIDATION_ERROR', 'errors.linkInvalid');
  const problem = passwordProblem(d.password, { email: user.email, name: user.name });
  if (problem) throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', { password: problem });
  await consumeEmailToken(d.token, 'reset_password'); // atomic: a link still works only once
  await setPassword(user, d.password);
  ok(res, { done: true, area: user.role === 'admin' ? 'admin' : 'app' });
}));

async function changePassword(req: Request, kind: 'user' | 'admin') {
  const d = input<{ currentPassword: string; password: string }>(req);
  const user = await UserModel.findById(req.auth!.id).select('+passwordHash');
  if (!user || !(await verifyPassword(user.passwordHash, d.currentPassword))) {
    throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', { currentPassword: 'errors.currentPasswordWrong' });
  }
  const problem = passwordProblem(d.password, { email: user.email, name: user.name });
  if (problem) throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', { password: problem });
  await setPassword(user, d.password);
  return { user: (await UserModel.findById(user._id))!, kind };
}

authRouter.post('/password/change', authenticate('app'), rateLimits.login, validate({ body: changePasswordSchema }), h(async (req, res) => {
  const { user } = await changePassword(req, 'user');
  // Every other device is logged out; this one gets a fresh session.
  const accessToken = await startSession(req, res, user, 'user');
  ok(res, { accessToken });
}));

/**
 * "What brings you here?" — the one-time choice made right after the first login (email or Google).
 * Creates the matching profile. The role can never be changed afterwards (the filter `role: null` makes it one-shot).
 */
authRouter.post('/role', authenticate('app'), rateLimits.authed, validate({ body: roleSelectSchema }), h(async (req, res) => {
  const { role } = input<{ role: 'creator' | 'brand' }>(req);
  const userId = req.auth!.id;
  // One transaction: either the role AND the profile are saved, or neither (no half-made accounts).
  await withTransaction(async (session) => {
    const updated = await UserModel.findOneAndUpdate({ _id: userId, role: null }, { $set: { role } }, { new: true, session });
    if (!updated) throw new AppError('CONFLICT', 'errors.roleAlreadySet');
    await createProfile(userId, role, updated.name, session);
  });
  invalidateUser(userId); // the cached role is now stale
  ok(res, { user: await meView(userId) });
}));

/* ---------- admins: email + password, then authenticator code ---------- */

/**
 * POST /auth/admin/login { email, password } → { mfaToken } (step 2: authenticator code).
 * If ADMIN_TOTP_REQUIRED=false (temporary, for testing) the password alone logs in: { accessToken, user }.
 * That is audited every time, and the admin panel shows a red "two-step login is OFF" bar.
 */
authRouter.post('/admin/login', rateLimits.login, validate({ body: adminLoginSchema }), h(async (req, res) => {
  const { email: addr, password } = input<{ email: string; password: string }>(req);
  const user = await checkCredentials(addr, password);
  if (user.role !== 'admin' || user.status !== 'active') throw new AppError('UNAUTHENTICATED', 'errors.badCredentials');
  if (!env.ADMIN_TOTP_REQUIRED) {
    const accessToken = await startSession(req, res, user, 'admin');
    req.auth = (await getAuthUser(String(user._id)))!;
    await audit(req, 'admin.login_without_totp', 'User', user._id);
    return ok(res, { accessToken, user: await meView(String(user._id)) });
  }
  if (!user.totpEnabled) throw new AppError('UNAUTHENTICATED', 'errors.badCredentials');
  ok(res, { mfaToken: signMfaToken(String(user._id), user.tokenVersion) });
}));

/** Step 2 of admin login: the 5-minute token from step 1 says whose password was right. */
async function mfaUser(mfaToken: string): Promise<UserDoc> {
  let claims;
  try {
    claims = verifyToken(mfaToken, 'bluenova-admin-mfa', 'mfa');
  } catch {
    throw new AppError('UNAUTHENTICATED');
  }
  const user = await UserModel.findById(claims.sub);
  if (!user || user.role !== 'admin' || user.status !== 'active' || user.tokenVersion !== claims.tv) {
    throw new AppError('UNAUTHENTICATED');
  }
  return user;
}

authRouter.post('/admin/totp/verify', rateLimits.login, validate({ body: adminTotpSchema }), h(async (req, res) => {
  const { mfaToken, code } = input<{ mfaToken: string; code: string }>(req);
  const user = await mfaUser(mfaToken);
  await verifyTotp(String(user._id), code);
  const accessToken = await startSession(req, res, user, 'admin');
  ok(res, { accessToken, user: await meView(String(user._id)) });
}));

/**
 * POST /auth/admin/recovery  { mfaToken, code }: step 2 for an admin who lost their authenticator phone.
 * Each recovery code works once. The use is audited and emailed to the admin, so a stolen code gets noticed.
 * Reply: { accessToken, user, recoveryCodesLeft }. The admin panel then asks them to set up a new authenticator.
 */
authRouter.post('/admin/recovery', rateLimits.login, validate({ body: adminRecoverySchema }), h(async (req, res) => {
  const { mfaToken, code } = input<{ mfaToken: string; code: string }>(req);
  const user = await mfaUser(mfaToken);
  const recoveryCodesLeft = await useRecoveryCode(String(user._id), code);
  const accessToken = await startSession(req, res, user, 'admin');
  req.auth = (await getAuthUser(String(user._id)))!; // so the audit entry names this admin as the actor
  await audit(req, 'admin.recovery_code_used', 'User', user._id, { changes: { recoveryCodesLeft } });
  sendInBackground(emails.recoveryCodeUsed(user.email, user.name, recoveryCodesLeft));
  ok(res, { accessToken, user: await meView(String(user._id)), recoveryCodesLeft });
}));

authRouter.post('/admin/refresh', originCheck(true), rateLimits.refresh, h(async (req, res) => {
  const { user, accessToken } = await refreshSession(req, res, 'admin');
  ok(res, { accessToken, user: await meView(String(user._id)) });
}));

authRouter.post('/admin/logout', originCheck(true), h(async (req, res) => {
  await endSession(req, res, 'admin');
  ok(res, { loggedOut: true });
}));

authRouter.post('/admin/password/change', authenticate('admin'), rateLimits.login, validate({ body: changePasswordSchema }), h(async (req, res) => {
  const { user } = await changePassword(req, 'admin');
  const accessToken = await startSession(req, res, user, 'admin');
  ok(res, { accessToken });
}));

/* ---------- me ---------- */

export const meRouter = Router();

meRouter.get('/', h(async (req, res) => ok(res, await meView(req.auth!.id))));

meRouter.patch('/preferences', validate({ body: preferencesSchema }), h(async (req, res) => {
  const { preferredLanguage, emailNotifications } = input<{ preferredLanguage?: UiLanguage; emailNotifications?: boolean }>(req);
  const set: Record<string, unknown> = {};
  if (preferredLanguage !== undefined) set.preferredLanguage = preferredLanguage;
  if (emailNotifications !== undefined) set.emailNotifications = emailNotifications;
  await UserModel.updateOne({ _id: req.auth!.id }, { $set: set });
  ok(res, await meView(req.auth!.id));
}));

export async function meView(userId: string) {
  const user = await UserModel.findById(userId).lean();
  if (!user) throw new AppError('UNAUTHENTICATED');
  const view: Record<string, unknown> = {
    id: String(user._id),
    role: user.role ?? null,
    adminRole: user.adminRole ?? null,
    name: user.name ?? null,
    email: user.email,
    preferredLanguage: user.preferredLanguage,
    emailNotifications: user.emailNotifications !== false,
  };
  // Team members only: lets the admin panel warn when two-step login is switched off.
  if (user.role === 'admin') view.adminTotpRequired = env.ADMIN_TOTP_REQUIRED;
  if (user.role === 'creator') {
    const p = await CreatorProfileModel.findOne({ userId }, {
      status: 1, onboardingStep: 1, isPartner: 1, displayName: 1, introReelDealId: 1,
    }).lean();
    if (p) view.creator = {
      id: String(p._id), status: p.status, onboardingStep: p.onboardingStep, isPartner: p.isPartner,
      displayName: p.displayName ?? null, introReelDealId: p.introReelDealId ? String(p.introReelDealId) : null,
    };
  }
  if (user.role === 'brand') {
    const b = await BrandProfileModel.findOne({ userId }, { status: 1, companyName: 1 }).lean();
    if (b) view.brand = { id: String(b._id), status: b.status, companyName: b.companyName ?? null };
  }
  return view;
}

export function recordConsents(req: Request, types: ('privacy' | 'terms' | 'creator_agreement' | 'brand_agreement')[]) {
  const acceptedAt = new Date();
  return UserModel.updateOne(
    { _id: req.auth!.id },
    { $push: { consents: { $each: types.map((type) => ({ type, version: POLICY_VERSION, acceptedAt, ip: req.ip })) } } },
  );
}
