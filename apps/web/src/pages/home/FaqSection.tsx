import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cx } from '@bluenova/ui';
import { useAppConfig } from '../../lib/config';

export function FaqSection() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useAppConfig();
  const base = t('home.faq', { returnObjects: true }) as { q: string; a: string }[];
  const items = paymentsEnabled
    ? [...base.slice(0, 1), t('home.faqPayment', { returnObjects: true }) as { q: string; a: string }, ...base.slice(1)]
    : base;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto mt-10 max-w-3xl divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
      {items.map((it, i) => (
        <div key={it.q}>
          <h3>
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold text-navy hover:bg-bg"
            >
              {it.q}
              <ChevronDown className={cx('h-5 w-5 shrink-0 text-ink-muted transition', open === i && 'rotate-180')} aria-hidden="true" />
            </button>
          </h3>
          {open === i && <p className="px-6 pb-5 leading-relaxed text-ink-muted">{it.a}</p>}
        </div>
      ))}
    </div>
  );
}
