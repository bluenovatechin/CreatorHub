/**
 * TypeScript additions to Express's Request object:
 *   req.id         unique id per request (also sent back as the X-Request-Id header, shown in error messages)
 *   req.auth       the logged-in user (set by middleware/auth.ts → authenticate)
 *   req.validated  the checked input (set by middleware/validate.ts → validate)
 */
import type { AuthUser } from './lib/userCache';

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthUser;
      validated?: { body?: unknown; params?: unknown; query?: unknown };
    }
  }
}

export {};
