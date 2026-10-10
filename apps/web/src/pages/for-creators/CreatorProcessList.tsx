import { useTranslation } from 'react-i18next';

export function CreatorProcessList() {
  const { t } = useTranslation();
  const steps = ['p1', 'p2', 'p3', 'p4', 'p5'] as const;

  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card sm:p-8">
      <h2 className="font-display text-2xl font-extrabold text-navy">{t('forCreators.processTitle')}</h2>
      <ol className="mt-6 space-y-5">
        {steps.map((k, i) => (
          <li key={k} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-navy">{t(`forCreators.${k}`)}</p>
              <p className="text-sm text-ink-muted">{t(`forCreators.${k}t`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
