/**
 * WHO IS LOGGED IN (React context). On page load it asks the API to restore the session from the
 * httpOnly cookie (POST /auth/refresh). Also decides where each user belongs:
 *   homePathFor(me)   no role → /welcome/role; creator → onboarding / status / dashboard; brand → profile / dashboard
 *   postLoginPath     where to go right after login (honours ?next= only inside the user's own area)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { safeRedirect } from '@bluenova/shared';
import { Loading } from '@bluenova/ui';
import { api, setSessionLostHandler, type Me } from './api';
import { setLang } from './i18n';

interface AuthState {
  me: Me | null;
  loading: boolean;
  signIn: (accessToken: string, me: Me) => void;
  reloadMe: () => Promise<Me | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    setSessionLostHandler(() => {
      setMe(null);
      qc.clear();
    });
    // Restore the session from the httpOnly refresh cookie.
    api.refresh().then((r) => {
      if (r) {
        setMe(r.user);
        setLang(r.user.preferredLanguage);
      }
      setLoading(false);
    });
  }, [qc]);

  const signIn = useCallback((accessToken: string, user: Me) => {
    api.setToken(accessToken);
    setMe(user);
  }, []);

  const reloadMe = useCallback(async () => {
    try {
      const fresh = await api.get<Me>('/me');
      setMe(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setMe(null);
    qc.clear();
  }, [qc]);

  const value = useMemo(() => ({ me, loading, signIn, reloadMe, signOut }), [me, loading, signIn, reloadMe, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** Where a signed-in user belongs right now, based on their role and the SERVER's status. */
export function homePathFor(me: Me): string {
  if (!me.role) return '/welcome/role';
  if (me.role === 'creator') {
    const s = me.creator?.status;
    if (s === 'DRAFT' || s === 'CHANGES_REQUESTED') return `/creator/onboarding/${Math.min(5, Math.max(1, me.creator?.onboardingStep ?? 1))}`;
    if (s === 'APPROVED') return '/creator';
    return '/creator/status';
  }
  return me.brand?.status === 'ACTIVE' ? '/brand' : '/brand/onboarding';
}

export function postLoginPath(me: Me, next: string | null): string {
  if (!me.role) return '/welcome/role';
  const fallback = homePathFor(me);
  const target = safeRedirect(next, fallback);
  // Only honour `next` inside the user's own area.
  return target.startsWith(`/${me.role}`) ? target : fallback;
}

/** UX guard. The API enforces every rule again; this only keeps people on the right screens. */
export function RequireRole({ role, children }: { role: 'creator' | 'brand'; children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (me.role !== role) return <Navigate to={homePathFor(me)} replace />;
  return <>{children}</>;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <Loading />;
  if (me) return <Navigate to={homePathFor(me)} replace />;
  return <>{children}</>;
}
