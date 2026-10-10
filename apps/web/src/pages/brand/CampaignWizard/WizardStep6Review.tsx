import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { Alert, Button, Card, CardHeader, Dialog, PageHeader, Stepper } from '@bluenova/ui';
import { api, errorText } from '../../../lib/api';
import { categoryLabel, cityLabel, formatDate, formatINR } from '../../../lib/format';
import type { CampaignView } from '../../../lib/types';

export function WizardStep6Review({ c }: { c: CampaignView }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/campaigns/${c.id}/submit`);
      await qc.invalidateQueries({ queryKey: ['campaigns'] });
      navigate(`/brand/campaigns/${c.id}`, { replace: true });
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  const row = (label: string, value: string, step: number) => (
    <div className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
      <div>
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="whitespace-pre-line font-medium">{value || '—'}</p>
      </div>
      <Link to={`/brand/campaigns/${c.id}/edit/${step}`} className="text-sm font-semibold text-primary">
        {t('common.edit')}
      </Link>
    </div>
  );

  return (
    <div className="campaign-wizard mx-auto max-w-3xl">
      <PageHeader title={t('wizard.title')} />
      <Stepper steps={t('wizard.steps', { returnObjects: true }) as string[]} current={6} />
      <Card>
        <CardHeader icon={<ClipboardCheck />} title={t('wizard.reviewTitle')} />
        {row(t('wizard.campTitle'), `${c.title}\n${c.goal ? t(`goal.${c.goal}`) : ''}`, 1)}
        {row(
          t('wizard.categories'),
          [c.filters.categories.map((k) => categoryLabel(k, lang)).join(', '), c.filters.cities.map((k) => cityLabel(k, lang)).join(', ')]
            .filter(Boolean)
            .join('\n'),
          2,
        )}
        {row(
          t('wizard.deliverables'),
          `${c.deliverables.map((d) => `${d.quantity}× ${t(`deliverable.${d.type}`)}`).join(', ')} · ${c.creatorsNeeded} creators · ${c.collabType ? t(`collab.${c.collabType}`) : ''}`,
          3,
        )}
        {row(t('wizard.startDate'), `${formatDate(c.startDate, lang)} – ${formatDate(c.endDate, lang)}`, 4)}
        {row(
          t('wizard.steps.4'),
          c.budget?.suggest
            ? t('wizard.budgetSuggest')
            : c.budget?.minPaise != null
            ? `${formatINR(c.budget.minPaise)} – ${formatINR(c.budget.maxPaise ?? 0)}`
            : '',
          5,
        )}
        {error && (
          <div className="mt-4">
            <Alert tone="red">{error}</Alert>
          </div>
        )}
        <div className="mt-5 flex justify-between">
          <Link to={`/brand/campaigns/${c.id}/edit/5`} className="inline-flex min-h-11 items-center px-2 font-semibold text-primary">
            ← {t('common.back')}
          </Link>
          <Button size="lg" variant="accent" loading={busy} onClick={() => setConfirming(true)}>
            {t('wizard.submit')}
          </Button>
        </div>
      </Card>
      {/* After submitting, the campaign can't be edited any more: confirm first. */}
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t('wizard.confirmTitle')}
        footer={<>
          <Button variant="secondary" onClick={() => setConfirming(false)}>{t('common.cancel')}</Button>
          <Button variant="accent" loading={busy} onClick={() => { setConfirming(false); void submit(); }}>{t('wizard.submit')}</Button>
        </>}>
        <p className="text-sm">{t('wizard.confirmText')}</p>
      </Dialog>
    </div>
  );
}
