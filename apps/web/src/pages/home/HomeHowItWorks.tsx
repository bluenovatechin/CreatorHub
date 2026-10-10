import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clapperboard, ClipboardList, Eye, Handshake, LayoutGrid, SearchCheck, UserPlus, Wallet,
} from 'lucide-react';
import { cx } from '@bluenova/ui';
import { SectionHead } from '../../components/marketing/SectionHead';

export function HomeHowItWorks() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'creators' | 'brands'>('creators');

  const creatorSteps = [
    { icon: UserPlus, t: t('forCreators.p1'), d: t('forCreators.p1t') },
    { icon: LayoutGrid, t: t('forCreators.p2'), d: t('forCreators.p2t') },
    { icon: Clapperboard, t: t('forCreators.p3'), d: t('forCreators.p3t') },
    { icon: SearchCheck, t: t('forCreators.p4'), d: t('forCreators.p4t') },
    { icon: Handshake, t: t('forCreators.p5'), d: t('forCreators.p5t') },
  ];

  const brandSteps = [
    { icon: ClipboardList, t: t('forBrands.s1'), d: t('forBrands.s1t') },
    { icon: SearchCheck, t: t('forBrands.s2'), d: t('forBrands.s2t') },
    { icon: Wallet, t: t('forBrands.s3'), d: t('forBrands.s3t') },
    { icon: Eye, t: t('forBrands.s4'), d: t('forBrands.s4t') },
  ];

  const steps = tab === 'creators' ? creatorSteps : brandSteps;

  return (
    <section className="bg-bg-subtle py-20">
      <div className="mx-auto max-w-content px-4">
        <SectionHead eyebrow={t('home.stepsEyebrow')} title={t('home.stepsTitle')} />
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-ctl border border-line bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab('creators')}
              className={cx('rounded-pill px-5 py-2 text-sm font-semibold transition', tab === 'creators' ? 'bg-primary text-white shadow-sm' : 'text-ink-muted hover:text-navy')}
            >
              {t('home.tabCreators')}
            </button>
            <button
              type="button"
              onClick={() => setTab('brands')}
              className={cx('rounded-pill px-5 py-2 text-sm font-semibold transition', tab === 'brands' ? 'bg-primary text-white shadow-sm' : 'text-ink-muted hover:text-navy')}
            >
              {t('home.tabBrands')}
            </button>
          </div>
        </div>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((st, i) => {
            const Icon = st.icon;
            return (
              <li key={st.t} className="relative rounded-card border border-line bg-white p-6 shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-xs font-bold text-primary">0{i + 1}</p>
                <h3 className="mt-1 font-display font-bold text-navy">{st.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{st.d}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
