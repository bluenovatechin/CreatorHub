import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UPDATED, SUMMARY_GU, type Section } from './legalData';
import { usePageMeta } from '../../lib/seo';

export function LegalPageView({
  titleEn,
  titleGu,
  kind,
  sections,
}: {
  titleEn: string;
  titleGu: string;
  kind: 'privacy' | 'terms';
  sections: Section[];
}) {
  const { t, i18n } = useTranslation();
  const isGu = i18n.language === 'gu';
  const summaryPoints = SUMMARY_GU[kind];
  usePageMeta({ title: isGu ? titleGu : titleEn, description: t(`meta.${kind}`) });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" />
        {isGu ? 'મુખ્ય પૃષ્ઠ પર પાછા જાઓ' : 'Back to home'}
      </Link>

      <header className="mt-6 border-b border-line pb-6">
        <h1 className="font-display text-3xl font-extrabold text-navy sm:text-4xl">{isGu ? titleGu : titleEn}</h1>
        <p className="mt-2 text-xs text-ink-muted">Last updated: {UPDATED}</p>
      </header>

      {/* Gujarati quick summary box when viewing in Gujarati */}
      {isGu && (
        <section aria-label="ગુજરાતી સારાંશ" className="mt-8 rounded-card border border-primary-200 bg-primary-50 p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">ઝડપી સારાંશ (Gujarati summary)</p>
          <p className="mt-1 text-sm text-ink-muted">
            સરળ સમજૂતી માટે નીચે મુખ્ય મુદ્દા આપેલા છે. કાયદાકીય રીતે માન્ય અંગ્રેજી લખાણ નીચે આપેલું છે.
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-navy">
            {summaryPoints.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* English official terms */}
      <article className="prose prose-navy mt-8 max-w-none">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="mt-8 first:mt-0">
            <h2 className="font-display text-xl font-bold text-navy">{section.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink">
              {section.body.map((item, idx) =>
                Array.isArray(item) ? (
                  <ul key={idx} className="list-disc space-y-1.5 pl-5">
                    {item.map((bullet, bulletIdx) => (
                      <li key={bulletIdx}>{bullet}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={idx}>{item}</p>
                ),
              )}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
