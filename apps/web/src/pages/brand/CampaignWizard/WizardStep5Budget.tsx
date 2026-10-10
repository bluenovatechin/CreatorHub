import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Checkbox, Field, Input } from '@bluenova/ui';
import type { CampaignView } from '../../../lib/types';
import { useFieldError } from '../../../components/common';
import { useWizardSave } from './useWizardSave';
import { WizardShell } from './WizardShell';

export function WizardStep5Budget({ c }: { c: CampaignView }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const { save, errors, formError, busy } = useWizardSave(c.id, 5);
  const { register, getValues, watch } = useForm({
    defaultValues: {
      budgetSuggest: c.budget?.suggest ?? false,
      budgetMin: c.budget?.minPaise != null ? String(c.budget.minPaise / 100) : '',
      budgetMax: c.budget?.maxPaise != null ? String(c.budget.maxPaise / 100) : '',
      usageRightsRequired: c.usageRights?.isRequired ?? false,
      usageRightsDays: c.usageRights?.durationDays?.toString() ?? '',
    },
  });
  const suggest = watch('budgetSuggest');
  const usage = watch('usageRightsRequired');
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

  const submit = () => {
    const v = getValues();
    save({
      budgetSuggest: v.budgetSuggest,
      budgetMin: v.budgetSuggest ? undefined : num(v.budgetMin),
      budgetMax: v.budgetSuggest ? undefined : num(v.budgetMax),
      usageRightsRequired: v.usageRightsRequired,
      usageRightsDays: v.usageRightsRequired ? num(v.usageRightsDays) : undefined,
    });
  };

  return (
    <WizardShell step={5} id={c.id} title={t('wizard.steps.4')} onSubmit={submit} busy={busy} formError={formError}>
      <Checkbox label={t('wizard.budgetSuggest')} {...register('budgetSuggest')} />
      {!suggest && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('wizard.budgetMin')} error={fe(errors.budgetMin)} required>
            {(id) => <Input id={id} inputMode="numeric" {...register('budgetMin')} />}
          </Field>
          <Field label={t('wizard.budgetMax')} error={fe(errors.budgetMax)} required>
            {(id) => <Input id={id} inputMode="numeric" {...register('budgetMax')} />}
          </Field>
        </div>
      )}
      <Checkbox label={t('wizard.usage')} {...register('usageRightsRequired')} />
      {usage && (
        <Field label={t('wizard.usageDays')} error={fe(errors.usageRightsDays)}>
          {(id) => <Input id={id} inputMode="numeric" className="max-w-32" {...register('usageRightsDays')} />}
        </Field>
      )}
    </WizardShell>
  );
}
