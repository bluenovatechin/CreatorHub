/**
 * MANUAL PAYMENT PAGE (only when payments are switched ON): shows what to pay and the bank/UPI details,
 * then the brand reports the transfer reference for the finance team to verify.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAppConfig } from '../../lib/config';
import { ArrowLeft, Clock, Landmark, Lock, Receipt, ShieldCheck, XCircle } from 'lucide-react';
import { PAYMENT_METHODS, paymentSubmitSchema, todayIST, type PaymentSubmitInput } from '../../lib/zod';
import { Alert, Badge, Button, Card, CardHeader, CopyButton, EmptyState, Field, Input, PageHeader, Select, Textarea } from '@bluenova/ui';
import { api, applyServerErrors, errorText } from '../../lib/api';
import { formatDate, formatINR } from '../../lib/format';
import type { CheckoutView, PaymentView } from '../../lib/types';
import { QueryState, useFieldError } from '../../components/common';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex items-center justify-between border-t border-line pt-3' : 'flex items-center justify-between'}>
      <dt className={strong ? 'font-bold text-navy' : 'text-ink-muted'}>{label}</dt>
      <dd className={strong ? 'font-display text-2xl font-extrabold text-navy' : 'font-semibold text-ink'}>{value}</dd>
    </div>
  );
}

const paymentTone = (s: PaymentView['status']) => (s === 'VERIFIED' ? 'green' : s === 'REJECTED' ? 'red' : 'blue');

export function PaymentPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const qc = useQueryClient();
  const fe = useFieldError();
  const lang = i18n.language;
  const { paymentsEnabled } = useAppConfig();
  const q = useQuery({ queryKey: ['checkout', id], queryFn: () => api.get<CheckoutView>(`/campaigns/${id}/checkout`), enabled: paymentsEnabled });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, watch, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<PaymentSubmitInput>({
    resolver: zodResolver(paymentSubmitSchema),
    defaultValues: { method: 'UPI', paidOn: todayIST() },
  });
  const method = watch('method');

  if (!paymentsEnabled) return <Navigate to={`/brand/campaigns/${id}`} replace />;
  if (q.isLoading || q.error) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;
  const c = q.data!;
  const rate = (c.gst.rateBps / 100).toString();
  const half = (c.gst.rateBps / 200).toString();
  const lastRejected = c.payments.find((p) => p.status === 'REJECTED' && !c.payments.some((x) => x.status !== 'REJECTED' && x.createdAt > p.createdAt));
  const canSubmit = c.lines.length > 0 && !c.pending && !!c.paymentDetails && !done;

  const onSubmit = async (v: PaymentSubmitInput) => {
    setError(null);
    try {
      await api.post(`/campaigns/${id}/payments`, v);
      setDone(true);
      await qc.invalidateQueries({ queryKey: ['checkout', id] });
      await qc.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };

  return (
    <div className="space-y-6">
      <Link to={`/brand/campaigns/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" />{t('campaign.details')}</Link>
      <PageHeader title={t('payment.title')} subtitle={t('payment.subtitle')} />

      {c.pending && <Alert tone="blue" title={t('payment.pendingTitle')}>{t('payment.pendingText')}</Alert>}
      {done && <Alert tone="green">{t('payment.submitted')}</Alert>}
      {lastRejected && !c.pending && !done && (
        <Alert tone="red" title={t('payment.rejectedTitle')}>{lastRejected.rejectReason}</Alert>
      )}

      {c.lines.length === 0 && !c.pending ? (
        <EmptyState icon={<Receipt />} title={t('payment.nothingDue')} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader icon={<Receipt />} title={t('payment.summary')} />
              <ul className="space-y-2 text-sm">
                {c.lines.map((l) => (
                  <li key={l.dealId} className="flex items-center justify-between gap-3"><span className="text-ink">{l.creator}</span><span className="font-semibold">{formatINR(l.brandPricePaise)}</span></li>
                ))}
              </ul>
              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                <Row label={t('payment.subtotal')} value={formatINR(c.subtotalPaise)} />
                {c.gst.cgstPaise > 0 && <Row label={t('payment.cgst', { rate: half })} value={formatINR(c.gst.cgstPaise)} />}
                {c.gst.sgstPaise > 0 && <Row label={t('payment.sgst', { rate: half })} value={formatINR(c.gst.sgstPaise)} />}
                {c.gst.igstPaise > 0 && <Row label={t('payment.igst', { rate })} value={formatINR(c.gst.igstPaise)} />}
                <Row label={t('payment.total')} value={formatINR(c.totalPaise)} strong />
              </dl>
            </Card>

            <Card className="bg-navy text-white" padded>
              <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Landmark className="h-5 w-5" aria-hidden="true" />{t('payment.bankTitle')}</h2>
              {c.paymentDetails ? (
                <>
                  <dl className="mt-5 space-y-3 text-sm">
                    {[
                      [t('payment.accountName'), c.paymentDetails.accountName],
                      [t('payment.bankName'), c.paymentDetails.bankName],
                      [t('payment.accountNumber'), c.paymentDetails.accountNumber],
                      [t('payment.ifsc'), c.paymentDetails.ifsc],
                      ...(c.paymentDetails.upiId ? [[t('payment.upiId'), c.paymentDetails.upiId]] : []),
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2.5">
                        <div><dt className="text-xs text-primary-200">{k}</dt><dd className="font-mono font-semibold tracking-wide">{v}</dd></div>
                        <span className="rounded-lg bg-white"><CopyButton value={v} label={t('common.copy')} copiedLabel={t('common.copied')} /></span>
                      </div>
                    ))}
                  </dl>
                  {c.paymentDetails.instructions && <p className="mt-4 text-sm text-primary-100">{c.paymentDetails.instructions}</p>}
                  <ol className="mt-5 space-y-2 text-sm text-primary-100">
                    {(t('payment.steps', { returnObjects: true }) as string[]).map((s, i) => (
                      <li key={s} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">{i + 1}</span>{s}</li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="mt-3 text-primary-100">{t('payment.notConfigured')}</p>
              )}
              <p className="mt-5 flex items-start gap-2 border-t border-white/15 pt-4 text-xs text-primary-200"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('payment.safety')}</p>
            </Card>
          </div>

          <div className="space-y-6">
            {canSubmit && (
              <Card>
                <CardHeader icon={<ShieldCheck />} title={t('payment.formTitle')} />
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label={t('payment.method')} required>
                      {(fid) => <Select id={fid} {...register('method')}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`payment.methods.${m}`)}</option>)}</Select>}
                    </Field>
                    <Field label={t('payment.paidOn')} error={fe(errors.paidOn?.message)} required>
                      {(fid, d) => <Input id={fid} aria-describedby={d} type="date" max={todayIST()} invalid={!!errors.paidOn} {...register('paidOn')} />}
                    </Field>
                  </div>
                  <Field label={t('payment.reference')} hint={t(`payment.refHints.${method}`)} error={fe(errors.reference?.message)} required>
                    {(fid, d) => <Input id={fid} aria-describedby={d} autoComplete="off" spellCheck={false} className="font-mono uppercase tracking-wide" invalid={!!errors.reference} {...register('reference')} />}
                  </Field>
                  <Field label={t('payment.amount')} hint={t('payment.amountHint', { amount: formatINR(c.totalPaise) })} error={fe(errors.amountPaid?.message)} required>
                    {(fid, d) => <Input id={fid} aria-describedby={d} inputMode="numeric" invalid={!!errors.amountPaid} {...register('amountPaid')} />}
                  </Field>
                  <Field label={t('payment.payerName')} error={fe(errors.payerName?.message)} required>
                    {(fid, d) => <Input id={fid} aria-describedby={d} invalid={!!errors.payerName} {...register('payerName')} />}
                  </Field>
                  <Field label={t('payment.note')} error={fe(errors.note?.message)}>
                    {(fid) => <Textarea id={fid} maxLength={300} className="min-h-20" {...register('note')} />}
                  </Field>
                  {error && <Alert tone="red">{error}</Alert>}
                  <Button type="submit" size="lg" block loading={isSubmitting}>{t('payment.submit')}</Button>
                </form>
              </Card>
            )}

            {c.payments.length > 0 && (
              <Card>
                <CardHeader icon={<Clock />} title={t('payment.history')} />
                <ul className="divide-y divide-line">
                  {c.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-navy">{formatINR(p.amountPaidPaise)} · {t(`payment.methods.${p.method}`)}</p>
                        <p className="font-mono text-xs text-ink-muted">{p.reference} · {formatDate(p.paidOn, lang)}</p>
                        {p.rejectReason && <p className="mt-1 flex items-center gap-1 text-xs text-danger"><XCircle className="h-3.5 w-3.5" />{p.rejectReason}</p>}
                      </div>
                      <Badge tone={paymentTone(p.status)}>{t(`status.payment.${p.status}`)}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
