import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { DEAL_STATUSES, DEAL_TYPES, DELIVERABLE_TYPES, OFFER_DECLINE_REASONS, OFFER_STATUSES } from '@bluenova/shared';

const statusHistory = new Schema(
  { from: String, to: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, at: Date },
  { _id: false },
);
const deliverable = new Schema({ type: { type: String, enum: DELIVERABLE_TYPES }, quantity: Number }, { _id: false });

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
    status: { type: String, enum: DEAL_STATUSES, required: true, index: true },
    statusHistory: [statusHistory],
  },
  { timestamps: true },
);

export type Deal = InferSchemaType<typeof dealSchema>;
export type DealDoc = HydratedDocument<Deal>;
export const DealModel = model('Deal', dealSchema);
