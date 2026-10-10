import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Clapperboard } from 'lucide-react';
import { creatorStep3Schema } from '../../../lib/zod';
import { Alert, Card, CardHeader, Field, Input } from '@bluenova/ui';
import { errorText } from '../../../lib/api';
import type { CreatorSelf } from '../../../lib/types';
import { useFieldError } from '../../../components/common';
import { OnboardingStepActions } from './OnboardingStepActions';

export function OnboardingStep3({ p, onSave }: { p: CreatorSelf; onSave: (v: { reels: string[] }) => Promise<void> }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ r1: string; r2: string; r3: string }>({
    defaultValues: { r1: p.reels[0] ?? '', r2: p.reels[1] ?? '', r3: p.reels[2] ?? '' },
  });

  const onSubmit = async (v: { r1: string; r2: string; r3: string }) => {
    setError(null);
    const reels = [v.r1, v.r2, v.r3].map((x) => x.trim()).filter(Boolean);
    const parsed = creatorStep3Schema.safeParse({ reels });
    if (!parsed.success) {
      setError(fe(parsed.error.issues[0]?.message) ?? t('errors.reelUrl'));
      return;
    }
    try {
      await onSave(parsed.data);
    } catch (e) {
      setError(errorText(t, e));
    }
  };

  return (
    <Card as="section">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <CardHeader icon={<Clapperboard />} title={t('onboarding.s3Title')} subtitle={t('onboarding.s3Text')} />
        {(['r1', 'r2', 'r3'] as const).map((k, i) => (
          <Field key={k} label={`${t('onboarding.reelN', { n: i + 1 })}${i === 2 ? ` (${t('common.optional')})` : ''}`} required={i < 2}>
            {(id) => (
              <Input
                id={id}
                type="url"
                inputMode="url"
                placeholder="https://www.instagram.com/reel/..."
                autoCapitalize="none"
                {...register(k)}
              />
            )}
          </Field>
        ))}
        {error && <Alert tone="red">{error}</Alert>}
        <OnboardingStepActions step={3} submitting={isSubmitting} />
      </form>
    </Card>
  );
}
