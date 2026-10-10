/**
 * ADMIN → MY SECURITY: each team member manages their OWN two-step login (any admin role, own account only).
 * Mounted at /api/v1/admin/security by admin.routes.ts, which already requires an admin login.
 *
 *   GET  /admin/security                    authenticator on? how many recovery codes are left?   → Settings → Security
 *   POST /admin/security/recovery-codes     { currentPassword } → 10 new codes, shown ONCE (old codes stop working)
 *   POST /admin/security/totp/start         { currentPassword } → a new authenticator key for a new phone
 *   POST /admin/security/totp/confirm       { code } → the first code from the new phone switches over;
 *                                           other devices are logged out and this one gets a fresh session
 *
 * Changes ask for the current password again, so an unlocked, unattended laptop isn't enough to take over 2FA.
 * Every change is audited and emailed to the admin. Codes and keys are never logged or stored in plain text.
 */
import { Router, type Request } from 'express';
import { authenticator } from 'otplib';
import { confirmPasswordSchema, totpConfirmSchema } from '@bluenova/shared';
import { validate } from '../../middleware/validate';
import { rateLimits } from '../../middleware/security';
import { audit } from '../../lib/audit';
import { decrypt, encrypt, type EncryptedValue } from '../../lib/crypto';
import { AppError, notFound } from '../../lib/errors';
import { h, input, ok } from '../../lib/http';
import { UserModel } from '../../models/user';
import { emails, sendInBackground } from '../../providers/email';
import { endAllSessions, newRecoveryCodes, recoveryCodesLeft, startSession, verifyPassword } from '../auth/auth.service';

export const adminSecurityRouter = Router();

/** Loads the signed-in admin and checks the password they just typed. */
async function confirmPassword(req: Request) {
  const user = await UserModel.findById(req.auth!.id).select('+passwordHash');
  if (!user) throw notFound();
  if (!(await verifyPassword(user.passwordHash, input<{ currentPassword: string }>(req).currentPassword))) {
    throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', { currentPassword: 'errors.currentPasswordWrong' });
  }
  return user;
}

adminSecurityRouter.get('/security', h(async (req, res) => {
  const user = await UserModel.findById(req.auth!.id, { totpEnabled: 1 }).lean();
  if (!user) throw notFound();
  ok(res, { totpEnabled: user.totpEnabled, recoveryCodesLeft: await recoveryCodesLeft(req.auth!.id) });
}));

adminSecurityRouter.post('/security/recovery-codes', rateLimits.login, validate({ body: confirmPasswordSchema }), h(async (req, res) => {
  const user = await confirmPassword(req);
  const codes = await newRecoveryCodes(String(user._id));
  await audit(req, 'admin.recovery_codes_created', 'User', user._id);
  sendInBackground(emails.adminSecurityChanged(user.email, user.name, 'recovery_codes'));
  ok(res, { codes });
}));

adminSecurityRouter.post('/security/totp/start', rateLimits.login, validate({ body: confirmPasswordSchema }), h(async (req, res) => {
  const user = await confirmPassword(req);
  const secret = authenticator.generateSecret(20);
  await UserModel.updateOne({ _id: user._id }, { $set: { pendingTotpSecret: encrypt(secret) } });
  // The current authenticator keeps working until the new one is confirmed with a correct code.
  ok(res, { secret, otpauthUrl: authenticator.keyuri(user.email, 'Bluenova Admin', secret) });
}));

adminSecurityRouter.post('/security/totp/confirm', rateLimits.login, validate({ body: totpConfirmSchema }), h(async (req, res) => {
  const user = await UserModel.findById(req.auth!.id).select('+pendingTotpSecret');
  if (!user?.pendingTotpSecret) throw new AppError('INVALID_STATE', 'errors.totpSetupMissing');
  const secret = decrypt(user.pendingTotpSecret as unknown as EncryptedValue);
  const delta = authenticator.checkDelta(input<{ code: string }>(req).code, secret);
  if (delta === null) throw new AppError('INVALID_OTP', 'errors.invalidOtp');
  await UserModel.updateOne({ _id: user._id }, {
    // The confirming code counts as used, so it can't be replayed at the login screen.
    $set: { totpSecret: user.pendingTotpSecret, totpEnabled: true, totpLastStep: Math.floor(Date.now() / 30_000) + delta },
    $unset: { pendingTotpSecret: 1 },
  });
  await endAllSessions(String(user._id), 'password_changed');
  const fresh = (await UserModel.findById(user._id))!;
  const accessToken = await startSession(req, res, fresh, 'admin');
  await audit(req, 'admin.authenticator_changed', 'User', user._id);
  sendInBackground(emails.adminSecurityChanged(user.email, user.name, 'authenticator'));
  ok(res, { accessToken });
}));
