/**
 * SYSTEM collections:
 *   Notification  the bell-icon messages
 *   AuditLog      append-only record of important actions (edits/deletes are blocked in code)
 *   Settings      one global document: margins, GST rate, payments on/off, bank details
 */
import { Schema, model, type InferSchemaType } from 'mongoose';

/* ---------- Notifications (text rendered on the client from i18n keys + params) ---------- */
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    link: String, // internal path only
    readAt: Date,
  },
  { timestamps: true },
);
notificationSchema.index({ userId: 1, _id: -1 });
export const NotificationModel = model('Notification', notificationSchema);

/* ---------- Audit log: append-only ---------- */
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: String,
    adminRole: String,
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    changes: Schema.Types.Mixed,
    reason: String,
    ip: String,
    userAgent: String,
    requestId: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
const appendOnly = () => {
  throw new Error('AuditLog is append-only');
};
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndReplace'] as const) {
  auditLogSchema.pre(op, appendOnly);
}
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('AuditLog is append-only'));
  next();
});
export const AuditLogModel = model('AuditLog', auditLogSchema);

/* ---------- Settings singleton ---------- */
const settingsSchema = new Schema(
  {
    _id: { type: String, default: 'global' },
    defaultMarginBps: { type: Number, default: 2500 },
    gstRateBps: { type: Number, default: 1800 },
    tdsRateBps: { type: Number, default: 0 },
    defaultMaxRevisions: { type: Number, default: 2 },
    offerExpiryHours: { type: Number, default: 48 },
    brandReviewAutoApproveDays: { type: Number, default: 5 },
    reapplyAfterDays: { type: Number, default: 90 },
    payoutHoldHoursAfterBankChange: { type: Number, default: 48 },
    // On/off switch for the in-website payment flow. Off = payments are arranged outside the website
    // and the team starts each campaign from the admin panel.
    paymentsEnabled: { type: Boolean, default: false },
    // Bluenova's bank / UPI details shown to brands for manual payment (set by a super admin).
    paymentDetails: {
      accountName: String, bankName: String, accountNumber: String, ifsc: String, upiId: String, instructions: String,
      updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }, updatedAt: Date,
    },
  },
  { timestamps: true },
);
export type Settings = InferSchemaType<typeof settingsSchema>;
export const SettingsModel = model('Settings', settingsSchema);

export async function getSettings(): Promise<Settings> {
  const s = await SettingsModel.findById('global').lean();
  if (s) return s;
  const created = await SettingsModel.findOneAndUpdate(
    { _id: 'global' }, { $setOnInsert: { _id: 'global' } }, { upsert: true, new: true, lean: true },
  );
  return created as Settings;
}
