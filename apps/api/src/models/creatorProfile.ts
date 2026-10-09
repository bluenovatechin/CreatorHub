/**
 * CREATOR PROFILES collection: one per creator account (created when they choose "creator").
 * Filled in during onboarding (5 steps), then reviewed by the team.
 * Status flow: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / CHANGES_REQUESTED / REJECTED (see stateMachines.ts).
 * `phone`, `internalNotes`, `internalTags` are never shown to brands.
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import {
  AGE_GROUPS, CATEGORY_KEYS, CITY_KEYS, CREATOR_STATUSES, FOLLOWER_BANDS, GENDERS, LANGUAGES, REVIEW_REASON_CODES,
} from '@bluenova/shared';

const statusHistory = new Schema(
  { from: String, to: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, at: Date },
  { _id: false },
);

const creatorProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    fullName: String,
    displayName: String,
    phone: String, // WhatsApp / contact number (10 digits); never shown to brands
    gender: { type: String, enum: GENDERS },
    ageGroup: { type: String, enum: AGE_GROUPS },
    city: { type: String, enum: CITY_KEYS },
    languages: [{ type: String, enum: LANGUAGES }],
    bio: String,
    categories: [{ type: String, enum: CATEGORY_KEYS }],
    instagram: {
      handle: String,
      followers: Number,
      avgViews: Number,
      engagementBps: Number, // engagement rate in basis points (5.25% = 525)
      followerBand: { type: String, enum: FOLLOWER_BANDS },
      statsSource: { type: String, enum: ['manual', 'screenshot', 'api'], default: 'manual' },
      statsUpdatedAt: Date,
    },
    reels: [{ _id: false, url: String, addedAt: Date }],
    rateCardPaise: {
      REEL: Number, POST: Number, STORY: Number, STORY_WITH_LINK: Number, CAROUSEL: Number,
    },
    acceptsBarter: { type: Boolean, default: false },
    availability: { open: { type: Boolean, default: true } },
    status: { type: String, enum: CREATOR_STATUSES, default: 'DRAFT', index: true },
    statusHistory: [statusHistory],
    onboardingStep: { type: Number, default: 1 },
    review: {
      scores: { quality: Number, consistency: Number, audienceFit: Number, engagement: Number },
      reasonCode: { type: String, enum: REVIEW_REASON_CODES },
      reasonText: String,
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
      claimedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    internalTags: { type: [String], select: false },
    internalNotes: { type: String, select: false },
    isPartner: { type: Boolean, default: false },
    partnerSince: Date,
    introReelDealId: { type: Schema.Types.ObjectId, ref: 'Deal' },
    creatorScore: { type: Number, default: 60 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedDeals: { type: Number, default: 0 },
    publicProfileEnabled: { type: Boolean, default: false },
    referralCode: { type: String, required: true, unique: true },
    submittedAt: Date,
    reapplyAfter: Date,
  },
  { timestamps: true },
);
creatorProfileSchema.index({ status: 1, categories: 1, city: 1 });

export type CreatorProfile = InferSchemaType<typeof creatorProfileSchema>;
export type CreatorProfileDoc = HydratedDocument<CreatorProfile>;
export const CreatorProfileModel = model('CreatorProfile', creatorProfileSchema);
