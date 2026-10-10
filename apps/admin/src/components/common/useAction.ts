import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorText } from '../../lib';

/** Wraps a button action: shows its error, and refreshes the listed queries when it succeeds. */
export function useAction<T = unknown>(fn: () => Promise<T>, invalidate: unknown[][]) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: fn,
    onMutate: () => setError(null),
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
    onError: (e) => setError(errorText(e)),
  });
  return { ...m, error };
}
