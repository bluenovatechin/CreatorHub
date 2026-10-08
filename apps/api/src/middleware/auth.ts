import type { NextFunction, Request, Response } from 'express';
import type { AdminRole, Role } from '@bluenova/shared';
import { AppError } from '../lib/errors';
import { verifyToken } from '../lib/tokens';
import { getAuthUser } from '../lib/userCache';

function bearer(req: Request): string | null {
  const header = req.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * Verifies the access token and loads the user's CURRENT role/status from the DB (cached ≤60s).
 * The token alone is never trusted for role or suspension.
 * `app` tokens work only for creators/brands (and users without a role yet); `admin` tokens only for admins.
 */
export const authenticate = (area: 'app' | 'admin') =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = bearer(req);
      if (!token) throw new AppError('UNAUTHENTICATED');
      let claims;
      try {
        claims = verifyToken(token, area === 'admin' ? 'bluenova-admin' : 'bluenova-app', 'access');
      } catch {
        throw new AppError('UNAUTHENTICATED');
      }
      const user = await getAuthUser(claims.sub);
      if (!user || user.status !== 'active' || user.tokenVersion !== claims.tv) throw new AppError('UNAUTHENTICATED');
      if (area === 'admin' && user.role !== 'admin') throw new AppError('UNAUTHENTICATED');
      if (area === 'app' && user.role === 'admin') throw new AppError('UNAUTHENTICATED');
      req.auth = user;
      next();
    } catch (err) {
      next(err);
    }
  };

export const authorize = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth || !req.auth.role || !roles.includes(req.auth.role)) return next(new AppError('FORBIDDEN'));
  next();
};

/** Admin sub-role check. super_admin always passes. */
export const requireAdmin = (...adminRoles: AdminRole[]) => (req: Request, _res: Response, next: NextFunction) => {
  const a = req.auth;
  if (!a || a.role !== 'admin' || !a.adminRole) return next(new AppError('FORBIDDEN'));
  if (a.adminRole === 'super_admin' || adminRoles.includes(a.adminRole)) return next();
  next(new AppError('FORBIDDEN'));
};
