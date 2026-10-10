/**
 * BRAND ONBOARDING PAGE (/brand/onboarding)
 */
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2, Phone, Receipt, Users } from 'lucide-react';
import { CATEGORIES, INDIAN_STATES, brandOnboardingSchema, type BrandOnboarding } from '../../../lib/zod';
import {
  Alert, Button, Card, CardHeader, Checkbox, Field, Input, PageHeader, SearchMultiSelect, SearchSelect, Select,
} from '@bluenova/ui';
import { api, applyServerErrors, errorText } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { categoryLabel, cityOptions } from '../../../lib/format';
import type { BrandSelf } from '../../../lib/types';
import { QueryState, useFieldError } from '../../../components/common';
import { TermsBox, useTermsRead } from '../../../components/TermsBox';
import { optional } from '../components/BrandCommon';
import './BrandOnboardingPage.css';

export function BrandOnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const fe = useFieldError();
  const { reloadMe, me } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['brand', 'me'], queryFn: () => api.get<BrandSelf>('/brands/me') });
  const b = q.data;
  const firstTime = b?.status === 'INCOMPLETE';
  const {
    register,
    control,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<BrandOnboarding>({
    resolver: zodResolver(brandOnboardingSchema),
    values: b
      ? ({
          companyName: b.companyName ?? '',
          contactName: b.contactName ?? me?.name ?? '',
          designation: b.designation ?? '',
          phone: b.phone ?? '',
          gstin: b.gstin ?? '',
          industry: (b.industry ?? undefined) as BrandOnboarding['industry'],
          city: (b.city ?? undefined) as BrandOnboarding['city'],
          areas: (b.areas ?? []) as BrandOnboarding['areas'],
          website: b.website ?? '',
          billingAddress: {
            line1: b.billingAddress?.line1 ?? '',
            line2: b.billingAddress?.line2 ?? '',
            city: b.billingAddress?.city ?? '',
            stateCode: b.billingAddress?.stateCode ?? '24',
            pincode: b.billingAddress?.pincode ?? '',
          },
          consents: { brandAgreement: !firstTime },
        } as BrandOnboarding)
      : undefined,
  });

  const terms = useTermsRead(); // the agreement tick unlocks after the brand terms were scrolled to the end
  if (q.isLoading || q.error) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;

  const onSubmit = async (v: BrandOnboarding) => {
    setError(null);
    try {
      await api.put('/brands/me', v);
      await qc.invalidateQueries({ queryKey: ['brand'] });
      await reloadMe();
      navigate('/brand', { replace: true });
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };
  const lang = i18n.language;

  return (
    <div className="brand-onboarding-page mx-auto max-w-3xl">
      <PageHeader title={t('brandOnboarding.title')} subtitle={t('brandOnboarding.subtitle')} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Card>
          <CardHeader icon={<Building2 />} title={t('brandOnboarding.secCompany')} />
          <div className="space-y-5">
            <Field label={t('brandOnboarding.companyName')} error={fe(errors.companyName?.message)} required>
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  autoComplete="organization"
                  invalid={!!errors.companyName}
                  {...register('companyName')}
                />
              )}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('brandOnboarding.industry')} error={fe(errors.industry?.message)} required>
                {(id, d) => (
                  <Select id={id} aria-describedby={d} invalid={!!errors.industry} {...register('industry', { setValueAs: optional })}>
                    <option value="">{t('onboarding.select')}</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {categoryLabel(c.key, lang)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('brandOnboarding.city')} error={fe(errors.city?.message)} required>
                {(id) => (
                  <Controller control={control} name="city" render={({ field }) => (
                    <SearchSelect id={id} options={cityOptions(lang)} value={field.value} onChange={field.onChange}
                      placeholder={t('common.typeCity')} empty={t('common.noCity')} invalid={!!errors.city} />
                  )} />
                )}
              </Field>
              <div className="sm:col-span-2">
                <Field label={t('brandOnboarding.areas')} hint={t('brandOnboarding.areasHint')} error={fe(errors.areas?.message)}>
                  {(id) => (
                    <Controller control={control} name="areas" render={({ field }) => (
                      <SearchMultiSelect id={id} options={cityOptions(lang)} value={field.value ?? []} onChange={field.onChange} max={30}
                        placeholder={t('common.typeCity')} empty={t('common.noCity')} removeLabel={t('common.remove')} />
                    )} />
                  )}
                </Field>
              </div>
              <Field
                label={`${t('brandOnboarding.gstin')} (${t('common.optional')})`}
                hint={t('brandOnboarding.gstinHint')}
                error={fe(errors.gstin?.message)}
              >
                {(id, d) => (
                  <Input
                    id={id}
                    aria-describedby={d}
                    autoCapitalize="characters"
                    maxLength={15}
                    placeholder="24ABCDE1234F1Z5"
                    className="uppercase"
                    invalid={!!errors.gstin}
                    {...register('gstin')}
                  />
                )}
              </Field>
              <Field
                label={`${t('brandOnboarding.website')} (${t('common.optional')})`}
                error={fe(errors.website?.message)}
              >
                {(id, d) => (
                  <Input
                    id={id}
                    aria-describedby={d}
                    type="url"
                    placeholder="https://"
                    invalid={!!errors.website}
                    {...register('website')}
                  />
                )}
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Users />} title={t('brandOnboarding.secContact')} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('brandOnboarding.contactName')} error={fe(errors.contactName?.message)} required>
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  autoComplete="name"
                  invalid={!!errors.contactName}
                  {...register('contactName')}
                />
              )}
            </Field>
            <Field
              label={`${t('brandOnboarding.designation')} (${t('common.optional')})`}
              error={fe(errors.designation?.message)}
            >
              {(id) => <Input id={id} {...register('designation')} />}
            </Field>
            <Field
              label={t('brandOnboarding.phone')}
              hint={t('brandOnboarding.phoneHint')}
              error={fe(errors.phone?.message)}
              required
            >
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  maxLength={14}
                  icon={<Phone />}
                  invalid={!!errors.phone}
                  {...register('phone')}
                />
              )}
            </Field>
            <Field label={t('brandOnboarding.accountEmail')}>
              {(id) => <Input id={id} value={me?.email ?? ''} disabled readOnly />}
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Receipt />} title={t('brandOnboarding.secBilling')} />
          <div className="space-y-5">
            <Field label={t('brandOnboarding.line1')} error={fe(errors.billingAddress?.line1?.message)} required>
              {(id) => (
                <Input
                  id={id}
                  autoComplete="address-line1"
                  invalid={!!errors.billingAddress?.line1}
                  {...register('billingAddress.line1')}
                />
              )}
            </Field>
            <Field label={`${t('brandOnboarding.line2')} (${t('common.optional')})`}>
              {(id) => <Input id={id} autoComplete="address-line2" {...register('billingAddress.line2')} />}
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t('brandOnboarding.addrCity')} error={fe(errors.billingAddress?.city?.message)} required>
                {(id) => (
                  <Input
                    id={id}
                    autoComplete="address-level2"
                    invalid={!!errors.billingAddress?.city}
                    {...register('billingAddress.city')}
                  />
                )}
              </Field>
              <Field label={t('brandOnboarding.state')} required>
                {(id) => (
                  <Select id={id} autoComplete="address-level1" {...register('billingAddress.stateCode')}>
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field
                label={t('brandOnboarding.pincode')}
                hint={t('brandOnboarding.pincodeHint')}
                error={fe(errors.billingAddress?.pincode?.message)}
                required
              >
                {(id, d) => (
                  <Input
                    id={id}
                    aria-describedby={d}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="postal-code"
                    invalid={!!errors.billingAddress?.pincode}
                    {...register('billingAddress.pincode')}
                  />
                )}
              </Field>
            </div>
          </div>
        </Card>

        {firstTime && (
          <div className="rounded-card bg-primary-50 p-4 ring-1 ring-inset ring-primary-100">
            <TermsBox part="brand" read={terms.read} onRead={terms.onRead} />
            <div className="mt-3"><Checkbox label={t('brandOnboarding.consentBrand')} disabled={!terms.read} {...register('consents.brandAgreement')} /></div>
            {(errors as { consents?: unknown }).consents ? (
              <p role="alert" className="mt-1 text-xs font-medium text-danger">
                {t('errors.consentRequired')}
              </p>
            ) : null}
          </div>
        )}
        {error && <Alert tone="red">{error}</Alert>}
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={isSubmitting}>
            {t('brandOnboarding.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
