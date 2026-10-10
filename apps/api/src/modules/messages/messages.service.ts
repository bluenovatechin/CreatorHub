/**
 * MESSAGES: shared logic for the website (modules/messages/messages.routes.ts) and the team inbox
 * (modules/admin/messages.routes.ts). Every conversation is between one creator/brand and the Bluenova team.
 *   addMessage()        saves a message, re-opens a closed conversation, updates unread counters, notifies the other side
 *   conversationView()  / messageView()  what each side may see. Users see "Bluenova team", never which team member.
 */
import type { ClientSession } from 'mongoose';
import { conversationMachine, type Actor } from '@bluenova/shared';
import { notify, notifyAdmins } from '../../lib/notify';
import { applyTransition } from '../../lib/transition';
import { ConversationModel, MessageModel, type ConversationDoc } from '../../models/conversation';

/** The fields the views read (works for both saved documents and .lean() query results). */
interface ConversationLike {
  _id: unknown; subject: string; status: string; lastMessageAt: Date; topic?: { type?: string | null; id?: unknown } | null;
  unreadByUser: number; unreadByTeam: number; ownerUserId: unknown; ownerRole: string; createdAt?: Date;
}
interface MessageLike { _id: unknown; from: string; body: string; senderId: unknown; createdAt?: Date }

/** Saves one message. `from` = who wrote it. Re-opens the conversation if it was closed. */
export async function addMessage(
  conv: ConversationDoc, from: 'user' | 'team', senderId: string, body: string, actor: Actor, session?: ClientSession,
) {
  if (conv.status === 'CLOSED') applyTransition(conv, conversationMachine, 'OPEN', actor, senderId, 'new_message');
  const [message] = await MessageModel.create([{ conversationId: conv._id, from, senderId, body }], { session });
  const firstUnread = from === 'user' ? conv.unreadByTeam === 0 : conv.unreadByUser === 0;
  conv.lastMessageAt = new Date();
  if (from === 'user') conv.unreadByTeam += 1;
  else conv.unreadByUser += 1;
  await conv.save({ session });
  // One notification per batch of unread messages, not one per message.
  if (firstUnread) {
    if (from === 'team') {
      await notify(conv.ownerUserId, 'message_from_team', { subject: conv.subject }, `/${conv.ownerRole}/messages?c=${conv._id}`, session);
    } else {
      await notifyAdmins(['reviewer', 'campaign_manager', 'finance'], 'admin_new_message', { subject: conv.subject }, `/inbox?c=${conv._id}`, session);
    }
  }
  return message;
}

/** Marks everything in this conversation as read for one side. */
export const markRead = (id: unknown, side: 'user' | 'team') =>
  ConversationModel.updateOne({ _id: id }, { $set: side === 'user' ? { unreadByUser: 0 } : { unreadByTeam: 0 } });

export function conversationView(c: ConversationLike, viewer: 'user' | 'team') {
  return {
    id: String(c._id), subject: c.subject, status: c.status, lastMessageAt: c.lastMessageAt,
    topic: c.topic?.type ? { type: c.topic.type, id: String(c.topic.id) } : null,
    unread: viewer === 'user' ? c.unreadByUser : c.unreadByTeam,
    ...(viewer === 'team' ? { ownerUserId: String(c.ownerUserId), ownerRole: c.ownerRole } : {}),
    createdAt: c.createdAt,
  };
}

export function messageView(m: MessageLike, viewer: 'user' | 'team', teamNames?: Map<string, string | null>) {
  return {
    id: String(m._id), from: m.from, body: m.body, at: m.createdAt,
    // Users only ever see "Bluenova team"; the team sees which colleague replied.
    ...(viewer === 'team' && m.from === 'team' ? { senderName: teamNames?.get(String(m.senderId)) ?? null } : {}),
  };
}
