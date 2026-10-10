/**
 * ADMIN → WORK REVIEW: the team's queue of creator work (draft links and live post links) for brand deals and
 * intro reels. Mounted at /api/v1/admin by admin.routes.ts (admin login already required).
 *
 *   GET  /admin/deals?status=…            the queue (default: everything waiting for the team) → admin page /deals
 *   POST /admin/deals/:id/draft-review    { decision: APPROVE | REVISION, note }  → forward to brand / approve intro, or send back
 *   POST /admin/deals/:id/live-review     { decision: VERIFY | REJECT, note }      → complete the deal, or ask for a fix
 *   POST /admin/deals/:id/amend           { reason, creatorPayout?, brandPrice?, draftDue?, liveDue?, maxRevisions? }
 *   POST /admin/deals/:id/cancel          { reason }   (campaign managers; amend/cancel are recorded and audited)
 * ?status=OVERDUE lists work whose deadline passed while it was the creator's turn.
 *
 * Who: campaign managers (brand deals and intro reels) and reviewers (intro reels only; the state machine refuses
 * them on brand deals). The workflow itself is in deals/deals.service.ts. Every decision is audited.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  DEAL_STATUSES, dealAmendSchema, dealCancelSchema, liveReviewSchema, objectId, paginationQuery, teamDraftReviewSchema,
  type DealAmendInput,
} from '@bluenova/shared';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { cursorPage, h, input, ok } from '../../lib/http';
import { CampaignModel } from '../../models/campaign';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { DealModel } from '../../models/deal';
import { amendDeal, cancelDeal, teamReviewDraft, teamReviewLive } from '../deals/deals.service';
import { dealAdminView } from '../serializers';

export const adminDealsRouter = Router();
const team = requireAdmin('campaign_manager', 'reviewer');
const WAITING_FOR_TEAM = ['DRAFT_SUBMITTED', 'LIVE_SUBMITTED'];

adminDealsRouter.get('/deals', team,
  validate({ query: paginationQuery.extend({ status: z.enum(['WAITING', 'OVERDUE', ...DEAL_STATUSES] as [string, ...string[]]).default('WAITING') }) }),
  h(async (req, res) => {
    const { status, cursor, limit } = input<{ status: string; cursor?: string; limit: number }>(req, 'query');
    const now = new Date();
    const filter: Record<string, unknown> = status === 'OVERDUE'
      // Work whose deadline passed while it was still the creator's turn.
      ? { $or: [
        { status: { $in: ['IN_PRODUCTION', 'REVISION_REQUESTED'] }, 'deadlines.draftDue': { $lt: now } },
        { status: 'APPROVED', 'deadlines.liveDue': { $lt: now } },
      ] }
      : { status: status === 'WAITING' ? { $in: WAITING_FOR_TEAM } : status };
    // Reviewers only handle intro reels.
    if (req.auth!.adminRole === 'reviewer') filter.type = 'INTRO_REEL';
    if (cursor) filter._id = { $lt: cursor };
    const items = await DealModel.find(filter).select('+marginPaise').sort({ _id: -1 }).limit(limit + 1).lean();
    const { page, nextCursor } = cursorPage(items, limit);
    const [creators, campaigns] = await Promise.all([
      CreatorProfileModel.find({ _id: { $in: page.map((d) => d.creatorId) } }, { displayName: 1 }).lean(),
      CampaignModel.find({ _id: { $in: page.map((d) => d.campaignId).filter(Boolean) } }, { title: 1 }).lean(),
    ]);
    const cr = new Map(creators.map((c) => [String(c._id), c.displayName ?? null]));
    const ca = new Map(campaigns.map((c) => [String(c._id), c.title ?? null]));
    ok(res, page.map((d) => ({
      ...dealAdminView(d), creatorName: cr.get(String(d.creatorId)) ?? null, campaignTitle: d.campaignId ? ca.get(String(d.campaignId)) ?? null : null,
    })), 200, { nextCursor });
  }),
);

const idParams = z.object({ id: objectId });

adminDealsRouter.post('/deals/:id/draft-review', team, validate({ params: idParams, body: teamDraftReviewSchema }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const { decision, note } = input<{ decision: 'APPROVE' | 'REVISION'; note?: string }>(req);
  await teamReviewDraft(id, decision, note, { id: req.auth!.id, adminRole: req.auth!.adminRole! });
  await audit(req, `deal.draft_${decision.toLowerCase()}`, 'Deal', id, { reason: note });
  ok(res, dealAdminView((await DealModel.findById(id).select('+marginPaise').lean())!));
}));

/** Change agreed terms (campaign managers). Recorded on the deal, audited, both sides notified. */
adminDealsRouter.post('/deals/:id/amend', requireAdmin('campaign_manager'), validate({ params: idParams, body: dealAmendSchema }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const d = input<DealAmendInput>(req);
  const changes = await amendDeal(id, d, { id: req.auth!.id, adminRole: req.auth!.adminRole! });
  await audit(req, 'deal.amend', 'Deal', id, { changes, reason: d.reason });
  ok(res, dealAdminView((await DealModel.findById(id).select('+marginPaise').lean())!));
}));

/** Cancel an unfinished deal (campaign managers). Audited, both sides notified. */
adminDealsRouter.post('/deals/:id/cancel', requireAdmin('campaign_manager'), validate({ params: idParams, body: dealCancelSchema }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const { reason } = input<{ reason: string }>(req);
  await cancelDeal(id, reason, { id: req.auth!.id, adminRole: req.auth!.adminRole! });
  await audit(req, 'deal.cancel', 'Deal', id, { reason });
  ok(res, dealAdminView((await DealModel.findById(id).select('+marginPaise').lean())!));
}));

adminDealsRouter.post('/deals/:id/live-review', team, validate({ params: idParams, body: liveReviewSchema }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const { decision, note } = input<{ decision: 'VERIFY' | 'REJECT'; note?: string }>(req);
  await teamReviewLive(id, decision, note, { id: req.auth!.id, adminRole: req.auth!.adminRole! });
  await audit(req, `deal.live_${decision.toLowerCase()}`, 'Deal', id, { reason: note });
  ok(res, dealAdminView((await DealModel.findById(id).select('+marginPaise').lean())!));
}));
