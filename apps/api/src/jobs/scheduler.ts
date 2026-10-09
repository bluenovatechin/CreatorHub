/**
 * BACKGROUND JOBS (run inside the API process every 10 minutes; started by server.ts).
 * Currently one job: offers nobody answered in time become EXPIRED and the creator is notified.
 */
import { logger } from '../lib/logger';
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
 * In-process scheduler for development and single-instance deployments.
 * Moves to the BullMQ worker once Redis is available (spec §18).
 */
export function startScheduler() {
  const run = () => expireOffers().catch((err) => logger.error({ err }, 'expireOffers failed'));
  const timer = setInterval(run, 10 * 60_000);
  timer.unref();
  void run();
}
