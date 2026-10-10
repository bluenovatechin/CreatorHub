/**
 * IDEMPOTENCY KEYS: remembers the answer to important requests (payments, accepting an offer, starting a campaign…)
 * so that the SAME request sent twice (double click, network retry, a phone resending after a timeout) is done once.
 * Used only by middleware/idempotency.ts. Documents delete themselves (TTL): unfinished ones after 5 minutes,
 * finished ones after 24 hours.
 */
import { Schema, model } from 'mongoose';

const idempotencyKeySchema = new Schema(
  {
    // sha256 of (user id + method + path + the key the browser sent): one user's key can never collide with another's.
    key: { type: String, required: true, unique: true },
    fingerprint: { type: String, required: true }, // sha256 of the request body: the same key with a different body is refused
    status: { type: String, enum: ['in_progress', 'done'], required: true },
    responseStatus: Number,
    responseBody: Schema.Types.Mixed,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const IdempotencyKeyModel = model('IdempotencyKey', idempotencyKeySchema);
