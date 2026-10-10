import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@bluenova/ui';

export function OnboardingStepActions({ step, submitting }: { step: number; submitting: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between gap-3 border-t border-line pt-5">
      {step > 1 ? (
        <Link to={`/creator/onboarding/${step - 1}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-primary">
          ← {t('common.back')}
        </Link>
      ) : (
        <span />
      )}
      <Button type="submit" loading={submitting} size="lg">
        {t('common.saveContinue')}
      </Button>
    </div>
  );
}
