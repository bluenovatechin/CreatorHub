import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Clapperboard } from 'lucide-react';
import { Card, cx } from '@bluenova/ui';
import type { DealView } from '../../../lib/types';
import { creatorBtn } from '../components/CreatorCommon';

export function CreatorIntroBanner({ intro }: { intro?: DealView }) {
  const { t } = useTranslation();

  if (!intro || ['VERIFIED', 'COMPLETED'].includes(intro.status)) return null;

  return (
    <Card className="border-primary-200 bg-primary-50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
            <Clapperboard className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-navy">{t('creatorHome.introTitle')}</p>
            <p className="text-sm text-ink-muted">{t('creatorHome.introText')}</p>
          </div>
        </div>
        <Link to="/creator/intro-reel" className={cx(creatorBtn, 'bg-primary text-white shadow-btn hover:bg-primary-hover')}>
          {t('creatorHome.introCta')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}
