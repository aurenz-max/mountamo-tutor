/**
 * The wire contract of the `spoken_miss` observation (handoff 20 Part B): which of this item's known wrong
 * answers is a spoken answer? It is the spoken counterpart of a gesture check's miss function (`jumpMiss`,
 * `frameMiss`, `countMiss`): the family's domain lists the item's known misses, the model maps the learner's
 * words onto one of them or onto none, and code gates the answer. It names the observable pattern of a wrong
 * answer only; it never judges credit (the dialogue observer does, from the tutor) and never moves the lesson.
 *
 * Client-safe: the runtime (`useTeachingWorkspace`) posts it and the server route validates it.
 */
import { boundedText as text, probability, validItemScope, type ItemScope, type ObservationAssessment }
  from './observationContract';

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

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
/** How a learner might say `n`: its word up to twenty, its digits past that. */
export const spokenNumber = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** The off-by misses of a spoken whole-number answer (`offByMisses`). */
export type OffByMiss = 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more';

/**
 * The off-by misses of a spoken whole-number answer, in the pilot's measured wording (qa/tutor-reports/spoken-miss/,
 * 0 false positives in 1,332 decisions). `of` names what the answer counts, with the number: "the 4 bears on the
 * board". A family lists its own concrete misses (the empty boxes, the number before the change) BEFORE these, so
 * an answer that is both is named by the family's pattern.
 */
export function offByMisses(answer: number, of: string): KnownMiss[] {
  return [
    ...(answer - 1 >= 1 ? [{ id: 'one_short', pattern: `The learner's answer is ${answer - 1}, one fewer than ${of}.`, examples: [spokenNumber(answer - 1)] }] : []),
    { id: 'one_over', pattern: `The learner's answer is ${answer + 1}, one more than ${of}.`, examples: [spokenNumber(answer + 1)] },
    ...(answer - 2 >= 1 ? [{ id: 'short_by_more', pattern: `The learner's answer is ${answer - 2} or fewer (but more than zero), two or more fewer than ${of}.`, examples: [spokenNumber(answer - 2)] }] : []),
    { id: 'over_by_more', pattern: `The learner's answer is ${answer + 2} or more, two or more more than ${of}.`, examples: [spokenNumber(answer + 2)] },
  ];
}

/**
 * A family's concrete number misses ("said the number before taking away"), kept only when the number is a real
 * wrong answer: not the key, above zero, and not already named by an earlier entry. Listed before `offByMisses`.
 */
export function numberMisses(answer: number, candidates: Array<{ id: string; value: number | undefined; pattern: (n: number) => string }>): KnownMiss[] {
  const seen = new Set<number>([answer]);
  return candidates.flatMap(({ id, value, pattern }) => {
    if (value === undefined || !Number.isInteger(value) || value < 1 || seen.has(value)) return [];
    seen.add(value);
    return [{ id, pattern: pattern(value), examples: [spokenNumber(value)] }];
  });
}
