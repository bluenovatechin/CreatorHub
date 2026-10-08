import type { Types } from 'mongoose';
import { canTransition, type Actor, type Machine } from '@bluenova/shared';
import { invalidState } from './errors';

interface Transitionable<S extends string> {
  status: S;
  statusHistory: { push(entry: { from: string; to: string; by?: Types.ObjectId | string; reason?: string; at: Date }): unknown };
}

/**
 * The only way to change an entity's status. Rejects moves the state machine doesn't
 * allow for this actor (409 INVALID_STATE) and records history.
 */
export function applyTransition<S extends string>(
  doc: Transitionable<S>,
  machine: Machine<S>,
  to: S,
  actor: Actor,
  by?: Types.ObjectId | string,
  reason?: string,
) {
  const from = doc.status;
  if (!canTransition(machine, from, to, actor)) throw invalidState();
  doc.status = to;
  doc.statusHistory.push({ from, to, by, reason, at: new Date() });
}
