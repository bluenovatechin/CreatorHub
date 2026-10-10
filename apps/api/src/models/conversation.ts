/**
 * MESSAGES between ONE creator or brand and the Bluenova team. Creators and brands never message each other
 * (product decision 2026-10-10), so contact details can't be swapped around the platform.
 *   Conversation  one thread: who it belongs to, subject, optional topic (one of their campaigns/deals),
 *                 OPEN/CLOSED (conversationMachine), and unread counters for each side
 *   Message       one message in a thread, from the user or from the team
 * Used by modules/messages (website) and modules/admin/messages.routes.ts (team inbox).
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { CONVERSATION_STATUSES } from '@bluenova/shared';

const conversationSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ownerRole: { type: String, enum: ['creator', 'brand'], required: true },
    subject: { type: String, required: true, maxlength: 120 },
    topic: { type: new Schema({ type: { type: String, enum: ['CAMPAIGN', 'DEAL'] }, id: Schema.Types.ObjectId }, { _id: false }), default: undefined },
    status: { type: String, enum: CONVERSATION_STATUSES, default: 'OPEN' },
    statusHistory: [{ _id: false, from: String, to: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, at: Date }],
    lastMessageAt: { type: Date, required: true },
    unreadByUser: { type: Number, default: 0 },
    unreadByTeam: { type: Number, default: 0 },
  },
  { timestamps: true },
);
conversationSchema.index({ ownerUserId: 1, lastMessageAt: -1 });
conversationSchema.index({ status: 1, lastMessageAt: -1 });

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    from: { type: String, enum: ['user', 'team'], required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true },
);
messageSchema.index({ conversationId: 1, _id: -1 });

export type Conversation = InferSchemaType<typeof conversationSchema>;
export type ConversationDoc = HydratedDocument<Conversation>;
export const ConversationModel = model('Conversation', conversationSchema);
export type Message = InferSchemaType<typeof messageSchema>;
export const MessageModel = model('Message', messageSchema);
