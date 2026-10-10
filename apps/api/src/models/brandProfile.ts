/**
 * BRAND PROFILES collection: one per brand account (created when they choose "brand").
 * Status: INCOMPLETE until the company details form is saved once, then ACTIVE.
 * `phone` is never shown to creators.
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { BRAND_STATUSES, CATEGORY_KEYS, CITY_KEYS } from '@bluenova/shared';

const brandProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    companyName: String,
    contactName: String,
    designation: String,
    phone: String, // contact number (10 digits); never shown to creators
    email: { type: String, lowercase: true },
    emailVerifiedAt: Date,
    gstin: String,
    industry: { type: String, enum: CATEGORY_KEYS },
    city: { type: String, enum: CITY_KEYS },
    areas: [{ type: String, enum: CITY_KEYS }], // cities where the brand wants promotions (default for new campaigns)
    website: String,
    billingAddress: { line1: String, line2: String, city: String, stateCode: String, pincode: String },
    status: { type: String, enum: BRAND_STATUSES, default: 'INCOMPLETE', index: true },
    favouriteCreatorIds: [{ type: Schema.Types.ObjectId, ref: 'CreatorProfile' }],
    internalNotes: { type: String, select: false },
    // Average of the creators' ratings after completed deals (team-only for now), and how many there are.
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type BrandProfile = InferSchemaType<typeof brandProfileSchema>;
export type BrandProfileDoc = HydratedDocument<BrandProfile>;
export const BrandProfileModel = model('BrandProfile', brandProfileSchema);
