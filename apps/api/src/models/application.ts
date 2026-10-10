/**
 * APPLICATIONS: an approved creator applies to an open campaign with a short pitch (and optionally a price).
 * The Bluenova team reviews it: SHORTLISTED (the creator is added to the brand's shortlist) or DECLINED.
 * Brands never see applications, only the resulting shortlist. One application per creator per campaign.
 * Status changes only through applyTransition() with applicationMachine (packages/shared/src/stateMachines.ts).
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { APPLICATION_STATUSES } from '@bluenova/shared';

const applicationSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'CreatorProfile', required: true, index: true },
    pitch: { type: String, required: true, maxlength: 1000 },
    proposedRatePaise: Number,
    status: { type: String, enum: APPLICATION_STATUSES, default: 'SUBMITTED', index: true },
    statusHistory: [{ _id: false, from: String, to: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, at: Date }],
    decisionNote: String, // shown to the creator when declined
    shortlistItemId: { type: Schema.Types.ObjectId, ref: 'ShortlistItem' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true },
);
applicationSchema.index({ campaignId: 1, creatorId: 1 }, { name: 'one_application_per_campaign', unique: true });

export type Application = InferSchemaType<typeof applicationSchema>;
export type ApplicationDoc = HydratedDocument<Application>;
export const ApplicationModel = model('Application', applicationSchema);
