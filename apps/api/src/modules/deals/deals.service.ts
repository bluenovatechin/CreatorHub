/**
 * DELIVERABLES WORKFLOW (the work after a deal starts). Used by deals.routes.ts (creator, brand) and
 * admin/deals.routes.ts (team). Links only: creators share a draft link and later the live Instagram post link.
 *
 *   BRAND deal:  IN_PRODUCTION → creator sends draft → DRAFT_SUBMITTED → team forwards → BRAND_REVIEW
 *                → brand approves → APPROVED (or asks for changes → REVISION_REQUESTED, limited by maxRevisions)
 *                → creator sends live link → LIVE_SUBMITTED → team verifies → VERIFIED → COMPLETED
 *                (team can also send a draft back, or reject a live link → APPROVED to fix and resend)
 *   INTRO_REEL:  same, but the team approves the draft directly (no brand).
 *
 * Every status change goes through applyTransition() with the right state machine, inside a transaction, so two
 * people pressing buttons at the same moment can't both succeed. Everyone involved gets a notification.
 * When the last deal of a campaign completes, the campaign becomes COMPLETED.
 * The team can also amend agreed terms (recorded on the deal) or cancel an unfinished deal (bottom of this file).
 */
import type { ClientSession } from 'mongoose';
import {
  campaignMachine, dealMachine, introDealMachine, istDateToUtc, rupeesToPaise, type AdminRole, type DealAmendInput, type DealStatus,
} from '@bluenova/shared';
import { AppError, invalidState, notFound } from '../../lib/errors';
import { withTransaction } from '../../lib/http';
import { notify, notifyAdmins } from '../../lib/notify';
import { applyTransition } from '../../lib/transition';
import { BrandProfileModel } from '../../models/brandProfile';
import { CampaignModel } from '../../models/campaign';
import { CreatorProfileModel } from '../../models/creatorProfile';
import { DealModel, type DealDoc } from '../../models/deal';

type Filter = Record<string, unknown>;
interface Admin { id: string; adminRole: AdminRole }

const machineFor = (deal: DealDoc) => (deal.type === 'INTRO_REEL' ? introDealMachine : dealMachine);
/** Team roles that handle this kind of deal (for notifications). */
const teamFor = (deal: DealDoc): AdminRole[] => (deal.type === 'INTRO_REEL' ? ['reviewer', 'campaign_manager'] : ['campaign_manager']);

/** Who to notify and what to call things in the messages. */
async function parties(deal: DealDoc, session: ClientSession) {
  const [creator, campaign, brand] = await Promise.all([
    CreatorProfileModel.findById(deal.creatorId, { userId: 1, displayName: 1 }).session(session).lean(),
    deal.campaignId ? CampaignModel.findById(deal.campaignId, { title: 1 }).session(session).lean() : null,
    deal.brandId ? BrandProfileModel.findById(deal.brandId, { userId: 1 }).session(session).lean() : null,
  ]);
  return {
    creatorUserId: creator?.userId,
    brandUserId: brand?.userId,
    params: { creator: creator?.displayName ?? '', campaign: deal.type === 'INTRO_REEL' ? 'Intro reel' : campaign?.title ?? '' },
    creatorLink: deal.type === 'INTRO_REEL' ? '/creator/intro-reel' : '/creator/deals',
  };
}

/** Loads the deal inside the transaction (fresh status), runs `change`, saves. 404 if `filter` doesn't match. */
async function withDeal<T>(filter: Filter, change: (deal: DealDoc, session: ClientSession) => Promise<T>): Promise<T> {
  return withTransaction(async (session) => {
    const deal = await DealModel.findOne(filter).session(session);
    if (!deal) throw notFound();
    // A disputed deal is paused: only the dispute resolution (trust/trust.service.ts) may move it again.
    // (The state machine allows the team to move DISPUTED deals, so this check must stay here.)
    if (deal.status === 'DISPUTED') throw new AppError('INVALID_STATE', 'errors.dealDisputed');
    const result = await change(deal, session);
    await deal.save({ session });
    return result;
  });
}

function latest(deal: DealDoc, kind: 'DRAFT' | 'LIVE') {
  const s = [...deal.submissions].reverse().find((x) => x.kind === kind);
  if (!s) throw invalidState();
  return s;
}

/* ---------- creator ---------- */

export function submitWork(filter: Filter, kind: 'DRAFT' | 'LIVE', url: string, note: string | undefined, userId: string) {
  return withDeal(filter, async (deal, session) => {
    applyTransition(deal, machineFor(deal), kind === 'DRAFT' ? 'DRAFT_SUBMITTED' : 'LIVE_SUBMITTED', 'creator', userId);
    deal.submissions.push({ kind, url, note, submittedAt: new Date(), reviews: [] });
    const p = await parties(deal, session);
    await notifyAdmins(teamFor(deal), kind === 'DRAFT' ? 'admin_draft_submitted' : 'admin_live_submitted', p.params, '/deals', session);
  });
}

/* ---------- team ---------- */

/** Team looks at a draft. APPROVE forwards it to the brand (brand deals) or approves it (intro reel). */
export function teamReviewDraft(dealId: string, decision: 'APPROVE' | 'REVISION', note: string | undefined, admin: Admin) {
  return withDeal({ _id: dealId }, async (deal, session) => {
    const draft = latest(deal, 'DRAFT');
    const to: DealStatus = decision === 'REVISION' ? 'REVISION_REQUESTED' : deal.type === 'INTRO_REEL' ? 'APPROVED' : 'BRAND_REVIEW';
    applyTransition(deal, machineFor(deal), to, admin.adminRole, admin.id, note);
    draft.reviews.push({ by: 'team', decision, note, reviewerId: admin.id as never, at: new Date() });
    const p = await parties(deal, session);
    if (to === 'BRAND_REVIEW') {
      draft.sharedWithBrand = true;
      if (p.brandUserId) await notify(p.brandUserId, 'brand_draft_ready', p.params, '/brand/deals', session);
    } else if (p.creatorUserId) {
      await notify(p.creatorUserId, to === 'APPROVED' ? 'creator_draft_approved' : 'creator_revision_requested', p.params, p.creatorLink, session);
    }
  });
}

/** Team checks the live post. VERIFY completes the deal (and the campaign, if it was the last one). */
export function teamReviewLive(dealId: string, decision: 'VERIFY' | 'REJECT', note: string | undefined, admin: Admin) {
  return withDeal({ _id: dealId }, async (deal, session) => {
    const live = latest(deal, 'LIVE');
    live.reviews.push({ by: 'team', decision, note, reviewerId: admin.id as never, at: new Date() });
    const p = await parties(deal, session);
    if (decision === 'REJECT') {
      applyTransition(deal, machineFor(deal), 'APPROVED', admin.adminRole, admin.id, note);
      if (p.creatorUserId) await notify(p.creatorUserId, 'creator_live_rejected', p.params, p.creatorLink, session);
      return;
    }
    applyTransition(deal, machineFor(deal), 'VERIFIED', admin.adminRole, admin.id);
    applyTransition(deal, machineFor(deal), 'COMPLETED', 'system', admin.id);
    deal.completedAt = new Date();
    await CreatorProfileModel.updateOne({ _id: deal.creatorId }, { $inc: { completedDeals: 1 } }, { session });
    if (p.creatorUserId) await notify(p.creatorUserId, 'creator_deal_completed', p.params, p.creatorLink, session);
    if (deal.type === 'BRAND' && p.brandUserId) {
      await notify(p.brandUserId, 'brand_deal_completed', p.params, '/brand/deals', session);
      await deal.save({ session }); // so the count below already sees this deal as completed
      await completeCampaignIfDone(deal.campaignId, p.brandUserId, session);
    }
  });
}

/**
 * The campaign is COMPLETED once none of its deals is still in progress and at least one was completed.
 * (If every deal was cancelled, e.g. after disputes, the team decides what happens to the campaign.)
 * Also called after a dispute cancels a deal (trust/trust.service.ts).
 */
export async function completeCampaignIfDone(campaignId: unknown, brandUserId: unknown, session: ClientSession) {
  if (!campaignId) return;
  const open = await DealModel.countDocuments({ campaignId, status: { $nin: ['COMPLETED', 'CANCELLED'] } }).session(session);
  if (open > 0) return;
  if (!(await DealModel.exists({ campaignId, status: 'COMPLETED' }).session(session))) return;
  const campaign = await CampaignModel.findById(campaignId).session(session);
  if (!campaign || campaign.status !== 'ACTIVE') return;
  applyTransition(campaign, campaignMachine, 'COMPLETED', 'system');
  await campaign.save({ session });
  await notify(brandUserId as string, 'brand_campaign_completed', { campaign: campaign.title ?? '' }, `/brand/campaigns/${campaign._id}`, session);
}

/* ---------- brand ---------- */

/** Brand looks at a draft the team forwarded. Asking for changes uses up one of the campaign's revisions. */
export function brandReviewDraft(filter: Filter, decision: 'APPROVE' | 'REVISION', note: string | undefined, userId: string) {
  return withDeal(filter, async (deal, session) => {
    const draft = latest(deal, 'DRAFT');
    if (decision === 'REVISION') {
      if (deal.brandRevisionsUsed >= deal.maxRevisions) throw new AppError('INVALID_STATE', 'errors.revisionLimit');
      applyTransition(deal, dealMachine, 'REVISION_REQUESTED', 'brand', userId, note);
      deal.brandRevisionsUsed += 1;
    } else {
      applyTransition(deal, dealMachine, 'APPROVED', 'brand', userId);
    }
    draft.reviews.push({ by: 'brand', decision, note, reviewerId: userId as never, at: new Date() });
    const p = await parties(deal, session);
    const type = decision === 'APPROVE' ? 'creator_draft_approved' : 'creator_revision_requested';
    if (p.creatorUserId) await notify(p.creatorUserId, type, p.params, p.creatorLink, session);
    await notifyAdmins(['campaign_manager'], decision === 'APPROVE' ? 'admin_brand_approved' : 'admin_brand_revision', p.params, '/deals', session);
  });
}

/* ---------- team: amendments and cancellation ---------- */

const FINAL: readonly string[] = ['COMPLETED', 'CANCELLED', 'VERIFIED'];

/**
 * Changes agreed terms after acceptance. Every change is recorded on the deal (amendments: who, when, why,
 * from → to), so a finalized agreement is never edited silently. Money: whole rupees in, paise stored; the margin
 * is recomputed. Changed deadlines get fresh reminders. Both sides are notified. Not allowed on finished deals.
 */
export function amendDeal(dealId: string, d: DealAmendInput, admin: Admin) {
  return withDeal({ _id: dealId }, async (deal, session) => {
    if (FINAL.includes(deal.status)) throw invalidState();
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const payout = d.creatorPayout !== undefined ? rupeesToPaise(d.creatorPayout) : deal.creatorPayoutPaise;
    const price = d.brandPrice !== undefined ? rupeesToPaise(d.brandPrice) : deal.brandPricePaise;
    if (deal.type === 'BRAND' && payout != null && price != null && price < payout) {
      throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', { brandPrice: 'errors.priceBelowPayout' });
    }
    if (d.creatorPayout !== undefined && payout !== deal.creatorPayoutPaise) {
      changes.creatorPayoutPaise = { from: deal.creatorPayoutPaise ?? null, to: payout };
      deal.creatorPayoutPaise = payout;
    }
    if (d.brandPrice !== undefined && price !== deal.brandPricePaise) {
      changes.brandPricePaise = { from: deal.brandPricePaise ?? null, to: price };
      deal.brandPricePaise = price;
    }
    if (changes.creatorPayoutPaise || changes.brandPricePaise) deal.set('marginPaise', (price ?? 0) - (payout ?? 0));
    for (const field of ['draftDue', 'liveDue'] as const) {
      const value = d[field];
      if (value === undefined) continue;
      const next = istDateToUtc(value);
      if (deal.deadlines?.[field]?.getTime() === next.getTime()) continue;
      changes[field] = { from: deal.deadlines?.[field] ?? null, to: next };
      deal.set(`deadlines.${field}`, next);
      // A new date deserves new reminders.
      deal.set(field === 'draftDue' ? 'reminders.draftDueSoon' : 'reminders.liveDueSoon', false);
      deal.set(field === 'draftDue' ? 'reminders.draftMissed' : 'reminders.liveMissed', false);
    }
    const due = deal.deadlines;
    if (due?.draftDue && due?.liveDue && due.draftDue > due.liveDue) {
      throw new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', { liveDue: 'errors.liveBeforeDraft' });
    }
    if (d.maxRevisions !== undefined && d.maxRevisions !== deal.maxRevisions) {
      changes.maxRevisions = { from: deal.maxRevisions, to: d.maxRevisions };
      deal.maxRevisions = d.maxRevisions;
    }
    if (Object.keys(changes).length === 0) throw new AppError('VALIDATION_ERROR', 'errors.nothingToChange');
    deal.amendments.push({ by: admin.id as never, at: new Date(), reason: d.reason, changes });
    const p = await parties(deal, session);
    if (p.creatorUserId) await notify(p.creatorUserId, 'deal_amended', p.params, p.creatorLink, session);
    if (deal.type === 'BRAND' && p.brandUserId) await notify(p.brandUserId, 'deal_amended', p.params, `/brand/deals/${deal._id}`, session);
    return changes;
  });
}

/** The team cancels an unfinished deal (reason required). Disputed deals are closed through the dispute instead. */
export function cancelDeal(dealId: string, reason: string, admin: Admin) {
  return withDeal({ _id: dealId }, async (deal, session) => {
    applyTransition(deal, machineFor(deal), 'CANCELLED', admin.adminRole, admin.id, reason);
    const p = await parties(deal, session);
    if (p.creatorUserId) await notify(p.creatorUserId, 'deal_cancelled', p.params, p.creatorLink, session);
    if (deal.type === 'BRAND' && p.brandUserId) {
      await notify(p.brandUserId, 'deal_cancelled', p.params, `/brand/deals/${deal._id}`, session);
      await deal.save({ session });
      await completeCampaignIfDone(deal.campaignId, p.brandUserId, session);
    }
  });
}
