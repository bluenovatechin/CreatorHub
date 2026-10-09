/**
 * Public switches from GET /api/v1/config: payments on/off, test mode banner, Google client id.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface AppConfig { paymentsEnabled: boolean; testMode: boolean; googleClientId: string | null }

/**
 * Public feature switches from the server (payments start switched off).
 * `status` tells whether they came from the server yet: 'loading', 'ready', or 'failed' (API unreachable).
 */
export function useAppConfig(): AppConfig & { status: 'loading' | 'ready' | 'failed' } {
  const q = useQuery({ queryKey: ['config'], queryFn: () => api.get<AppConfig>('/config'), staleTime: 5 * 60_000 });
  const status = q.isSuccess ? 'ready' : q.isError ? 'failed' : 'loading';
  return { ...(q.data ?? { paymentsEnabled: false, testMode: false, googleClientId: null }), status };
}
