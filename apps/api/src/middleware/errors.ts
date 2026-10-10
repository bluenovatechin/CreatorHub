/**
 * LAST STOP FOR ERRORS: turns any thrown error into the standard reply
 * { error: { code, message, fields?, requestId } }. Unexpected errors become a generic 500 and are logged;
 * stack traces and internal messages are never sent to the browser.
 */
import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('NOT_FOUND'));
}

/** Never leaks stack traces or internal messages. Clients get a code, an i18n key and the request id. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let appErr: AppError;
  if (err instanceof AppError) {
    appErr = err;
  } else if (err instanceof mongoose.Error.CastError) {
    appErr = new AppError('NOT_FOUND');
  } else if (typeof err === 'object' && err !== null && 'type' in err && (err as { type: string }).type === 'entity.too.large') {
    appErr = new AppError('VALIDATION_ERROR', 'errors.payloadTooLarge');
  } else if (typeof err === 'object' && err !== null && 'type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    appErr = new AppError('VALIDATION_ERROR', 'errors.invalidJson');
  } else if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    appErr = new AppError('CONFLICT');
  } else {
    logger.error({ err, requestId: req.id }, 'unhandled error');
    appErr = new AppError('INTERNAL');
  }
  if (appErr.status >= 500 && env.NODE_ENV !== 'production' && !(err instanceof AppError)) {
    logger.error({ err }, 'internal error');
  }
  if (appErr.retryAfterSeconds) res.setHeader('Retry-After', String(appErr.retryAfterSeconds));
  res.status(appErr.status).json({
    error: { code: appErr.code, message: appErr.message, fields: appErr.fields, requestId: req.id },
  });
}
