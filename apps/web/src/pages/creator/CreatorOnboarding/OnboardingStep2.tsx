import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { LayoutGrid } from 'lucide-react';
import { CATEGORIES, creatorStep2Schema, type CreatorStep2 } from '../../../lib/zod';
import { Alert, Card, CardHeader, ChipSelect } from '@bluenova/ui';
import { CategoryIcon } from '../../../components/icons';
import { errorText } from '../../../lib/api';
import { categoryLabel } from '../../../lib/format';
import type { CreatorSelf } from '../../../lib/types';
import { useFieldError } from '../../../components/common';
import { OnboardingStepActions } from './OnboardingStepActions';

export function OnboardingStep2({ p, onSave }: { p: CreatorSelf; onSave: (v: CreatorStep2) => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const fe = useFieldError();
  const [error, setError] = useState<string | null>(null);
  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreatorStep2>({
    resolver: zodResolver(creatorStep2Schema),
    defaultValues: { categories: p.categories as CreatorStep2['categories'] },
  });

  return (
    <Card as="section">
      <form
        onSubmit={handleSubmit(async (v) => {
          setError(null);
          try {
            await onSave(v);
          } catch (e) {
            setError(errorText(t, e));
          }
        })}
        noValidate
        className="space-y-5"
      >
        <div id="cats">
          <CardHeader icon={<LayoutGrid />} title={t('onboarding.s2Title')} subtitle={t('onboarding.s2Text')} />
        </div>
        <Controller
          control={control}
          name="categories"
          render={({ field }) => (
            <ChipSelect
              labelledBy="cats"
              value={field.value ?? []}
              onChange={field.onChange}
              max={3}
              options={CATEGORIES.map((c) => ({
                value: c.key,
                label: categoryLabel(c.key, i18n.language),
                icon: <CategoryIcon k={c.key} className="h-3.5 w-3.5" />,
              }))}
            />
          )}
        />
        {errors.categories && <p role="alert" className="text-xs font-medium text-danger">{fe(errors.categories.message)}</p>}
        {error && <Alert tone="red">{error}</Alert>}
        <OnboardingStepActions step={2} submitting={isSubmitting} />
      </form>
    </Card>
  );
}
