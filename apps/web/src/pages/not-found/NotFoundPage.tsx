/**
 * 404 NOT FOUND PAGE
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { EmptyState } from '@bluenova/ui';
import { primaryBtn } from '../../components/marketing/marketingStyles';
import './NotFoundPage.css';
import { usePageMeta } from '../../lib/seo';

export function NotFoundPage() {
  const { t } = useTranslation();
  usePageMeta({ description: t('meta.notFound'), index: false });

  return (
    <div className="not-found-page mx-auto max-w-content px-4 py-24">
      <EmptyState
        title={t('common.notFoundTitle')}
        text={t('common.notFoundText')}
        action={
          <Link to="/" className={primaryBtn}>
            <Home className="h-4 w-4" />
            {t('common.home')}
          </Link>
        }
      />
    </div>
  );
}
