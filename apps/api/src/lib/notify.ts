/**
 * IN-APP NOTIFICATIONS (the bell icon). Stores a type + parameters; the website turns it into text
 * in the user's language (i18n key `notif.<type>`). `link` must be an internal path like /creator/offers/123.
 */
import type { ClientSession, Types } from 'mongoose';
import type { AdminRole } from '@bluenova/shared';
import { NotificationModel } from '../models/system';
import { UserModel } from '../models/user';
import { logger } from './logger';

/**
 * In-app notification. Text is rendered on the client from `notif.<type>` + params.
 * WhatsApp/email delivery is added later through provider adapters.
 */
export async function notify(
  userId: Types.ObjectId | string,
  type: string,
  params: Record<string, string | number> = {},
  link?: string,
  session?: ClientSession,
) {
  if (link && !link.startsWith('/')) throw new Error('Notification links must be internal paths');
  await NotificationModel.create([{ userId, type, params, link }], { session });
  logger.debug({ type, userId: String(userId) }, 'notification created');
}

export async function notifyAdmins(
  adminRoles: AdminRole[],
  type: string,
  params: Record<string, string | number> = {},
  link?: string,
  session?: ClientSession,
) {
  const admins = await UserModel.find(
    { role: 'admin', status: 'active', adminRole: { $in: [...adminRoles, 'super_admin'] } }, { _id: 1 },
  ).session(session ?? null).lean();
  if (admins.length === 0) return;
  await NotificationModel.create(
    admins.map((a) => ({ userId: a._id, type, params, link })), { session, ordered: true },
  );
}
