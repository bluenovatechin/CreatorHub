import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import type { GlobalSetupContext } from 'vitest/node';

let replSet: MongoMemoryReplSet;

/** One in-memory replica set for the whole run (transactions need a replica set). */
export default async function setup({ provide }: GlobalSetupContext) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  provide('mongoUri', replSet.getUri());
  return async () => {
    await replSet.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
