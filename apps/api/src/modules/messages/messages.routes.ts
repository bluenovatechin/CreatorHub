/**
 * MESSAGES (website): a signed-in creator or brand talks to the Bluenova team. Mounted at /api/v1/conversations
 * by app.ts (creator/brand login required). Every query is limited to the signed-in user's own conversations.
 *
 *   GET  /conversations                    my conversations (newest activity first)
 *   POST /conversations                    { subject, body, topic? } start one (topic = one of MY campaigns/deals)
 *   GET  /conversations/:id/messages       the messages (newest 50, or older with ?cursor=); marks them read
 *   POST /conversations/:id/messages       { body } send a message (re-opens a closed conversation)
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { conversationCreateSchema, messageBodySchema, objectId } from '@bluenova/shared';
import { validate } from '../../middleware/validate';
import { rateLimits } from '../../middleware/security';
import { notFound } from '../../lib/errors';
import { h, input, ok, withTransaction } from '../../lib/http';
import { ApplicationModel } from '../../models/application';
import { BrandProfileModel } from '../../models/brandProfile';
import { CampaignModel } from '../../models/campaign';
import { ConversationModel, MessageModel } from '../../models/conversation';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { DealModel, OfferModel } from '../../models/deal';
import { addMessage, conversationView, markRead, messageView } from './messages.service';

export const conversationsRouter = Router();

/** A topic must be the user's OWN campaign or deal; anything else is treated as not found. */
async function assertOwnTopic(req: Request, topic: { type: 'CAMPAIGN' | 'DEAL'; id: string }) {
  let found: unknown;
  if (req.auth!.role === 'brand') {
    const b = await BrandProfileModel.findOne({ userId: req.auth!.id }, { _id: 1 }).lean();
    found = b && (topic.type === 'CAMPAIGN'
      ? await CampaignModel.exists({ _id: topic.id, brandId: b._id })
      : await DealModel.exists({ _id: topic.id, brandId: b._id, type: 'BRAND' }));
  } else {
    const p = await CreatorProfileModel.findOne({ userId: req.auth!.id }, { _id: 1 }).lean();
    found = p && (topic.type === 'DEAL'
      ? await DealModel.exists({ _id: topic.id, creatorId: p._id })
      // A creator is "in" a campaign once they applied, got an offer, or have a deal.
      : (await OfferModel.exists({ campaignId: topic.id, creatorId: p._id })) ?? (await ApplicationModel.exists({ campaignId: topic.id, creatorId: p._id })));
  }
  if (!found) throw notFound();
}

async function ownConversation(req: Request) {
  const c = await ConversationModel.findOne({ _id: input<{ id: string }>(req, 'params').id, ownerUserId: req.auth!.id });
  if (!c) throw notFound();
  return c;
}

conversationsRouter.get('/', h(async (req, res) => {
  const list = await ConversationModel.find({ ownerUserId: req.auth!.id }).sort({ lastMessageAt: -1 }).limit(50).lean();
  ok(res, list.map((c) => conversationView(c, 'user')));
}));

conversationsRouter.post('/', rateLimits.messages, validate({ body: conversationCreateSchema }), h(async (req, res) => {
  const d = input<{ subject: string; body: string; topic?: { type: 'CAMPAIGN' | 'DEAL'; id: string } }>(req);
  if (d.topic) await assertOwnTopic(req, d.topic);
  const role = req.auth!.role as 'creator' | 'brand';
  const conv = await withTransaction(async (session) => {
    const [c] = await ConversationModel.create([{
      ownerUserId: req.auth!.id, ownerRole: role, subject: d.subject, topic: d.topic, lastMessageAt: new Date(),
      statusHistory: [{ to: 'OPEN', by: req.auth!.id, at: new Date() }],
    }], { session });
    await addMessage(c, 'user', req.auth!.id, d.body, role, session);
    return c;
  });
  ok(res, conversationView(conv.toObject(), 'user'), 201);
}));

const idParams = z.object({ id: objectId });

conversationsRouter.get('/:id/messages', validate({ params: idParams, query: z.object({ cursor: objectId.optional() }) }), h(async (req, res) => {
  const conv = await ownConversation(req);
  const { cursor } = input<{ cursor?: string }>(req, 'query');
  const items = await MessageModel.find({ conversationId: conv._id, ...(cursor ? { _id: { $lt: cursor } } : {}) }).sort({ _id: -1 }).limit(51).lean();
  const page = items.slice(0, 50);
  await markRead(conv._id, 'user');
  ok(res, {
    conversation: conversationView({ ...conv.toObject(), unreadByUser: 0 }, 'user'),
    messages: page.reverse().map((m) => messageView(m, 'user')),
  }, 200, { nextCursor: items.length > 50 ? String(page[0]._id) : null });
}));

conversationsRouter.post('/:id/messages', rateLimits.messages, validate({ params: idParams, body: messageBodySchema }), h(async (req, res) => {
  const conv = await ownConversation(req);
  const message = await withTransaction(async (session) => {
    const fresh = (await ConversationModel.findById(conv._id).session(session))!;
    return addMessage(fresh, 'user', req.auth!.id, input<{ body: string }>(req).body, req.auth!.role as 'creator' | 'brand', session);
  });
  ok(res, messageView(message.toObject(), 'user'), 201);
}));
