/**
 * IDEMPOTENT ROUTES: `idempotent` makes a route safe to call twice with the same `Idempotency-Key` header.
 *   first request   → runs normally; a successful (2xx) answer is saved
 *   same key again  → the saved answer is sent back (header `Idempotent-Replayed: true`); nothing runs twice
 *   still running   → 409 errors.requestInProgress (wait and try again)
 *   same key, different body → 409 errors.idempotencyMismatch (a bug in the caller)
 * Failed answers (4xx/5xx) are NOT saved, so fixing the problem and retrying with the same key works.
 * Requests without the header behave exactly as before (the state checks in each route still block duplicates).
 * Put it AFTER authenticate(): keys are scoped to the signed-in user. Model: models/idempotency.ts.
 * The browser client (packages/ui/src/api.ts) sends a key when a page passes one.
 */
import type { NextFunction, Request, Response } from 'express';
import { sha256 } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { IdempotencyKeyModel } from '../models/idempotency';

const IN_PROGRESS_TTL_MS = 5 * 60_000; // an abandoned (crashed) request frees its key after 5 minutes
const DONE_TTL_MS = 24 * 3_600_000;

const isDuplicateKeyError = (err: unknown) => typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;

export async function idempotent(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.get('idempotency-key');
    if (!raw) return next();
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(raw)) throw new AppError('VALIDATION_ERROR', 'errors.idempotencyKey');
    const key = sha256(`${req.auth?.id ?? 'anonymous'}:${req.method}:${req.originalUrl.split('?')[0]}:${raw}`);
    const fingerprint = sha256(JSON.stringify(req.body ?? {}));

    try {
      await IdempotencyKeyModel.create({ key, fingerprint, status: 'in_progress', expiresAt: new Date(Date.now() + IN_PROGRESS_TTL_MS) });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // Seen this key before.
      const existing = await IdempotencyKeyModel.findOne({ key }).lean();
      if (existing?.fingerprint && existing.fingerprint !== fingerprint) throw new AppError('CONFLICT', 'errors.idempotencyMismatch');
      if (existing?.status === 'done') {
        res.setHeader('Idempotent-Replayed', 'true');
        res.status(existing.responseStatus ?? 200).json(existing.responseBody);
        return;
      }
      throw new AppError('CONFLICT', 'errors.requestInProgress');
    }

    // Save the answer BEFORE sending it, so a retry arriving right after always finds it.
    let answered = false;
    const send = res.json.bind(res);
    res.json = (body: unknown) => {
      answered = true;
      const status = res.statusCode;
      const save = status < 300
        ? IdempotencyKeyModel.updateOne({ key }, { $set: { status: 'done', responseStatus: status, responseBody: body, expiresAt: new Date(Date.now() + DONE_TTL_MS) } })
        : IdempotencyKeyModel.deleteOne({ key }); // failed: let the caller retry with the same key
      save.catch((err) => logger.error({ err }, 'idempotency key update failed')).finally(() => send(body));
      return res;
    };
    // The connection dropped before any answer: free the key so a retry can run.
    res.on('close', () => {
      if (!answered) void IdempotencyKeyModel.deleteOne({ key, status: 'in_progress' }).catch(() => undefined);
    });
    next();
  } catch (err) {
    next(err);
  }
}
