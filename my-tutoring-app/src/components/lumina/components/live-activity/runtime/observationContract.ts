/**
 * What every observation kind shares on the wire: the item an observation is scoped
 * to, and the bounds a request or a model answer is rechecked against. Client-safe —
 * the routes, the client observers and the server kinds all import it.
 */
import type { RuntimeSnapshot } from './contract';

export interface ItemScope { sessionEpoch: string; instanceId: string; itemId: string }

/** ONE spelling of an item's identity. The tracker, the transport and both observers
 *  compare these strings, so a second template would drop observations silently. */
export const itemScopeKey = (scope: { sessionEpoch: string; instanceId?: string | null; itemId?: string }) =>
  `${scope.sessionEpoch}/${scope.instanceId}/${scope.itemId}`;
export const snapshotScopeKey = (state: RuntimeSnapshot) =>
  itemScopeKey({ sessionEpoch: state.sessionEpoch, instanceId: state.instanceId, itemId: state.task?.itemId });
/** Is the runtime still on the item this observation was made about? */
export const sameItemScope = (state: RuntimeSnapshot, scope: ItemScope) => state.sessionEpoch === scope.sessionEpoch
  && state.instanceId === scope.instanceId && state.task?.itemId === scope.itemId;

/** A model's observation must not outlive the turn it was about. */
export const OBSERVATION_TIMEOUT_MS = 4000;

/** The client half of an observation route. A refused or failed request abstains. */
export const postObservation = <Request, Decision>(path: string, abstain: (reason: string) => Decision) =>
  async (request: Request, signal: AbortSignal): Promise<Decision> => {
    const response = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal,
    });
    return response.ok ? response.json() : abstain('unavailable');
  };

export const probability = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
export const boundedText = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
export const validItemScope = (v: any): v is ItemScope =>
  !!v && ['sessionEpoch', 'instanceId', 'itemId'].every(k => boundedText(v[k], 200) && !!v[k]);

/** The exact model input and answers, kept inspectable on every decision. */
export interface ObservationAssessment { state?: unknown; questions: unknown; answers: unknown }
