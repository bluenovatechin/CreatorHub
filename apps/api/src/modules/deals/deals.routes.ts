/**
 * DEALS (for creators and brands: each side sees only its own deals, through ownerFilter)
 * and NOTIFICATIONS (the bell icon, for any signed-in user).
 *   GET  /deals, /deals/:id     list / one deal (role-specific view from serializers.ts)
 *   POST /deals/:id/draft       creator sends a draft link          } the workflow rules live
 *   POST /deals/:id/live        creator sends the live post link    } in deals.service.ts
 *   POST /deals/:id/review      brand approves a forwarded draft or asks for changes
 *   POST /deals/:id/dispute     creator or brand reports a problem; the deal pauses until the team resolves it
 *   POST /deals/:id/rating      after completion, each side rates the other once (trust/trust.service.ts)
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { brandDraftReviewSchema, disputeCreateSchema, draftSubmitSchema, liveSubmitSchema, objectId, ratingSchema } from '@bluenova/shared';
import { authenticate, authorize } from '../../middleware/auth';
import { rateLimits } from '../../middleware/security';
import { validate } from '../../middleware/validate';
import { AppError, notFound } from '../../lib/errors';
import { h, input, ok } from '../../lib/http';
import { BrandProfileModel } from '../../models/brandProfile';
import { CampaignModel } from '../../models/campaign';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { DealModel, type Deal } from '../../models/deal';
import { NotificationModel, getSettings } from '../../models/system';
import { creatorCardView, dealBrandView, dealCreatorView } from '../serializers';
import { disputeSummaries, myRatings, openDispute, rateDeal } from '../trust/trust.service';
import { brandReviewDraft, submitWork } from './deals.service';

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
  const side = req.auth!.role as 'creator' | 'brand';
  const ids = deals.map((d) => d._id);
  const [disputes, ratings, settings] = await Promise.all([disputeSummaries(ids, side, req.auth!.id), myRatings(ids, side), getSettings()]);
  const autoDays = settings.brandReviewAutoApproveDays ?? 5;
  /** When a draft waiting for the brand is approved automatically (jobs/deadlines.ts), so both sides can see it. */
  const reviewDueAt = (d: Deal) => {
    if (d.status !== 'BRAND_REVIEW' || autoDays <= 0) return null;
    const entered = [...(d.statusHistory ?? [])].reverse().find((h) => h.to === 'BRAND_REVIEW')?.at;
    return entered ? new Date(entered.getTime() + autoDays * 86_400_000) : null;
  };
  // Each side sees its own rating and the latest dispute (the other side's written text stays private).
  const trust = (d: Deal & { _id: unknown }) => ({
    dispute: disputes.get(String(d._id)) ?? null, myRating: ratings.get(String(d._id)) ?? null, brandReviewDueAt: reviewDueAt(d),
  });
  if (side === 'creator') {
    const brands = await BrandProfileModel.find({ _id: { $in: campaigns.map((c) => c.brandId) } }, { companyName: 1 }).lean();
    const bMap = new Map(brands.map((b) => [String(b._id), b.companyName ?? null]));
    return deals.map((d) => {
      const c = d.campaignId ? cMap.get(String(d.campaignId)) : undefined;
      return { ...dealCreatorView(d, { campaignTitle: c?.title ?? null, companyName: c ? bMap.get(String(c.brandId)) ?? null : null }), ...trust(d) };
    });
  }
  const creators = await CreatorProfileModel.find({ _id: { $in: deals.map((d) => d.creatorId) } }).lean();
  const crMap = new Map(creators.map((c) => [String(c._id), c]));
  return deals.map((d) => {
    const cr = crMap.get(String(d.creatorId));
    return {
      ...dealBrandView(d, {
        campaignTitle: d.campaignId ? cMap.get(String(d.campaignId))?.title ?? null : null,
        creator: cr ? creatorCardView(cr) : null,
      }),
      ...trust(d),
    };
  });
}

dealsRouter.get('/deals', h(async (req, res) => {
  const deals = await DealModel.find(await ownerFilter(req)).sort({ _id: -1 }).limit(100).lean();
  ok(res, await present(req, deals));
}));

/** One of the signed-in party's own deals, in their view (404 for anyone else's). */
async function oneDeal(req: Request, id: string) {
  const deal = await DealModel.findOne({ _id: id, ...(await ownerFilter(req)) }).lean();
  if (!deal) throw notFound();
  return (await present(req, [deal]))[0];
}

const idParams = validate({ params: z.object({ id: objectId }) });

dealsRouter.get('/deals/:id', idParams, h(async (req, res) => {
  ok(res, await oneDeal(req, input<{ id: string }>(req, 'params').id));
}));

/** Creators can send work only while their partnership is active (not suspended). */
async function activeCreatorFilter(req: Request) {
  const p = await CreatorProfileModel.findOne({ userId: req.auth!.id }, { _id: 1, status: 1 }).lean();
  if (!p) throw notFound();
  if (p.status !== 'APPROVED') throw new AppError('FORBIDDEN', 'errors.notApprovedYet');
  return { creatorId: p._id };
}

for (const kind of ['draft', 'live'] as const) {
  dealsRouter.post(`/deals/:id/${kind}`, authorize('creator'), idParams,
    validate({ body: kind === 'draft' ? draftSubmitSchema : liveSubmitSchema }),
    h(async (req, res) => {
      const { id } = input<{ id: string }>(req, 'params');
      const { url, note } = input<{ url: string; note?: string }>(req);
      await submitWork({ _id: id, ...(await activeCreatorFilter(req)) }, kind === 'draft' ? 'DRAFT' : 'LIVE', url, note, req.auth!.id);
      ok(res, await oneDeal(req, id));
    }),
  );
}

/** Creator or brand: something is wrong with this running brand deal. The deal pauses until the team resolves it. */
dealsRouter.post('/deals/:id/dispute', rateLimits.reports, idParams, validate({ body: disputeCreateSchema }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const { reason, description } = input<{ reason: string; description: string }>(req);
  await openDispute({ _id: id, ...(await ownerFilter(req)) }, req.auth!.role as 'creator' | 'brand', req.auth!.id, reason, description);
  ok(res, await oneDeal(req, id), 201);
}));

/** After a completed brand deal: the brand rates the creator, the creator rates the brand (once each). */
dealsRouter.post('/deals/:id/rating', idParams, validate({ body: ratingSchema }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const { stars, comment } = input<{ stars: number; comment?: string }>(req);
  await rateDeal({ _id: id, ...(await ownerFilter(req)) }, req.auth!.role as 'creator' | 'brand', req.auth!.id, stars, comment);
  ok(res, await oneDeal(req, id), 201);
}));

dealsRouter.post('/deals/:id/review', authorize('brand'), idParams, validate({ body: brandDraftReviewSchema }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const { decision, note } = input<{ decision: 'APPROVE' | 'REVISION'; note?: string }>(req);
  await brandReviewDraft({ _id: id, ...(await ownerFilter(req)) }, decision, note, req.auth!.id);
  ok(res, await oneDeal(req, id));
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
