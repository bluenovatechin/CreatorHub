import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import {
  AGE_GROUPS, CATEGORIES, FOLLOWER_BANDS, GENDERS, LANGUAGES,
} from '../../../lib/zod';
import { ChipSelect, Field, Input, SearchMultiSelect } from '@bluenova/ui';
import { CategoryIcon } from '../../../components/icons';
import { categoryLabel, cityOptions } from '../../../lib/format';
import type { CampaignView } from '../../../lib/types';
import { useFieldError } from '../../../components/common';
import { useWizardSave } from './useWizardSave';
import { WizardShell } from './WizardShell';

export function WizardStep2Audience({ c }: { c: CampaignView }) {
  const { t, i18n } = useTranslation();
  const fe = useFieldError();
  const lang = i18n.language;
  const { save, errors, formError, busy } = useWizardSave(c.id, 2);
  const { control, register, getValues } = useForm({
    defaultValues: {
      categories: c.filters.categories,
      cities: c.filters.cities, // a new campaign starts with the areas from the brand's profile (set by the API)
      languages: c.filters.languages,
      followerBands: c.filters.followerBands,
      genders: c.filters.genders,
      ageGroups: c.filters.ageGroups,
      minEngagementRate: c.filters.minEngagementRate?.toString() ?? '',
    },
  });

  const chips = (
    name: 'categories' | 'cities' | 'languages' | 'followerBands' | 'genders' | 'ageGroups',
    label: string,
    options: { value: string; label: string }[],
    required = false,
    hint?: string,
  ) => (
    <div className="space-y-1.5">
      <p id={`l-${name}`} className="text-sm font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </p>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      <Controller
        control={control}
        name={name}
        render={({ field }) => <ChipSelect labelledBy={`l-${name}`} value={field.value} onChange={field.onChange} options={options} />}
      />
      {errors[name] && (
        <p role="alert" className="text-xs font-medium text-danger">
          {fe(errors[name])}
        </p>
      )}
    </div>
  );

  return (
    <WizardShell
      step={2}
      id={c.id}
      title={t('wizard.steps.1')}
      busy={busy}
      formError={formError}
      onSubmit={() => {
        const v = getValues();
        save({ ...v, minEngagementRate: v.minEngagementRate === '' ? undefined : Number(v.minEngagementRate) });
      }}
    >
      {chips('categories', t('wizard.categories'), CATEGORIES.map((x) => ({ value: x.key, label: categoryLabel(x.key, lang), icon: <CategoryIcon k={x.key} className="h-3.5 w-3.5" /> })), true)}
      <Field label={t('wizard.cities')} hint={t('wizard.citiesHint')} error={errors.cities ? fe(errors.cities) : undefined}>
        {(id) => (
          <Controller control={control} name="cities" render={({ field }) => (
            <SearchMultiSelect id={id} options={cityOptions(lang)} value={field.value} onChange={field.onChange} max={30}
              placeholder={t('common.typeCity')} empty={t('common.noCity')} removeLabel={t('common.remove')} />
          )} />
        )}
      </Field>
      {chips('languages', t('wizard.languages'), LANGUAGES.map((x) => ({ value: x, label: t(`lang.${x}`) })))}
      {chips('followerBands', t('wizard.bands'), FOLLOWER_BANDS.map((x) => ({ value: x, label: t(`band.${x}`) })))}
      {chips('genders', t('wizard.genders'), GENDERS.filter((g) => g !== 'prefer_not_say').map((x) => ({ value: x, label: t(`gender.${x}`) })))}
      {chips('ageGroups', t('wizard.ageGroups'), AGE_GROUPS.map((x) => ({ value: x, label: t(`age.${x}`) })))}
      <Field label={`${t('wizard.minEng')} (${t('common.optional')})`} error={fe(errors.minEngagementRate)}>
        {(id) => <Input id={id} inputMode="decimal" className="max-w-32" {...register('minEngagementRate')} />}
      </Field>
    </WizardShell>
  );
}
