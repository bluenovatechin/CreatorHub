/**
 * CONTACT (/contact): Bluenova's phone and website, and a short form for visitors (no account needed).
 * Logged-in creators and brands are pointed to Messages instead (their conversation history stays in one place).
 * The form uses the shared contactSchema (same rules in the browser and the API); "website" is a hidden spam trap.
 * API: POST /contact (apps/api/src/modules/contact/contact.routes.ts).
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Mail, MessagesSquare, Phone, Send } from 'lucide-react';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '@bluenova/ui';
import { contactSchema, type z } from '../../lib/zod';
import { api, applyServerErrors, errorText } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { usePageMeta } from '../../lib/seo';
import { useFieldError } from '../../components/common';
import { PageHero } from '../../components/marketing/PageHero';

type Form = z.input<typeof contactSchema>;

export function ContactPage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  usePageMeta({ title: t('nav.contact'), description: t('meta.contact') });
  const fe = useFieldError();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setError: setFieldError, reset, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(contactSchema), defaultValues: { topic: 'BRAND' } });
  const onSubmit = async (v: Form) => {
    setError(null);
    try {
      await api.post('/contact', v);
      setSent(true);
      reset();
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };

  return (
    <div>
      <PageHero eyebrow={t('nav.contact')} title={t('contact.title')} text={t('contact.intro')} cta={t('nav.faq')} to="/faq" />
      <section className="mx-auto grid max-w-content gap-6 px-4 py-12 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{t('contact.direct')}</h2>
          <ul className="mt-4 space-y-3">
            <li><a className="flex items-center gap-2 font-semibold text-primary" href="tel:+917600236644"><Phone className="h-4 w-4" aria-hidden="true" />+91 76002 36644</a></li>
            <li><a className="flex items-center gap-2 font-semibold text-primary" href="https://bluenovatech.in" target="_blank" rel="noopener noreferrer"><Mail className="h-4 w-4" aria-hidden="true" />bluenovatech.in</a></li>
          </ul>
          {me?.role && (
            <p className="mt-6 flex gap-2 rounded-xl bg-primary-50 p-3 text-sm text-navy">
              <MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{t('contact.loggedIn')} <Link to={`/${me.role}/messages`} className="font-semibold text-primary">{t('nav.messages')}</Link></span>
            </p>
          )}
        </Card>
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{t('contact.formTitle')}</h2>
          {sent ? <div className="mt-4"><Alert tone="green">{t('contact.sent')}</Alert></div> : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('contact.name')} error={fe(errors.name?.message)} required>{(id) => <Input id={id} autoComplete="name" invalid={!!errors.name} {...register('name')} />}</Field>
                <Field label={t('auth.email')} error={fe(errors.email?.message)} required>{(id) => <Input id={id} type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />}</Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('contact.phone')} error={fe(errors.phone?.message)}>{(id) => <Input id={id} type="tel" autoComplete="tel" invalid={!!errors.phone} {...register('phone')} />}</Field>
                <Field label={t('contact.topic')}>
                  {(id) => (
                    <Select id={id} {...register('topic')}>
                      {(['BRAND', 'CREATOR', 'OTHER'] as const).map((x) => <option key={x} value={x}>{t(`contact.topics.${x}`)}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
              <Field label={t('contact.message')} error={fe(errors.message?.message)} required>{(id) => <Textarea id={id} rows={5} maxLength={2000} invalid={!!errors.message} {...register('message')} />}</Field>
              {/* Spam trap: hidden from people (and screen readers); bots fill it in. */}
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" {...register('website')} />
              {error && <Alert tone="red">{error}</Alert>}
              <Button type="submit" loading={isSubmitting}><Send className="h-4 w-4" aria-hidden="true" /> {t('contact.send')}</Button>
            </form>
          )}
        </Card>
      </section>
    </div>
  );
}
