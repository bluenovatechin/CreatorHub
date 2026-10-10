/**
 * MESSAGES PAGE (/creator/messages and /brand/messages): talk to the Bluenova team. Creators and brands never
 * message each other; the team passes on what's needed. Left: my conversations; right: the open one (?c=<id>).
 * "New message" can be pre-filled from a deal page: ?new=1&topic=DEAL&id=<dealId>&subject=<text>.
 * API: /conversations (apps/api/src/modules/messages/messages.routes.ts). Messages are plain text (never HTML).
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { MessagesSquare, Plus, Send } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Textarea, cx } from '@bluenova/ui';
import { api, errorText } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { QueryState } from '../../components/common';

interface Conversation { id: string; subject: string; status: 'OPEN' | 'CLOSED'; lastMessageAt: string; unread: number; topic: { type: 'CAMPAIGN' | 'DEAL'; id: string } | null }
interface Message { id: string; from: 'user' | 'team'; body: string; at: string }

function NewConversation({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const topicType = params.get('topic');
  const topic = (topicType === 'DEAL' || topicType === 'CAMPAIGN') && params.get('id') ? { type: topicType, id: params.get('id')! } : undefined;
  const [subject, setSubject] = useState(params.get('subject') ?? '');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api.post<Conversation>('/conversations', { subject: subject.trim(), body: body.trim(), topic }),
    onMutate: () => setError(null),
    onSuccess: (c) => { void qc.invalidateQueries({ queryKey: ['conversations'] }); onCreated(c.id); },
    onError: (e) => setError(errorText(t, e)),
  });
  return (
    <Card>
      <h2 className="mb-4 font-display text-lg font-bold text-navy">{t('messages.new')}</h2>
      <div className="space-y-4">
        <Field label={t('messages.subject')}>{(id) => <Input id={id} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
        <Field label={t('messages.message')}>{(id) => <Textarea id={id} rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
        {error && <Alert tone="red">{error}</Alert>}
        <Button loading={create.isPending} disabled={subject.trim().length < 3 || !body.trim()} onClick={() => create.mutate()}>
          <Send className="h-4 w-4" aria-hidden="true" /> {t('messages.send')}
        </Button>
      </div>
    </Card>
  );
}

function Thread({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['conversations', id],
    queryFn: () => api.get<{ conversation: Conversation; messages: Message[] }>(`/conversations/${id}/messages`),
    refetchInterval: 30_000,
  });
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const send = useMutation({
    mutationFn: () => api.post(`/conversations/${id}/messages`, { body: body.trim() }),
    onMutate: () => setError(null),
    onSuccess: () => { setBody(''); void qc.invalidateQueries({ queryKey: ['conversations'] }); },
    onError: (e) => setError(errorText(t, e)),
  });
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [q.data?.messages.length]);
  // Opening a thread marks it read on the server; refresh the list's unread badges.
  useEffect(() => { if (q.data) void qc.invalidateQueries({ queryKey: ['conversations'], exact: true }); }, [q.data, qc]);
  if (q.isLoading || q.error) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;
  const { conversation, messages } = q.data!;
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <h2 className="font-display text-lg font-bold text-navy">{conversation.subject}</h2>
        {conversation.status === 'CLOSED' && <Badge tone="grey">{t('messages.closed')}</Badge>}
      </div>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto py-4" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={cx('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', m.from === 'user' ? 'ml-auto bg-primary text-white' : 'bg-bg text-navy')}>
            <p className={cx('mb-0.5 text-xs font-semibold', m.from === 'user' ? 'text-primary-100' : 'text-primary')}>
              {m.from === 'user' ? t('messages.you') : t('messages.team')} · {formatDate(m.at, i18n.language)}
            </p>
            <p className="whitespace-pre-line break-words">{m.body}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="space-y-2 border-t border-line pt-3">
        {conversation.status === 'CLOSED' && <p className="text-xs text-ink-muted">{t('messages.reopenHint')}</p>}
        <Textarea aria-label={t('messages.message')} rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
        {error && <Alert tone="red">{error}</Alert>}
        <Button loading={send.isPending} disabled={!body.trim()} onClick={() => send.mutate()}>
          <Send className="h-4 w-4" aria-hidden="true" /> {t('messages.send')}
        </Button>
      </div>
    </Card>
  );
}

export function MessagesPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const selected = params.get('c');
  const creating = params.get('new') === '1';
  const q = useQuery({ queryKey: ['conversations'], queryFn: () => api.get<Conversation[]>('/conversations'), refetchInterval: 60_000 });

  return (
    <div className="space-y-5">
      <PageHeader title={t('messages.title')} subtitle={t('messages.subtitle')}
        action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setParams({ new: '1' })}>{t('messages.new')}</Button>} />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className={cx(selected || creating ? 'hidden lg:block' : '')}>
          {q.isLoading || q.error ? <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0 ? (
            <EmptyState icon={<MessagesSquare />} title={t('messages.none')} text={t('messages.noneText')} />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
              {q.data!.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setParams({ c: c.id })}
                    className={cx('flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-primary-50', selected === c.id && 'bg-primary-50')}>
                    <span>
                      <span className="block font-semibold text-navy">{c.subject}</span>
                      <span className="text-xs text-ink-muted">{formatDate(c.lastMessageAt, i18n.language)}{c.status === 'CLOSED' ? ` · ${t('messages.closed')}` : ''}</span>
                    </span>
                    {c.unread > 0 && <Badge tone="blue">{c.unread}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          {creating ? <NewConversation onCreated={(id) => setParams({ c: id })} />
            : selected ? <Thread id={selected} />
              : <p className="hidden rounded-card border border-dashed border-line p-10 text-center text-sm text-ink-muted lg:block">{t('messages.pick')}</p>}
        </div>
      </div>
    </div>
  );
}
