/**
 * ADMIN → DISPUTES & REPORTS (trust and safety). Mounted at /api/v1/admin by admin.routes.ts.
 *   GET  /admin/disputes?status=OPEN|RESOLVED     campaign managers: problems raised on running deals
 *   POST /admin/disputes/:id/resolve              { outcome: CONTINUE | CANCEL, note } (both sides see the note)
 *   GET  /admin/reports?status=OPEN|ACTIONED|DISMISSED   reviewers + campaign managers: reports about campaigns/creators
 *   POST /admin/reports/:id/review                { outcome: ACTIONED | DISMISSED, note? } (team-internal note)
 *   GET  /admin/ratings?targetType=&targetId=     ratings with comments for one creator or brand
 * Logic: trust/trust.service.ts. Every decision is audited.
 */
import { Router } from 'express';
import { z } from 'zod';
import { DISPUTE_STATUSES, REPORT_STATUSES, disputeResolveSchema, objectId, reportReviewSchema } from '@bluenova/shared';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { h, input, ok } from '../../lib/http';
import { BrandProfileModel } from '../../models/brandProfile';
import { CampaignModel } from '../../models/campaign';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { DisputeModel, RatingModel, ReportModel } from '../../models/trust';
import { UserModel } from '../../models/user';
import { resolveDispute, reviewReport } from '../trust/trust.service';

export const adminTrustRouter = Router();
const cm = requireAdmin('campaign_manager');
const moderators = requireAdmin('reviewer', 'campaign_manager');
const idParams = z.object({ id: objectId });

adminTrustRouter.get('/disputes', cm, validate({ query: z.object({ status: z.enum(DISPUTE_STATUSES).default('OPEN') }) }), h(async (req, res) => {
  const { status } = input<{ status: string }>(req, 'query');
  const list = await DisputeModel.find({ status }).sort({ _id: -1 }).limit(100).lean();
  const [campaigns, users] = await Promise.all([
    CampaignModel.find({ _id: { $in: list.map((d) => d.campaignId) } }, { title: 1 }).lean(),
    UserModel.find({ _id: { $in: list.map((d) => d.raisedBy) } }, { name: 1 }).lean(),
  ]);
  const titles = new Map(campaigns.map((c) => [String(c._id), c.title ?? null]));
  const names = new Map(users.map((u) => [String(u._id), u.name ?? null]));
  ok(res, list.map((d) => ({
    id: String(d._id), dealId: String(d.dealId), campaignId: d.campaignId ? String(d.campaignId) : null,
    campaignTitle: d.campaignId ? titles.get(String(d.campaignId)) ?? null : null,
    raisedByRole: d.raisedByRole, raisedByName: names.get(String(d.raisedBy)) ?? null,
    reason: d.reason, description: d.description, previousStatus: d.previousStatus, status: d.status,
    resolution: d.resolution ?? null, createdAt: d.createdAt,
  })));
}));

adminTrustRouter.post('/disputes/:id/resolve', cm, validate({ params: idParams, body: disputeResolveSchema }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const { outcome, note } = input<{ outcome: 'CONTINUE' | 'CANCEL'; note: string }>(req);
  const d = await resolveDispute(id, outcome, note, { id: req.auth!.id, adminRole: req.auth!.adminRole! });
  await audit(req, `dispute.${outcome.toLowerCase()}`, 'Dispute', d._id, { changes: { dealId: String(d.dealId) }, reason: note });
  ok(res, { id: String(d._id), status: d.status, resolution: d.resolution });
}));

adminTrustRouter.get('/reports', moderators, validate({ query: z.object({ status: z.enum(REPORT_STATUSES).default('OPEN') }) }), h(async (req, res) => {
  const { status } = input<{ status: string }>(req, 'query');
  const list = await ReportModel.find({ status }).sort({ _id: -1 }).limit(100).lean();
  const ids = (t: string) => list.filter((r) => r.targetType === t).map((r) => r.targetId);
  const [campaigns, creators, reporters] = await Promise.all([
    CampaignModel.find({ _id: { $in: ids('CAMPAIGN') } }, { title: 1 }).lean(),
    CreatorProfileModel.find({ _id: { $in: ids('CREATOR') } }, { displayName: 1 }).lean(),
    UserModel.find({ _id: { $in: list.map((r) => r.reporterUserId) } }, { name: 1 }).lean(),
  ]);
  const targetNames = new Map<string, string | null>([
    ...campaigns.map((c) => [String(c._id), c.title ?? null] as [string, string | null]),
    ...creators.map((c) => [String(c._id), c.displayName ?? null] as [string, string | null]),
  ]);
  const reporterNames = new Map(reporters.map((u) => [String(u._id), u.name ?? null]));
  ok(res, list.map((r) => ({
    id: String(r._id), targetType: r.targetType, targetId: String(r.targetId), targetName: targetNames.get(String(r.targetId)) ?? null,
    reporterRole: r.reporterRole, reporterName: reporterNames.get(String(r.reporterUserId)) ?? null,
    reason: r.reason, details: r.details, status: r.status, reviewNote: r.reviewNote ?? null, createdAt: r.createdAt,
  })));
}));

adminTrustRouter.post('/reports/:id/review', moderators, validate({ params: idParams, body: reportReviewSchema }), h(async (req, res) => {
  const { id } = input<{ id: string }>(req, 'params');
  const { outcome, note } = input<{ outcome: 'ACTIONED' | 'DISMISSED'; note?: string }>(req);
  const r = await reviewReport(id, outcome, note, { id: req.auth!.id, adminRole: req.auth!.adminRole! });
  await audit(req, `report.${outcome.toLowerCase()}`, 'Report', r._id, { reason: note });
  ok(res, { id: String(r._id), status: r.status });
}));

adminTrustRouter.get('/ratings', moderators,
  validate({ query: z.object({ targetType: z.enum(['CREATOR', 'BRAND']), targetId: objectId }) }),
  h(async (req, res) => {
    const { targetType, targetId } = input<{ targetType: 'CREATOR' | 'BRAND'; targetId: string }>(req, 'query');
    const list = await RatingModel.find({ targetType, targetId }).sort({ _id: -1 }).limit(50).lean();
    const profile = targetType === 'CREATOR'
      ? await CreatorProfileModel.findById(targetId, { ratingAvg: 1, ratingCount: 1 }).lean()
      : await BrandProfileModel.findById(targetId, { ratingAvg: 1, ratingCount: 1 }).lean();
    ok(res, {
      average: profile?.ratingAvg ?? 0, count: profile?.ratingCount ?? 0,
      ratings: list.map((r) => ({ id: String(r._id), dealId: String(r.dealId), stars: r.stars, comment: r.comment ?? null, createdAt: r.createdAt })),
    });
  }),
);
