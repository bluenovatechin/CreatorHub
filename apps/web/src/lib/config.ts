import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface AppConfig { paymentsEnabled: boolean; testMode: boolean }

/** Public feature switches from the server (payments start switched off). */
export function useAppConfig(): AppConfig {
  const q = useQuery({ queryKey: ['config'], queryFn: () => api.get<AppConfig>('/config'), staleTime: 5 * 60_000 });
  return q.data ?? { paymentsEnabled: false, testMode: false };
}
