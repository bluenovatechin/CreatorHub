import type { NextFunction, Request, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { AppError } from '../lib/errors';

type Parts = { body?: ZodTypeAny; params?: ZodTypeAny; query?: ZodTypeAny };

export function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message.startsWith('errors.') ? issue.message : `errors.zod.${issue.code}`;
  }
  return fields;
}

/** Validates request parts with zod. Unknown keys are stripped (zod default), so mass assignment is impossible. */
export const validate = (parts: Parts) => (req: Request, _res: Response, next: NextFunction) => {
  req.validated = {};
  for (const key of ['params', 'query', 'body'] as const) {
    const schema = parts[key];
    if (!schema) continue;
    const result = schema.safeParse(req[key] ?? {});
    if (!result.success) return next(new AppError('VALIDATION_ERROR', 'errors.VALIDATION_ERROR', zodFields(result.error)));
    req.validated[key] = result.data;
  }
  next();
};
