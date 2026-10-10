/**
 * WEBSITE ENQUIRIES: messages sent from the public Contact page by visitors (no account needed).
 * Read and marked handled by the team in the admin Inbox ("Website enquiries"). Deleted after 1 year.
 * Holds a name, email and optional phone: personal data, so only the team sees it (audited when listed).
 */
import { Schema, model, type InferSchemaType } from 'mongoose';

const enquirySchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 60 },
    email: { type: String, required: true },
    phone: String,
    topic: { type: String, enum: ['CREATOR', 'BRAND', 'OTHER'], required: true },
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ['OPEN', 'HANDLED'], default: 'OPEN', index: true },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    handledAt: Date,
    ip: String,
  },
  { timestamps: true },
);
enquirySchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 86_400 });

export type Enquiry = InferSchemaType<typeof enquirySchema>;
export const EnquiryModel = model('Enquiry', enquirySchema);
