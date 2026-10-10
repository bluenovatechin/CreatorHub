/**
 * DEADLINE JOBS (run every 10 minutes from scheduler.ts):
 *   remindDeadlines()    48 h before a draft / live deadline → reminder to the creator;
 *                        deadline passed → "missed" message to the creator and the team.
 *                        Each message is sent once per deal (flags in deal.reminders, set atomically).
 *   autoApproveDrafts()  a draft waiting for the BRAND longer than settings.brandReviewAutoApproveDays is approved
 *                        automatically (state machine: BRAND_REVIEW → APPROVED by "system"), so creators aren't
 *                        stuck. Both sides are told. Disputed deals are never touched.
 */
import { dealMachine } from '@bluenova/shared';
import { withTransaction } from '../lib/http';
import { logger } from '../lib/logger';
import { notify, notifyAdmins } from '../lib/notify';
import { applyTransition } from '../lib/transition';
import { BrandProfileModel } from '../models/brandProfile';
import { CampaignModel } from '../models/campaign';
import { CreatorProfileModel } from '../models/creatorProfile';
import { DealModel } from '../models/deal';
import { getSettings } from '../models/system';

const SOON_MS = 48 * 3_600_000;
const dateIST = (d: Date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(d);

type Flag = 'draftDueSoon' | 'draftMissed' | 'liveDueSoon' | 'liveMissed';

/** Sets the flag only if it wasn't set yet. True = this run "owns" the message (no duplicates across runs). */
async function claim(dealId: unknown, flag: Flag) {
  const r = await DealModel.updateOne({ _id: dealId, [`reminders.${flag}`]: { $ne: true } }, { $set: { [`reminders.${flag}`]: true } });
  return r.modifiedCount === 1;
}

async function labels(deal: { creatorId: unknown; campaignId?: unknown; type: string }) {
  const [creator, campaign] = await Promise.all([
    CreatorProfileModel.findById(deal.creatorId, { userId: 1, displayName: 1 }).lean(),
    deal.campaignId ? CampaignModel.findById(deal.campaignId, { title: 1 }).lean() : null,
  ]);
  return { creator, campaign: deal.type === 'INTRO_REEL' ? 'Intro reel' : campaign?.title ?? '' };
}

export async function remindDeadlines(now = new Date()) {
  const soon = new Date(now.getTime() + SOON_MS);
  const checks: { flag: Flag; statuses: string[]; field: 'draftDue' | 'liveDue'; missed: boolean }[] = [
    { flag: 'draftDueSoon', statuses: ['IN_PRODUCTION', 'REVISION_REQUESTED'], field: 'draftDue', missed: false },
    { flag: 'draftMissed', statuses: ['IN_PRODUCTION', 'REVISION_REQUESTED'], field: 'draftDue', missed: true },
    { flag: 'liveDueSoon', statuses: ['APPROVED'], field: 'liveDue', missed: false },
    { flag: 'liveMissed', statuses: ['APPROVED'], field: 'liveDue', missed: true },
  ];
  let sent = 0;
  for (const c of checks) {
    const due = c.missed ? { $lt: now } : { $gte: now, $lte: soon };
    const deals = await DealModel.find({ status: { $in: c.statuses }, [`deadlines.${c.field}`]: due, [`reminders.${c.flag}`]: { $ne: true } }).limit(200).lean();
    for (const deal of deals) {
      if (!(await claim(deal._id, c.flag))) continue;
      const { creator, campaign } = await labels(deal);
      const link = deal.type === 'INTRO_REEL' ? '/creator/intro-reel' : `/creator/deals/${deal._id}`;
      const date = dateIST(deal.deadlines![c.field]!);
      if (creator) {
        const type = c.missed ? 'creator_deadline_missed' : c.field === 'draftDue' ? 'creator_draft_due_soon' : 'creator_live_due_soon';
        await notify(creator.userId, type, { campaign, date }, link);
      }
      if (c.missed) {
        await notifyAdmins(deal.type === 'INTRO_REEL' ? ['reviewer', 'campaign_manager'] : ['campaign_manager'], 'admin_deadline_missed',
          { creator: creator?.displayName ?? '', campaign, date }, '/deals?status=OVERDUE');
      }
      sent += 1;
    }
  }
  return sent;
}

export async function autoApproveDrafts(now = new Date()) {
  const days = (await getSettings()).brandReviewAutoApproveDays ?? 5;
  if (days <= 0) return 0; // 0 = switched off
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  // Rough filter on the database, exact check (when it ENTERED brand review) below.
  const candidates = await DealModel.find({ status: 'BRAND_REVIEW', updatedAt: { $lte: cutoff } }, { _id: 1 }).limit(100).lean();
  let approved = 0;
  for (const { _id } of candidates) {
    try {
      const done = await withTransaction(async (session) => {
        const deal = await DealModel.findOne({ _id, status: 'BRAND_REVIEW' }).session(session);
        if (!deal) return false;
        const enteredAt = [...deal.statusHistory].reverse().find((h) => h.to === 'BRAND_REVIEW')?.at;
        if (!enteredAt || enteredAt > cutoff) return false;
        applyTransition(deal, dealMachine, 'APPROVED', 'system', undefined, 'brand_review_time_ended');
        const draft = [...deal.submissions].reverse().find((s) => s.kind === 'DRAFT');
        draft?.reviews.push({ by: 'system', decision: 'APPROVE', note: `Approved automatically after ${days} days without a brand review.`, at: now });
        await deal.save({ session });
        const { creator, campaign } = await labels(deal);
        const brand = await BrandProfileModel.findById(deal.brandId, { userId: 1 }).session(session).lean();
        const params = { creator: creator?.displayName ?? '', campaign };
        if (creator) await notify(creator.userId, 'creator_draft_approved', params, `/creator/deals/${deal._id}`, session);
        if (brand) await notify(brand.userId, 'brand_draft_auto_approved', params, `/brand/deals/${deal._id}`, session);
        return true;
      });
      if (done) approved += 1;
    } catch (err) {
      logger.error({ err, dealId: String(_id) }, 'auto-approve failed');
    }
  }
  return approved;
}
