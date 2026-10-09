/**
 * THE ONE ERROR TYPE the API throws on purpose: `new AppError('NOT_FOUND')`.
 * Each code maps to an HTTP status (below). `message` is a translation key like 'errors.badCredentials'
 * that the website turns into English/Gujarati text. middleware/errors.ts turns it into the JSON reply.
 */
export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'INVALID_STATE'
  | 'CONFLICT' | 'RATE_LIMITED' | 'INVALID_OTP' | 'STEP_UP_REQUIRED' | 'INTERNAL' | 'UNAVAILABLE';

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  INVALID_STATE: 409,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INVALID_OTP: 400,
  STEP_UP_REQUIRED: 401,
  INTERNAL: 500,
  UNAVAILABLE: 503, // e.g. the database isn't connected yet
};

/** An error that is safe to show to the client. `message` is an i18n key. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string = `errors.${code}`,
    readonly fields?: Record<string, string>,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const notFound = () => new AppError('NOT_FOUND');
export const invalidState = () => new AppError('INVALID_STATE');
