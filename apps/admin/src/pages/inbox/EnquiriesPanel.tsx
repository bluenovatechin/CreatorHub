/**
 * INBOX → WEBSITE ENQUIRIES: messages from the public Contact page (visitors without an account).
 * Reply by email or phone outside the website, then "Mark handled". API: modules/admin/enquiries.routes.ts.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { Badge, Button, Card, EmptyState, cx } from '@bluenova/ui';
import { api, date, label } from '../../lib';
import { QState } from '../../components/common';

interface Enquiry { id: string; name: string; email: string; phone: string | null; topic: string; message: string; status: 'OPEN' | 'HANDLED'; createdAt: string }

export function EnquiriesPanel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'OPEN' | 'HANDLED'>('OPEN');
  const q = useQuery({ queryKey: ['enquiries', status], queryFn: () => api.get<Enquiry[]>(`/admin/enquiries?status=${status}`) });
  const handled = useMutation({
    mutationFn: (id: string) => api.post(`/admin/enquiries/${id}/handled`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['enquiries'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['OPEN', 'HANDLED'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={cx('min-h-9 rounded-full px-4 text-sm font-semibold', status === s ? 'bg-navy text-white' : 'border border-line bg-white text-ink-muted')}>{label(s)}</button>
        ))}
      </div>
      {q.isLoading || q.error ? <QState q={q} /> : q.data!.length === 0 ? <EmptyState icon={<Mail />} title="No enquiries here" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data!.map((e) => (
            <Card key={e.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold text-navy">{e.name}</p>
                  <p className="text-sm"><a className="text-primary" href={`mailto:${e.email}`}>{e.email}</a>{e.phone ? <> · <a className="text-primary" href={`tel:${e.phone}`}>{e.phone}</a></> : null}</p>
                </div>
                <Badge tone={e.topic === 'BRAND' ? 'blue' : e.topic === 'CREATOR' ? 'green' : 'grey'}>{label(e.topic)}</Badge>
              </div>
              <p className="mt-3 whitespace-pre-line rounded-xl bg-bg p-3 text-sm">{e.message}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
                <span>{date(e.createdAt)}</span>
                {e.status === 'OPEN' && <Button size="sm" variant="secondary" loading={handled.isPending && handled.variables === e.id} onClick={() => handled.mutate(e.id)}>Mark handled</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
