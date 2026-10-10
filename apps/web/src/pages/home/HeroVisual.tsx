import { useTranslation } from 'react-i18next';
import { BadgeCheck, CheckCircle2, Film, Instagram, Sparkles } from 'lucide-react';
import { cx } from '@bluenova/ui';

/** Illustrative product preview built in HTML (no stock photos). */
export function HeroVisual() {
  const { t } = useTranslation();
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-primary-200/60 via-white to-accent-soft blur-2xl" />
      <div className="relative rounded-[24px] border border-white/70 bg-white/90 p-6 shadow-lift backdrop-blur">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sun to-danger text-white">
            <Sparkles className="h-7 w-7" />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold text-navy">{t('home.mockCard.name')}</p>
            <p className="text-sm text-ink-muted">{t('home.mockCard.role')}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t('home.mockCard.partner')}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-bg p-3">
            <p className="text-xs text-ink-muted">{t('home.mockCard.followers')}</p>
            <p className="font-display text-xl font-extrabold text-navy">48.2K</p>
          </div>
          <div className="rounded-2xl bg-bg p-3">
            <p className="text-xs text-ink-muted">{t('home.mockCard.engagement')}</p>
            <p className="font-display text-xl font-extrabold text-accent">5.4%</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {['from-primary-400 to-primary-700', 'from-accent to-primary-500', 'from-sun to-primary-400'].map((g) => (
            <div key={g} className={cx('flex aspect-[9/14] items-end rounded-xl bg-gradient-to-br p-2', g)}>
              <Film className="h-4 w-4 text-white/90" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-lift sm:-left-10">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-navy">{t('home.mockCard.toast')}</p>
          <p className="text-xs text-ink-muted">{t('home.mockCard.toastText')}</p>
        </div>
      </div>
      <div className="absolute -right-3 -top-5 flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 shadow-lift sm:-right-8">
        <Instagram className="h-4 w-4 text-danger" />
        <span className="text-xs font-bold text-navy">#ad · Reel</span>
      </div>
    </div>
  );
}
