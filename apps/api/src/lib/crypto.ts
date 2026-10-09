/**
 * CRYPTO HELPERS (Node's built-in crypto only, no home-made algorithms).
 *   randomToken  unguessable random strings (session cookies, email links, tickets)
 *   sha256/hmac  one-way fingerprints, so the database stores hashes instead of real tokens/codes
 *   encrypt/decrypt  AES-256-GCM for secrets we must read back later (the admins' authenticator keys).
 *                    Keys come from DATA_ENCRYPTION_KEY(S); the same keys must be used locally and on Render.
 */
import crypto from 'node:crypto';
import { env } from '../config/env';

export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString('base64url');

export const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

export const hmac = (key: string, value: string): string =>
  crypto.createHmac('sha256', key).update(value).digest('hex');

export function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function randomCode(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[crypto.randomInt(0, alphabet.length)];
  return out;
}

/** Encrypted field format stored in MongoDB. */
export interface EncryptedValue {
  v: string;
  iv: string;
  tag: string;
  ct: string;
}

/** AES-256-GCM with a random 12-byte IV per value and a key version for rotation. */
export function encrypt(plaintext: string): EncryptedValue {
  const v = env.DATA_ENCRYPTION_ACTIVE_VERSION;
  const key = Buffer.from(env.DATA_ENCRYPTION_KEYS[v], 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { v, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ct: ct.toString('base64') };
}

export function decrypt(value: EncryptedValue): string {
  const keyB64 = env.DATA_ENCRYPTION_KEYS[value.v];
  if (!keyB64) throw new Error(`Unknown encryption key version ${value.v}`);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(value.ct, 'base64')), decipher.final()]).toString('utf8');
}
