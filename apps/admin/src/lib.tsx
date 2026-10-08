import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { ApiError, Loading, createApiClient, type Tone } from '@bluenova/ui';

export interface AdminMe { id: string; role: 'admin'; adminRole: 'super_admin' | 'reviewer' | 'campaign_manager' | 'finance'; name: string | null; email: string }

let lost: () => void = () => undefined;
export const api = createApiClient<AdminMe>({ refreshPath: '/auth/admin/refresh', logoutPath: '/auth/admin/logout', onSessionLost: () => lost() });

const MESSAGES: Record<string, string> = {
  'errors.invalidOtp': 'Incorrect or expired authenticator code.',
  'errors.badCredentials': 'Incorrect email or password.',
  'errors.loginLocked': 'Too many failed attempts. Try again in 15 minutes.',
  'errors.currentPasswordWrong': 'Current password is incorrect.',
  'errors.passwordShort': 'Use at least 8 characters.',
  'errors.passwordMix': 'Use both letters and numbers.',
  'errors.passwordCommon': 'This password is too common.',
  'errors.passwordPersonal': "Don't use your name or email in the password.",
  'errors.passwordMismatch': "Passwords don't match.",
  'errors.passwordSame': 'New password must be different.',
  'errors.accountNumber': 'Account number must be 9–18 digits.',
  'errors.ifsc': 'Enter a valid IFSC (e.g. HDFC0001234).',
  'errors.upi': 'Enter a valid UPI ID (e.g. name@bank).',
  'errors.nameFake': 'Enter a real name.',
  'errors.reasonRequired': 'A reason is required.',
  'errors.scoresRequired': 'Give all four scores.',
  'errors.usePaymentFlow': 'Payments are switched on: this campaign starts when its payment is verified.',
  'errors.priceBelowPayout': 'Brand price cannot be lower than the creator payout.',
  'errors.INVALID_STATE': 'This action is not allowed in the current status. Refresh the page.',
  'errors.FORBIDDEN': 'Your admin role does not allow this action.',
  'errors.NOT_FOUND': 'Not found.',
  'errors.UNAUTHENTICATED': 'Session expired. Please log in again.',
  'errors.VALIDATION_ERROR': 'Please check the form.',
  'errors.creatorNotApproved': 'Only approved creators can be shortlisted.',
  'errors.shortlistEmpty': 'Add at least one creator to the shortlist first.',
  'errors.CONFLICT': 'Already done (e.g. creator already on this shortlist).',
  'errors.RATE_LIMITED': 'Too many requests. Please wait.',
  'errors.network': 'No internet connection.',
  'errors.serverDown': "Can't reach the API server. Check the terminal: it may not be running, or the database may be blocked (Atlas → Network Access).",
};

export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const fields = Object.entries(err.fields ?? {}).map(([k, v]) => `${k}: ${v.replace(/^errors\./, '')}`).join(', ');
    return `${MESSAGES[err.message] ?? MESSAGES[`errors.${err.code}`] ?? err.message}${fields ? ` (${fields})` : ''}`;
  }
  return 'Something went wrong.';
}

export const rupees = (paise: number | null | undefined) =>
  paise == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);
export const date = (v: string | null | undefined) =>
  v ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(v)) : '—';
export const label = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '—');

export function tone(status: string): Tone {
  if (['DRAFT'].includes(status)) return 'grey';
  if (['SUBMITTED', 'UNDER_REVIEW', 'IN_REVIEW', 'CREATORS_SELECTED'].includes(status)) return 'blue';
  if (['CHANGES_REQUESTED', 'SHORTLIST_SENT', 'PAYMENT_PENDING', 'AWAITING_PAYMENT', 'SENT', 'PROPOSED'].includes(status)) return 'amber';
  if (['IN_PRODUCTION', 'ACTIVE'].includes(status)) return 'teal';
  if (['APPROVED', 'COMPLETED', 'ACCEPTED', 'SELECTED', 'VERIFIED'].includes(status)) return 'green';
  if (status === 'REJECTED') return 'red';
  return 'red';
}

interface AuthState { me: AdminMe | null; loading: boolean; signIn: (token: string, me: AdminMe) => void; signOut: () => Promise<void> }
const Ctx = createContext<AuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  useEffect(() => {
    lost = () => { setMe(null); qc.clear(); };
    api.refresh().then((r) => { if (r) setMe(r.user); setLoading(false); });
  }, [qc]);
  const signIn = useCallback((token: string, user: AdminMe) => { api.setToken(token); setMe(user); }, []);
  const signOut = useCallback(async () => { await api.logout(); setMe(null); qc.clear(); }, [qc]);
  const value = useMemo(() => ({ me, loading, signIn, signOut }), [me, loading, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdmin outside provider');
  return c;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { me, loading } = useAdmin();
  if (loading) return <Loading />;
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** UI-only check of the admin sub-role. The API enforces the same rules. */
export function can(me: AdminMe | null, ...roles: AdminMe['adminRole'][]) {
  return !!me && (me.adminRole === 'super_admin' || roles.includes(me.adminRole));
}

/** Feature switches (payments start switched off). */
export function useFeatures() {
  const { me } = useAdmin();
  const q = useQuery({ queryKey: ['features'], queryFn: () => api.get<{ paymentsEnabled: boolean }>('/admin/settings/features'), enabled: !!me });
  return { paymentsEnabled: q.data?.paymentsEnabled ?? false, loaded: q.isSuccess };
}
