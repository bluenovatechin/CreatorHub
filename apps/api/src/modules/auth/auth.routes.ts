import { Router, type Request } from 'express';
import {
  POLICY_VERSION, adminLoginSchema, adminTotpSchema, changePasswordSchema, emailOnlySchema, loginSchema, passwordProblem,
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
import { h, input, ok } from '../../lib/http';
import { logger } from '../../lib/logger';
import { signMfaToken, verifyToken } from '../../lib/tokens';
import { invalidateUser } from '../../lib/userCache';
import { EmailTokenModel } from '../../models/auth';
import { BrandProfileModel } from '../../models/brandProfile';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { UserModel, type UserDoc } from '../../models/user';
import { email, emails } from '../../providers/email';
import {
  checkCredentials, checkEmailOtp, clearLoginFailures, consumeEmailToken, createEmailOtp, createEmailToken, emailLink,
  endAllSessions, endSession, hashPassword, peekEmailToken, peekSignupTicket, type PendingSignup, refreshSession, startSession, verifyPassword,
  verifyTotp,
} from './auth.service';
import { verifyGoogleCredential } from '../../providers/google';

export const authRouter = Router();

/**
 * Sends an email in the background. Requests never wait for email delivery (a slow or blocked mail
 * server must not freeze signup/login), and failures never reveal anything to the user; they are logged.
 */
async function sendSafely(msg: Parameters<typeof email.send>[0]) {
  try {
    await email.send(msg);
  } catch (err) {
    logger.error({ reason: err instanceof Error ? err.message : String(err) }, 'email delivery failed');
    if (env.NODE_ENV === 'development' && (msg.link || msg.code)) {
      // Never leave the developer stuck: show why it failed and the link itself.
      // eslint-disable-next-line no-console
      console.log([
        '',
        `  ⚠️  Email to ${msg.to} could NOT be sent: ${err instanceof Error ? err.message : err}`,
        msg.code ? `     Code (for testing):  ${msg.code}` : `     Link (for testing):  ${msg.link}`,
        '',
      ].join('\n'));
    }
  }
}

/** At most one email of each kind per minute per account. */
async function recentlySent(userId: unknown, purpose: 'verify_otp' | 'reset_password') {
  const last = await EmailTokenModel.findOne({ userId, purpose }).sort({ createdAt: -1 }).lean();
  return !!last && Date.now() - last.createdAt.getTime() < 60_000;
}

async function createProfile(userId: string, role: 'creator' | 'brand', name: string) {
  if (role === 'creator') {
    await CreatorProfileModel.create({
      userId, fullName: name, slug: `c-${randomCode('abcdefghijkmnpqrstuvwxyz23456789', 10)}`,
      referralCode: randomCode('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8),
    });
  } else {
    await BrandProfileModel.create({ userId, contactName: name });
  }
}

/**
 * Starts email verification: a 6-digit code by email, plus a ticket only this browser tab holds.
 * If a code went out in the last minute, that code is still valid, so no second email is sent.
 */
async function startEmailVerification(user: UserDoc, pending?: PendingSignup) {
  if (!(await recentlySent(user._id, 'verify_otp'))) {
    const code = await createEmailOtp(user._id);
    void sendSafely(emails.otp(user.email, code));
  }
  return createEmailToken(user._id, 'signup_ticket', pending);
}

const ticketSchema = z.object({ ticket: tokenSchema.shape.token });
const otpSchema = z.object({ ticket: tokenSchema.shape.token, code: z.string().trim().regex(/^\d{6}$/, 'errors.otp') });

/* ---------- signup & email verification (6-digit code on the same page) ---------- */

authRouter.post('/signup', rateLimits.signup, validate({ body: signupSchema }), h(async (req, res) => {
  const d = input<SignupInput>(req);
  const existing = await UserModel.findOne({ email: d.email });
  const passwordHash = await hashPassword(d.password); // always hashed, so every branch takes the same time
  if (existing) {
    if (!existing.emailVerifiedAt && existing.status === 'active' && existing.role !== 'admin' && !existing.googleId) {
      // An unfinished signup (closed the tab, refreshed, lost the code): send a fresh code.
      // The name/password/role typed now are applied only after the code from the inbox is entered.
      const ticket = await startEmailVerification(existing, { name: d.name, role: d.role, passwordHash });
      return ok(res, { otpSent: true, ticket }, 201);
    }
    // Same response as a new signup (with a ticket that can never verify), so nobody can test
    // which emails are registered. The real owner gets a heads-up email instead of a code.
    void sendSafely(emails.alreadyRegistered(d.email, `${env.APP_BASE_URL}/login`));
    return ok(res, { otpSent: true, ticket: randomToken(32) }, 201);
  }
  const now = new Date();
  const user = await UserModel.create({
    name: d.name, email: d.email, role: d.role, passwordHash, passwordChangedAt: now,
    preferredLanguage: req.get('accept-language')?.startsWith('en') ? 'en' : 'gu',
    consents: [
      { type: 'terms', version: POLICY_VERSION, acceptedAt: now, ip: req.ip },
      { type: 'privacy', version: POLICY_VERSION, acceptedAt: now, ip: req.ip },
    ],
  });
  await createProfile(String(user._id), d.role, d.name);
  if (env.TEST_MODE) {
    // Testing without an email service: verified straight away, straight to the dashboard.
    user.emailVerifiedAt = new Date();
    await user.save();
    const accessToken = await startSession(req, res, user, 'user');
    return ok(res, { accessToken, user: await meView(String(user._id)) }, 201);
  }
  ok(res, { otpSent: true, ticket: await startEmailVerification(user) }, 201);
}));

/** The code from the email, typed on the same page. Correct code = verified + logged in. */
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
    if (user.role !== t.pending.role) {
      await Promise.all([CreatorProfileModel.deleteOne({ userId: user._id }), BrandProfileModel.deleteOne({ userId: user._id })]);
      user.role = t.pending.role;
      await createProfile(String(user._id), t.pending.role, t.pending.name);
    }
  }
  user.emailVerifiedAt ??= new Date();
  await user.save();
  invalidateUser(String(user._id));
  // This ticket and any other open signup tabs for this account are done.
  await EmailTokenModel.updateMany({ userId: user._id, purpose: 'signup_ticket', usedAt: null }, { $set: { usedAt: new Date() } });
  const accessToken = await startSession(req, res, user, 'user');
  ok(res, { accessToken, user: await meView(String(user._id)) });
}));

authRouter.post('/signup/resend-otp', rateLimits.emailLinks, validate({ body: ticketSchema }), h(async (req, res) => {
  const t = await peekSignupTicket(input<{ ticket: string }>(req).ticket);
  const user = t ? await UserModel.findById(t.userId) : null;
  if (user && !user.emailVerifiedAt && user.status === 'active') {
    if (await recentlySent(user._id, 'verify_otp')) throw new AppError('RATE_LIMITED', 'errors.otpCooldown', undefined, 60);
    const code = await createEmailOtp(user._id);
    void sendSafely(emails.otp(user.email, code));
  }
  ok(res, { sent: true });
}));

/* ---------- Continue with Google ---------- */

const googleSchema = z.object({
  credential: z.string().min(100).max(5000),
  role: z.enum(['creator', 'brand']).optional(),
});

authRouter.post('/google', rateLimits.login, validate({ body: googleSchema }), h(async (req, res) => {
  const { credential, role } = input<{ credential: string; role?: 'creator' | 'brand' }>(req);
  const g = await verifyGoogleCredential(credential);
  if (!g.emailVerified) throw new AppError('FORBIDDEN', 'errors.googleNotVerified');
  let user = await UserModel.findOne({ $or: [{ googleId: g.sub }, { email: g.email }] });
  if (user) {
    if (user.role === 'admin') throw new AppError('UNAUTHENTICATED', 'errors.badCredentials'); // admins use the admin panel
    if (user.status !== 'active') throw new AppError('FORBIDDEN', 'errors.accountInactive');
    // Google has proven this person owns the email, so linking and verifying is safe.
    user.googleId ??= g.sub;
    user.emailVerifiedAt ??= new Date();
    await user.save();
    invalidateUser(String(user._id));
  } else {
    const now = new Date();
    user = await UserModel.create({
      name: g.name.slice(0, 60), email: g.email, googleId: g.sub, role: role ?? null, emailVerifiedAt: now,
      preferredLanguage: req.get('accept-language')?.startsWith('en') ? 'en' : 'gu',
      consents: [
        { type: 'terms', version: POLICY_VERSION, acceptedAt: now, ip: req.ip },
        { type: 'privacy', version: POLICY_VERSION, acceptedAt: now, ip: req.ip },
      ],
    });
    if (role) await createProfile(String(user._id), role, user.name);
  }
  const accessToken = await startSession(req, res, user, 'user');
  ok(res, { accessToken, user: await meView(String(user._id)) });
}));

/* ---------- login ---------- */

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

authRouter.post('/password/forgot', rateLimits.emailLinks, validate({ body: emailOnlySchema }), h(async (req, res) => {
  const user = await UserModel.findOne({ email: input<{ email: string }>(req).email });
  if (user && user.status === 'active' && !(await recentlySent(user._id, 'reset_password'))) {
    const token = await createEmailToken(user._id, 'reset_password');
    const area = user.role === 'admin' ? 'admin' : 'app';
    void sendSafely(emails.reset(user.email, user.name, emailLink('/reset-password', token, area)));
  }
  ok(res, { sent: true }); // identical whether or not the email exists
}));

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

async function setPassword(user: UserDoc, password: string) {
  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.emailVerifiedAt ??= new Date(); // the user just proved they own the email
  await user.save();
  await endAllSessions(String(user._id), 'password_changed');
  await clearLoginFailures(user.email);
  void sendSafely(emails.passwordChanged(user.email, user.name));
}

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

/** Only for older accounts created before role selection moved into signup. */
authRouter.post('/role', authenticate('app'), validate({ body: roleSelectSchema }), h(async (req, res) => {
  const { role } = input<{ role: 'creator' | 'brand' }>(req);
  const userId = req.auth!.id;
  const updated = await UserModel.findOneAndUpdate({ _id: userId, role: null }, { $set: { role } }, { new: true });
  if (!updated) throw new AppError('CONFLICT', 'errors.roleAlreadySet');
  await createProfile(userId, role, updated.name);
  invalidateUser(userId);
  ok(res, { user: await meView(userId) });
}));

/* ---------- admins: email + password, then authenticator code ---------- */

authRouter.post('/admin/login', rateLimits.login, validate({ body: adminLoginSchema }), h(async (req, res) => {
  const { email: addr, password } = input<{ email: string; password: string }>(req);
  const user = await checkCredentials(addr, password);
  if (user.role !== 'admin' || user.status !== 'active' || !user.totpEnabled) throw new AppError('UNAUTHENTICATED', 'errors.badCredentials');
  ok(res, { mfaToken: signMfaToken(String(user._id), user.tokenVersion) });
}));

authRouter.post('/admin/totp/verify', rateLimits.login, validate({ body: adminTotpSchema }), h(async (req, res) => {
  const { mfaToken, code } = input<{ mfaToken: string; code: string }>(req);
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
  await verifyTotp(String(user._id), code);
  const accessToken = await startSession(req, res, user, 'admin');
  ok(res, { accessToken, user: await meView(String(user._id)) });
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
  const { preferredLanguage } = input<{ preferredLanguage: UiLanguage }>(req);
  await UserModel.updateOne({ _id: req.auth!.id }, { $set: { preferredLanguage } });
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
  };
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
