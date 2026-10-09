/**
 * LOGIN-RELATED collections (all store hashes, never the real secret):
 *   RefreshToken   one per logged-in device ("keep me logged in" cookie), rotated on every use
 *   EmailToken     one-time email secrets: reset link, 6-digit signup code, signup ticket
 *   LoginThrottle  failed-login counter per email (5 wrong passwords → 15-minute lock)
 * Expired documents are deleted automatically by MongoDB (TTL indexes).
 */
import { Schema, model } from 'mongoose';

/** Refresh tokens: only the SHA-256 hash is stored. Rotated on every use. */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['user', 'admin'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    // Only 'rotated' tokens get the short parallel-tab grace window; theft/logout revocations never do.
    revokedReason: { type: String, enum: ['rotated', 'reuse_detected', 'logout', 'logout_all', 'inactive', 'password_changed'] },
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);

/**
 * One-time email secrets. Only hashes are stored, never the real value. Three kinds (`purpose`):
 *   reset_password  the link in a "forgot password" email (valid 1 hour, works once)
 *   verify_otp      the 6-digit signup code (valid 10 minutes, max 5 wrong tries)
 *   signup_ticket   a random value only the signing-up browser tab holds; it says WHICH account the code is for
 */
const emailTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: ['reset_password', 'signup_ticket', 'verify_otp'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
    codeHash: String, // verify_otp only: HMAC of the 6-digit code
    attempts: { type: Number, default: 0 }, // verify_otp only
    // signup_ticket only: details from a repeated, unfinished signup. Applied only after the emailed code is entered,
    // so whoever proves they own the inbox ends up with the password THEY chose.
    pending: { type: new Schema({ name: String, passwordHash: String }, { _id: false }), default: undefined },
  },
  { timestamps: true },
);
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 }); // purge an hour after expiry
export const EmailTokenModel = model('EmailToken', emailTokenSchema);

/**
 * Failed logins per email address (whether or not the account exists, so lockouts reveal nothing).
 * 5 failures in 15 minutes lock that email for 15 minutes.
 */
const loginThrottleSchema = new Schema({
  key: { type: String, required: true, unique: true }, // sha256(email)
  failures: { type: Number, default: 0 },
  windowStart: { type: Date, required: true },
  lockedUntil: Date,
  purgeAt: { type: Date, required: true },
});
loginThrottleSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
export const LoginThrottleModel = model('LoginThrottle', loginThrottleSchema);
