import 'server-only';
import { systemOne, typesafeConfigured, type Question } from '../manifest/typesafe/typesafeClient';
import type { ObservationAssessment } from '../../components/live-activity/runtime/observationContract';

/**
 * One kind of JEV observation: a fixed question set over a bounded state, and a pure
 * decision over the answers. A kind classifies; it never plans teaching and never
 * speaks. Who may act on a decision is the CLIENT observer's contract, not this one:
 * only `assignment_outcome` has a runtime consumer, every other kind is advisory.
 *
 * Adding a kind means adding its questions, its state builder and its decision here,
 * plus a real-model case set. It does not mean a primitive-specific branch (TW-10).
 */
export interface ObservationKind<Request, Decision> {
  id: string;
  timeoutMs: number;
  /** Fixed, or built per request when the options are the item's own (`spoken_miss`: one option per known miss). */
  questions: Record<string, Question> | ((request: Request) => Record<string, Question>);
  /** The exact model input. Kept inspectable on every decision. */
  state: (request: Request) => unknown;
  decide: (request: Request, answers: any, ms: number, model?: string) => Decision;
  abstain: (reason: string, ms?: number) => Decision;
}

export type Assessed = { assessment?: ObservationAssessment };
/** `cancelled` is the caller's own abort (a superseded turn), so the upstream call stops with it. */
export async function runObservation<Request, Decision extends Assessed>(kind: ObservationKind<Request, Decision>, request: Request,
    cancelled?: AbortSignal): Promise<Decision> {
  if (!typesafeConfigured()) return kind.abstain('not_configured');
  const start = performance.now(), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), kind.timeoutMs);
  try {
    const state = kind.state(request);
    const questions = typeof kind.questions === 'function' ? kind.questions(request) : kind.questions;
    const result = await systemOne(state, questions,
      { signal: cancelled ? AbortSignal.any([cancelled, controller.signal]) : controller.signal });
    return { ...kind.decide(request, result.answers, result.ms, result.model),
      assessment: { state, questions, answers: result.answers } };
  } catch { return kind.abstain(controller.signal.aborted ? 'timeout' : 'unavailable', Math.round(performance.now() - start)); }
  finally { clearTimeout(timer); }
}
