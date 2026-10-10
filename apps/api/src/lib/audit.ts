/**
 * AUDIT LOG WRITER: records who did what (admin actions, money, account changes) into the AuditLog
 * collection, which can only be added to, never edited or deleted (see models/system.ts).
 * Used by admin routes, payments and admin → users. Never put passwords or secrets in `changes`.
 */
import type { Request } from 'express';
import type { ClientSession, Types } from 'mongoose';
import { AuditLogModel } from '../models/system';
import { logger } from './logger';

/** Record an admin or security-relevant action. Never pass decrypted secrets in `changes`. */
export async function audit(
  req: Request,
  action: string,
  entityType: string,
  entityId: Types.ObjectId | string | undefined,
  extra: { changes?: Record<string, unknown>; reason?: string } = {},
  session?: ClientSession,
) {
  try {
    await AuditLogModel.create([{
      actorId: req.auth?.id,
      actorRole: req.auth?.role ?? undefined,
      adminRole: req.auth?.adminRole ?? undefined,
      action,
      entityType,
      entityId,
      changes: extra.changes,
      reason: extra.reason,
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 300),
      requestId: req.id,
    }], { session });
  } catch (err) {
    // Inside a transaction, the failure must abort the business change too.
    if (session) throw err;
    logger.error({ err, action }, 'audit log write failed');
  }
}

/**
 * Records that an admin LOOKED at personal data, at most once per 10 minutes per admin + action + record.
 * The admin panel refreshes open pages every 15 seconds; without this, one open page would fill the audit log.
 */
export async function auditView(req: Request, action: string, entityType: string, entityId: Types.ObjectId | string | undefined) {
  const recent = await AuditLogModel.exists({
    actorId: req.auth?.id, action, entityType, entityId: entityId ?? null, createdAt: { $gt: new Date(Date.now() - 10 * 60_000) },
  });
  if (!recent) await audit(req, action, entityType, entityId);
}
