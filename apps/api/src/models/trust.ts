/**
 * TRUST & SAFETY collections (Phase 10). Used by modules/trust and modules/admin/trust.routes.ts.
 *   Dispute  a problem with a running brand deal, raised by its creator or brand. The deal is DISPUTED until a
 *            campaign manager resolves it: CONTINUE (back to `previousStatus`) or CANCEL. One open dispute per deal.
 *   Report   a creator reports a campaign, or a brand reports a creator. Reviewed by the team (ACTIONED / DISMISSED).
 *            One open report per person per target.
 *   Rating   after a COMPLETED brand deal, the brand rates the creator and the creator rates the brand, once each.
 *            Team-only for now (a creator sees their own average); profiles keep ratingAvg / ratingCount.
 * Status changes only through applyTransition() (disputeMachine, reportMachine in packages/shared).
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { DEAL_STATUSES, DISPUTE_REASONS, DISPUTE_STATUSES, REPORT_REASONS, REPORT_STATUSES } from '@bluenova/shared';

const statusHistory = [{ _id: false, from: String, to: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, at: Date }];

const disputeSchema = new Schema(
  {
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    raisedByRole: { type: String, enum: ['creator', 'brand'], required: true },
    reason: { type: String, enum: DISPUTE_REASONS, required: true },
    description: { type: String, required: true, maxlength: 2000 },
    previousStatus: { type: String, enum: DEAL_STATUSES, required: true }, // where the deal was when it was paused
    status: { type: String, enum: DISPUTE_STATUSES, default: 'OPEN', index: true },
    statusHistory,
    resolution: {
      type: new Schema({ outcome: { type: String, enum: ['CONTINUE', 'CANCEL'] }, note: String, by: Schema.Types.ObjectId, at: Date }, { _id: false }),
      default: undefined,
    },
  },
  { timestamps: true },
);
disputeSchema.index({ dealId: 1 }, { name: 'one_open_dispute_per_deal', unique: true, partialFilterExpression: { status: 'OPEN' } });

const reportSchema = new Schema(
  {
    reporterUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reporterRole: { type: String, enum: ['creator', 'brand'], required: true },
    targetType: { type: String, enum: ['CAMPAIGN', 'CREATOR'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: REPORT_STATUSES, default: 'OPEN', index: true },
    statusHistory,
    reviewNote: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true },
);
reportSchema.index(
  { reporterUserId: 1, targetType: 1, targetId: 1 },
  { name: 'one_open_report_per_target', unique: true, partialFilterExpression: { status: 'OPEN' } },
);

const ratingSchema = new Schema(
  {
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', required: true },
    raterUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    raterRole: { type: String, enum: ['creator', 'brand'], required: true },
    targetType: { type: String, enum: ['CREATOR', 'BRAND'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: String,
  },
  { timestamps: true },
);
ratingSchema.index({ dealId: 1, raterRole: 1 }, { name: 'one_rating_per_side', unique: true });

export type Dispute = InferSchemaType<typeof disputeSchema>;
export type DisputeDoc = HydratedDocument<Dispute>;
export const DisputeModel = model('Dispute', disputeSchema);
export type Report = InferSchemaType<typeof reportSchema>;
export const ReportModel = model('Report', reportSchema);
export type Rating = InferSchemaType<typeof ratingSchema>;
export const RatingModel = model('Rating', ratingSchema);
