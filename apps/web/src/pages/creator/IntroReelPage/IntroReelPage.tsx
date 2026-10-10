/**
 * INTRO REEL PAGE (/creator/intro-reel): the script and checklist for the creator's first reel, then the work panel
 * (send the draft link → the Bluenova team approves → send the live post link → verified).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Info, Megaphone, Sparkles } from 'lucide-react';
import { Badge, Card, CardHeader, PageHeader, cx } from '@bluenova/ui';
import { api } from '../../../lib/api';
import type { DealView } from '../../../lib/types';
import { QueryState } from '../../../components/common';
import { DealWorkPanel } from '../../../components/deals/DealWorkPanel';
import { useProfile } from '../components/CreatorCommon';
import './IntroReelPage.css';

export function IntroReelPage() {
  const { t } = useTranslation();
  const profile = useProfile();
  const [verb, setVerb] = useState<'m' | 'f'>('m');
  const [checked, setChecked] = useState<boolean[]>(Array(7).fill(false));
  const introId = profile.data?.introReelDealId;
  const intro = useQuery({ queryKey: ['deals', introId], queryFn: () => api.get<DealView>(`/deals/${introId}`), enabled: !!introId });

  if (profile.isLoading || profile.error) return <QueryState isLoading={profile.isLoading} error={profile.error} />;
  const p = profile.data!;
  if (p.status !== 'APPROVED') return <Navigate to="/creator/status" replace />;
  const joined = verb === 'm' ? 'જોડાઈ ગયો' : 'જોડાઈ ગઈ';
  const doneCount = checked.filter(Boolean).length;

  return (
    <div className="intro-reel-page mx-auto max-w-3xl space-y-5">
      <Link to="/creator" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" />
        {t('nav.dashboard')}
      </Link>
      <PageHeader eyebrow="Bluenova Creator Hub" title={t('intro.title')} />
      <Card>
        <CardHeader icon={<Sparkles />} title={t('intro.concept')} />
        <p className="leading-relaxed">{t('intro.conceptText')}</p>
      </Card>
      <Card>
        <CardHeader
          icon={<Megaphone />}
          title={t('intro.script')}
          action={
            <div className="flex rounded-full border border-line p-0.5 text-sm" role="group" aria-label={t('intro.verbToggle')}>
              {(['m', 'f'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={verb === v}
                  onClick={() => setVerb(v)}
                  className={cx('min-h-8 rounded-full px-3 font-semibold', verb === v ? 'bg-primary text-white' : 'text-ink-muted')}
                >
                  {t(v === 'm' ? 'intro.verbM' : 'intro.verbF')}
                </button>
              ))}
            </div>
          }
        />
        <blockquote lang="gu" className="space-y-2 rounded-2xl border-l-4 border-primary bg-primary-50 p-5 text-[17px] leading-8 text-navy">
          <p>
            “Hi everyone! હું છું <strong>{p.displayName}</strong> 👋
          </p>
          <p>
            અને હવે હું officially Bluenova Creator Hub સાથે Creator Partner તરીકે <strong>{joined}</strong> છું. ✨
          </p>
          <p>હવે brands અને creators વચ્ચે meaningful collaborations માટે હું Bluenova Creator Hub સાથે કામ કરીશ.</p>
          <p>જો તમે પણ તમારા brand સાથે collaboration કરવા માંગતા હો, તો stay connected with Bluenova Creator Hub. 🚀”</p>
        </blockquote>
      </Card>
      <Card>
        <CardHeader
          icon={<CheckCircle2 />}
          title={t('intro.checklist')}
          subtitle={t('intro.checklistNote')}
          action={<Badge tone={doneCount === 7 ? 'green' : 'grey'}>{doneCount}/7</Badge>}
        />
        <ul className="grid gap-2 sm:grid-cols-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n, i) => (
            <li key={n}>
              <label
                className={cx(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                  checked[i] ? 'border-accent bg-accent-soft' : 'border-line hover:border-primary-200',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 accent-primary"
                  checked={checked[i]}
                  onChange={(e) => setChecked((c) => c.map((x, j) => (j === i ? e.target.checked : x)))}
                />
                <span className="text-sm">{t(`intro.c${n}`)}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader icon={<Info />} title={t('intro.important')} />
        <p className="leading-relaxed">{t('intro.importantText')}</p>
        <p className="mt-3 text-sm text-ink-muted">{t('intro.posting')}</p>
      </Card>
      {intro.data ? <DealWorkPanel deal={intro.data} viewer="creator" /> : intro.isLoading || intro.error ? <QueryState isLoading={intro.isLoading} error={intro.error} retry={() => intro.refetch()} /> : null}
    </div>
  );
}
