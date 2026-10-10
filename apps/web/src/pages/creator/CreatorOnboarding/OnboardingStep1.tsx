import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Phone, UserRound } from 'lucide-react';
import {
  AGE_GROUPS, GENDERS, LANGUAGES, creatorStep1Schema, type CreatorStep1,
} from '../../../lib/zod';
import { Alert, Card, CardHeader, Checkbox, ChipSelect, Field, Input, SearchMultiSelect, SearchSelect, Select, Textarea } from '@bluenova/ui';
import { applyServerErrors, errorText } from '../../../lib/api';
import { cityOptions } from '../../../lib/format';
import type { CreatorSelf } from '../../../lib/types';
import { useFieldError } from '../../../components/common';
import { TermsBox, useTermsRead } from '../../../components/TermsBox';
import { OnboardingStepActions } from './OnboardingStepActions';

const optional = (v: unknown) => (v === '' || v === null ? undefined : v);

export function OnboardingStep1({ p, onSave }: { p: CreatorSelf; onSave: (v: CreatorStep1) => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const fe = useFieldError();
  const terms = useTermsRead(); // the agreement tick unlocks after the creator terms were scrolled to the end
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<CreatorStep1>({
    resolver: zodResolver(creatorStep1Schema),
    defaultValues: {
      fullName: p.fullName ?? '',
      displayName: p.displayName ?? '',
      phone: p.phone ?? '',
      igHandle: p.igHandle ?? '',
      city: (p.city ?? undefined) as CreatorStep1['city'],
      areas: (p.areas ?? []) as CreatorStep1['areas'],
      languages: (p.languages.length ? p.languages : ['gu']) as CreatorStep1['languages'],
      gender: (p.gender ?? undefined) as CreatorStep1['gender'],
      ageGroup: (p.ageGroup ?? undefined) as CreatorStep1['ageGroup'],
      bio: p.bio ?? '',
    },
  });

  const onSubmit = async (v: CreatorStep1) => {
    setError(null);
    try {
      await onSave(v);
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };
  const lang = i18n.language;

  return (
    <Card as="section">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <CardHeader icon={<UserRound />} title={t('onboarding.s1Title')} subtitle={t('onboarding.s1Text')} />
        <Field label={t('onboarding.fullName')} error={fe(errors.fullName?.message)} required>
          {(id, d) => <Input id={id} aria-describedby={d} autoComplete="name" invalid={!!errors.fullName} {...register('fullName')} />}
        </Field>
        <Field label={t('onboarding.displayName')} hint={t('onboarding.displayNameHint')} error={fe(errors.displayName?.message)} required>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.displayName} {...register('displayName')} />}
        </Field>
        <Field label={t('onboarding.phone')} hint={t('onboarding.phoneHint')} error={fe(errors.phone?.message)} required>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              maxLength={14}
              icon={<Phone />}
              placeholder="98XXXXXXXX"
              invalid={!!errors.phone}
              {...register('phone')}
            />
          )}
        </Field>
        <Field label={t('onboarding.igHandle')} error={fe(errors.igHandle?.message)} required>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              placeholder="@yourhandle"
              autoCapitalize="none"
              invalid={!!errors.igHandle}
              {...register('igHandle')}
            />
          )}
        </Field>
        <Field label={t('onboarding.city')} error={fe(errors.city?.message)} required>
          {(id) => (
            <Controller control={control} name="city" render={({ field }) => (
              <SearchSelect id={id} options={cityOptions(lang)} value={field.value} onChange={field.onChange}
                placeholder={t('common.typeCity')} empty={t('common.noCity')} invalid={!!errors.city} />
            )} />
          )}
        </Field>
        <Field label={t('onboarding.areas')} hint={t('onboarding.areasHint')} error={fe(errors.areas?.message)}>
          {(id) => (
            <Controller control={control} name="areas" render={({ field }) => (
              <SearchMultiSelect id={id} options={cityOptions(lang)} value={field.value ?? []} onChange={field.onChange} max={30}
                placeholder={t('common.typeCity')} empty={t('common.noCity')} removeLabel={t('common.remove')} />
            )} />
          )}
        </Field>
        <div className="space-y-1.5">
          <p id="langs" className="text-sm font-medium">
            {t('onboarding.languages')} <span className="text-danger">*</span>
          </p>
          <Controller
            control={control}
            name="languages"
            render={({ field }) => (
              <ChipSelect
                labelledBy="langs"
                value={field.value ?? []}
                onChange={field.onChange}
                max={3}
                options={LANGUAGES.map((l) => ({ value: l, label: t(`lang.${l}`) }))}
              />
            )}
          />
          {errors.languages && <p className="text-xs font-medium text-danger">{fe(errors.languages.message)}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t('onboarding.gender')} (${t('common.optional')})`}>
            {(id) => (
              <Select id={id} {...register('gender', { setValueAs: optional })}>
                <option value="">{t('onboarding.select')}</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {t(`gender.${g}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={`${t('onboarding.ageGroup')} (${t('common.optional')})`}>
            {(id) => (
              <Select id={id} {...register('ageGroup', { setValueAs: optional })}>
                <option value="">{t('onboarding.select')}</option>
                {AGE_GROUPS.map((a) => (
                  <option key={a} value={a}>
                    {t(`age.${a}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={`${t('onboarding.bio')} (${t('common.optional')})`} hint={t('onboarding.bioHint')} error={fe(errors.bio?.message)}>
          {(id, d) => <Textarea id={id} aria-describedby={d} maxLength={300} {...register('bio')} />}
        </Field>
        <fieldset className="space-y-3 rounded-ctl bg-primary-50 p-4 ring-1 ring-inset ring-primary-100">
          <TermsBox part="creator" read={terms.read} onRead={terms.onRead} />
          <Checkbox label={t('onboarding.consentCreator')} disabled={!terms.read} {...register('consents.creatorAgreement')} />
          {errors.consents && <p role="alert" className="text-xs font-medium text-danger">{t('errors.consentRequired')}</p>}
        </fieldset>
        {error && <Alert tone="red">{error}</Alert>}
        <OnboardingStepActions step={1} submitting={isSubmitting} />
      </form>
    </Card>
  );
}
