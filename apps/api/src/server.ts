/**
 * API ENTRY POINT (npm run dev / npm start runs this file).
 * Order: connect to MongoDB (retrying with a clear message) → build the Express app (app.ts) → listen on PORT
 * → start background jobs (jobs/scheduler.ts). Ctrl+C / SIGTERM closes everything cleanly.
 */
import { env } from './config/env';
import { createApp } from './app';
import { connectDb, disconnectDb } from './db';
import { startScheduler } from './jobs/scheduler';
import { logger } from './lib/logger';

/** Keeps trying to reach the database, explaining the most common cause once, so a fix in Atlas needs no restart. */
async function connectWithRetry() {
  let warned = false;
  for (;;) {
    try {
      await connectDb();
      return;
    } catch (err) {
      if (!warned) {
        const ipProblem = err instanceof Error && /whitelist|IP|ServerSelection|ECONNREFUSED|ETIMEOUT|querySrv/i.test(`${err.name} ${err.message}`);
        // eslint-disable-next-line no-console
        console.log([
          '',
          '  ❌ Cannot connect to the database (MongoDB Atlas).',
          ipProblem
            ? '     Most likely your internet (IP) address is not allowed in Atlas.\n     Fix: Atlas → Network Access → "Add Current IP Address" → Confirm.'
            : `     Reason: ${err instanceof Error ? err.message.replace(/mongodb\S+/g, '[hidden]') : 'unknown'}`,
          '     Also check the username/password in apps/api/.env.',
          '     Retrying every 10 seconds — no need to restart once it is fixed.',
          '',
        ].join('\n'));
        warned = true;
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}

async function main() {
  // Listen FIRST, so the websites get a clear "database not connected yet" answer (503) instead of
  // "connection refused" while MongoDB is unreachable (e.g. Atlas blocking a new IP address).
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    if (env.NODE_ENV !== 'development') logger.info(`API listening on port ${env.PORT}`);
  });

  // Ctrl+C / Render stopping the service: close cleanly (registered early, the DB wait below can be long).
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await connectWithRetry();
  startScheduler(); // background jobs need the database
  if (env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log([
      '',
      '  ✅ Bluenova is running (database connected)',
      '     Website:      http://localhost:5180',
      '     Admin panel:  http://localhost:5181',
      '',
    ].join('\n'));
  }
}

main().catch((err) => {
  logger.fatal({ err: err instanceof Error ? err.message : err }, 'failed to start');
  process.exit(1);
});
