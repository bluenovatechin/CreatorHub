import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@bluenova/ui';
import { api, date } from '../../lib';
import { QState } from '../../components/common';

export function AuditLogPage() {
  const q = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.get<{ id: string; actorName: string | null; adminRole: string | null; action: string; entityType: string; entityId: string | null; reason: string | null; ip: string | null; createdAt: string }[]>('/admin/audit-logs?limit=50'),
  });

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Read-only record of every admin action." />
      {q.isLoading || q.error ? <QState q={q} /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-xs uppercase text-ink-muted"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Reason</th><th className="p-3">IP</th></tr></thead>
            <tbody className="divide-y divide-line">
              {q.data!.map((a) => (
                <tr key={a.id}>
                  <td className="p-3 text-xs">{date(a.createdAt)}</td>
                  <td className="p-3">{a.actorName ?? '—'}<div className="text-xs text-ink-muted">{a.adminRole}</div></td>
                  <td className="p-3 font-mono text-xs">{a.action}</td>
                  <td className="p-3 text-xs">{a.entityType} {a.entityId?.slice(-6)}</td>
                  <td className="p-3 text-xs">{a.reason ?? ''}</td>
                  <td className="p-3 text-xs">{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
