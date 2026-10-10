/**
 * TESTS: database indexes in production. Production connects with autoIndex off, so server.ts calls ensureIndexes().
 * These tests start from collections WITHOUT indexes (like a fresh live database) and check that ensureIndexes()
 * builds the important ones, and that one bad collection doesn't stop the others or crash the API.
 */
import { describe, expect, it } from 'vitest';
import { ensureIndexes } from '../src/db';
import { EmailTokenModel, LoginThrottleModel, RefreshTokenModel } from '../src/models/auth';
import { UserModel } from '../src/models/user';
import { useDatabase } from './helpers';

useDatabase('index_tests');

type IndexInfo = { name: string; key: Record<string, number>; unique?: boolean; expireAfterSeconds?: number };
const indexesOf = async (model: { collection: { indexes(): Promise<unknown[]> } }) => (await model.collection.indexes()) as IndexInfo[];
const byKey = (list: IndexInfo[], field: string) => list.find((i) => Object.keys(i.key).length === 1 && i.key[field] === 1);

describe('ensureIndexes (production start-up)', () => {
  it('creates the unique and auto-clean-up indexes when they are missing, and is safe to run again', async () => {
    for (const m of [UserModel, RefreshTokenModel, EmailTokenModel, LoginThrottleModel]) await m.collection.dropIndexes();
    expect(byKey(await indexesOf(UserModel), 'email')).toBeUndefined();

    const first = await ensureIndexes();
    expect(first.failed).toEqual([]);
    expect(first.ok).toEqual(expect.arrayContaining(['User', 'RefreshToken', 'EmailToken', 'LoginThrottle']));

    expect(byKey(await indexesOf(UserModel), 'email')?.unique).toBe(true); // one account per email
    expect(byKey(await indexesOf(UserModel), 'googleId')?.unique).toBe(true);
    expect(byKey(await indexesOf(RefreshTokenModel), 'tokenHash')?.unique).toBe(true);
    expect(byKey(await indexesOf(RefreshTokenModel), 'expiresAt')?.expireAfterSeconds).toBe(0); // expired sessions deleted
    expect(byKey(await indexesOf(EmailTokenModel), 'expiresAt')?.expireAfterSeconds).toBe(3600); // old codes/links deleted
    expect(byKey(await indexesOf(LoginThrottleModel), 'purgeAt')?.expireAfterSeconds).toBe(0);

    // Running again (every restart) changes nothing and reports no problems.
    expect((await ensureIndexes()).failed).toEqual([]);
  });

  it('reports a collection whose data blocks an index, without stopping the others or throwing', async () => {
    await UserModel.collection.dropIndexes();
    await RefreshTokenModel.collection.dropIndexes();
    // Two accounts with the same email (possible only because the unique index was missing).
    const twin = { name: 'Twin', email: 'twin@example.com', role: null, status: 'active', tokenVersion: 0 };
    await UserModel.collection.insertMany([{ ...twin }, { ...twin }]);

    const result = await ensureIndexes();
    expect(result.failed.map((f) => f.model)).toEqual(['User']);
    expect(result.failed[0].reason).toMatch(/duplicate key/i);
    expect(byKey(await indexesOf(RefreshTokenModel), 'tokenHash')?.unique).toBe(true); // the others were still built
    await UserModel.collection.deleteMany({ email: 'twin@example.com' });
  });
});
