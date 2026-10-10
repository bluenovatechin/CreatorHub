import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { DELIVERABLE_TYPES, creatorStep4Schema, type CreatorStep4 } from '../../../lib/zod';
import { Alert, Card, CardHeader, Checkbox, Field, Input } from '@bluenova/ui';
import { applyServerErrors, errorText } from '../../../lib/api';
import type { CreatorSelf } from '../../../lib/types';
import { useFieldError } from '../../../components/common';
import { OnboardingStepActions } from './OnboardingStepActions';

const optionalNumber = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v));

export function OnboardingStep4({ p, onSave }: { p: CreatorSelf; onSave: (v: CreatorStep4) => Promise<void> }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const [error, setError] = useState<string | null>(null);
  const rupees = (k: string) => (p.rateCardPaise[k] !== undefined ? p.rateCardPaise[k] / 100 : undefined);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<CreatorStep4>({
    resolver: zodResolver(creatorStep4Schema),
    defaultValues: {
      followers: p.stats.followers ?? undefined,
      avgViews: p.stats.avgViews ?? undefined,
      engagementRate: p.stats.engagementRate ?? undefined,
      rateCard: Object.fromEntries(DELIVERABLE_TYPES.map((d) => [d, rupees(d)])) as CreatorStep4['rateCard'],
      acceptsBarter: p.acceptsBarter,
    },
  });

  return (
    <Card as="section">
      <form
        onSubmit={handleSubmit(async (v) => {
          setError(null);
          try {
            await onSave(v);
          } catch (e) {
            if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
          }
        })}
        noValidate
        className="space-y-5"
      >
        <CardHeader icon={<BarChart3 />} title={t('onboarding.s4Title')} subtitle={t('onboarding.s4Text')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('onboarding.followers')} error={fe(errors.followers?.message)} required>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                inputMode="numeric"
                invalid={!!errors.followers}
                {...register('followers', { setValueAs: optionalNumber })}
              />
            )}
          </Field>
          <Field label={t('onboarding.avgViews')} error={fe(errors.avgViews?.message)} required>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                inputMode="numeric"
                invalid={!!errors.avgViews}
                {...register('avgViews', { setValueAs: optionalNumber })}
              />
            )}
          </Field>
          <Field label={t('onboarding.engagement')} hint={t('onboarding.engagementHint')} error={fe(errors.engagementRate?.message)} required>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                inputMode="decimal"
                invalid={!!errors.engagementRate}
                {...register('engagementRate', { setValueAs: optionalNumber })}
              />
            )}
          </Field>
        </div>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">{t('onboarding.rateCard')}</legend>
          <p className="text-xs text-ink-muted">{t('onboarding.rateHint')}</p>
          {errors.rateCard?.message && <p role="alert" className="text-xs font-medium text-danger">{fe(errors.rateCard.message)}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {DELIVERABLE_TYPES.map((d) => (
              <Field key={d} label={t(`deliverable.${d}`)} error={fe(errors.rateCard?.[d]?.message)}>
                {(id, desc) => (
                  <Input
                    id={id}
                    aria-describedby={desc}
                    inputMode="numeric"
                    placeholder="₹"
                    {...register(`rateCard.${d}`, { setValueAs: optionalNumber })}
                  />
                )}
              </Field>
            ))}
          </div>
        </fieldset>
        <Checkbox label={t('onboarding.barter')} {...register('acceptsBarter')} />
        {error && <Alert tone="red">{error}</Alert>}
        <OnboardingStepActions step={4} submitting={isSubmitting} />
      </form>
    </Card>
  );
}
