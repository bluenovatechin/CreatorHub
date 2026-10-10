import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ZodTypeAny } from 'zod';
import { CAMPAIGN_STEP_SCHEMAS } from '../../../lib/zod';
import { ApiError, api, errorText } from '../../../lib/api';
import type { CampaignView } from '../../../lib/types';

export type Errors = Record<string, string>;

/** Validates with the shared schema (same rules as the server) and returns field → message. */
export function check(schema: ZodTypeAny, payload: unknown): { ok: true; data: unknown } | { ok: false; errors: Errors } {
  const r = schema.safeParse(payload);
  if (r.success) return { ok: true, data: r.data };
  const errors: Errors = {};
  for (const i of r.error.issues) {
    const k = String(i.path[0] ?? '_');
    if (!errors[k]) errors[k] = i.message;
  }
  return { ok: false, errors };
}

export function useWizardSave(id: string | undefined, step: number) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (payload: unknown) => {
    setFormError(null);
    const v = check(CAMPAIGN_STEP_SCHEMAS[step as 1 | 2 | 3 | 4 | 5], payload);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = id
        ? await api.put<CampaignView>(`/campaigns/${id}/wizard/${step}`, v.data)
        : await api.post<CampaignView>('/campaigns', v.data);
      qc.setQueryData(['campaigns', saved.id], saved);
      void qc.invalidateQueries({ queryKey: ['campaigns'], exact: true });
      navigate(`/brand/campaigns/${saved.id}/edit/${step + 1}`);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setErrors(e.fields);
      else setFormError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return { save, errors, formError, busy };
}
