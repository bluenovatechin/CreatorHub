import { useTranslation } from 'react-i18next';
import { UserRound } from 'lucide-react';
import { Avatar, Card, CardHeader } from '@bluenova/ui';
import { useAuth } from '../../lib/auth';

export function AccountProfileCard() {
  const { t } = useTranslation();
  const { me } = useAuth();

  return (
    <Card>
      <CardHeader icon={<UserRound />} title={t('settings.account')} />
      <div className="flex items-center gap-4">
        <Avatar name={me?.name} size="lg" />
        <div>
          <p className="font-display text-lg font-bold text-navy">{me?.name}</p>
          <p className="text-sm text-ink-muted">{me?.email}</p>
        </div>
      </div>
    </Card>
  );
}
