import { useTranslation } from 'react-i18next';
import { useFieldArray, useForm } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { COLLAB_TYPES, DELIVERABLE_TYPES } from '../../../lib/zod';
import { Button, Checkbox, Field, Input, Select } from '@bluenova/ui';
import type { CampaignView } from '../../../lib/types';
import { useFieldError } from '../../../components/common';
import { useWizardSave } from './useWizardSave';
import { WizardShell } from './WizardShell';

export function WizardStep3Deliverables({ c }: { c: CampaignView }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const { save, errors, formError, busy } = useWizardSave(c.id, 3);
  const { control, register, getValues, watch } = useForm({
    defaultValues: {
      deliverables: c.deliverables.length ? c.deliverables.map((d) => ({ type: d.type, quantity: String(d.quantity) })) : [{ type: 'REEL', quantity: '1' }],
      creatorsNeeded: c.creatorsNeeded?.toString() ?? '1',
      collabType: c.collabType ?? 'PAID',
      productName: c.product?.name ?? '',
      productValue: c.product ? String(c.product.valuePaise / 100) : '',
      shipping: c.product?.shippingRequired ?? true,
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'deliverables' });
  const collab = watch('collabType');

  const submit = () => {
    const v = getValues();
    save({
      deliverables: v.deliverables.map((d) => ({ type: d.type, quantity: Number(d.quantity) })),
      creatorsNeeded: Number(v.creatorsNeeded),
      collabType: v.collabType,
      product: v.collabType === 'PAID' ? undefined : { name: v.productName, value: Number(v.productValue || 0), shippingRequired: v.shipping },
    });
  };

  return (
    <WizardShell step={3} id={c.id} title={t('wizard.steps.2')} onSubmit={submit} busy={busy} formError={formError}>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">
          {t('wizard.deliverables')} <span className="text-danger">*</span>
        </legend>
        {fields.map((f, i) => (
          <div key={f.id} className="flex gap-2">
            <Select aria-label={t('wizard.deliverables')} {...register(`deliverables.${i}.type`)}>
              {DELIVERABLE_TYPES.map((d) => (
                <option key={d} value={d}>
                  {t(`deliverable.${d}`)}
                </option>
              ))}
            </Select>
            <Input aria-label={t('wizard.qty')} inputMode="numeric" className="w-20" {...register(`deliverables.${i}.quantity`)} />
            {fields.length > 1 && <Button variant="ghost" aria-label={t('common.remove')} onClick={() => remove(i)} icon={<Trash2 className="h-4 w-4" />} />}
          </div>
        ))}
        {fields.length < 5 && (
          <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => append({ type: 'POST', quantity: '1' })}>
            {t('wizard.addDeliverable')}
          </Button>
        )}
        {errors.deliverables && (
          <p role="alert" className="text-xs font-medium text-danger">
            {fe(errors.deliverables)}
          </p>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('wizard.creatorsNeeded')} error={fe(errors.creatorsNeeded)} required>
          {(id) => <Input id={id} inputMode="numeric" {...register('creatorsNeeded')} />}
        </Field>
        <Field label={t('wizard.collabType')} required>
          {(id) => (
            <Select id={id} {...register('collabType')}>
              {COLLAB_TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`collab.${x}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {collab !== 'PAID' && (
        <fieldset className="space-y-4 rounded-ctl bg-bg p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('wizard.productName')} error={fe(errors.product)} required>
              {(id) => <Input id={id} {...register('productName')} />}
            </Field>
            <Field label={t('wizard.productValue')} required>
              {(id) => <Input id={id} inputMode="numeric" {...register('productValue')} />}
            </Field>
          </div>
          <Checkbox label={t('wizard.shipping')} {...register('shipping')} />
        </fieldset>
      )}
    </WizardShell>
  );
}
