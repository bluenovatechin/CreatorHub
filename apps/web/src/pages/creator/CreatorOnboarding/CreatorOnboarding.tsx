/**
 * CREATOR ONBOARDING (/creator/onboarding/1..5)
 * Modularized onboarding flow using dedicated step subcomponents.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Alert, PageHeader, Stepper } from '@bluenova/ui';
import { api } from '../../../lib/api';
import type { CreatorSelf } from '../../../lib/types';
import { QueryState } from '../../../components/common';
import { OnboardingStep1 } from './OnboardingStep1';
import { OnboardingStep2 } from './OnboardingStep2';
import { OnboardingStep3 } from './OnboardingStep3';
import { OnboardingStep4 } from './OnboardingStep4';
import { OnboardingStep5 } from './OnboardingStep5';
import './CreatorOnboarding.css';

function useProfile() {
  return useQuery({ queryKey: ['creator', 'me'], queryFn: () => api.get<CreatorSelf>('/creators/me') });
}

export function CreatorOnboarding() {
  const { t } = useTranslation();
  const { step: stepParam } = useParams();
  const step = Math.min(5, Math.max(1, Number(stepParam) || 1));
  const profile = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const handleSaveStep = (currentStep: number) => async (body: unknown) => {
    const updated = await api.put<CreatorSelf>(`/creators/me/onboarding/${currentStep}`, body);
    qc.setQueryData(['creator', 'me'], updated);
    navigate(`/creator/onboarding/${currentStep + 1}`);
  };

  if (profile.isLoading || profile.error) return <QueryState isLoading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />;
  const p = profile.data!;
  if (!['DRAFT', 'CHANGES_REQUESTED'].includes(p.status)) return <Navigate to="/creator/status" replace />;
  if (step > p.onboardingStep) return <Navigate to={`/creator/onboarding/${p.onboardingStep}`} replace />;

  return (
    <div className="creator-onboarding mx-auto max-w-2xl">
      <PageHeader title={t('onboarding.title')} subtitle={t('onboarding.subtitle')} />
      <Stepper steps={t('onboarding.steps', { returnObjects: true }) as string[]} current={step} />
      {p.status === 'CHANGES_REQUESTED' && p.review?.reasonText && (
        <div className="mb-4">
          <Alert tone="amber" title={t('onboarding.changesBanner')}>
            {p.review.reasonText}
          </Alert>
        </div>
      )}
      {step === 1 && <OnboardingStep1 p={p} onSave={handleSaveStep(1)} />}
      {step === 2 && <OnboardingStep2 p={p} onSave={handleSaveStep(2)} />}
      {step === 3 && <OnboardingStep3 p={p} onSave={handleSaveStep(3)} />}
      {step === 4 && <OnboardingStep4 p={p} onSave={handleSaveStep(4)} />}
      {step === 5 && <OnboardingStep5 p={p} />}
    </div>
  );
}
