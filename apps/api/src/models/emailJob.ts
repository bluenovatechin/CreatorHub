/**
 * EMAIL OUTBOX: one document per notification email (created by lib/notify.ts, sent by jobs/emailOutbox.ts).
 *   PENDING → SENDING → SENT
 *                    ↘ PENDING again (temporary failure: retried later, up to 5 tries) ↘ FAILED (gave up / permanent)
 *   SKIPPED: the person turned emails off or has no email address by the time it was sent.
 * `notificationId` is unique, so one notification can never produce two emails.
 * The address is NOT stored here: it is read from the user at sending time (so a changed address is respected
 * and the outbox holds no copy of personal data). Kept 90 days for the admin "Email log", then deleted.
 */
import { Schema, model, type InferSchemaType } from 'mongoose';

export const EMAIL_JOB_STATUSES = ['PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'] as const;

const emailJobSchema = new Schema(
  {
    notificationId: { type: Schema.Types.ObjectId, ref: 'Notification', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    link: String,
    status: { type: String, enum: EMAIL_JOB_STATUSES, default: 'PENDING' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, required: true },
    lockedUntil: Date, // while SENDING; a crashed sender's job becomes available again after this
    lastError: String,
    sentAt: Date,
  },
  { timestamps: true },
);
emailJobSchema.index({ notificationId: 1 }, { name: 'one_email_per_notification', unique: true });
emailJobSchema.index({ status: 1, nextAttemptAt: 1 });
emailJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86_400 });

export type EmailJob = InferSchemaType<typeof emailJobSchema>;
export const EmailJobModel = model('EmailJob', emailJobSchema);
