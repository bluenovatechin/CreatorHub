import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  CalendarDays, ClipboardCheck, Clapperboard, FileText, IndianRupee, Users,
} from 'lucide-react';
import { Alert, Button, Card, CardHeader, PageHeader, Stepper } from '@bluenova/ui';

const STEP_ICONS = [
  <FileText key="1" />,
  <Users key="2" />,
  <Clapperboard key="3" />,
  <CalendarDays key="4" />,
  <IndianRupee key="5" />,
  <ClipboardCheck key="6" />,
];

export function WizardShell({
  step,
  id,
  title,
  children,
  onSubmit,
  busy,
  formError,
}: {
  step: number;
  id?: string;
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  busy: boolean;
  formError: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="campaign-wizard mx-auto max-w-3xl">
      <PageHeader title={t('wizard.title')} />
      <Stepper steps={t('wizard.steps', { returnObjects: true }) as string[]} current={step} />
      <Card as="section">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-6"
        >
          <CardHeader icon={STEP_ICONS[step - 1]} title={title} />
          {children}
          {formError && <Alert tone="red">{formError}</Alert>}
          <div className="flex justify-between gap-3 border-t border-line pt-5">
            {step > 1 && id ? (
              <Link to={`/brand/campaigns/${id}/edit/${step - 1}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-primary">
                ← {t('common.back')}
              </Link>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg" loading={busy}>
              {t('common.saveContinue')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
