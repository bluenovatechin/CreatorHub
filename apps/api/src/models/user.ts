/**
 * USERS collection: one document per account (creator, brand, not-yet-chosen, or team member).
 * Holds login data only. Creator/brand details live in creatorProfile.ts / brandProfile.ts.
 * Secret fields have `select: false` and are only loaded when explicitly asked for.
 * Field-by-field explanation: docs/DATA_MODELS.md.
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ADMIN_ROLES, ROLES, UI_LANGUAGES } from '@bluenova/shared';

const encryptedValue = new Schema({ v: String, iv: String, tag: String, ct: String }, { _id: false });

const userSchema = new Schema(
  {
    role: { type: String, enum: [...ROLES, null], default: null },
    adminRole: { type: String, enum: [...ADMIN_ROLES, null], default: null },
    name: { type: String, required: true, maxlength: 60 },
    email: { type: String, required: true, lowercase: true, trim: true }, // login identifier
    emailVerifiedAt: Date,
    passwordHash: { type: String, select: false }, // empty for Google-only accounts
    googleId: { type: String }, // Google account id ("sub") when the user signs in with Google
    passwordChangedAt: Date,
    phone: { type: String }, // optional contact number (E.164); not used for login
    status: { type: String, enum: ['active', 'suspended', 'deletion_pending', 'deleted'], default: 'active' },
    tokenVersion: { type: Number, default: 0 },
    preferredLanguage: { type: String, enum: UI_LANGUAGES, default: 'gu' },
    consents: [{
      _id: false,
      type: { type: String, enum: ['privacy', 'terms', 'creator_agreement', 'brand_agreement'] },
      version: String,
      acceptedAt: Date,
      ip: String,
    }],
    totpSecret: { type: encryptedValue, select: false },
    totpEnabled: { type: Boolean, default: false },
    totpLastStep: { type: Number, select: false },
    referredByCode: String,
    lastLoginAt: Date,
  },
  { timestamps: true },
);
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } });
userSchema.index({ role: 1, adminRole: 1 });

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);
