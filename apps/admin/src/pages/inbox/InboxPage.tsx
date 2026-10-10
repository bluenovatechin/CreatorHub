/**
 * INBOX (/inbox): every conversation between a creator/brand and the team. Reviewers, campaign managers, finance.
 * Left: conversations (filter: waiting = unread for the team). Right: the open one (?c=<id>) with reply + close.
 * Users see replies as "Bluenova team"; here you see which colleague wrote each one. Opening a conversation
 * is recorded in the audit log (it is personal data). API: apps/api/src/modules/admin/messages.routes.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Inbox, Send } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Textarea, cx } from '@bluenova/ui';
import { api, date, errorText, useAdmin } from '../../lib';
import { QState } from '../../components/common';
import { EnquiriesPanel } from './EnquiriesPanel';

interface Conversation {
  id: string; subject: string; status: 'OPEN' | 'CLOSED'; lastMessageAt: string; unread: number; ownerUserId: string;
  ownerRole: 'creator' | 'brand'; ownerName: string | null; topic: { type: 'CAMPAIGN' | 'DEAL'; id: string } | null;
}
interface Message { id: string; from: 'user' | 'team'; body: string; at: string; senderName?: string | null }

const FILTERS: [string, string][] = [['WAITING', 'Waiting'], ['OPEN', 'Open'], ['CLOSED', 'Closed'], ['ALL', 'All']];

function Thread({ id }: { id: string }) {
  const { me } = useAdmin();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.get<{ conversation: Conversation; messages: Message[] }>(`/admin/conversations/${id}/messages`),
  });
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['conversation', id] }); void qc.invalidateQueries({ queryKey: ['conversations'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const reply = useMutation({
    mutationFn: () => api.post(`/admin/conversations/${id}/messages`, { body: body.trim() }),
    onMutate: () => setError(null),
    onSuccess: () => { setBody(''); refresh(); },
    onError: (e) => setError(errorText(e)),
  });
  const status = useMutation({
    mutationFn: (s: 'OPEN' | 'CLOSED') => api.post(`/admin/conversations/${id}/status`, { status: s }),
    onSuccess: refresh,
    onError: (e) => setError(errorText(e)),
  });
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [q.data?.messages.length]);
  if (q.isLoading || q.error) return <QState q={q} />;
  const { conversation: c, messages } = q.data!;
  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-navy">{c.subject}</h2>
          <p className="text-sm text-ink-muted">
            {me?.adminRole === 'super_admin' // the account page is for super admins only
              ? <Link to={`/users/${c.ownerUserId}`} className="text-primary">{c.ownerName ?? 'User'}</Link>
              : c.ownerName ?? 'User'} · {c.ownerRole}
            {c.topic && <> · about {c.topic.type === 'CAMPAIGN' ? <Link to={`/campaigns/${c.topic.id}`} className="text-primary">a campaign</Link> : 'a deal'}</>}
          </p>
        </div>
        <Button size="sm" variant="secondary" loading={status.isPending} onClick={() => status.mutate(c.status === 'OPEN' ? 'CLOSED' : 'OPEN')}>
          {c.status === 'OPEN' ? 'Close conversation' : 'Re-open'}
        </Button>
      </div>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto py-4">
        {messages.map((m) => (
          <div key={m.id} className={cx('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', m.from === 'team' ? 'ml-auto bg-primary text-white' : 'bg-bg text-navy')}>
            <p className={cx('mb-0.5 text-xs font-semibold', m.from === 'team' ? 'text-primary-100' : 'text-primary')}>
              {m.from === 'team' ? `Team${m.senderName ? ` (${m.senderName})` : ''}` : c.ownerName ?? 'User'} · {date(m.at)}
            </p>
            <p className="whitespace-pre-line break-words">{m.body}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="space-y-2 border-t border-line pt-3">
        <Textarea aria-label="Reply" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
        <p className="text-xs text-ink-faint">The user sees this as “Bluenova team”. Never share another user's phone or email.</p>
        {error && <Alert tone="red">{error}</Alert>}
        <Button loading={reply.isPending} disabled={!body.trim()} icon={<Send className="h-4 w-4" />} onClick={() => reply.mutate()}>Send reply</Button>
      </div>
    </Card>
  );
}

export function InboxPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'WAITING';
  const selected = params.get('c');
  const tab = params.get('tab') === 'enquiries' ? 'enquiries' : 'conversations';
  const q = useQuery({ queryKey: ['conversations', status], queryFn: () => api.get<Conversation[]>(`/admin/conversations?status=${status}`), refetchInterval: 60_000 });
  return (
    <div>
      <PageHeader title="Inbox" subtitle="Messages from creators and brands. They only ever talk to the team, never to each other." />
      <div className="mb-4 flex gap-4 border-b border-line text-sm font-semibold">
        <button type="button" className={cx('pb-2', tab === 'conversations' ? 'border-b-2 border-primary text-primary' : 'text-ink-muted')} onClick={() => setParams({})}>Conversations</button>
        <button type="button" className={cx('pb-2', tab === 'enquiries' ? 'border-b-2 border-primary text-primary' : 'text-ink-muted')} onClick={() => setParams({ tab: 'enquiries' })}>Website enquiries</button>
      </div>
      {tab === 'enquiries' ? <EnquiriesPanel /> : (<>
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map(([s, text]) => (
          <button key={s} type="button" onClick={() => setParams({ status: s })}
            className={cx('min-h-9 rounded-full px-4 text-sm font-semibold', status === s ? 'bg-primary text-white' : 'border border-line bg-white text-ink-muted hover:text-navy')}>
            {text}
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div>
          {q.isLoading || q.error ? <QState q={q} /> : q.data!.length === 0 ? (
            <EmptyState icon={<Inbox />} title="Nothing here" text={status === 'WAITING' ? 'No unread messages.' : undefined} />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
              {q.data!.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setParams({ status, c: c.id })}
                    className={cx('flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-primary-50', selected === c.id && 'bg-primary-50')}>
                    <span>
                      <span className="block font-semibold text-navy">{c.subject}</span>
                      <span className="text-xs text-ink-muted">{c.ownerName} · {c.ownerRole} · {date(c.lastMessageAt)}</span>
                    </span>
                    {c.unread > 0 ? <Badge tone="blue">{c.unread}</Badge> : c.status === 'CLOSED' ? <Badge tone="grey">closed</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>{selected ? <Thread id={selected} /> : <p className="hidden rounded-card border border-dashed border-line p-10 text-center text-sm text-ink-muted lg:block">Pick a conversation.</p>}</div>
      </div>
      </>)}
    </div>
  );
}
