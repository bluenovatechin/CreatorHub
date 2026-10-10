/**
 * ADMIN → EMAIL LOG (super admins): every notification email in the outbox (models/emailJob.ts) with its status,
 * tries and the provider's error, so delivery problems are visible without reading server logs.
 *   GET  /admin/emails?status=PENDING|SENDING|SENT|FAILED|SKIPPED|ALL   newest first (+ how many were sent in 24 h)
 *   POST /admin/emails/:id/retry   a FAILED email goes back to PENDING (sent within a minute). Audited.
 * The address shown is the recipient's CURRENT account email (the outbox itself stores no addresses).
 */
import { Router } from 'express';
import { z } from 'zod';
import { objectId, paginationQuery } from '@bluenova/shared';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { invalidState } from '../../lib/errors';
import { cursorPage, h, input, ok } from '../../lib/http';
import { kickEmailOutbox } from '../../jobs/emailOutbox';
import { EMAIL_JOB_STATUSES, EmailJobModel } from '../../models/emailJob';
import { UserModel } from '../../models/user';

export const adminEmailsRouter = Router();
adminEmailsRouter.use('/emails', requireAdmin('super_admin'));

adminEmailsRouter.get('/emails',
  validate({ query: paginationQuery.extend({ status: z.enum([...EMAIL_JOB_STATUSES, 'ALL']).default('ALL') }) }),
  h(async (req, res) => {
    const { status, cursor, limit } = input<{ status: string; cursor?: string; limit: number }>(req, 'query');
    const filter: Record<string, unknown> = status === 'ALL' ? {} : { status };
    if (cursor) filter._id = { $lt: cursor };
    const items = await EmailJobModel.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
    const { page, nextCursor } = cursorPage(items, limit);
    const users = await UserModel.find({ _id: { $in: page.map((j) => j.userId) } }, { email: 1, name: 1 }).lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    const sent24h = await EmailJobModel.countDocuments({ status: 'SENT', sentAt: { $gt: new Date(Date.now() - 86_400_000) } });
    ok(res, page.map((j) => ({
      id: String(j._id), type: j.type, status: j.status, attempts: j.attempts, lastError: j.lastError ?? null,
      nextAttemptAt: j.nextAttemptAt, sentAt: j.sentAt ?? null, createdAt: j.createdAt,
      to: byId.get(String(j.userId))?.email ?? null, name: byId.get(String(j.userId))?.name ?? null,
    })), 200, { nextCursor, sent24h, dailyLimit: env.EMAIL_DAILY_LIMIT, provider: env.EMAIL_PROVIDER });
  }),
);

adminEmailsRouter.post('/emails/:id/retry', validate({ params: z.object({ id: objectId }) }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const r = await EmailJobModel.updateOne({ _id: id, status: 'FAILED' }, { $set: { status: 'PENDING', nextAttemptAt: new Date(), attempts: 0 } });
  if (r.modifiedCount !== 1) throw invalidState();
  await audit(req, 'email.retry', 'EmailJob', id);
  kickEmailOutbox();
  ok(res, { retried: true });
}));
