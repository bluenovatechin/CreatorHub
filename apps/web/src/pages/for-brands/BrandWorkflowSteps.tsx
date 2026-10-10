import { useTranslation } from 'react-i18next';
import { ClipboardList, Eye, SearchCheck, Wallet } from 'lucide-react';

export function BrandWorkflowSteps() {
  const { t } = useTranslation();
  const steps = [
    { icon: ClipboardList, k: 's1' },
    { icon: SearchCheck, k: 's2' },
    { icon: Wallet, k: 's3' },
    { icon: Eye, k: 's4' },
  ];

  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map(({ icon: Icon, k }, i) => (
        <li key={k} className="rounded-card border border-line bg-white p-6 shadow-card">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-xs font-bold text-primary">0{i + 1}</p>
          <p className="mt-1 font-display font-bold text-navy">{t(`forBrands.${k}`)}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{t(`forBrands.${k}t`)}</p>
        </li>
      ))}
    </ol>
  );
}
