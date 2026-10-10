import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { CAMPAIGN_GOALS } from '../../../lib/zod';
import { Field, Input, Select, Textarea } from '@bluenova/ui';
import type { CampaignView } from '../../../lib/types';
import { useFieldError } from '../../../components/common';
import { useWizardSave } from './useWizardSave';
import { WizardShell } from './WizardShell';

export function WizardStep1Basics({ c }: { c?: CampaignView }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const { save, errors, formError, busy } = useWizardSave(c?.id, 1);
  const { register, getValues } = useForm({
    defaultValues: {
      title: c?.title ?? '',
      goal: c?.goal ?? '',
      description: c?.description ?? '',
    },
  });

  return (
    <WizardShell step={1} id={c?.id} title={t('wizard.steps.0')} onSubmit={() => save(getValues())} busy={busy} formError={formError}>
      <Field label={t('wizard.campTitle')} error={fe(errors.title)} required>
        {(id, d) => <Input id={id} aria-describedby={d} maxLength={100} invalid={!!errors.title} {...register('title')} />}
      </Field>
      <Field label={t('wizard.goal')} error={fe(errors.goal)} required>
        {(id, d) => (
          <Select id={id} aria-describedby={d} invalid={!!errors.goal} {...register('goal')}>
            <option value="">{t('onboarding.select')}</option>
            {CAMPAIGN_GOALS.map((g) => (
              <option key={g} value={g}>
                {t(`goal.${g}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t('wizard.description')} error={fe(errors.description)} required>
        {(id, d) => <Textarea id={id} aria-describedby={d} rows={5} maxLength={2000} invalid={!!errors.description} {...register('description')} />}
      </Field>
    </WizardShell>
  );
}
