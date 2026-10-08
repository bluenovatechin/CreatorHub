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

/** Single-use email links (verify email, reset password). Only the hash is stored. */
const emailTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: ['verify_email', 'reset_password'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
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
