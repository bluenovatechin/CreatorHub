/**
 * DATABASE CONNECTION (MongoDB via Mongoose). Called by server.ts at startup and by scripts/tests.
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

export async function disconnectDb() {
  await mongoose.disconnect();
}
