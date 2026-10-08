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
  checkCredentials, clearLoginFailures, consumeEmailToken, createEmailToken, emailLink, endAllSessions, endSession,
  hashPassword, peekEmailToken, peekSignupTicket, refreshSession, startSession, verifyPassword, verifyTotp,
} from './auth.service';

export const authRouter = Router();

/** Never let an email failure reveal anything or break the flow; it is logged for the team. */
async function sendSafely(msg: Parameters<typeof email.send>[0]) {
  try {
    await email.send(msg);
  } catch (err) {
    logger.error({ reason: err instanceof Error ? err.message : String(err) }, 'email delivery failed');
    if (env.NODE_ENV === 'development' && msg.link) {
      // Never leave the developer stuck: show why it failed and the link itself.
      // eslint-disable-next-line no-console
      console.log([
        '',
        `  ⚠️  Email to ${msg.to} could NOT be sent: ${err instanceof Error ? err.message : err}`,
        `     Link (for testing):  ${msg.link}`,
        '',
      ].join('\n'));
    }
  }
}

/** At most one email of each kind per minute per account. */
async function recentlySent(userId: unknown, purpose: 'verify_email' | 'reset_password') {
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

/* ---------- signup & email verification ---------- */

authRouter.post('/signup', rateLimits.signup, validate({ body: signupSchema }), h(async (req, res) => {
  const d = input<SignupInput>(req);
  const existing = await UserModel.findOne({ email: d.email }, { _id: 1 }).lean();
  if (existing) {
    // Same response as a new signup (including a ticket that will simply never verify),
    // so nobody can test which emails are registered.
    await sendSafely(emails.alreadyRegistered(d.email, `${env.APP_BASE_URL}/login`));
    return ok(res, { sent: true, ticket: randomToken(32) }, 201);
  }
  const now = new Date();
  const user = await UserModel.create({
    name: d.name, email: d.email, role: d.role, passwordHash: await hashPassword(d.password), passwordChangedAt: now,
    preferredLanguage: req.get('accept-language')?.startsWith('en') ? 'en' : 'gu',
    consents: [
      { type: 'terms', version: POLICY_VERSION, acceptedAt: now, ip: req.ip },
      { type: 'privacy', version: POLICY_VERSION, acceptedAt: now, ip: req.ip },
    ],
  });
  await createProfile(String(user._id), d.role, d.name);
  if (env.TEST_MODE) {
    // Testing without an email service: the account is verified straight away.
    user.emailVerifiedAt = new Date();
    await user.save();
    return ok(res, { sent: true, autoVerified: true }, 201);
  }
  const token = await createEmailToken(user._id, 'verify_email');
  await sendSafely(emails.verify(d.email, d.name, emailLink('/verify-email', token)));
  // The signing-up tab keeps this ticket and uses it to continue once the email link has been clicked.
  const ticket = await createEmailToken(user._id, 'signup_ticket');
  ok(res, { sent: true, ticket }, 201);
}));

/** Clicking the email link only marks the email as verified. It does NOT log anyone in. */
authRouter.post('/verify-email', rateLimits.emailLinks, validate({ body: tokenSchema }), h(async (req, res) => {
  const userId = await consumeEmailToken(input<{ token: string }>(req).token, 'verify_email');
  const user = await UserModel.findById(userId);
  if (!user || user.status !== 'active' || user.role === 'admin') throw new AppError('VALIDATION_ERROR', 'errors.linkInvalid');
  if (!user.emailVerifiedAt) {
    user.emailVerifiedAt = new Date();
    await user.save();
    invalidateUser(userId);
  }
  ok(res, { verified: true });
}));

/** The signing-up tab asks: has my email been verified yet? */
authRouter.post('/signup/status', rateLimits.signupStatus, validate({ body: z.object({ ticket: tokenSchema.shape.token }) }), h(async (req, res) => {
  const userId = await peekSignupTicket(input<{ ticket: string }>(req).ticket);
  const user = userId ? await UserModel.findById(userId, { emailVerifiedAt: 1, status: 1 }).lean() : null;
  ok(res, { verified: Boolean(user && user.status === 'active' && user.emailVerifiedAt) });
}));

/** Once verified, the signing-up tab exchanges its ticket (once) for a session and continues. */
authRouter.post('/signup/continue', rateLimits.emailLinks, validate({ body: z.object({ ticket: tokenSchema.shape.token }) }), h(async (req, res) => {
  const { ticket } = input<{ ticket: string }>(req);
  const userId = await peekSignupTicket(ticket);
  const user = userId ? await UserModel.findById(userId) : null;
  if (!user || user.status !== 'active' || !user.emailVerifiedAt) throw new AppError('INVALID_STATE', 'errors.emailNotVerifiedYet');
  await consumeEmailToken(ticket, 'signup_ticket');
  const accessToken = await startSession(req, res, user, 'user');
  ok(res, { accessToken, user: await meView(String(user._id)) });
}));

authRouter.post('/verify-email/resend', rateLimits.emailLinks, validate({ body: emailOnlySchema }), h(async (req, res) => {
  const user = await UserModel.findOne({ email: input<{ email: string }>(req).email });
  if (user && !user.emailVerifiedAt && user.status === 'active' && user.role !== 'admin' && !(await recentlySent(user._id, 'verify_email'))) {
    const token = await createEmailToken(user._id, 'verify_email');
    await sendSafely(emails.verify(user.email, user.name, emailLink('/verify-email', token)));
  }
  ok(res, { sent: true });
}));

/* ---------- login ---------- */

authRouter.post('/login', rateLimits.login, validate({ body: loginSchema }), h(async (req, res) => {
  const { email: addr, password } = input<{ email: string; password: string }>(req);
  const user = await checkCredentials(addr, password);
  if (user.role === 'admin') throw new AppError('UNAUTHENTICATED', 'errors.badCredentials'); // admins use the admin panel
  if (user.status !== 'active') throw new AppError('FORBIDDEN', 'errors.accountInactive');
  if (!user.emailVerifiedAt) {
    if (!(await recentlySent(user._id, 'verify_email'))) {
      const token = await createEmailToken(user._id, 'verify_email');
      await sendSafely(emails.verify(user.email, user.name, emailLink('/verify-email', token)));
    }
    throw new AppError('FORBIDDEN', 'errors.emailNotVerified');
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
    await sendSafely(emails.reset(user.email, user.name, emailLink('/reset-password', token, area)));
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
  await sendSafely(emails.passwordChanged(user.email, user.name));
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
