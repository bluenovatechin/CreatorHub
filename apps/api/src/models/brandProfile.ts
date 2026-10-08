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
    website: String,
    billingAddress: { line1: String, line2: String, city: String, stateCode: String, pincode: String },
    status: { type: String, enum: BRAND_STATUSES, default: 'INCOMPLETE', index: true },
    favouriteCreatorIds: [{ type: Schema.Types.ObjectId, ref: 'CreatorProfile' }],
    internalNotes: { type: String, select: false },
  },
  { timestamps: true },
);

export type BrandProfile = InferSchemaType<typeof brandProfileSchema>;
export type BrandProfileDoc = HydratedDocument<BrandProfile>;
export const BrandProfileModel = model('BrandProfile', brandProfileSchema);
