/**
 * TERMS BOX + "I AGREE" TICK, the way big apps do it: the terms are shown in a small scrollable box, and the tick
 * only becomes clickable once the person has scrolled to the end. Used on Sign up (full Terms + Privacy Policy),
 * creator onboarding (creator terms) and brand onboarding (brand terms).
 * Text: pages/legal/legalData.ts (English is the binding version; Gujarati speakers also get the short summary).
 * Accessible: the box can be scrolled with the keyboard (it is focusable), and the hint says why the tick is grey.
 * Usage: const terms = useTermsRead(); <TermsBox {...terms} /> then <Checkbox disabled={!terms.read} … />.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDown, CheckCircle2 } from 'lucide-react';
import { cx } from '@bluenova/ui';
import { PRIVACY, SUMMARY_GU, TERMS, UPDATED, type Section } from '../pages/legal/legalData';

/** Which parts of the Terms each place shows. */
const PARTS: Record<'signup' | 'creator' | 'brand', string[] | 'all'> = {
  signup: 'all',
  creator: ['about', 'service', 'formats', 'creators', 'nodirect', 'communication', 'ip', 'prohibited', 'suspension'],
  brand: ['about', 'service', 'formats', 'brands', 'nodirect', 'communication', 'ip', 'prohibited', 'suspension'],
};

/** Holds "has the person scrolled to the end?" for one terms box. */
export function useTermsRead() {
  const [read, setRead] = useState(false);
  return { read, onRead: useCallback(() => setRead(true), []) };
}

function SectionView({ s }: { s: Section }) {
  return (
    <section className="mb-3">
      <h4 className="font-semibold text-navy">{s.title}</h4>
      {s.body.map((b, i) => Array.isArray(b)
        ? <ul key={i} className="mt-1 list-disc space-y-0.5 pl-4">{b.map((x) => <li key={x}>{x}</li>)}</ul>
        : <p key={i} className="mt-1">{b}</p>)}
    </section>
  );
}

export function TermsBox({ part = 'signup', read, onRead }: { part?: 'signup' | 'creator' | 'brand'; read: boolean; onRead: () => void }) {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const ids = PARTS[part];
  const sections = ids === 'all' ? TERMS : TERMS.filter((s) => ids.includes(s.id));

  const check = useCallback(() => {
    const el = ref.current;
    // "At the end" = within a few pixels of the bottom (or the text is short enough to need no scrolling).
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) onRead();
  }, [onRead]);
  useEffect(() => { check(); }, [check]);

  return (
    <div>
      <div ref={ref} onScroll={check} tabIndex={0} role="region" aria-label={t('terms.boxLabel')}
        className="max-h-56 overflow-y-auto rounded-ctl border border-line-strong bg-bg p-4 text-xs leading-relaxed text-ink focus:outline-none focus:ring-4 focus:ring-primary/15">
        <p className="mb-3 font-display text-sm font-bold text-navy">{t(part === 'signup' ? 'legal.terms' : `terms.title.${part}`)} · <span className="font-normal text-ink-muted">{t('terms.updated', { date: UPDATED })}</span></p>
        {i18n.language === 'gu' && (
          <section className="mb-3 rounded-lg bg-white p-3">
            <h4 className="font-semibold text-navy">{t('terms.summaryGu')}</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">{SUMMARY_GU.terms.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        )}
        {sections.map((s) => <SectionView key={s.id} s={s} />)}
        {part === 'signup' && (
          <>
            <p className="mb-2 mt-4 font-display text-sm font-bold text-navy">{t('legal.privacy')}</p>
            {i18n.language === 'gu' && (
              <ul className="mb-3 list-disc space-y-0.5 rounded-lg bg-white p-3 pl-7">{SUMMARY_GU.privacy.map((x) => <li key={x}>{x}</li>)}</ul>
            )}
            {PRIVACY.map((s) => <SectionView key={s.id} s={s} />)}
          </>
        )}
        <p className="mt-3 font-semibold text-navy">{t('terms.end')}</p>
      </div>
      <p className={cx('mt-1.5 flex items-center gap-1.5 text-xs', read ? 'text-success' : 'text-ink-muted')} aria-live="polite">
        {read ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
        {read ? t('terms.readDone') : t('terms.scrollHint')}
        <Link to="/terms" target="_blank" className="ml-auto font-semibold text-primary">{t('terms.openFull')}</Link>
      </p>
    </div>
  );
}
