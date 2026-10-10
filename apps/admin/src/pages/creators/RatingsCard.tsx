/**
 * CREATOR / BRAND → RATINGS (team only): average stars and the comments left after completed deals.
 * Shown on the admin creator page. API: GET /admin/ratings (apps/api/src/modules/admin/trust.routes.ts).
 */
import { useQuery } from '@tanstack/react-query';
import { Card } from '@bluenova/ui';
import { api, date } from '../../lib';
import { QState } from '../../components/common';

interface Ratings { average: number; count: number; ratings: { id: string; stars: number; comment: string | null; createdAt: string }[] }

export function RatingsCard({ targetType, targetId }: { targetType: 'CREATOR' | 'BRAND'; targetId: string }) {
  const q = useQuery({ queryKey: ['ratings', targetType, targetId], queryFn: () => api.get<Ratings>(`/admin/ratings?targetType=${targetType}&targetId=${targetId}`) });
  return (
    <Card>
      <h2 className="font-semibold">Ratings (team only)</h2>
      {q.isLoading || q.error ? <QState q={q} /> : q.data!.count === 0 ? <p className="mt-1 text-sm text-ink-muted">No ratings yet.</p> : (
        <>
          <p className="mt-1 text-sm"><b>{q.data!.average.toFixed(1)} ★</b> from {q.data!.count} completed collaboration{q.data!.count === 1 ? '' : 's'}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {q.data!.ratings.map((r) => (
              <li key={r.id} className="rounded-xl bg-bg p-3">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)} · <span className="text-xs text-ink-muted">{date(r.createdAt)}</span>{r.comment && <p className="mt-1">{r.comment}</p>}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
