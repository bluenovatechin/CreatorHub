/**
 * GOOGLE CALLBACK PAGE (/auth/google/callback)
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '@bluenova/ui';
import { api, errorText } from '../../../lib/api';
import { postLoginPath, useAuth } from '../../../lib/auth';
import { AuthLayout } from '../../../components/layout';
import { Heading, GOOGLE_STATE_KEY, type Session } from '../components/AuthCommon';
import './GoogleCallbackPage.css';

export function GoogleCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, '', window.location.pathname);
    let saved: { state?: string; nonce?: string; next?: string | null } = {};
    try {
      saved = JSON.parse(sessionStorage.getItem(GOOGLE_STATE_KEY) ?? '{}');
      sessionStorage.removeItem(GOOGLE_STATE_KEY);
    } catch {
      /* storage blocked */
    }

    const credential = hash.get('id_token');
    if (hash.get('error')) {
      return setError(t(hash.get('error') === 'access_denied' ? 'errors.googleCancelled' : 'errors.googleFailed'));
    }
    if (!credential || !saved.state || hash.get('state') !== saved.state || !saved.nonce) {
      return setError(t('errors.googleFailed'));
    }

    api
      .post<Session>('/auth/google', { credential, nonce: saved.nonce })
      .then((s) => {
        signIn(s.accessToken, s.user);
        navigate(postLoginPath(s.user, saved.next ?? null), { replace: true });
      })
      .catch((e) => setError(errorText(t, e)));
  }, [t, navigate, signIn]);

  return (
    <div className="google-callback-page">
      <AuthLayout>
        {error ? (
          <>
            <Heading title={t('auth.googleProblemTitle')} />
            <Alert tone="red">{error}</Alert>
            <Link to="/login" replace className="mt-6 inline-block font-semibold text-primary hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </>
        ) : (
          <Heading title={t('auth.googleSigningIn')} text={t('auth.pleaseWait')} />
        )}
      </AuthLayout>
    </div>
  );
}
