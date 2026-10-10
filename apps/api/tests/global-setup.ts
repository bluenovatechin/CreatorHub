/**
 * Starts ONE in-memory MongoDB for the whole test run (no real database is ever touched).
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import type { TestProject } from 'vitest/node';

let replSet: MongoMemoryReplSet;

/** One in-memory replica set for the whole run (transactions need a replica set). */
export default async function setup(project: TestProject) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  project.provide('mongoUri', replSet.getUri());
  return async () => {
    await replSet.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
