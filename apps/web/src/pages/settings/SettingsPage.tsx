/**
 * SETTINGS PAGE (/creator/settings, /brand/settings): account, language, email notifications, password, sessions.
 */
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Card, CardHeader, PageHeader } from '@bluenova/ui';
import { LanguageSwitch } from '../../components/layout';
import { SafetyTip } from '../../components/common';
import { AccountProfileCard } from './AccountProfileCard';
import { ChangePasswordCard } from './ChangePasswordCard';
import { SecurityCard } from './SecurityCard';
import { EmailPrefsCard } from './EmailPrefsCard';
import './SettingsPage.css';

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="settings-page mx-auto max-w-2xl space-y-5">
      <PageHeader title={t('settings.title')} />
      <AccountProfileCard />
      <Card>
        <CardHeader icon={<Globe />} title={t('settings.language')} action={<LanguageSwitch />} />
      </Card>
      <EmailPrefsCard />
      <ChangePasswordCard />
      <SecurityCard />
      <SafetyTip />
    </div>
  );
}
