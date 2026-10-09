/**
 * ADMIN → USERS: see every account (creators, brands, people who haven't picked a role yet, team members)
 * and fix account problems during testing.
 *
 * Who can use it: super_admin ONLY (it shows personal data such as emails and phone numbers).
 * Mounted at /api/v1/admin/users by admin.routes.ts, which already requires an admin login (password + authenticator).
 *
 *   GET  /admin/users                 list + filters (role, search)            → admin page /users
 *   GET  /admin/users/:id             everything about one account             → admin page /users/:id
 *   POST /admin/users/:id/password    set a new password for a user            → "Set new password" dialog
 *   POST /admin/users/:id/status      suspend / re-activate an account         → "Suspend" / "Re-activate" buttons
 *
 * Passwords are NEVER shown: only an argon2id hash is stored, and a hash cannot be turned back into the password.
 * That is deliberate (if the database ever leaked, nobody could read anyone's password).
 * When an admin needs to get into a test account, they set a new password here instead.
 * Every view and change here is written to the audit log.
 */
import { Router } from 'express';
import { z } from 'zod';
import { objectId, passwordProblem } from '@bluenova/shared';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { cursorPage, h, input, ok } from '../../lib/http';
import { invalidateUser } from '../../lib/userCache';
import { RefreshTokenModel } from '../../models/auth';
import { BrandProfileModel } from '../../models/brandProfile';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { UserModel } from '../../models/user';
import { endAllSessions, setPassword } from '../auth/auth.service';
import { brandAdminView, creatorAdminView } from '../serializers';

export const adminUsersRouter = Router();
adminUsersRouter.use('/users', requireAdmin('super_admin'));

const idParam = z.object({ id: objectId });
const idParams = validate({ params: idParam });

const listQuery = z.object({
  // 'none' = signed up but hasn't chosen creator/brand yet
  role: z.enum(['creator', 'brand', 'none', 'admin']).optional(),
  q: z.string().trim().max(60).optional(), // search name or email
  cursor: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Turns user-typed text into a safe "contains" search (special regex characters are escaped). */
const containsText = (q: string) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/** The account fields an admin may see. Built from an allow-list: hashes and secrets can never slip through. */
function accountView(u: {
  _id: unknown; name?: string | null; email: string; role?: string | null; adminRole?: string | null; status: string;
  emailVerifiedAt?: Date | null; passwordHash?: string | null; googleId?: string | null; preferredLanguage?: string | null;
  createdAt?: Date; lastLoginAt?: Date | null; passwordChangedAt?: Date | null;
}) {
  return {
    id: String(u._id),
    name: u.name ?? null,
    email: u.email,
    role: u.role ?? null,
    adminRole: u.adminRole ?? null,
    status: u.status,
    emailVerified: !!u.emailVerifiedAt,
    // How this person can log in (we only say WHETHER a password exists, never the password or its hash).
    signIn: { password: !!u.passwordHash, google: !!u.googleId },
    preferredLanguage: u.preferredLanguage ?? null,
    createdAt: u.createdAt ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    passwordChangedAt: u.passwordChangedAt ?? null,
  };
}

/* ---------- list ---------- */

adminUsersRouter.get('/users', validate({ query: listQuery }), h(async (req, res) => {
  const { role, q, cursor, limit } = input<z.infer<typeof listQuery>>(req, 'query');
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role === 'none' ? null : role;
  if (q) filter.$or = [{ name: containsText(q) }, { email: containsText(q) }];
  if (cursor) filter._id = { $lt: cursor }; // newest first, "load more" continues below the last one shown

  const users = await UserModel.find(filter).select('+passwordHash').sort({ _id: -1 }).limit(limit + 1).lean();
  const { page, nextCursor } = cursorPage(users, limit);

  // One query per profile type (not one per user) to add a short profile summary to each row.
  const ids = page.map((u) => u._id);
  const [creators, brands] = await Promise.all([
    CreatorProfileModel.find({ userId: { $in: ids } }, { userId: 1, displayName: 1, 'instagram.handle': 1, city: 1, status: 1, phone: 1 }).lean(),
    BrandProfileModel.find({ userId: { $in: ids } }, { userId: 1, companyName: 1, city: 1, status: 1, phone: 1 }).lean(),
  ]);
  const creatorOf = new Map(creators.map((c) => [String(c.userId), c]));
  const brandOf = new Map(brands.map((b) => [String(b.userId), b]));

  // Counts for the filter tabs.
  const [all, creatorCount, brandCount, noRole, admins] = await Promise.all([
    UserModel.countDocuments({}),
    UserModel.countDocuments({ role: 'creator' }),
    UserModel.countDocuments({ role: 'brand' }),
    UserModel.countDocuments({ role: null }),
    UserModel.countDocuments({ role: 'admin' }),
  ]);

  ok(res, page.map((u) => {
    const c = creatorOf.get(String(u._id));
    const b = brandOf.get(String(u._id));
    return {
      ...accountView(u),
      profile: c
        ? { kind: 'creator', id: String(c._id), title: c.displayName ?? null, igHandle: c.instagram?.handle ?? null, city: c.city ?? null, status: c.status, phone: c.phone ?? null }
        : b
          ? { kind: 'brand', id: String(b._id), title: b.companyName ?? null, igHandle: null, city: b.city ?? null, status: b.status, phone: b.phone ?? null }
          : null,
    };
  }), 200, { nextCursor, counts: { all, creator: creatorCount, brand: brandCount, none: noRole, admin: admins } });
}));

/* ---------- one account ---------- */

adminUsersRouter.get('/users/:id', idParams, h(async (req, res) => {
  const u = await UserModel.findById(input<{ id: string }>(req, 'params').id).select('+passwordHash').lean();
  if (!u) throw notFound();
  const [creator, brand, sessions] = await Promise.all([
    CreatorProfileModel.findOne({ userId: u._id }).select('+internalTags +internalNotes').lean(),
    BrandProfileModel.findOne({ userId: u._id }).select('+internalNotes').lean(),
    // Logged-in devices = refresh tokens that are still valid.
    RefreshTokenModel.find({ userId: u._id, revokedAt: null, expiresAt: { $gt: new Date() } }, { kind: 1, ip: 1, userAgent: 1, createdAt: 1 })
      .sort({ _id: -1 }).limit(10).lean(),
  ]);
  await audit(req, 'user.view', 'User', u._id); // reading personal data is recorded too
  ok(res, {
    ...accountView(u),
    consents: (u.consents ?? []).map((c) => ({ type: c.type, version: c.version, acceptedAt: c.acceptedAt })),
    activeSessions: sessions.map((s) => ({ kind: s.kind, ip: s.ip ?? null, device: s.userAgent ?? null, since: s.createdAt })),
    creator: creator ? creatorAdminView(creator, u) : null,
    brand: brand ? brandAdminView(brand, u) : null,
  });
}));

/* ---------- set a new password ---------- */

const setPasswordSchema = z.object({
  password: z.string().min(1).max(128),
  reason: z.string().trim().min(3, 'errors.reasonRequired').max(300),
});

adminUsersRouter.post('/users/:id/password', validate({ params: idParam, body: setPasswordSchema }), h(async (req, res) => {
  const { password, reason } = input<z.infer<typeof setPasswordSchema>>(req);
  const user = await UserModel.findById(input<{ id: string }>(req, 'params').id);
  if (!user) throw notFound();
  // Team accounts are protected by an authenticator app; they change their own password in Settings.
  if (user.role === 'admin') throw new AppError('FORBIDDEN', 'errors.adminSelfServiceOnly');
  const problem = passwordProblem(password, { email: user.email, name: user.name });
  if (problem) throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', { password: problem });
  await setPassword(user, password); // logs them out everywhere + emails them "your password was changed"
  await audit(req, 'user.password_set', 'User', user._id, { reason }); // the password itself is never logged
  ok(res, { done: true });
}));

/* ---------- suspend / re-activate ---------- */

const statusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().trim().min(3, 'errors.reasonRequired').max(300),
});

adminUsersRouter.post('/users/:id/status', validate({ params: idParam, body: statusSchema }), h(async (req, res) => {
  const { status, reason } = input<z.infer<typeof statusSchema>>(req);
  const user = await UserModel.findById(input<{ id: string }>(req, 'params').id);
  if (!user) throw notFound();
  if (user.role === 'admin') throw new AppError('FORBIDDEN', 'errors.adminSelfServiceOnly');
  if (!['active', 'suspended'].includes(user.status)) throw new AppError('INVALID_STATE');
  const from = user.status;
  user.status = status;
  await user.save();
  invalidateUser(String(user._id)); // takes effect on their very next request
  if (status === 'suspended') await endAllSessions(String(user._id)); // kick them out of every device now
  await audit(req, `user.${status === 'suspended' ? 'suspend' : 'reactivate'}`, 'User', user._id, { changes: { from, to: status }, reason });
  ok(res, { status });
}));
