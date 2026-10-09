/**
 * SMALL HELPERS USED BY EVERY ROUTE:
 *   h(fn)            wraps an async route so thrown errors reach the error handler
 *   ok(res, data)    sends the standard success reply: { data, meta? }
 *   input(req)       reads the input that validate() already checked (never use req.body directly)
 *   withTransaction  all-or-nothing database changes (e.g. accept an offer AND create the deal)
 *   cursorPage       "load more" paging (newest first)
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ClientSession } from 'mongoose';
import mongoose from 'mongoose';
import { AppError } from './errors';

/** Wrap async handlers so rejected promises reach the error handler. */
export const h = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const ok = (res: Response, data: unknown, status = 200, meta?: Record<string, unknown>) =>
  res.status(status).json(meta ? { data, meta } : { data });

/** Validated input placed on the request by the `validate` middleware. */
export function input<T>(req: Request, part: 'body' | 'params' | 'query' = 'body'): T {
  const v = req.validated?.[part];
  if (v === undefined) throw new AppError('INTERNAL', 'errors.INTERNAL');
  return v as T;
}

export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export function cursorPage<T extends { _id: unknown }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const last = page[page.length - 1];
  return { page, nextCursor: hasMore && last ? String(last._id) : null };
}
