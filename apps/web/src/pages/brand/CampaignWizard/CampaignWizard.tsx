/**
 * NEW CAMPAIGN WIZARD (/brand/campaigns/new and /edit/:step)
 * Decomposed into dedicated step subcomponents.
 */
import { useQuery } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import type { CampaignView } from '../../../lib/types';
import { QueryState } from '../../../components/common';
import { WizardStep1Basics } from './WizardStep1Basics';
import { WizardStep2Audience } from './WizardStep2Audience';
import { WizardStep3Deliverables } from './WizardStep3Deliverables';
import { WizardStep4Timeline } from './WizardStep4Timeline';
import { WizardStep5Budget } from './WizardStep5Budget';
import { WizardStep6Review } from './WizardStep6Review';
import './CampaignWizard.css';

export function CampaignWizard() {
  const { id, step: stepParam } = useParams();
  const step = id ? Math.min(6, Math.max(1, Number(stepParam) || 1)) : 1;
  const q = useQuery({ queryKey: ['campaigns', id], queryFn: () => api.get<CampaignView>(`/campaigns/${id}`), enabled: !!id });

  if (id && (q.isLoading || q.error)) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;
  const c = q.data;
  if (c && c.status !== 'DRAFT') return <Navigate to={`/brand/campaigns/${c.id}`} replace />;
  if (c && step > c.wizardStep) return <Navigate to={`/brand/campaigns/${c.id}/edit/${c.wizardStep}`} replace />;

  const key = `${id ?? 'new'}-${step}`;
  switch (step) {
    case 1:
      return <WizardStep1Basics key={key} c={c} />;
    case 2:
      return <WizardStep2Audience key={key} c={c!} />;
    case 3:
      return <WizardStep3Deliverables key={key} c={c!} />;
    case 4:
      return <WizardStep4Timeline key={key} c={c!} />;
    case 5:
      return <WizardStep5Budget key={key} c={c!} />;
    default:
      return <WizardStep6Review key={key} c={c!} />;
  }
}
