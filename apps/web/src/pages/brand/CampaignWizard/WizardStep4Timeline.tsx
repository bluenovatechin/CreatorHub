import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { todayIST } from '../../../lib/zod';
import { Alert, Field, Input, Select, Textarea } from '@bluenova/ui';
import { lines, words } from '../../../lib/format';
import type { CampaignView } from '../../../lib/types';
import { useFieldError } from '../../../components/common';
import { useWizardSave } from './useWizardSave';
import { WizardShell } from './WizardShell';

export function WizardStep4Timeline({ c }: { c: CampaignView }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const { save, errors, formError, busy } = useWizardSave(c.id, 4);
  const iso = (d: string | null) => (d ? todayIST(new Date(d)) : '');
  const { register, getValues } = useForm({
    defaultValues: {
      startDate: iso(c.startDate),
      endDate: iso(c.endDate),
      dos: c.guidelines.dos.join('\n'),
      donts: c.guidelines.donts.join('\n'),
      refs: c.guidelines.referenceUrls.join('\n'),
      hashtags: c.guidelines.hashtags.join(' '),
      mentions: c.guidelines.mentions.join(' '),
      maxRevisions: String(c.maxRevisions ?? 2),
    },
  });

  const submit = () => {
    const v = getValues();
    save({
      startDate: v.startDate,
      endDate: v.endDate,
      dos: lines(v.dos),
      donts: lines(v.donts),
      referenceUrls: lines(v.refs),
      hashtags: words(v.hashtags),
      mentions: words(v.mentions),
      maxRevisions: Number(v.maxRevisions),
    });
  };

  return (
    <WizardShell step={4} id={c.id} title={t('wizard.steps.3')} onSubmit={submit} busy={busy} formError={formError}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('wizard.startDate')} error={fe(errors.startDate)} required>
          {(id, d) => <Input id={id} aria-describedby={d} type="date" min={todayIST()} invalid={!!errors.startDate} {...register('startDate')} />}
        </Field>
        <Field label={t('wizard.endDate')} error={fe(errors.endDate)} required>
          {(id, d) => <Input id={id} aria-describedby={d} type="date" min={todayIST()} invalid={!!errors.endDate} {...register('endDate')} />}
        </Field>
      </div>
      <Field label={t('wizard.dos')} error={fe(errors.dos)}>
        {(id) => <Textarea id={id} rows={3} {...register('dos')} />}
      </Field>
      <Field label={t('wizard.donts')} error={fe(errors.donts)}>
        {(id) => <Textarea id={id} rows={3} {...register('donts')} />}
      </Field>
      <Field label={t('wizard.refs')} error={fe(errors.referenceUrls)}>
        {(id) => <Textarea id={id} rows={2} placeholder="https://" {...register('refs')} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('wizard.hashtags')} error={fe(errors.hashtags)}>
          {(id) => <Input id={id} placeholder="#diwali #surat" {...register('hashtags')} />}
        </Field>
        <Field label={t('wizard.mentions')} error={fe(errors.mentions)}>
          {(id) => <Input id={id} placeholder="@yourbrand" {...register('mentions')} />}
        </Field>
      </div>
      <Field label={t('wizard.maxRevisions')}>
        {(id) => (
          <Select id={id} className="max-w-32" {...register('maxRevisions')}>
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Alert tone="amber">⚠️ {t('wizard.disclosureNote')}</Alert>
    </WizardShell>
  );
}
