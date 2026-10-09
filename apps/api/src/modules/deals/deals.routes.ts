/**
 * DEALS (for creators and brands: each side sees only its own deals, through ownerFilter)
 * and NOTIFICATIONS (the bell icon, for any signed-in user).
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { objectId } from '@bluenova/shared';
import { authenticate, authorize } from '../../middleware/auth';
import { rateLimits } from '../../middleware/security';
import { validate } from '../../middleware/validate';
import { notFound } from '../../lib/errors';
import { h, input, ok } from '../../lib/http';
import { BrandProfileModel } from '../../models/brandProfile';
import { CampaignModel } from '../../models/campaign';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { DealModel, type Deal } from '../../models/deal';
import { NotificationModel } from '../../models/system';
import { creatorCardView, dealBrandView, dealCreatorView } from '../serializers';

export const dealsRouter = Router();
dealsRouter.use('/deals', authenticate('app'), authorize('creator', 'brand'), rateLimits.authed);

/** The ownership filter for the signed-in party. Every deal query goes through this. */
async function ownerFilter(req: Request): Promise<Record<string, unknown>> {
  if (req.auth!.role === 'creator') {
    const p = await CreatorProfileModel.findOne({ userId: req.auth!.id }, { _id: 1 }).lean();
    if (!p) throw notFound();
    return { creatorId: p._id };
  }
  const b = await BrandProfileModel.findOne({ userId: req.auth!.id }, { _id: 1 }).lean();
  if (!b) throw notFound();
  return { brandId: b._id, type: 'BRAND' };
}

async function present(req: Request, deals: (Deal & { _id: unknown })[]) {
  const campaigns = await CampaignModel.find({ _id: { $in: deals.map((d) => d.campaignId).filter(Boolean) } }, { title: 1, brandId: 1 }).lean();
  const cMap = new Map(campaigns.map((c) => [String(c._id), c]));
  if (req.auth!.role === 'creator') {
    const brands = await BrandProfileModel.find({ _id: { $in: campaigns.map((c) => c.brandId) } }, { companyName: 1 }).lean();
    const bMap = new Map(brands.map((b) => [String(b._id), b.companyName ?? null]));
    return deals.map((d) => {
      const c = d.campaignId ? cMap.get(String(d.campaignId)) : undefined;
      return dealCreatorView(d, { campaignTitle: c?.title ?? null, companyName: c ? bMap.get(String(c.brandId)) ?? null : null });
    });
  }
  const creators = await CreatorProfileModel.find({ _id: { $in: deals.map((d) => d.creatorId) } }).lean();
  const crMap = new Map(creators.map((c) => [String(c._id), c]));
  return deals.map((d) => {
    const cr = crMap.get(String(d.creatorId));
    return dealBrandView(d, {
      campaignTitle: d.campaignId ? cMap.get(String(d.campaignId))?.title ?? null : null,
      creator: cr ? creatorCardView(cr) : null,
    });
  });
}

dealsRouter.get('/deals', h(async (req, res) => {
  const deals = await DealModel.find(await ownerFilter(req)).sort({ _id: -1 }).limit(100).lean();
  ok(res, await present(req, deals));
}));

dealsRouter.get('/deals/:id', validate({ params: z.object({ id: objectId }) }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const deal = await DealModel.findOne({ _id: id, ...(await ownerFilter(req)) }).lean();
  if (!deal) throw notFound();
  ok(res, (await present(req, [deal]))[0]);
}));

/* ---------- notifications (any signed-in creator/brand) ---------- */

export const notificationsRouter = Router();

notificationsRouter.get('/', validate({ query: z.object({ cursor: objectId.optional() }) }), h(async (req, res) => {
  const { cursor } = input<{ cursor?: string }>(req, 'query');
  const filter: Record<string, unknown> = { userId: req.auth!.id };
  if (cursor) filter._id = { $lt: cursor };
  const items = await NotificationModel.find(filter).sort({ _id: -1 }).limit(31).lean();
  const page = items.slice(0, 30);
  const unread = await NotificationModel.countDocuments({ userId: req.auth!.id, readAt: null });
  ok(res, page.map((n) => ({
    id: String(n._id), type: n.type, params: n.params, link: n.link ?? null, readAt: n.readAt ?? null, createdAt: n.createdAt,
  })), 200, { unread, nextCursor: items.length > 30 ? String(page[page.length - 1]._id) : null });
}));

notificationsRouter.post('/read',
  validate({ body: z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(objectId).min(1).max(100) })]) }),
  h(async (req, res) => {
    const body = input<{ all: true } | { ids: string[] }>(req);
    const filter: Record<string, unknown> = { userId: req.auth!.id, readAt: null };
    if ('ids' in body) filter._id = { $in: body.ids };
    await NotificationModel.updateMany(filter, { $set: { readAt: new Date() } });
    ok(res, { done: true });
  }),
);
