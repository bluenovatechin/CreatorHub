/**
 * FAQ (/faq): the homepage questions plus more about applying, drafts, messages, problems and ratings.
 * Answers describe how the platform actually works (keep them in line with docs/FLOWS.md).
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHero } from '../../components/marketing/PageHero';
import { usePageMeta } from '../../lib/seo';

export function FaqPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t('nav.faq'), description: t('meta.faq') });
  const items = [
    ...(t('home.faq', { returnObjects: true }) as { q: string; a: string }[]),
    ...(t('faqPage.more', { returnObjects: true }) as { q: string; a: string }[]),
  ];
  return (
    <div>
      <PageHero eyebrow={t('nav.faq')} title={t('home.faqTitle')} text={t('faqPage.intro')} cta={t('faqPage.contact')} to="/contact" />
      <section className="mx-auto max-w-3xl space-y-3 px-4 py-12">
        {items.map((it) => (
          <details key={it.q} className="group rounded-2xl border border-line bg-white p-5 shadow-card">
            <summary className="cursor-pointer list-none font-semibold text-navy marker:hidden">{it.q}</summary>
            <p className="mt-3 leading-relaxed text-ink-muted">{it.a}</p>
          </details>
        ))}
        <p className="pt-4 text-sm">{t('faqPage.still')} <Link to="/contact" className="font-semibold text-primary">{t('faqPage.contact')}</Link></p>
      </section>
    </div>
  );
}
