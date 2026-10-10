/**
 * OFFERS (sent to a creator when a brand selects them; accept/decline within 48h) and
 * DEALS (created when a creator accepts: the actual piece of work, from payment to the live post).
 * Each deal keeps the creator's `submissions` (draft links, then the live post link) with every review of them.
 * `marginPaise` (Bluenova's cut) has select:false and is never shown to brands or creators.
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { DEAL_STATUSES, DEAL_TYPES, STORED_DELIVERABLE_TYPES, OFFER_DECLINE_REASONS, OFFER_STATUSES } from '@bluenova/shared';

const statusHistory = new Schema(
  { from: String, to: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, at: Date },
  { _id: false },
);
const deliverable = new Schema({ type: { type: String, enum: STORED_DELIVERABLE_TYPES }, quantity: Number }, { _id: false }); // incl. older formats

const offerSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'CreatorProfile', required: true, index: true },
    shortlistItemId: { type: Schema.Types.ObjectId, ref: 'ShortlistItem', required: true, unique: true },
    payoutPaise: { type: Number, required: true },
    deliverables: [deliverable],
    deadlines: { draftDue: Date, liveDue: Date },
    briefSnapshot: {
      title: String, description: String, dos: [String], donts: [String], referenceUrls: [String],
      hashtags: [String], mentions: [String], disclosure: String,
    },
    status: { type: String, enum: OFFER_STATUSES, default: 'SENT' },
    decline: { reason: { type: String, enum: OFFER_DECLINE_REASONS }, note: String },
    expiresAt: { type: Date, required: true },
    statusHistory: [statusHistory],
  },
  { timestamps: true },
);
offerSchema.index({ status: 1, expiresAt: 1 });

export type Offer = InferSchemaType<typeof offerSchema>;
export type OfferDoc = HydratedDocument<Offer>;
export const OfferModel = model('Offer', offerSchema);

/** A recorded change to agreed terms: who, when, why, and { field: { from, to } }. */
const amendment = new Schema(
  { by: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date, reason: String, changes: Schema.Types.Mixed },
  { _id: false },
);

/** One review of a submission: by the Bluenova team or by the brand. */
const workReview = new Schema(
  {
    by: { type: String, enum: ['team', 'brand', 'system'], required: true }, // system = automatic (e.g. review time ended)
    decision: { type: String, enum: ['APPROVE', 'REVISION', 'VERIFY', 'REJECT'], required: true },
    note: String,
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, required: true },
  },
  { _id: false },
);

/**
 * One piece of work the creator sent: a DRAFT link (reviewed by the team, then the brand) or the LIVE post link
 * (checked by the team). Links only; no files are uploaded to Bluenova.
 */
const workSubmission = new Schema({
  kind: { type: String, enum: ['DRAFT', 'LIVE'], required: true },
  url: { type: String, required: true },
  note: String,
  submittedAt: { type: Date, required: true },
  sharedWithBrand: { type: Boolean, default: false }, // drafts become visible to the brand only when the team forwards them
  reviews: [workReview],
});

const dealSchema = new Schema(
  {
    type: { type: String, enum: DEAL_TYPES, required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'BrandProfile', index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'CreatorProfile', required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer' },
    brandPricePaise: Number,
    creatorPayoutPaise: Number,
    marginPaise: { type: Number, select: false },
    deliverables: [deliverable],
    deadlines: { draftDue: Date, liveDue: Date },
    maxRevisions: { type: Number, default: 2 },
    brandRevisionsUsed: { type: Number, default: 0 },
    submissions: [workSubmission],
    completedAt: Date,
    // Which deadline messages were already sent (jobs/deadlines.ts), so each goes out only once.
    reminders: {
      draftDueSoon: Boolean, draftMissed: Boolean, liveDueSoon: Boolean, liveMissed: Boolean,
    },
    // Changes to agreed terms after acceptance (admin → amend), each with who, when and why.
    amendments: [amendment],
    status: { type: String, enum: DEAL_STATUSES, required: true, index: true },
    statusHistory: [statusHistory],
  },
  { timestamps: true },
);

export type Deal = InferSchemaType<typeof dealSchema>;
export type DealDoc = HydratedDocument<Deal>;
// One deal per accepted offer, even if two "accept" requests race each other.
dealSchema.index({ offerId: 1 }, { name: 'one_deal_per_offer', unique: true, partialFilterExpression: { offerId: { $type: 'objectId' } } });
dealSchema.index({ creatorId: 1, status: 1 });
export const DealModel = model('Deal', dealSchema);
