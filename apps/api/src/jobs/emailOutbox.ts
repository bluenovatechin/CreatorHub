/**
 * EMAIL OUTBOX SENDER: sends the queued notification emails (models/emailJob.ts) in the background.
 * Runs every minute from scheduler.ts, and a few seconds after a new email is queued (kickEmailOutbox).
 *
 * For each due job: claim it atomically (so two runs never send the same email), check the person still wants
 * emails, send it in their language, then mark it SENT. Temporary failures (network, rate limit, provider
 * outage) are retried after 1 min, 5 min, 30 min, 2 h; permanent ones (bad address, unverified sender) or the
 * 5th failure end as FAILED with the reason. The admin "Email log" shows all of this.
 * Daily cap (EMAIL_DAILY_LIMIT, default 250) keeps us inside Brevo's free plan: over the cap, emails wait.
 * Delivery is "at least once": if the server stops right after the provider accepted an email but before it
 * was marked SENT, that one email can go out twice. Everything else is exactly once.
 */
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { EmailJobModel } from '../models/emailJob';
import { UserModel } from '../models/user';
import { emailProvider, isTransientEmailError } from '../providers/email';
import { notificationEmail } from '../providers/notificationEmails';

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000];
const LOCK_MS = 2 * 60_000;
const BATCH = 20;

/** Sends due emails. Returns how many were handled (sent, skipped, retried or failed). */
export async function processEmailOutbox(now = new Date()): Promise<number> {
  const sentToday = await EmailJobModel.countDocuments({ status: 'SENT', sentAt: { $gt: new Date(now.getTime() - 86_400_000) } });
  let budget = Math.min(BATCH, Math.max(0, env.EMAIL_DAILY_LIMIT - sentToday));
  if (budget === 0) {
    logger.warn({ limit: env.EMAIL_DAILY_LIMIT }, 'daily email limit reached; notification emails wait');
    return 0;
  }
  let handled = 0;
  while (budget-- > 0) {
    // Claim one due job. A SENDING job whose lock expired belonged to a sender that stopped: take it over.
    const job = await EmailJobModel.findOneAndUpdate(
      { $or: [{ status: 'PENDING', nextAttemptAt: { $lte: now } }, { status: 'SENDING', lockedUntil: { $lt: now } }] },
      { $set: { status: 'SENDING', lockedUntil: new Date(now.getTime() + LOCK_MS) }, $inc: { attempts: 1 } },
      { sort: { nextAttemptAt: 1 }, new: true },
    );
    if (!job) break;
    handled += 1;
    const user = await UserModel.findById(job.userId, { email: 1, preferredLanguage: 1, emailNotifications: 1, status: 1 }).lean();
    if (!user?.email || user.status !== 'active' || user.emailNotifications === false) {
      await EmailJobModel.updateOne({ _id: job._id }, { $set: { status: 'SKIPPED', lastError: !user?.email ? 'no address' : 'emails turned off or account inactive' }, $unset: { lockedUntil: 1 } });
      continue;
    }
    try {
      await emailProvider().send(notificationEmail(user.email, user.preferredLanguage === 'en' ? 'en' : 'gu', job.type, job.params ?? {}, job.link ?? null));
      await EmailJobModel.updateOne({ _id: job._id }, { $set: { status: 'SENT', sentAt: new Date() }, $unset: { lockedUntil: 1, lastError: 1 } });
    } catch (err) {
      const reason = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      const retry = isTransientEmailError(err) && job.attempts < MAX_ATTEMPTS;
      await EmailJobModel.updateOne({ _id: job._id }, {
        $set: retry
          ? { status: 'PENDING', lastError: reason, nextAttemptAt: new Date(now.getTime() + BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)]) }
          : { status: 'FAILED', lastError: reason },
        $unset: { lockedUntil: 1 },
      });
      logger.warn({ jobId: String(job._id), attempts: job.attempts, retry, reason }, 'notification email not sent');
    }
  }
  return handled;
}

let kickTimer: NodeJS.Timeout | null = null;
/**
 * Sends new emails soon instead of waiting for the next minute. Waits 3 s so the transaction that queued the
 * email has committed. Off in tests (they call processEmailOutbox themselves).
 */
export function kickEmailOutbox() {
  if (env.NODE_ENV === 'test' || kickTimer) return;
  kickTimer = setTimeout(() => {
    kickTimer = null;
    processEmailOutbox().catch((err) => logger.error({ err }, 'email outbox failed'));
  }, 3_000);
  kickTimer.unref();
}
