/**
 * 60-SECOND CACHE of each user's role/status/tokenVersion, so every request can check
 * "is this person still allowed?" without a database trip. Call invalidateUser(id) after changing any of those fields.
 */
import type { AdminRole, Role } from '@bluenova/shared';
import { UserModel } from '../models/user';

export interface AuthUser {
  id: string;
  role: Role | null;
  adminRole: AdminRole | null;
  status: string;
  tokenVersion: number;
}

/**
 * Short-lived cache of security-relevant user fields so every request can check
 * suspension and token version without a DB round trip. Busted on every change.
 * (Single-process cache; moves to Redis when the API runs on multiple instances.)
 */
const TTL_MS = 60_000;
const cache = new Map<string, { value: AuthUser; expires: number }>();

export async function getAuthUser(id: string): Promise<AuthUser | null> {
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.value;
  const u = await UserModel.findById(id, { role: 1, adminRole: 1, status: 1, tokenVersion: 1 }).lean();
  if (!u) {
    cache.delete(id);
    return null;
  }
  const value: AuthUser = {
    id,
    role: (u.role ?? null) as Role | null,
    adminRole: (u.adminRole ?? null) as AdminRole | null,
    status: u.status,
    tokenVersion: u.tokenVersion,
  };
  cache.set(id, { value, expires: Date.now() + TTL_MS });
  return value;
}

export function invalidateUser(id: string): void {
  cache.delete(id);
}

export function clearUserCache(): void {
  cache.clear();
}
