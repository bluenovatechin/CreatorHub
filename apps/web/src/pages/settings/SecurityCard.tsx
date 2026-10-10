import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Button, Card, CardHeader } from '@bluenova/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export function SecurityCard() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const logoutAll = useMutation({
    mutationFn: () => api.post('/auth/logout-all'),
    onSettled: async () => {
      await signOut();
      navigate('/');
    },
  });

  return (
    <Card>
      <CardHeader icon={<ShieldCheck />} title={t('settings.security')} subtitle={t('settings.logoutAllText')} />
      <div className="flex flex-wrap gap-3">
        <Button variant="danger" loading={logoutAll.isPending} onClick={() => logoutAll.mutate()}>
          {t('settings.logoutAll')}
        </Button>
        <Button
          variant="secondary"
          icon={<LogOut className="h-4 w-4" />}
          onClick={async () => {
            await signOut();
            navigate('/');
          }}
        >
          {t('nav.logout')}
        </Button>
      </div>
    </Card>
  );
}
