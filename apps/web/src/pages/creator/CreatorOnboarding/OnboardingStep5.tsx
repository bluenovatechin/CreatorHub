import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { Alert, Button, Card, CardHeader } from '@bluenova/ui';
import { api, errorText } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { categoryLabel, cityLabel, formatINR } from '../../../lib/format';
import type { CreatorSelf } from '../../../lib/types';

export function OnboardingStep5({ p }: { p: CreatorSelf }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { reloadMe } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/creators/me/submit');
      await qc.invalidateQueries({ queryKey: ['creator'] });
      await reloadMe();
      navigate('/creator/status', { replace: true });
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
        <p className="font-medium">{value || '—'}</p>
      </div>
      <Link to={`/creator/onboarding/${step}`} className="text-sm font-semibold text-primary">
        {t('common.edit')}
      </Link>
    </div>
  );

  return (
    <Card as="section">
      <CardHeader icon={<ClipboardCheck />} title={t('onboarding.s5Title')} subtitle={t('onboarding.s5Text')} />
      {row(t('onboarding.fullName'), `${p.fullName ?? ''} · ${p.displayName ?? ''}`, 1)}
      {row(t('onboarding.phone'), p.phone ?? '', 1)}
      {row(t('onboarding.igHandle'), p.igHandle ? `@${p.igHandle}` : '', 1)}
      {row(t('onboarding.city'), p.city ? cityLabel(p.city, lang) : '', 1)}
      {row(t('onboarding.s2Title'), p.categories.map((c) => categoryLabel(c, lang)).join(', '), 2)}
      {row(t('onboarding.s3Title'), p.reels.join('\n'), 3)}
      {row(
        t('onboarding.s4Title'),
        [
          p.stats.followers != null ? `${p.stats.followers.toLocaleString('en-IN')} ${t('onboarding.followers')}` : '',
          p.stats.engagementRate != null ? `${p.stats.engagementRate}%` : '',
          ...Object.entries(p.rateCardPaise).map(([k, v]) => `${t(`deliverable.${k}`)} ${formatINR(v)}`),
        ]
          .filter(Boolean)
          .join(' · '),
        4,
      )}
      {error && (
        <div className="mt-4">
          <Alert tone="red">{error}</Alert>
        </div>
      )}
      <div className="mt-5 flex justify-between">
        <Link to="/creator/onboarding/4" className="inline-flex min-h-11 items-center px-2 font-semibold text-primary">
          ← {t('common.back')}
        </Link>
        <Button size="lg" variant="accent" loading={busy} onClick={submit}>
          {t('onboarding.submit')}
        </Button>
      </div>
    </Card>
  );
}
