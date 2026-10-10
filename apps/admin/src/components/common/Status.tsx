import { Badge } from '@bluenova/ui';
import { label, tone } from '../../lib';

/** Coloured status pill (e.g. SUBMITTED, APPROVED). */
export function Status({ s }: { s: string }) {
  return <Badge tone={tone(s)}>{label(s)}</Badge>;
}
