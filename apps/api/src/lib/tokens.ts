/**
 * ACCESS TOKENS (JWT, signed with JWT_ACCESS_SECRET, valid 15 minutes).
 * Three audiences so a token for one area can never be used in another:
 *   bluenova-app        creators & brands (website)
 *   bluenova-admin      team (admin panel)
 *   bluenova-admin-mfa  the 5-minute "password was right, now enter the authenticator code" step
 * `tv` (token version) lets us log someone out everywhere instantly: bump user.tokenVersion and old tokens stop working.
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const ISSUER = 'bluenova-api';
export type Audience = 'bluenova-app' | 'bluenova-admin' | 'bluenova-admin-mfa';

export interface AccessClaims {
  sub: string;
  tv: number;
  typ: 'access' | 'mfa';
}

export function signAccessToken(userId: string, tokenVersion: number, audience: Exclude<Audience, 'bluenova-admin-mfa'>): string {
  return jwt.sign({ tv: tokenVersion, typ: 'access' }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256', expiresIn: env.JWT_ACCESS_TTL_SECONDS, issuer: ISSUER, audience, subject: userId,
  });
}

export function signMfaToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ tv: tokenVersion, typ: 'mfa' }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256', expiresIn: 300, issuer: ISSUER, audience: 'bluenova-admin-mfa', subject: userId,
  });
}

/** Throws on any problem (bad signature, wrong alg/issuer/audience, expired, wrong type). */
export function verifyToken(token: string, audience: Audience | Audience[], typ: AccessClaims['typ']): AccessClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'], issuer: ISSUER, audience: audience as string | [string, ...string[]],
  });
  if (typeof payload !== 'object' || payload === null) throw new Error('bad token');
  const p = payload as jwt.JwtPayload;
  if (p.typ !== typ || typeof p.sub !== 'string' || typeof p.tv !== 'number') throw new Error('bad token');
  return { sub: p.sub, tv: p.tv, typ };
}
