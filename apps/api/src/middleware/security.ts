/**
 * REQUEST-LEVEL SECURITY:
 *   requestId     gives each request an id (shown in errors, useful for support)
 *   noStore       tells browsers/proxies never to cache API answers
 *   originCheck   blocks requests from websites that aren't ours (CSRF protection)
 *   rateLimits    how many requests one visitor may make (e.g. 10 signups/hour, 30 logins/15 min, 40 messages/10 min)
 */
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

/** Authenticated API responses must never be cached by browsers or proxies. */
export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}

/**
 * CSRF defence in depth (cookies are already SameSite=Strict):
 * state-changing requests that carry an Origin header must come from an allowed origin,
 * and cookie-authenticated endpoints REQUIRE an allowed Origin.
 */
export function originCheck(requireOrigin: boolean) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return requireOrigin ? next(new AppError('FORBIDDEN')) : next();
    if (!env.CORS_ORIGINS.includes(origin)) return next(new AppError('FORBIDDEN'));
    next();
  };
}

const skipInTests = () => env.NODE_ENV === 'test' && process.env.TEST_RATE_LIMITS !== '1';

const limiter = (windowMs: number, limit: number, keyPrefix: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: skipInTests,
    keyGenerator: (req) => `${keyPrefix}:${req.auth?.id ?? req.ip}`,
    handler: (_req, _res, next, options) =>
      next(new AppError('RATE_LIMITED', 'errors.RATE_LIMITED', undefined, Math.ceil(options.windowMs / 1000))),
  });

export const rateLimits = {
  global: limiter(60_000, 300, 'global'),
  signup: limiter(60 * 60_000, 10, 'signup'),
  login: limiter(15 * 60_000, 30, 'login'),
  emailLinks: limiter(60 * 60_000, 20, 'email-links'),
  otpVerify: limiter(15 * 60_000, 30, 'otp-verify'),
  refresh: limiter(60_000, 30, 'refresh'),
  authed: limiter(60_000, 120, 'authed'),
  // Messages to/from the team: plenty for a real conversation, too few to flood the inbox.
  messages: limiter(10 * 60_000, 40, 'messages'),
  // Reports and disputes: rare by nature.
  reports: limiter(60 * 60_000, 10, 'reports'),
  // Public contact form (no login): a few per hour per network.
  contact: limiter(60 * 60_000, 5, 'contact'),
};
