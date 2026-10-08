import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import {
  AGE_GROUPS, CAMPAIGN_GOALS, CAMPAIGN_STATUSES, CATEGORY_KEYS, CITY_KEYS, COLLAB_TYPES,
  DELIVERABLE_TYPES, FOLLOWER_BANDS, GENDERS, LANGUAGES, SHORTLIST_STATUSES,
} from '@bluenova/shared';

const statusHistory = new Schema(
  { from: String, to: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, at: Date },
  { _id: false },
);

const deliverable = new Schema({ type: { type: String, enum: DELIVERABLE_TYPES }, quantity: Number }, { _id: false });

const campaignSchema = new Schema(
  {
    brandId: { type: Schema.Types.ObjectId, ref: 'BrandProfile', required: true, index: true },
    assignedManagerId: { type: Schema.Types.ObjectId, ref: 'User' },
    title: String,
    goal: { type: String, enum: CAMPAIGN_GOALS },
    description: String,
    filters: {
      categories: [{ type: String, enum: CATEGORY_KEYS }],
      cities: [{ type: String, enum: CITY_KEYS }],
      languages: [{ type: String, enum: LANGUAGES }],
      followerBands: [{ type: String, enum: FOLLOWER_BANDS }],
      genders: [{ type: String, enum: GENDERS }],
      ageGroups: [{ type: String, enum: AGE_GROUPS }],
      minEngagementBps: Number,
    },
    deliverables: [deliverable],
    creatorsNeeded: Number,
    collabType: { type: String, enum: COLLAB_TYPES },
    product: { name: String, valuePaise: Number, shippingRequired: Boolean },
    budget: { suggest: Boolean, minPaise: Number, maxPaise: Number },
    startDate: Date,
    endDate: Date,
    guidelines: {
      dos: [String],
      donts: [String],
      referenceUrls: [String],
      hashtags: [String],
      mentions: [String],
      disclosure: { type: String, default: '#ad' },
    },
    maxRevisions: { type: Number, default: 2 },
    usageRights: { isRequired: { type: Boolean, default: false }, durationDays: Number },
    status: { type: String, enum: CAMPAIGN_STATUSES, default: 'DRAFT', index: true },
    statusHistory: [statusHistory],
    wizardStep: { type: Number, default: 1 },
    interestedCreatorIds: { type: [{ type: Schema.Types.ObjectId, ref: 'CreatorProfile' }], select: false },
    submittedAt: Date,
  },
  { timestamps: true },
);

export type Campaign = InferSchemaType<typeof campaignSchema>;
export type CampaignDoc = HydratedDocument<Campaign>;
export const CampaignModel = model('Campaign', campaignSchema);

const shortlistItemSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'CreatorProfile', required: true },
    brandPricePaise: { type: Number, required: true, min: 0 },
    creatorPayoutPaise: { type: Number, required: true, min: 0 },
    matchScore: Number,
    adminNote: String,
    status: { type: String, enum: SHORTLIST_STATUSES, default: 'PROPOSED' },
    proposedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
shortlistItemSchema.index({ campaignId: 1, creatorId: 1 }, { unique: true });

export type ShortlistItem = InferSchemaType<typeof shortlistItemSchema>;
export type ShortlistItemDoc = HydratedDocument<ShortlistItem>;
export const ShortlistItemModel = model('ShortlistItem', shortlistItemSchema);
