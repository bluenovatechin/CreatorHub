import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { cx } from '@bluenova/ui';
import { formatDateTime } from '../../lib/format';
import type { NotificationView } from '../../lib/types';

export function NotificationItem({ n }: { n: NotificationView }) {
  const { t, i18n } = useTranslation();
  const text = t(`notif.${n.type}`, { ...n.params, defaultValue: t('notif.default') });

  const body = (
    <div className={cx('flex gap-4 px-5 py-4', !n.readAt && 'bg-primary-50/60')}>
      <span
        className={cx(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          n.readAt ? 'bg-bg text-ink-faint' : 'bg-primary text-white',
        )}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <p className={cx('text-sm', !n.readAt ? 'font-semibold text-navy' : 'text-ink')}>{text}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{formatDateTime(n.createdAt, i18n.language)}</p>
      </div>
    </div>
  );

  return (
    <li>
      {n.link && n.link.startsWith('/') && !n.link.startsWith('//') ? (
        <Link to={n.link} className="block hover:bg-bg">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}
