/**
 * WORK REVIEW → "Change terms" and "Cancel deal" (campaign managers) for one unfinished deal.
 *   Change terms: payout / brand price (₹), draft and live dates, change requests allowed. A reason is required;
 *                 the change is recorded on the deal (each side sees its own part), audited and both sides told.
 *   Cancel deal:  reason required; audited; both sides told. Disputed deals are closed from Disputes & reports.
 * API: POST /admin/deals/:id/amend, /admin/deals/:id/cancel (apps/api/src/modules/admin/deals.routes.ts).
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, Field, Input, Textarea } from '@bluenova/ui';
import { api, errorText } from '../../lib';

interface DealLite { id: string; type: 'BRAND' | 'INTRO_REEL'; status: string; maxRevisions: number }

export function DealAdminActions({ deal }: { deal: DealLite }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'amend' | 'cancel' | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const done = () => { setMode(null); setForm({}); void qc.invalidateQueries({ queryKey: ['deals'] }); };
  const submit = useMutation({
    mutationFn: () => {
      if (mode === 'cancel') return api.post(`/admin/deals/${deal.id}/cancel`, { reason: form.reason?.trim() });
      const body: Record<string, unknown> = { reason: form.reason?.trim() };
      if (form.creatorPayout) body.creatorPayout = Number(form.creatorPayout);
      if (form.brandPrice) body.brandPrice = Number(form.brandPrice);
      if (form.draftDue) body.draftDue = form.draftDue;
      if (form.liveDue) body.liveDue = form.liveDue;
      if (form.maxRevisions) body.maxRevisions = Number(form.maxRevisions);
      return api.post(`/admin/deals/${deal.id}/amend`, body);
    },
    onMutate: () => setError(null),
    onSuccess: done,
    onError: (e) => setError(errorText(e)),
  });
  if (['COMPLETED', 'CANCELLED', 'VERIFIED', 'DISPUTED'].includes(deal.status)) return null;
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const digits = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, '') }));
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button type="button" className="font-semibold text-primary" onClick={() => { setError(null); setMode('amend'); }}>Change terms</button>
        {deal.type === 'BRAND' && <button type="button" className="font-semibold text-danger" onClick={() => { setError(null); setMode('cancel'); }}>Cancel deal</button>}
      </div>
      <Dialog open={!!mode} onClose={() => setMode(null)} title={mode === 'cancel' ? 'Cancel this deal?' : 'Change the agreed terms'}
        footer={<>
          <Button variant="secondary" onClick={() => setMode(null)}>Back</Button>
          <Button variant={mode === 'cancel' ? 'danger' : 'primary'} loading={submit.isPending} disabled={(form.reason?.trim().length ?? 0) < 3} onClick={() => submit.mutate()}>
            {mode === 'cancel' ? 'Cancel deal' : 'Save changes'}
          </Button>
        </>}>
        <div className="space-y-4 text-sm">
          {mode === 'amend' ? (
            <>
              <p className="text-ink-muted">Fill in only what changes. The creator sees payout and date changes; the brand sees price and date changes.</p>
              {deal.type === 'BRAND' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="New creator payout ₹">{(id) => <Input id={id} inputMode="numeric" value={form.creatorPayout ?? ''} onChange={digits('creatorPayout')} />}</Field>
                  <Field label="New brand price ₹">{(id) => <Input id={id} inputMode="numeric" value={form.brandPrice ?? ''} onChange={digits('brandPrice')} />}</Field>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Draft due">{(id) => <Input id={id} type="date" value={form.draftDue ?? ''} onChange={set('draftDue')} />}</Field>
                <Field label="Live by">{(id) => <Input id={id} type="date" value={form.liveDue ?? ''} onChange={set('liveDue')} />}</Field>
              </div>
              {deal.type === 'BRAND' && (
                <Field label={`Change requests allowed (now ${deal.maxRevisions})`}>{(id) => <Input id={id} inputMode="numeric" className="w-24" value={form.maxRevisions ?? ''} onChange={digits('maxRevisions')} />}</Field>
              )}
            </>
          ) : <Alert tone="amber">The deal ends for both sides. Any money already arranged outside the website must be settled there.</Alert>}
          <Field label="Reason (recorded; both sides are told something changed)">{(id) => <Textarea id={id} maxLength={500} value={form.reason ?? ''} onChange={set('reason')} />}</Field>
          {error && <Alert tone="red">{error}</Alert>}
        </div>
      </Dialog>
    </>
  );
}
