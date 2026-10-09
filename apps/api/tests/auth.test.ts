/**
 * TESTS: accounts & security — signup validation, email codes, Google, login lockout, password reset,
 * sessions, role separation, admin login, audit log, admin → users.
 */
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { authenticator } from 'otplib';
import { RefreshTokenModel } from '../src/models/auth';
import { AuditLogModel } from '../src/models/system';
import { UserModel } from '../src/models/user';
import { verifyTotp } from '../src/modules/auth/auth.service';
import { consoleEmail } from '../src/providers/email';
import { setGoogleVerifierForTests } from '../src/providers/google';
import { ADMIN_ORIGIN, ORIGIN, PASSWORD, app, bearer, lastEmailCode, lastEmailToken, loginAdmin, nextEmail, signup, useDatabase } from './helpers';

useDatabase('auth_tests');

const cookieOf = (res: request.Response, name: string) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`));
const signupBody = (email: string, extra: Record<string, unknown> = {}) =>
  ({ name: 'Riya Shah', email, password: PASSWORD, confirmPassword: PASSWORD, acceptTerms: true, ...extra });

describe('signup and email verification', () => {
  it('validates every field', async () => {
    const email = nextEmail();
    const bad = async (extra: Record<string, unknown>) => {
      const r = await request(app).post('/api/v1/auth/signup').send(signupBody(email, extra));
      expect(r.status).toBe(400);
      return r.body.error.fields;
    };
    expect(await bad({ email: 'not-an-email' })).toHaveProperty('email');
    expect(await bad({ email: 'x@mailinator.com' })).toHaveProperty('email', 'errors.emailDisposable');
    expect(await bad({ name: 'test' })).toHaveProperty('name', 'errors.nameFake');
    expect(await bad({ password: 'short1', confirmPassword: 'short1' })).toHaveProperty('password', 'errors.passwordShort');
    expect(await bad({ password: 'password123', confirmPassword: 'password123' })).toHaveProperty('password', 'errors.passwordCommon');
    expect(await bad({ confirmPassword: 'Different-Pass-9' })).toHaveProperty('confirmPassword', 'errors.passwordMismatch');
    expect(await bad({ acceptTerms: false })).toHaveProperty('acceptTerms');
  });

  it('verifies the email with a 6-digit code on the same page, then goes straight in', async () => {
    const email = nextEmail();
    const s = await request(app).post('/api/v1/auth/signup').send(signupBody(email)).expect(201);
    expect(s.body.data.otpSent).toBe(true);
    const user = await UserModel.findOne({ email }).select('+passwordHash').lean();
    expect(user!.passwordHash).toMatch(/^\$argon2id\$/); // never stored in plain text
    expect(user!.emailVerifiedAt).toBeFalsy();
    const code = lastEmailCode(email);
    expect(code).toMatch(/^\d{6}$/);
    const wrong = code === '000000' ? '111111' : '000000';
    const bad = await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket: s.body.data.ticket, code: wrong }).expect(400);
    expect(bad.body.error.message).toBe('errors.otpInvalid');
    const ok = await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket: s.body.data.ticket, code }).expect(200);
    expect(ok.body.data.user.role).toBeNull(); // the frontend now shows "creator or brand?"
    const chosen = await request(app).post('/api/v1/auth/role').set(bearer(ok.body.data.accessToken)).send({ role: 'creator' }).expect(200);
    expect(chosen.body.data.user.role).toBe('creator');
    // The choice is one-time: nobody can switch themselves to another role later.
    await request(app).post('/api/v1/auth/role').set(bearer(ok.body.data.accessToken)).send({ role: 'brand' }).expect(409);
    await request(app).get('/api/v1/me').set(bearer(ok.body.data.accessToken)).expect(200);
    expect((await UserModel.findOne({ email }).lean())!.emailVerifiedAt).toBeTruthy(); // stored as verified
    // Code and ticket are single use.
    await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket: s.body.data.ticket, code }).expect(400);
    // From now on it's a normal login, no code needed.
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
    expect(login.body.data.accessToken).toBeTruthy();
  });

  it('locks a code after 5 wrong tries, rate-limits resends, and a new code works', async () => {
    const email = nextEmail();
    const s = await request(app).post('/api/v1/auth/signup').send(signupBody(email)).expect(201);
    const ticket = s.body.data.ticket as string;
    const code = lastEmailCode(email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket, code: wrong }).expect(400);
    const locked = await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket, code }).expect(400);
    expect(locked.body.error.message).toBe('errors.otpTooMany');
    await request(app).post('/api/v1/auth/signup/resend-otp').send({ ticket }).expect(429); // within a minute
    const { EmailTokenModel } = await import('../src/models/auth');
    await EmailTokenModel.collection.updateMany({ purpose: 'verify_otp' }, { $set: { createdAt: new Date(Date.now() - 120_000) } });
    await request(app).post('/api/v1/auth/signup/resend-otp').send({ ticket }).expect(200);
    const fresh = lastEmailCode(email);
    await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket, code: fresh }).expect(200);
  });

  it('a second tab (login before verifying) does not break the signup tab', async () => {
    const email = nextEmail();
    const s = await request(app).post('/api/v1/auth/signup').send(signupBody(email)).expect(201);
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
    expect(login.body.data.needsVerification).toBe(true);
    // Within a minute no second email: the first code is still the one to type, in either tab.
    await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket: s.body.data.ticket, code: lastEmailCode(email) }).expect(200);
    // Once verified, the other tab's ticket is closed.
    await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket: login.body.data.ticket, code: lastEmailCode(email) }).expect(400);
  });

  it('ignores a role (or any other extra field) sent with signup: nobody can make themselves an admin', async () => {
    const email = nextEmail();
    const s = await request(app).post('/api/v1/auth/signup').send(signupBody(email, { role: 'admin', adminRole: 'super_admin' })).expect(201);
    const ok = await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket: s.body.data.ticket, code: lastEmailCode(email) }).expect(200);
    expect(ok.body.data.user.role).toBeNull();
    expect(ok.body.data.user.adminRole).toBeNull();
    await request(app).post('/api/v1/auth/role').set(bearer(ok.body.data.accessToken)).send({ role: 'admin' }).expect(400);
  });

  it('signing up again before verifying sends a fresh code, and the new details apply only after the code', async () => {
    const email = nextEmail();
    await request(app).post('/api/v1/auth/signup').send(signupBody(email)).expect(201);
    const { EmailTokenModel } = await import('../src/models/auth');
    await EmailTokenModel.collection.updateMany({ purpose: 'verify_otp' }, { $set: { createdAt: new Date(Date.now() - 120_000) } });
    const NEW_PASSWORD = 'Monsoon-Vadodara-42';
    const again = await request(app).post('/api/v1/auth/signup')
      .send(signupBody(email, { name: 'Asha Patel', password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })).expect(201);
    // Not applied yet: the first password still applies (and the account still needs verifying).
    await request(app).post('/api/v1/auth/login').send({ email, password: NEW_PASSWORD }).expect(401);
    const ok = await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket: again.body.data.ticket, code: lastEmailCode(email) }).expect(200);
    expect(ok.body.data.user.name).toBe('Asha Patel');
    await request(app).post('/api/v1/auth/login').send({ email, password: NEW_PASSWORD }).expect(200);
    await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(401);
  });

  it('an unverified account that logs in gets a code on the login page', async () => {
    const email = nextEmail();
    await request(app).post('/api/v1/auth/signup').send(signupBody(email)).expect(201);
    const { EmailTokenModel } = await import('../src/models/auth');
    await EmailTokenModel.collection.updateMany({ purpose: 'verify_otp' }, { $set: { createdAt: new Date(Date.now() - 120_000) } });
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
    expect(login.body.data.needsVerification).toBe(true);
    expect(login.body.data.accessToken).toBeUndefined(); // no session until the code is entered
    await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket: login.body.data.ticket, code: lastEmailCode(email) }).expect(200);
  });

  it('does not reveal whether an email is already registered', async () => {
    const { email } = await signup('creator');
    const fresh = await request(app).post('/api/v1/auth/signup').send(signupBody(nextEmail()));
    const r = await request(app).post('/api/v1/auth/signup').send(signupBody(email));
    expect(r.status).toBe(fresh.status);
    expect(Object.keys(r.body.data).sort()).toEqual(Object.keys(fresh.body.data).sort());
    expect(consoleEmail.sent.at(-1)!.subject).toMatch(/already have/); // the real owner gets a heads-up, not a code
    // The ticket handed out for an existing email can never be used.
    await request(app).post('/api/v1/auth/signup/verify-otp').send({ ticket: r.body.data.ticket, code: '123456' }).expect(400);
  });
});

describe('continue with Google', () => {
  const nonce = 'n'.repeat(32);
  const fakeGoogle = (identity: { sub: string; email: string; emailVerified?: boolean; name?: string }) =>
    setGoogleVerifierForTests(async () => ({ name: 'Google User', emailVerified: true, nonce, ...identity }));
  const credential = 'g'.repeat(200);
  afterEach(() => setGoogleVerifierForTests(null));

  it('creates a verified account, signs in, and the role is chosen on the next screen', async () => {
    const email = nextEmail();
    fakeGoogle({ sub: 'google-1', email, name: 'Meera Joshi' });
    const r = await request(app).post('/api/v1/auth/google').send({ credential, nonce }).expect(200);
    expect(r.body.data.user.role).toBeNull();
    await request(app).post('/api/v1/auth/role').set(bearer(r.body.data.accessToken)).send({ role: 'brand' }).expect(200);
    const u = await UserModel.findOne({ email }).lean();
    expect(u!.emailVerifiedAt).toBeTruthy();
    expect(u!.googleId).toBe('google-1');
    // Signing in again finds the same account.
    const again = await request(app).post('/api/v1/auth/google').send({ credential, nonce }).expect(200);
    expect(again.body.data.user.id).toBe(r.body.data.user.id);
    expect(again.body.data.user.role).toBe('brand');
  });

  it('links Google to an existing email account, and rejects unverified Google emails and admins', async () => {
    const { email } = await signup('creator');
    fakeGoogle({ sub: 'google-2', email });
    const r = await request(app).post('/api/v1/auth/google').send({ credential, nonce }).expect(200);
    expect(r.body.data.user.role).toBe('creator');
    fakeGoogle({ sub: 'google-3', email: nextEmail(), emailVerified: false });
    await request(app).post('/api/v1/auth/google').send({ credential, nonce }).expect(403);
    const admin = await loginAdmin('reviewer');
    fakeGoogle({ sub: 'google-4', email: admin.email });
    const team = await request(app).post('/api/v1/auth/google').send({ credential, nonce }).expect(403);
    expect(team.body.error.message).toBe('errors.googleTeamAccount');
  });

  it('refuses a token whose nonce does not match (replayed or injected token)', async () => {
    fakeGoogle({ sub: 'google-6', email: nextEmail() });
    await request(app).post('/api/v1/auth/google').send({ credential, nonce: 'x'.repeat(32) }).expect(401);
    await request(app).post('/api/v1/auth/google').send({ credential }).expect(400); // nonce is required
  });

  it('a new Google user without a role is sent to choose one', async () => {
    fakeGoogle({ sub: 'google-5', email: nextEmail() });
    const r = await request(app).post('/api/v1/auth/google').send({ credential, nonce }).expect(200);
    expect(r.body.data.user.role).toBeNull();
  });
});

describe('login', () => {
  it('gives the same error for unknown emails and wrong passwords, and sets a strict httpOnly cookie on success', async () => {
    const { email } = await signup('brand');
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: nextEmail(), password: PASSWORD });
    const wrong = await request(app).post('/api/v1/auth/login').send({ email, password: 'Wrong-Pass-99' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
    const ok = await request(app).post('/api/v1/auth/login').send({ email: email.toUpperCase(), password: PASSWORD }).expect(200);
    const cookie = cookieOf(ok, 'bn_rt')!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(JSON.stringify(ok.body)).not.toContain('passwordHash');
  });

  it('locks an email after 5 failed attempts, even with the right password', async () => {
    const { email } = await signup('creator');
    for (let i = 0; i < 5; i++) await request(app).post('/api/v1/auth/login').send({ email, password: 'Wrong-Pass-99' }).expect(401);
    const r = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(r.status).toBe(429);
    expect(r.body.error.message).toBe('errors.loginLocked');
  });

  it('admins cannot log in on the creator/brand site', async () => {
    const admin = await loginAdmin('reviewer');
    await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: PASSWORD }).expect(401);
  });
});

describe('forgot and reset password', () => {
  it('answers identically for unknown emails and resets with a single-use link that logs out every device', async () => {
    const { email, token } = await signup('creator');
    const unknown = await request(app).post('/api/v1/auth/password/forgot').send({ email: nextEmail() });
    const known = await request(app).post('/api/v1/auth/password/forgot').send({ email });
    expect(unknown.body).toEqual(known.body);
    const link = lastEmailToken(email);
    await request(app).post('/api/v1/auth/password/reset')
      .send({ token: link, password: 'password123', confirmPassword: 'password123' }).expect(400); // weak password rejected
    await request(app).post('/api/v1/auth/password/reset')
      .send({ token: link, password: 'New-Monsoon-77', confirmPassword: 'New-Monsoon-77' }).expect(200);
    const reused = await request(app).post('/api/v1/auth/password/reset')
      .send({ token: link, password: 'Another-Pass-77', confirmPassword: 'Another-Pass-77' }).expect(400); // single use
    expect(reused.body.error.message).toBe('errors.linkUsed');
    await request(app).get('/api/v1/me').set(bearer(token)).expect(401); // old session ended
    await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email, password: 'New-Monsoon-77' }).expect(200);
  });

  it('a rejected new password does not use up the reset link (bug fix)', async () => {
    const { email } = await signup('creator', 'Neha Patel');
    await request(app).post('/api/v1/auth/password/forgot').send({ email }).expect(200);
    const link = lastEmailToken(email);
    // Contains the user's name: rejected by the server-side personal-info check…
    const r1 = await request(app).post('/api/v1/auth/password/reset').send({ token: link, password: 'Neha-Monsoon-77', confirmPassword: 'Neha-Monsoon-77' }).expect(400);
    expect(r1.body.error.fields.password).toBe('errors.passwordPersonal');
    // …but the same link still works for a good password.
    await request(app).post('/api/v1/auth/password/reset').send({ token: link, password: 'Fresh-Monsoon-77', confirmPassword: 'Fresh-Monsoon-77' }).expect(200);
    await request(app).post('/api/v1/auth/login').send({ email, password: 'Fresh-Monsoon-77' }).expect(200);
  });

  it('explains when an older reset link was replaced by a newer email', async () => {
    const { email } = await signup('brand');
    await request(app).post('/api/v1/auth/password/forgot').send({ email }).expect(200);
    const older = lastEmailToken(email);
    const { EmailTokenModel } = await import('../src/models/auth');
    await EmailTokenModel.collection.updateMany({ purpose: 'reset_password' }, { $set: { createdAt: new Date(Date.now() - 120_000) } }); // past the 1-minute resend limit
    await request(app).post('/api/v1/auth/password/forgot').send({ email }).expect(200);
    const r = await request(app).post('/api/v1/auth/password/reset').send({ token: older, password: 'Fresh-Monsoon-77', confirmPassword: 'Fresh-Monsoon-77' }).expect(400);
    expect(r.body.error.message).toBe('errors.linkUsed');
    await request(app).post('/api/v1/auth/password/reset').send({ token: lastEmailToken(email), password: 'Fresh-Monsoon-77', confirmPassword: 'Fresh-Monsoon-77' }).expect(200);
  });

  it('change password requires the current password', async () => {
    const { token } = await signup('brand');
    await request(app).post('/api/v1/auth/password/change').set(bearer(token))
      .send({ currentPassword: 'Wrong-Pass-99', password: 'Fresh-Start-55', confirmPassword: 'Fresh-Start-55' }).expect(400);
    const r = await request(app).post('/api/v1/auth/password/change').set(bearer(token))
      .send({ currentPassword: PASSWORD, password: 'Fresh-Start-55', confirmPassword: 'Fresh-Start-55' }).expect(200);
    await request(app).get('/api/v1/me').set(bearer(token)).expect(401); // old token revoked
    await request(app).get('/api/v1/me').set(bearer(r.body.data.accessToken)).expect(200); // new session works
  });
});

describe('sessions', () => {
  it('requires an allowed Origin on refresh (CSRF defence)', async () => {
    const { agent } = await signup('creator');
    await agent.post('/api/v1/auth/refresh').expect(403);
    await agent.post('/api/v1/auth/refresh').set('Origin', 'https://evil.example').expect(403);
    await agent.post('/api/v1/auth/refresh').set('Origin', ORIGIN).expect(200);
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const { agent } = await signup('creator');
    const first = await agent.post('/api/v1/auth/refresh').set('Origin', ORIGIN).expect(200);
    const oldCookie = cookieOf(first, 'bn_rt')!.split(';')[0];
    await agent.post('/api/v1/auth/refresh').set('Origin', ORIGIN).expect(200);
    await RefreshTokenModel.updateMany({ revokedAt: { $ne: null } }, { $set: { revokedAt: new Date(Date.now() - 60_000) } });
    await request(app).post('/api/v1/auth/refresh').set('Origin', ORIGIN).set('Cookie', oldCookie).expect(401);
    await agent.post('/api/v1/auth/refresh').set('Origin', ORIGIN).expect(401);
  });

  it('a logged-out refresh token can never be reused, even within the grace window', async () => {
    const { agent } = await signup('brand');
    const r = await agent.post('/api/v1/auth/refresh').set('Origin', ORIGIN).expect(200);
    const cookie = cookieOf(r, 'bn_rt')!.split(';')[0];
    await agent.post('/api/v1/auth/logout').set('Origin', ORIGIN).expect(200);
    await request(app).post('/api/v1/auth/refresh').set('Origin', ORIGIN).set('Cookie', cookie).expect(401);
  });

  it('logout-all invalidates existing access tokens immediately', async () => {
    const { token } = await signup('creator');
    await request(app).get('/api/v1/me').set(bearer(token)).expect(200);
    await request(app).post('/api/v1/auth/logout-all').set(bearer(token)).expect(200);
    await request(app).get('/api/v1/me').set(bearer(token)).expect(401);
  });

  it('rejects missing, malformed and forged tokens', async () => {
    await request(app).get('/api/v1/me').expect(401);
    await request(app).get('/api/v1/me').set('Authorization', 'Bearer not.a.jwt').expect(401);
    const forged = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjMiLCJ0diI6MCwidHlwIjoiYWNjZXNzIn0.';
    await request(app).get('/api/v1/me').set('Authorization', `Bearer ${forged}`).expect(401);
  });
});

describe('roles', () => {
  it('keeps creators, brands and admins in their own areas', async () => {
    const creator = await signup('creator');
    const brand = await signup('brand');
    await request(app).get('/api/v1/brands/me').set(bearer(creator.token)).expect(403);
    await request(app).get('/api/v1/creators/me').set(bearer(brand.token)).expect(403);
    await request(app).get('/api/v1/admin/dashboard').set(bearer(creator.token)).expect(401);
    const admin = await loginAdmin('reviewer');
    await request(app).get('/api/v1/creators/me').set(bearer(admin.token)).expect(401);
    await request(app).get('/api/v1/admin/campaigns').set(bearer(admin.token)).expect(403);
    await request(app).get('/api/v1/admin/audit-logs').set(bearer(admin.token)).expect(403);
  });
});

describe('admin login', () => {
  it('requires password then a one-time authenticator code', async () => {
    const admin = await loginAdmin('super_admin');
    await request(app).get('/api/v1/admin/dashboard').set(bearer(admin.token)).expect(200);
    const user = await UserModel.findOne({ email: admin.email });
    await expect(verifyTotp(String(user!._id), authenticator.generate(admin.secret))).rejects.toThrow(); // replay blocked
  });

  it('rejects creators on the admin login and wrong authenticator codes', async () => {
    const { email } = await signup('creator');
    await request(app).post('/api/v1/auth/admin/login').send({ email, password: PASSWORD }).expect(401);
    const admin = await loginAdmin('finance');
    const r1 = await request(app).post('/api/v1/auth/admin/login').send({ email: admin.email, password: PASSWORD }).expect(200);
    const good = authenticator.generate(admin.secret);
    await request(app).post('/api/v1/auth/admin/totp/verify').set('Origin', ADMIN_ORIGIN)
      .send({ mfaToken: r1.body.data.mfaToken, code: good === '123456' ? '654321' : '123456' }).expect(400);
  });
});

describe('audit log', () => {
  it('is append-only', async () => {
    const entry = await AuditLogModel.create({ action: 'test', entityType: 'Test' });
    await expect(AuditLogModel.updateOne({ _id: entry._id }, { $set: { action: 'changed' } })).rejects.toThrow(/append-only/);
    await expect(AuditLogModel.deleteOne({ _id: entry._id })).rejects.toThrow(/append-only/);
  });
});

describe('admin → users', () => {
  it('lets a super admin see every account (never a password or hash), set a new password and suspend', async () => {
    const creator = await signup('creator');
    const admin = await loginAdmin('super_admin');
    const list = await request(app).get('/api/v1/admin/users?role=creator').set(bearer(admin.token)).expect(200);
    const row = list.body.data.find((u: { email: string }) => u.email === creator.email);
    expect(row.role).toBe('creator');
    expect(row.signIn).toEqual({ password: true, google: false });
    expect(JSON.stringify(list.body)).not.toMatch(/argon2|passwordHash/);
    expect(list.body.meta.counts.creator).toBeGreaterThan(0);

    const detail = await request(app).get(`/api/v1/admin/users/${row.id}`).set(bearer(admin.token)).expect(200);
    expect(detail.body.data.creator).toBeTruthy();
    expect(JSON.stringify(detail.body)).not.toMatch(/argon2|passwordHash|totpSecret/);

    // Set a new password: the user is logged out everywhere and can log in with the new one.
    const NEW = 'Kite-Festival-Rajkot-14';
    await request(app).post(`/api/v1/admin/users/${row.id}/password`).set(bearer(admin.token)).send({ password: NEW, reason: 'testing' }).expect(200);
    await request(app).get('/api/v1/me').set(bearer(creator.token)).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: creator.email, password: NEW }).expect(200);
    expect(consoleEmail.sent.at(-1)!.to).toBe(creator.email); // "your password was changed" heads-up

    // Suspend: login refused; re-activate: works again. Every change is in the audit log.
    await request(app).post(`/api/v1/admin/users/${row.id}/status`).set(bearer(admin.token)).send({ status: 'suspended', reason: 'testing' }).expect(200);
    await request(app).post('/api/v1/auth/login').send({ email: creator.email, password: NEW }).expect(403);
    await request(app).post(`/api/v1/admin/users/${row.id}/status`).set(bearer(admin.token)).send({ status: 'active', reason: 'testing' }).expect(200);
    await request(app).post('/api/v1/auth/login').send({ email: creator.email, password: NEW }).expect(200);
    const actions = (await AuditLogModel.find({ entityId: row.id }).lean()).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['user.view', 'user.password_set', 'user.suspend', 'user.reactivate']));
  });

  it('is for super admins only, and cannot touch team accounts', async () => {
    const reviewer = await loginAdmin('reviewer');
    await request(app).get('/api/v1/admin/users').set(bearer(reviewer.token)).expect(403);
    const creator = await signup('creator');
    await request(app).get('/api/v1/admin/users').set(bearer(creator.token)).expect(401);
    const admin = await loginAdmin('super_admin');
    const team = await UserModel.findOne({ email: reviewer.email }).lean();
    await request(app).post(`/api/v1/admin/users/${team!._id}/password`).set(bearer(admin.token)).send({ password: 'Kite-Festival-Rajkot-14', reason: 'x-test' }).expect(403);
  });
});
