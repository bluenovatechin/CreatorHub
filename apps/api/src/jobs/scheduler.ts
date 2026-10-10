/**
 * BACKGROUND JOBS (run inside the API process; started by server.ts). This file: offers nobody answered in
 * time become EXPIRED and the creator is notified; plus the timer that runs every job (startScheduler).
 * Other jobs: deadlines.ts (reminders, auto-approve), emailOutbox.ts (notification emails).
 */
import { logger } from '../lib/logger';
import { autoApproveDrafts, remindDeadlines } from './deadlines';
import { processEmailOutbox } from './emailOutbox';
import { notify } from '../lib/notify';
import { CampaignModel } from '../models/campaign';
import { CreatorProfileModel } from '../models/creatorProfile';
import { OfferModel } from '../models/deal';

/** Marks SENT offers past their expiry as EXPIRED and tells the creator. */
export async function expireOffers(now = new Date()) {
  const due = await OfferModel.find({ status: 'SENT', expiresAt: { $lte: now } }).limit(500);
  for (const offer of due) {
    const r = await OfferModel.updateOne(
      { _id: offer._id, status: 'SENT' },
      { $set: { status: 'EXPIRED' }, $push: { statusHistory: { from: 'SENT', to: 'EXPIRED', at: now } } },
    );
    if (r.modifiedCount !== 1) continue;
    const [creator, campaign] = await Promise.all([
      CreatorProfileModel.findById(offer.creatorId, { userId: 1 }).lean(),
      CampaignModel.findById(offer.campaignId, { title: 1 }).lean(),
    ]);
    if (creator) await notify(creator.userId, 'creator_offer_expired', { campaign: campaign?.title ?? '' }, `/creator/offers/${offer._id}`);
  }
  return due.length;
}

/**
 * In-process scheduler (one API server, so no job queue is needed):
 *   every 10 min  expire unanswered offers, deadline reminders, auto-approve drafts the brand didn't review
 *   every minute  send queued notification emails (jobs/emailOutbox.ts)
 * Every job is safe to run twice at the same time (atomic claims), e.g. if Render briefly runs two copies.
 */
export function startScheduler() {
  const every10 = () => {
    expireOffers().catch((err) => logger.error({ err }, 'expireOffers failed'));
    remindDeadlines().catch((err) => logger.error({ err }, 'remindDeadlines failed'));
    autoApproveDrafts().catch((err) => logger.error({ err }, 'autoApproveDrafts failed'));
  };
  const everyMinute = () => processEmailOutbox().catch((err) => logger.error({ err }, 'email outbox failed'));
  setInterval(every10, 10 * 60_000).unref();
  setInterval(everyMinute, 60_000).unref();
  every10();
  void everyMinute();
}
