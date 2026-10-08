import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PAYMENT_METHODS } from '@bluenova/shared';

/**
 * Manual payments: the brand transfers money to Bluenova's bank/UPI and submits the transaction details;
 * the finance team checks the bank statement and verifies (or rejects) it.
 */
const paymentSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'BrandProfile', required: true, index: true },
    dealIds: [{ type: Schema.Types.ObjectId, ref: 'Deal' }],
    subtotalPaise: { type: Number, required: true },
    gst: { rateBps: Number, cgstPaise: Number, sgstPaise: Number, igstPaise: Number },
    totalPaise: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    reference: { type: String, required: true }, // UTR / UPI transaction id / cheque number
    amountPaidPaise: { type: Number, required: true },
    paidOn: { type: Date, required: true },
    payerName: { type: String, required: true },
    note: String,
    status: { type: String, enum: ['SUBMITTED', 'VERIFIED', 'REJECTED'], default: 'SUBMITTED', index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectReason: String,
  },
  { timestamps: true },
);
// The same bank reference can't be used for two payments (unless the earlier one was rejected).
paymentSchema.index({ method: 1, reference: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['SUBMITTED', 'VERIFIED'] } } });

export type Payment = InferSchemaType<typeof paymentSchema>;
export type PaymentDoc = HydratedDocument<Payment>;
export const PaymentModel = model('Payment', paymentSchema);
