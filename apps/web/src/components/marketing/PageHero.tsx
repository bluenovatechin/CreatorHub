import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cx } from '@bluenova/ui';
import { primaryBtn } from './marketingStyles';

export function PageHero({
  eyebrow,
  title,
  text,
  cta,
  to,
}: {
  eyebrow: string;
  title: string;
  text: string;
  cta: string;
  to: string;
}) {
  return (
    <section className="bg-hero-glow">
      <div className="mx-auto max-w-content px-4 py-16 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-navy sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-muted">{text}</p>
        <Link to={to} className={cx(primaryBtn, 'mt-8')}>
          {cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
