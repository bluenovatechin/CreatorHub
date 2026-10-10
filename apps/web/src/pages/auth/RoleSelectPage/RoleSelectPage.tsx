/**
 * ROLE SELECT PAGE (/welcome/role)
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2, Clapperboard } from 'lucide-react';
import { Alert, Button, ChoiceCards } from '@bluenova/ui';
import { api, errorText } from '../../../lib/api';
import { postLoginPath, useAuth } from '../../../lib/auth';
import { AuthLayout } from '../../../components/layout';
import { Heading } from '../components/AuthCommon';
import './RoleSelectPage.css';

export function RoleSelectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, reloadMe } = useAuth();
  const [role, setRole] = useState<'creator' | 'brand' | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me?.role) navigate(postLoginPath(me, null), { replace: true });
  }, [me, navigate]);

  const submit = async () => {
    if (!role) {
      setError(t('errors.roleRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/role', { role });
      const fresh = await reloadMe();
      if (!fresh) setError(t('errors.generic'));
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="role-select-page">
      <AuthLayout>
        <Heading title={t('auth.roleTitle')} text={t('auth.roleNote')} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-5"
        >
          <ChoiceCards
            value={role}
            onChange={(v) => {
              setRole(v);
              setError(null);
            }}
            options={[
              {
                value: 'creator' as const,
                title: t('auth.roleCreator'),
                text: t('auth.roleCreatorText'),
                icon: <Clapperboard className="h-5 w-5" />,
              },
              {
                value: 'brand' as const,
                title: t('auth.roleBrand'),
                text: t('auth.roleBrandText'),
                icon: <Building2 className="h-5 w-5" />,
              },
            ]}
          />
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" block size="lg" loading={busy} disabled={!role}>
            {t('auth.roleContinue')}
          </Button>
        </form>
      </AuthLayout>
    </div>
  );
}
