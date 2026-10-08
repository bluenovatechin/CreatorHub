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
