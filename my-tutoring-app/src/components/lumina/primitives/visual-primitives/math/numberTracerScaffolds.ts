/**
 * Number tracer's live-tutor misstep inventory (see `/add-live-tutor-tools`).
 *
 * A dedicated module rather than a section of a script file, because this is a
 * TUTOR-LED primitive: there is no judged runner and therefore no `correctionFor`
 * for these aids to sit beside. What there IS is the component's own feedback
 * line ("Excellent writing!", "Keep practicing that shape!"), which states the
 * verdict. These aids name the MISSTEP instead, and never state the answer —
 * which here means never a digit and never its number word, because the answer
 * to every ask on this primitive is a numeral.
 *
 * Missteps deliberately left to another lane:
 *   - "started the stroke in the wrong place" — telling a start point apart from
 *     a wrong shape needs per-stroke geometry against the guide, and the adapter
 *     publishes stroke COUNTS and a score, not stroke origins. Publish that
 *     evidence before declaring the aid; until then the ghost guide and the
 *     arrows (support-tier levers) are what address it.
 *   - "drew nothing at all" — the component already blocks the check below
 *     `MIN_STROKE_POINTS` with its own message, so there is no wrong answer to aid.
 *   - "cannot form the numeral yet" — between-item remediation, not an in-item aid.
 *   - "needs the ghost guide or the arrows" — that is the support tier, a
 *     difficulty axis, not an error response.
 */
import { resolveScaffolds, type LiveScaffold } from '../../../components/live-activity/runtime/liveScaffolds';
import type { NumberTracerChallenge } from './NumberTracer';

/** What the child has actually drawn on this item, as the adapter publishes it. */
export interface TracerMisstepEvidence {
  /** Whether the last committed attempt was judged wrong. Every aid gates on it. */
  wrongNow: boolean;
  /** How many separate strokes the child drew. */
  strokeCount: number;
  /** How many strokes the guide itself is made of. */
  guideStrokeCount: number;
  /** Total points across every stroke — the proxy for how much was actually drawn. */
  inkPoints: number;
  /** Total points in the guide itself, so "not enough" is measured against THIS numeral. */
  guidePoints: number;
  /** The score the check returned, or null before any check. */
  score: number | null;
}

export type TracerScaffold = LiveScaffold<NumberTracerChallenge, TracerMisstepEvidence>;

/**
 * Did the drawing stop well short of the whole numeral?
 *
 * Measured against THIS numeral's own guide rather than a fixed point count: a
 * one is a dozen points and a zero is twice that, so an absolute threshold would
 * call every completed one "stopped early" and never catch a half-drawn zero.
 */
const stoppedEarly = (e: TracerMisstepEvidence) =>
  e.guidePoints > 0 && e.inkPoints < e.guidePoints * 0.6;

/**
 * One method reminder per challenge type. Deliberately free of digits and number
 * words: the answer to every ask on this primitive is a numeral, so "make it look
 * like a one" would be the answer on a `digit: 1` item.
 */
const METHOD: Record<NumberTracerChallenge['type'], TracerScaffold> = {
  trace: { strategyId: 'follow-the-grey-shape', when: 'the child needs the method again',
    hint: () => 'Start on the dot and follow the grey shape all the way to the end.' },
  copy: { strategyId: 'look-then-make-yours-match', when: 'the child needs the method again',
    hint: () => 'Look at the number at the top. Then make yours look the same as that.' },
  write: { strategyId: 'picture-it-then-draw-it', when: 'the child needs the method again',
    hint: () => 'Picture the shape in your head first, then draw it in the box.' },
  sequence: { strategyId: 'find-the-empty-box', when: 'the child needs the method again',
    hint: () => 'Look along the row and find the empty box. Work out what belongs in it.' },
};

/**
 * The error-specific aids, offered only once the published evidence fits. Each
 * `when` states the CONDITION, because the model routes on that sentence.
 */
const AIDS: readonly TracerScaffold[] = [
  { strategyId: 'keep-going-to-the-end', when: 'the child stopped drawing partway through',
    hint: () => 'Your line stopped early. Keep going until the whole shape is drawn.',
    matches: (_c, e) => e.wrongNow && e.inkPoints > 0 && stoppedEarly(e) },

  { strategyId: 'lift-your-finger-less', when: 'the child drew it in far more pieces than the shape needs',
    hint: () => 'That was drawn in lots of pieces. Try to keep your finger down and follow the shape round.',
    matches: (_c, e) => e.wrongNow && e.guideStrokeCount > 0 && e.strokeCount > e.guideStrokeCount * 2 },

  { strategyId: 'check-it-against-the-model', when: 'the child drew a full shape but it is not the one on the screen',
    // Not "the one on the screen": `statesNumber` reads the word "one" as the
    // number, and this aid really can fire on a `digit: 1` item.
    hint: () => 'You drew a whole shape. Look at the number on the screen again and check yours against it.',
    matches: (c, e) => e.wrongNow && !stoppedEarly(e) && c.showModel
      && (c.type === 'copy' || c.type === 'sequence') },
];

/** The type's method reminder plus every aid whose evidence currently fits. */
export function tracerScaffoldsFor(challenge: NumberTracerChallenge | null | undefined,
  evidence: TracerMisstepEvidence): TracerScaffold[] {
  return resolveScaffolds(challenge, evidence, challenge ? METHOD[challenge.type] : undefined, AIDS);
}
