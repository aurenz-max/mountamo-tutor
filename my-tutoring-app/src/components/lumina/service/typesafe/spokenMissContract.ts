/**
 * The wire contract of the `spoken_miss` observation (handoff 20 Part B): which of this item's known wrong
 * answers is a spoken answer? It is the spoken counterpart of a gesture check's miss function (`jumpMiss`,
 * `frameMiss`, `countMiss`): the family's domain lists the item's known misses, the model maps the learner's
 * words onto one of them or onto none, and code gates the answer. It names the observable pattern of a wrong
 * answer only; it never judges credit (the dialogue observer does, from the tutor) and never moves the lesson.
 *
 * Client-safe on purpose: it moves beside the other contracts in `runtime/` when the runtime wiring lands.
 */
import { boundedText as text, probability, validItemScope, type ItemScope, type ObservationAssessment }
  from '../../components/live-activity/runtime/observationContract';

/** One known wrong answer of THIS item, stated concretely by the family's domain (numbers, words, letters). */
export interface KnownMiss {
  /** The id a catalog `teachingWorkspace.misses` list names, e.g. `one_over`. */
  id: string;
  /** The observable pattern on this item: "The last number the learner says is 5, one more than the 4 butterflies." */
  pattern: string;
  /** What a learner showing it might say, e.g. ["five", "one two three four five"]. */
  examples?: string[];
}

export interface SpokenMissRequest {
  scope: ItemScope;
  task: string;
  expectedAnswer: string;
  /** What the learner said, as transcribed (may be noisy). */
  learner: string;
  /** What the tutor said just before the learner answered, when known. */
  priorTutor?: string;
  /** In precedence order: when an answer fits two, the first listed wins. */
  misses: KnownMiss[];
}

/** The non-miss readings. A miss id may not reuse one. */
export const NON_MISS = ['correct', 'other_wrong', 'no_answer'] as const;
export type NonMiss = typeof NON_MISS[number];

export interface SpokenMissDecision {
  /** The named miss id, or null: correct, an unlisted wrong answer, no answer, or below the gate. */
  miss: string | null;
  /** The likeliest reading whether or not it cleared the gate: a miss id or a `NonMiss`. */
  reading: string | null;
  /** Probability of `reading`. */
  p: number | null;
  accepted: boolean;
  reason: string;
  ms: number;
  model?: string;
  assessment?: ObservationAssessment;
}

/** Code holds the policy: a miss is named only when P(a known miss) and that miss's own fit both reach this. */
export const MISS_GATE = 0.7;
export const MAX_MISSES = 12;

const ID = /^[a-z][a-z0-9_]{0,39}$/;
const validMiss = (m: any): m is KnownMiss => !!m && typeof m.id === 'string' && ID.test(m.id)
  && !(NON_MISS as readonly string[]).includes(m.id) && text(m.pattern, 400) && !!m.pattern.trim()
  && (m.examples === undefined || Array.isArray(m.examples) && m.examples.length <= 6 && m.examples.every((e: unknown) => text(e, 200)));

export function validSpokenMissRequest(v: any): v is SpokenMissRequest {
  return !!v && validItemScope(v.scope) && text(v.task, 1500) && text(v.expectedAnswer, 2000) && !!v.expectedAnswer.trim()
    && text(v.learner, 2000) && !!v.learner.trim() && (v.priorTutor === undefined || text(v.priorTutor, 4000))
    && Array.isArray(v.misses) && v.misses.length >= 1 && v.misses.length <= MAX_MISSES && v.misses.every(validMiss)
    && new Set(v.misses.map((m: KnownMiss) => m.id)).size === v.misses.length;
}

export const abstainSpokenMiss = (reason: string, ms = 0): SpokenMissDecision =>
  ({ miss: null, reading: null, p: null, accepted: false, reason, ms });

export const validReading = (p: unknown): p is number => probability(p);
