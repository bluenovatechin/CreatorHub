/**
 * BUILDS THE EXPRESS APP: security middleware first, then every route group.
 * Every request passes through, in this order:
 *   requestId → logging → helmet (security headers) → CORS → JSON body (max 100kb) → cookies
 *   → rejectMongoOperators ($-keys in input → 400) → rejectRepeatedQuery (?a=1&a=2 → 400) → global rate limit → /api/v1 router
 *   → (route-level: auth check → role check → input validation → handler) → error handler.
 * Route groups: /auth (auth.routes) · /me · /notifications · /conversations (messages with the team) · /admin/*
 * · creators · brands · deals · reports.
 * Docs: docs/ARCHITECTURE.md (request lifecycle) and docs/API.md (every endpoint).
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { AppError } from './lib/errors';
import { logger } from './lib/logger';
import { ok } from './lib/http';
import { authenticate, authorize } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { noStore, originCheck, rateLimits, requestId } from './middleware/security';
import { rejectMongoOperators, rejectRepeatedQuery } from './middleware/sanitize';
import { adminRouter } from './modules/admin';
import { authRouter, meRouter } from './modules/auth';
import { brandsRouter } from './modules/brands';
import { creatorsRouter } from './modules/creators';
import { dealsRouter, notificationsRouter } from './modules/deals';
import { conversationsRouter } from './modules/messages';
import { reportsRouter } from './modules/trust';
import { contactRouter } from './modules/contact';
import { getSettings } from './models/system';

export function createApp() {
  const app = express();

  // Order matters — see docs/BLUENOVA_AI_BUILD_PROMPT.md §13.1
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(pinoHttp({
    logger,
    genReqId: (req) => (req as express.Request).id,
    customProps: (req) => ({ userId: (req as express.Request).auth?.id }),
    autoLogging: { ignore: (req) => req.url === '/healthz' },
    // Normal requests (including expected 401s) are not logged in development; server errors always are.
    // 503 = database not connected yet: the terminal already shows the Atlas message once, so don't repeat it per request.
    customLogLevel: (_req, res, err) => (res.statusCode === 503 ? (env.NODE_ENV === 'development' ? 'silent' : 'warn')
      : err || res.statusCode >= 500 ? 'error' : env.NODE_ENV === 'development' ? 'silent' : 'info'),
  }));
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
  }));
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true, maxAge: 600 }));
  // (Razorpay webhook with express.raw() will be mounted here, before the JSON parser, in Phase 2.)
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(rejectMongoOperators);
  app.use(rejectRepeatedQuery);
  app.use(rateLimits.global);

  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/readyz', (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ ok: ready });
  });

  const api = express.Router();
  api.use(noStore);
  // While MongoDB isn't connected (still starting, or Atlas blocking this IP), answer clearly instead of hanging.
  api.use((_req, _res, next) => next(mongoose.connection.readyState === 1 ? undefined : new AppError('UNAVAILABLE', 'errors.serverDown')));
  api.use(originCheck(false));
  api.use('/auth', authRouter);
  // Public feature flags the frontends need (nothing sensitive).
  api.get('/config', async (_req, res, next) => {
    try {
      ok(res, { paymentsEnabled: (await getSettings()).paymentsEnabled ?? false, testMode: env.TEST_MODE, googleClientId: env.GOOGLE_CLIENT_ID ?? null });
    } catch (err) {
      next(err);
    }
  });
  api.use('/me', authenticate('app'), rateLimits.authed, meRouter);
  api.use('/notifications', authenticate('app'), rateLimits.authed, notificationsRouter);
  api.use('/conversations', authenticate('app'), authorize('creator', 'brand'), rateLimits.authed, conversationsRouter);
  api.use('/reports', authenticate('app'), authorize('creator', 'brand'), rateLimits.authed, reportsRouter);
  api.use('/contact', contactRouter); // public Contact page (no login; rate-limited)
  api.use('/admin', adminRouter);
  api.use(creatorsRouter);
  api.use(brandsRouter);
  api.use(dealsRouter);
  app.use('/api/v1', api);

  app.get('/', (_req, res) => ok(res, { name: 'Bluenova Creator Hub API' }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
