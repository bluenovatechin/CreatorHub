/**
 * INPUT SHAPE GUARDS (run on every request, before the routes). Replace the old express-mongo-sanitize and hpp
 * packages, which are unmaintained and don't work with Express 5.
 *   rejectMongoOperators  any key starting with "$" or containing "." in body, query or URL params → 400.
 *                         Stops tricks like { "email": { "$ne": null } } reaching a database query.
 *                         (Mongoose strictQuery and zod validation are further layers behind this one.)
 *   rejectRepeatedQuery   the same query parameter twice (?status=A&status=B) → 400, so a value can't
 *                         unexpectedly become a list. No route accepts repeated parameters.
 * Rejecting (instead of silently cleaning) makes attacks visible and never changes what a real user sent.
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';

const MAX_DEPTH = 20; // deeper JSON than this is never needed and could be used to slow the server down

function hasBadKey(value: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) return value.some((v) => hasBadKey(v, depth + 1));
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.')) return true;
      if (hasBadKey(v, depth + 1)) return true;
    }
  }
  return false;
}

export function rejectMongoOperators(req: Request, _res: Response, next: NextFunction) {
  if (hasBadKey(req.body) || hasBadKey(req.query) || hasBadKey(req.params)) {
    return next(new AppError('VALIDATION_ERROR', 'errors.invalidInput'));
  }
  next();
}

export function rejectRepeatedQuery(req: Request, _res: Response, next: NextFunction) {
  if (Object.values(req.query ?? {}).some((v) => Array.isArray(v))) return next(new AppError('VALIDATION_ERROR', 'errors.invalidInput'));
  next();
}
