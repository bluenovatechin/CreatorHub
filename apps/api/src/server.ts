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
      if (warned) {
        // eslint-disable-next-line no-console
        console.log('\n  ✅ Database connected.\n');
      }
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
  await connectWithRetry();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log([
        '',
        '  ✅ Bluenova is running',
        '     Website:      http://localhost:5180',
        '     Admin panel:  http://localhost:5181',
        '',
      ].join('\n'));
    } else {
      logger.info(`API listening on port ${env.PORT}`);
    }
  });
  startScheduler();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err: err instanceof Error ? err.message : err }, 'failed to start');
  process.exit(1);
});
