/**
 * ADMIN → INBOX: the team side of every conversation with creators and brands.
 * Mounted at /api/v1/admin by admin.routes.ts (admin login required). Reviewers, campaign managers and finance.
 *
 *   GET  /admin/conversations?status=WAITING|OPEN|CLOSED|ALL   the inbox (WAITING = has unread messages for the team)
 *   POST /admin/conversations                    { userId, subject, body } the team starts a conversation with a user
 *   GET  /admin/conversations/:id/messages       read a conversation (marks it read; audited: it's personal data)
 *   POST /admin/conversations/:id/messages       { body } reply as "Bluenova team"
 *   POST /admin/conversations/:id/status         { status: OPEN | CLOSED }
 */
import { Router } from 'express';
import { z } from 'zod';
import { adminConversationCreateSchema, conversationMachine, conversationStatusSchema, messageBodySchema, objectId } from '@bluenova/shared';
import { requireAdmin } from '../../middleware/auth';
import { rateLimits } from '../../middleware/security';
import { validate } from '../../middleware/validate';
import { audit, auditView } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { h, input, ok, withTransaction } from '../../lib/http';
import { applyTransition } from '../../lib/transition';
import { ConversationModel, MessageModel } from '../../models/conversation';
import { UserModel } from '../../models/user';
import { addMessage, conversationView, markRead, messageView } from '../messages/messages.service';

export const adminMessagesRouter = Router();
const team = requireAdmin('reviewer', 'campaign_manager', 'finance');
const idParams = z.object({ id: objectId });

adminMessagesRouter.get('/conversations', team,
  validate({ query: z.object({ status: z.enum(['WAITING', 'OPEN', 'CLOSED', 'ALL']).default('WAITING'), cursor: objectId.optional() }) }),
  h(async (req, res) => {
    const { status, cursor } = input<{ status: string; cursor?: string }>(req, 'query');
    const filter: Record<string, unknown> =
      status === 'WAITING' ? { unreadByTeam: { $gt: 0 } } : status === 'ALL' ? {} : { status };
    if (cursor) filter._id = { $lt: cursor };
    const list = await ConversationModel.find(filter).sort({ lastMessageAt: -1 }).limit(100).lean();
    const owners = await UserModel.find({ _id: { $in: list.map((c) => c.ownerUserId) } }, { name: 1 }).lean();
    const names = new Map(owners.map((u) => [String(u._id), u.name ?? null]));
    ok(res, list.map((c) => ({ ...conversationView(c, 'team'), ownerName: names.get(String(c.ownerUserId)) ?? null })));
  }),
);

adminMessagesRouter.post('/conversations', team, rateLimits.messages, validate({ body: adminConversationCreateSchema }), h(async (req, res) => {
  const d = input<{ userId: string; subject: string; body: string }>(req);
  const owner = await UserModel.findById(d.userId, { role: 1, status: 1 }).lean();
  if (!owner || (owner.role !== 'creator' && owner.role !== 'brand')) throw new AppError('VALIDATION_ERROR', 'errors.notAWebsiteAccount');
  const conv = await withTransaction(async (session) => {
    const [c] = await ConversationModel.create([{
      ownerUserId: owner._id, ownerRole: owner.role, subject: d.subject, lastMessageAt: new Date(),
      statusHistory: [{ to: 'OPEN', by: req.auth!.id, at: new Date() }],
    }], { session });
    await addMessage(c, 'team', req.auth!.id, d.body, req.auth!.adminRole!, session);
    return c;
  });
  await audit(req, 'conversation.start', 'Conversation', conv._id, { changes: { userId: d.userId } });
  ok(res, conversationView(conv.toObject(), 'team'), 201);
}));

adminMessagesRouter.get('/conversations/:id/messages', team, validate({ params: idParams, query: z.object({ cursor: objectId.optional() }) }), h(async (req, res) => {
  const conv = await ConversationModel.findById(input<{ id: string }>(req, 'params').id).lean();
  if (!conv) throw notFound();
  const { cursor } = input<{ cursor?: string }>(req, 'query');
  const items = await MessageModel.find({ conversationId: conv._id, ...(cursor ? { _id: { $lt: cursor } } : {}) }).sort({ _id: -1 }).limit(101).lean();
  const page = items.slice(0, 100);
  const people = await UserModel.find({ _id: { $in: [conv.ownerUserId, ...page.map((m) => m.senderId)] } }, { name: 1 }).lean();
  const names = new Map(people.map((u) => [String(u._id), u.name ?? null]));
  await markRead(conv._id, 'team');
  await auditView(req, 'conversation.view', 'Conversation', conv._id);
  ok(res, {
    conversation: { ...conversationView({ ...conv, unreadByTeam: 0 }, 'team'), ownerName: names.get(String(conv.ownerUserId)) ?? null },
    messages: page.reverse().map((m) => messageView(m, 'team', names)),
  }, 200, { nextCursor: items.length > 100 ? String(page[0]._id) : null });
}));

adminMessagesRouter.post('/conversations/:id/messages', team, rateLimits.messages, validate({ params: idParams, body: messageBodySchema }), h(async (req, res) => {
  const message = await withTransaction(async (session) => {
    const conv = await ConversationModel.findById(input<{ id: string }>(req, 'params').id).session(session);
    if (!conv) throw notFound();
    const m = await addMessage(conv, 'team', req.auth!.id, input<{ body: string }>(req).body, req.auth!.adminRole!, session);
    conv.unreadByTeam = 0; // replying means the team has read it
    await conv.save({ session });
    return m;
  });
  ok(res, messageView(message.toObject(), 'team', new Map([[req.auth!.id, null]])), 201);
}));

adminMessagesRouter.post('/conversations/:id/status', team, validate({ params: idParams, body: conversationStatusSchema }), h(async (req, res) => {
  const conv = await ConversationModel.findById(input<{ id: string }>(req, 'params').id);
  if (!conv) throw notFound();
  const { status } = input<{ status: 'OPEN' | 'CLOSED' }>(req);
  applyTransition(conv, conversationMachine, status, req.auth!.adminRole!, req.auth!.id);
  if (status === 'CLOSED') conv.unreadByTeam = 0;
  await conv.save();
  await audit(req, `conversation.${status.toLowerCase()}`, 'Conversation', conv._id);
  ok(res, conversationView(conv.toObject(), 'team'));
}));
