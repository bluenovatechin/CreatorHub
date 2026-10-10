import { Alert, Button, Loading } from '@bluenova/ui';
import { errorText } from '../../lib';

/** Loading spinner or error-with-retry for a query. Renders nothing once data is ready. */
export function QState({ q }: { q: { isLoading: boolean; error: unknown; refetch: () => unknown } }) {
  if (q.isLoading) return <Loading />;
  if (q.error) {
    return (
      <Alert tone="red" title={errorText(q.error)}>
        <Button size="sm" variant="secondary" className="mt-2" onClick={() => q.refetch()}>
          Retry
        </Button>
      </Alert>
    );
  }
  return null;
}
