/**
 * DATABASE CONNECTION (MongoDB via Mongoose). Called by server.ts at startup and by scripts/tests.
 * ensureIndexes() builds missing indexes in production, where automatic index building is off.
 * `strictQuery` makes Mongoose ignore unknown filter fields (a safety net against query injection).
 */
import mongoose from 'mongoose';
import { env } from './config/env';
import { logger } from './lib/logger';

mongoose.set('strictQuery', true);

export async function connectDb(uri = env.MONGODB_URI) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15_000,
    autoIndex: env.NODE_ENV !== 'production',
  });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
}

/**
 * Creates any missing database indexes (unique email, one-time tokens, automatic clean-up of expired tokens, …).
 * Production connects with autoIndex off, so without this the indexes each model declares would never be built.
 * Called once by server.ts in production, after the database connects.
 * Safe to repeat: createIndexes() only ADDS missing indexes; it never drops or changes existing ones or any data.
 * If one collection fails (e.g. duplicate emails block the unique-email index), it is logged and the rest still run.
 */
export async function ensureIndexes(): Promise<{ ok: string[]; failed: { model: string; reason: string }[] }> {
  const models = Object.values(mongoose.models);
  const results = await Promise.allSettled(models.map((m) => m.createIndexes()));
  const ok: string[] = [];
  const failed: { model: string; reason: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push(models[i].modelName);
    else failed.push({ model: models[i].modelName, reason: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });
  if (failed.length) logger.error({ failed }, 'some database indexes could not be created');
  else logger.info({ models: ok.length }, 'database indexes checked');
  return { ok, failed };
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
