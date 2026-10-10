/**
 * TRUST & SAFETY logic: disputes on running deals, reports about campaigns/creators, and ratings after completed
 * deals. Used by deals/deals.routes.ts (dispute, rating), trust/reports.routes.ts (reports) and
 * admin/trust.routes.ts (the team's side). Models: models/trust.ts.
 *
 * Disputes pause a deal (DISPUTED). The team resolves them: CONTINUE puts the deal back exactly where it was,
 * CANCEL ends it. No money moves automatically: refunds/payouts for a cancelled deal are settled by finance outside
 * the website (there is no payout system yet).
 */
import type { ClientSession } from 'mongoose';
import { dealMachine, disputeMachine, reportMachine, type AdminRole, type DealStatus } from '@bluenova/shared';
import { AppError, notFound } from '../../lib/errors';
import { withTransaction } from '../../lib/http';
import { notify, notifyAdmins } from '../../lib/notify';
import { applyTransition } from '../../lib/transition';
import { ApplicationModel } from '../../models/application';
import { BrandProfileModel } from '../../models/brandProfile';
import { CampaignModel, ShortlistItemModel } from '../../models/campaign';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { DealModel, OfferModel, type DealDoc } from '../../models/deal';
import { DisputeModel, RatingModel, ReportModel } from '../../models/trust';
import { completeCampaignIfDone } from '../deals/deals.service';

type Side = 'creator' | 'brand';
interface Admin { id: string; adminRole: AdminRole }

/** The user ids of both sides of a deal, and the campaign title, for notifications. */
async function sides(deal: DealDoc, session: ClientSession) {
  const [creator, brand, campaign] = await Promise.all([
    CreatorProfileModel.findById(deal.creatorId, { userId: 1 }).session(session).lean(),
    BrandProfileModel.findById(deal.brandId, { userId: 1 }).session(session).lean(),
    CampaignModel.findById(deal.campaignId, { title: 1 }).session(session).lean(),
  ]);
  return { creatorUserId: creator?.userId, brandUserId: brand?.userId, campaign: campaign?.title ?? '' };
}

/* ---------- disputes ---------- */

export function openDispute(filter: Record<string, unknown>, side: Side, userId: string, reason: string, description: string) {
  return withTransaction(async (session) => {
    const deal = await DealModel.findOne({ ...filter, type: 'BRAND' }).session(session);
    if (!deal) throw notFound();
    const previousStatus = deal.status;
    applyTransition(deal, dealMachine, 'DISPUTED', side, userId, reason); // refuses deals that can't be disputed now
    await deal.save({ session });
    const [dispute] = await DisputeModel.create([{
      dealId: deal._id, campaignId: deal.campaignId, raisedBy: userId, raisedByRole: side, reason, description, previousStatus,
      statusHistory: [{ to: 'OPEN', by: userId, at: new Date() }],
    }], { session });
    const s = await sides(deal, session);
    const other = side === 'creator' ? s.brandUserId : s.creatorUserId;
    const otherLink = side === 'creator' ? `/brand/deals/${deal._id}` : `/creator/deals/${deal._id}`;
    // The other side learns the deal is paused, not what was written (the team handles the details).
    if (other) await notify(other, 'deal_disputed', { campaign: s.campaign }, otherLink, session);
    await notifyAdmins(['campaign_manager'], 'admin_dispute_opened', { campaign: s.campaign }, '/trust', session);
    return dispute;
  });
}

export function resolveDispute(disputeId: string, outcome: 'CONTINUE' | 'CANCEL', note: string, admin: Admin) {
  return withTransaction(async (session) => {
    const dispute = await DisputeModel.findById(disputeId).session(session);
    if (!dispute) throw notFound();
    applyTransition(dispute, disputeMachine, 'RESOLVED', admin.adminRole, admin.id, outcome);
    dispute.resolution = { outcome, note, by: admin.id as never, at: new Date() };
    await dispute.save({ session });
    const deal = (await DealModel.findById(dispute.dealId).session(session))!;
    const to: DealStatus = outcome === 'CONTINUE' ? (dispute.previousStatus as DealStatus) : 'CANCELLED';
    applyTransition(deal, dealMachine, to, admin.adminRole, admin.id, `dispute_${outcome.toLowerCase()}`);
    await deal.save({ session });
    const s = await sides(deal, session);
    if (s.creatorUserId) await notify(s.creatorUserId, 'dispute_resolved', { campaign: s.campaign }, `/creator/deals/${deal._id}`, session);
    if (s.brandUserId) await notify(s.brandUserId, 'dispute_resolved', { campaign: s.campaign }, `/brand/deals/${deal._id}`, session);
    if (outcome === 'CANCEL' && s.brandUserId) await completeCampaignIfDone(deal.campaignId, s.brandUserId, session);
    return dispute;
  });
}

/** For deal pages: the latest dispute of each deal, as one side may see it (the other side's text stays private). */
export async function disputeSummaries(dealIds: unknown[], side: Side, userId: string) {
  const list = await DisputeModel.find({ dealId: { $in: dealIds } }).sort({ _id: -1 }).lean();
  const latest = new Map<string, (typeof list)[number]>();
  for (const d of list) if (!latest.has(String(d.dealId))) latest.set(String(d.dealId), d);
  const out = new Map<string, unknown>();
  for (const [dealId, d] of latest) {
    const mine = d.raisedByRole === side && String(d.raisedBy) === userId;
    out.set(dealId, {
      id: String(d._id), status: d.status, reason: d.reason, raisedByMe: mine, createdAt: d.createdAt,
      description: mine ? d.description : null,
      resolution: d.resolution?.outcome ? { outcome: d.resolution.outcome, note: d.resolution.note ?? null, at: d.resolution.at } : null,
    });
  }
  return out;
}

/* ---------- ratings ---------- */

export async function rateDeal(filter: Record<string, unknown>, side: Side, userId: string, stars: number, comment?: string) {
  const deal = await DealModel.findOne({ ...filter, type: 'BRAND' }).lean();
  if (!deal) throw notFound();
  if (deal.status !== 'COMPLETED') throw new AppError('INVALID_STATE', 'errors.rateAfterCompletion');
  const targetType = side === 'brand' ? 'CREATOR' : 'BRAND';
  const targetId = side === 'brand' ? deal.creatorId : deal.brandId;
  try {
    await RatingModel.create({ dealId: deal._id, raterUserId: userId, raterRole: side, targetType, targetId, stars, comment });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new AppError('CONFLICT', 'errors.alreadyRated');
    throw err;
  }
  // New average = (old average × old count + stars) / (old count + 1), computed inside ONE database update
  // (an update pipeline), so two ratings arriving together can't overwrite each other.
  const update = [{ $set: {
    ratingAvg: { $divide: [{ $add: [{ $multiply: ['$ratingAvg', '$ratingCount'] }, stars] }, { $add: ['$ratingCount', 1] }] },
    ratingCount: { $add: ['$ratingCount', 1] },
  } }];
  if (side === 'brand') await CreatorProfileModel.updateOne({ _id: targetId }, update);
  else await BrandProfileModel.updateOne({ _id: targetId }, update);
}

export async function myRatings(dealIds: unknown[], side: Side) {
  const list = await RatingModel.find({ dealId: { $in: dealIds }, raterRole: side }).lean();
  return new Map(list.map((r) => [String(r.dealId), { stars: r.stars, comment: r.comment ?? null }]));
}

/* ---------- reports ---------- */

/** People may only report what they actually deal with: creators → campaigns they can see; brands → their creators. */
async function assertCanReport(side: Side, userId: string, targetType: 'CAMPAIGN' | 'CREATOR', targetId: string) {
  if (side === 'creator' && targetType === 'CAMPAIGN') {
    const p = await CreatorProfileModel.findOne({ userId }, { _id: 1, categories: 1, status: 1 }).lean();
    if (!p) throw notFound();
    const visible = (p.status === 'APPROVED' && await CampaignModel.exists({ _id: targetId, 'filters.categories': { $in: p.categories ?? [] }, status: { $ne: 'DRAFT' } }))
      || await OfferModel.exists({ campaignId: targetId, creatorId: p._id })
      || await ApplicationModel.exists({ campaignId: targetId, creatorId: p._id });
    if (!visible) throw notFound();
    return;
  }
  if (side === 'brand' && targetType === 'CREATOR') {
    const b = await BrandProfileModel.findOne({ userId }, { _id: 1 }).lean();
    if (!b) throw notFound();
    const campaignIds = (await CampaignModel.find({ brandId: b._id }, { _id: 1 }).lean()).map((c) => c._id);
    const related = await ShortlistItemModel.exists({ campaignId: { $in: campaignIds }, creatorId: targetId, status: { $in: ['PROPOSED', 'SELECTED', 'REJECTED_BY_BRAND'] } })
      || await DealModel.exists({ brandId: b._id, creatorId: targetId });
    if (!related) throw notFound();
    return;
  }
  throw new AppError('FORBIDDEN'); // creators report campaigns; brands report creators
}

export async function createReport(side: Side, userId: string, d: { targetType: 'CAMPAIGN' | 'CREATOR'; targetId: string; reason: string; details: string }) {
  await assertCanReport(side, userId, d.targetType, d.targetId);
  try {
    const report = await ReportModel.create({
      reporterUserId: userId, reporterRole: side, ...d, statusHistory: [{ to: 'OPEN', by: userId, at: new Date() }],
    });
    await notifyAdmins(['reviewer', 'campaign_manager'], 'admin_report_received', { target: d.targetType.toLowerCase() }, '/trust?tab=reports');
    return report;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new AppError('CONFLICT', 'errors.alreadyReported');
    throw err;
  }
}

export async function reviewReport(id: string, outcome: 'ACTIONED' | 'DISMISSED', note: string | undefined, admin: Admin) {
  const report = await ReportModel.findById(id);
  if (!report) throw notFound();
  applyTransition(report, reportMachine, outcome, admin.adminRole, admin.id, note);
  report.reviewNote = note;
  report.reviewedBy = admin.id as never;
  report.reviewedAt = new Date();
  await report.save();
  // The reporter learns it was looked at, not what action was taken against someone else.
  await notify(report.reporterUserId, 'report_reviewed', {}, report.reporterRole === 'creator' ? '/creator' : '/brand');
  return report;
}
