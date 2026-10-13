/**
 * Length lab on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C10).
 *
 * Pure: the component and any probe read the same assignment and scene. A tap, tiles laid with + and Check, or
 * three objects placed in order are checked by the activity's own check. compare and indirect ask for one choice,
 * which may also be said aloud: the item is spoken with `acceptsGesture`, and JEV judges it from the tutor's
 * feedback against `expectedAnswer` (VB-1, 2026-10-13). tile_and_count and estimate_then_tile are checked on the
 * tiles laid, order on the slots, and two_unit_compare asks its question only after both measurements, so those
 * stay tap-only; the tutor is never handed `correctUnitCount`, `correctOrderCsv` or the objects' lengths.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { LengthLabChallenge } from './LengthLab';

const isSpoken = (c: LengthLabChallenge) => c.type === 'compare' || c.type === 'indirect';

export function workspaceAssignment(challenge: LengthLabChallenge): TeachingAssignment {
  const expectedAnswer = lengthExpectedAnswer(challenge);
  if (!expectedAnswer) return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
  return { id: challenge.id, task: `${challenge.instruction} The learner answers by saying it, or tapping one choice.`,
    response: 'speech', acceptsGesture: true, expectedAnswer, misses: lengthSpokenMisses(challenge) };
}

/** The one answer a spoken compare or indirect choice is judged against, with the natural ways of saying it. */
export function lengthExpectedAnswer(c: LengthLabChallenge): string | undefined {
  const a = c.objectName0, b = c.objectName1;
  if (!isSpoken(c) || !a || !b) return undefined;
  if (c.correctAnswer === 'same') return `the same length (neither the ${a} nor the ${b} is longer); said as "the same", `
    + `"same length", "they are the same" or "neither". Naming either object as longer or shorter is not it.`;
  if (c.type === 'indirect') {
    const key = c.correctAnswer, other = key === a ? b : key === b ? a : '';
    if (!other) return undefined;
    return `the ${key} (the clues make the ${key} longer than the ${other}); said as "${key}", "the ${key}" or "the ${key} `
      + `is longer". Naming the ${other}${c.referenceObjectName ? ` or the ${c.referenceObjectName}` : ''}, or saying they `
      + 'are the same, is not it.';
  }
  if (c.correctAnswer !== 'longer' && c.correctAnswer !== 'shorter') return undefined;
  const [long, short] = c.correctAnswer === 'longer' ? [a, b] : [b, a];
  const opposite = c.correctAnswer === 'longer' ? 'shorter' : 'longer';
  return `the ${long} is longer and the ${short} is shorter. Credit naming the object the question asks for: the ${long} `
    + `when it asks which is longer, the ${short} when it asks which is shorter, alone ("the ${long}") or in a sentence `
    + `("the ${long} is longer"); or saying the choice as the screen words it, "${a} is ${c.correctAnswer}". Naming the `
    + `other object, calling the ${a} ${opposite}, or saying they are the same length is not it.`;
}

/** A spoken choice's known wrong answers, with the tap's ids (`lengthMiss`, the catalog's lists), most specific first. */
export function lengthSpokenMisses(c: LengthLabChallenge): KnownMiss[] {
  const a = c.objectName0, b = c.objectName1;
  if (!isSpoken(c) || !a || !b) return [];
  if (c.correctAnswer === 'same') return [{ id: c.type === 'compare' ? 'missed_same' : 'chose_shorter',
    pattern: `The ${a} and the ${b} are the same length, but the learner names one of them as longer or shorter.`,
    examples: [`the ${a}`, `the ${b} is longer`] }];
  const same = { id: 'said_same', pattern: 'The learner says the two are the same length, though one is longer.',
    examples: ['the same', 'same length'] };
  if (c.type === 'indirect') {
    const key = c.correctAnswer, other = key === a ? b : a;
    return [{ id: 'chose_shorter', pattern: `The answer is the ${key}. The learner names the ${other}, the shorter one, as longer.`,
      examples: [`the ${other}`, `the ${other} is longer`] }, same];
  }
  const [long, short] = c.correctAnswer === 'longer' ? [a, b] : [b, a];
  return [{ id: 'reversed', pattern: `The ${long} is longer. The learner swaps longer and shorter: names the ${short} as `
    + `longer, or the ${long} as shorter, or names the ${short} when asked which is longer.`,
  examples: [`the ${short} is longer`, `the ${long} is shorter`] }, same];
}

/** What a spoken mode's answer is, which the scene withholds until the learner answers. */
const WITHHELD = 'which object is longer or shorter, or whether they are the same length';

export interface LengthView {
  /** compare: 'longer' | 'shorter' | 'same'; indirect: an object name or 'same'; two_unit_compare: a unit. */
  answer: string | null;
  /** Tiles in the row now (tile_and_count, estimate_then_tile), or the count the learner checked. */
  tiles: number;
  /** estimate_then_tile: the guess made before measuring (never graded). */
  estimate: number | null;
  /** two_unit_compare: how many of each unit the learner laid down, once each row is checked. */
  countA: number | null;
  countB: number | null;
  /** The unit being laid (unitA) and two_unit_compare's second unit, resolved against the lab's default unit. */
  unitA: string;
  unitB: string;
  /** order: the names in the slots, shortest end first (fewer than three while placing). */
  order: readonly string[];
  /** Support tier aids on screen. */
  ticksShown: boolean;
  fitShown: boolean;
}

const unitName = (u: string) => u.replace('_', ' ');
const expectedCount = (c: LengthLabChallenge) => c.correctUnitCount || c.objectLength0;
/** two_unit_compare: the unit needed more of is the one with the larger count, re-derived from both counts. */
export const moreUnit = (c: LengthLabChallenge, view: Pick<LengthView, 'unitA' | 'unitB'>) =>
  (c.correctUnitCount ?? 0) > (c.correctUnitCountB ?? 0) ? view.unitA : view.unitB;
const expectedOrder = (c: LengthLabChallenge) => (c.correctOrderCsv ?? '').split(',').map(s => s.trim());

/** The activity's own check. */
export function lengthLabMatches(c: LengthLabChallenge, view: LengthView): boolean {
  switch (c.type) {
    case 'compare': case 'indirect': return view.answer === c.correctAnswer;
    case 'tile_and_count': case 'estimate_then_tile': return view.tiles === expectedCount(c);
    case 'two_unit_compare': return view.answer === moreUnit(c, view);
    case 'order': {
      const want = expectedOrder(c);
      return view.order.length === want.length && want.every((name, i) => name === view.order[i]);
    }
    default: return false;
  }
}

/** The learner's work in their own terms, never the key. */
export function describeLengthWork(c: LengthLabChallenge, view: LengthView): string {
  switch (c.type) {
    case 'compare':
      return view.answer === 'same' ? 'Chose: they are the same length'
        : view.answer ? `Chose: the ${c.objectName0} is ${view.answer}` : 'No choice yet';
    case 'indirect':
      return view.answer === 'same' ? 'Chose: same length' : view.answer ? `Chose: the ${view.answer} is longer` : 'No choice yet';
    case 'tile_and_count':
    case 'estimate_then_tile': {
      const guess = c.type === 'estimate_then_tile'
        ? (view.estimate === null ? 'No guess yet. ' : `Guessed ${view.estimate}. `) : '';
      const unit = unitName(view.unitA);
      return guess + (view.tiles ? `Laid ${view.tiles} ${unit || 'tiles'} along the ${c.objectName0}` : 'No tiles laid yet');
    }
    case 'two_unit_compare': {
      // By position (the scene names the units in order): a unit's name in a miss message would be the other choice.
      const a = view.countA === null ? 'Measuring with the first unit' : `Laid ${view.countA} of the first unit`;
      const b = view.countA === null ? '' : view.countB === null ? ', now measuring with the second unit'
        : `, then ${view.countB} of the second unit`;
      const pick = view.answer ? `. Chose: needed more of the ${view.answer === view.unitA ? 'first' : 'second'} unit` : '';
      return a + b + pick;
    }
    case 'order':
      return view.order.length ? `Placed shortest to longest: ${view.order.join(', ')}` : 'No object placed yet';
    default: return 'No work yet';
  }
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads, drawn from
 * the catalog's commonStruggles (longer/shorter confused, gaps or overlaps when tiling):
 * - compare: `reversed` (longer and shorter swapped), `said_same` (a real difference called the same),
 *   `missed_same` (equal lengths called longer or shorter);
 * - tile_and_count / estimate_then_tile: `tiled_to_guess` (stopped at the guess, not the end of the object),
 *   `one_short` / `one_over` (a gap or an overlap's worth), `short` / `over`;
 * - two_unit_compare: `chose_bigger_unit` (picked the unit that took fewer);
 * - order: `reversed_order` (longest first), `swapped_pair` (two neighbours swapped), `other_order`;
 * - indirect: `chose_shorter` (the other object), `said_same`.
 */
export type LengthMiss = 'reversed' | 'said_same' | 'missed_same'
  | 'tiled_to_guess' | 'one_short' | 'one_over' | 'short' | 'over'
  | 'chose_bigger_unit'
  | 'reversed_order' | 'swapped_pair' | 'other_order'
  | 'chose_shorter';

export function lengthMiss(c: LengthLabChallenge | null, view: LengthView): LengthMiss | undefined {
  if (!c || lengthLabMatches(c, view)) return undefined;
  switch (c.type) {
    case 'compare':
      if (!view.answer) return undefined;
      return c.correctAnswer === 'same' ? 'missed_same' : view.answer === 'same' ? 'said_same' : 'reversed';
    case 'indirect':
      if (!view.answer) return undefined;
      return view.answer === 'same' ? 'said_same' : 'chose_shorter';
    case 'tile_and_count':
    case 'estimate_then_tile': {
      const want = expectedCount(c), got = view.tiles;
      if (c.type === 'estimate_then_tile' && view.estimate !== null && got === view.estimate) return 'tiled_to_guess';
      if (got === want - 1) return 'one_short';
      if (got === want + 1) return 'one_over';
      return got < want ? 'short' : 'over';
    }
    case 'two_unit_compare': return view.answer ? 'chose_bigger_unit' : undefined;
    case 'order': {
      const want = expectedOrder(c), got = view.order;
      if (got.length !== want.length) return undefined;
      if (want.every((name, i) => name === got[got.length - 1 - i])) return 'reversed_order';
      const wrong = want.map((name, i) => name !== got[i] ? i : -1).filter(i => i >= 0);
      return wrong.length === 2 && wrong[1] - wrong[0] === 1 ? 'swapped_pair' : 'other_order';
    }
    default: return undefined;
  }
}

/** What is drawn and asked. The objects and units on screen are named; no length, count or order is. */
export function workspaceScene(c: LengthLabChallenge, view: LengthView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  const ticks = view.ticksShown ? 'shown: each bar is split into unit cells' : 'hidden';
  if (c.type === 'compare') {
    drawn.objects = `${c.objectName0} and ${c.objectName1}, drawn as two bars starting at the same line`;
    drawn.unitMarks = ticks;
    drawn.choices = `${c.objectName0} is longer | ${c.objectName0} is shorter | They are the same length`;
  } else if (c.type === 'tile_and_count' || c.type === 'estimate_then_tile') {
    drawn.object = `${c.objectName0}, drawn as one bar`;
    drawn.unit = unitName(view.unitA);
    if (c.type === 'estimate_then_tile') {
      drawn.guess = view.estimate === null ? `not made yet; choices ${(c.estimateOptions ?? []).join(', ')}` : String(view.estimate);
      drawn.guessGraded = 'never: any guess is fine; the measuring is what is checked';
    }
    drawn.howToAnswer = 'tap + to lay a unit along the object, - to take one back, then Check';
    drawn.fitCheck = view.fitShown ? 'shown: a line says not enough, too many, or a fit' : 'hidden';
  } else if (c.type === 'two_unit_compare') {
    drawn.object = `${c.objectName0}, drawn as one bar`;
    drawn.units = `first ${unitName(view.unitA)}, then ${unitName(view.unitB)} (drawn wider)`;
    drawn.howToAnswer = 'lay each unit along the object with + and Check, then tap the unit they needed more of';
  } else if (c.type === 'order') {
    drawn.objects = [c.objectName0, c.objectName1, c.objectName2].filter(Boolean).join(', ') + ', drawn as bars';
    drawn.unitMarks = ticks;
    drawn.howToAnswer = 'tap each object into the slots from shortest to longest, then Check Order';
  } else if (c.type === 'indirect') {
    drawn.clues = [c.clue0, c.clue1].filter(Boolean).join(' ');
    if (c.referenceObjectName) drawn.reference = `${c.referenceObjectName}, drawn as a bar`;
    drawn.objectsNotDrawn = `${c.objectName0} and ${c.objectName1} are not drawn side by side`;
    drawn.choices = `${c.objectName0} is longer | ${c.objectName1} is longer | Same length`;
  }
  return {
    objects: [],
    facts: {
      kind: c.type, ...drawn,
      learnerWork: describeLengthWork(c, view),
      constraints: isSpoken(c)
        ? 'The learner says the answer or taps one choice; a tap is checked by the activity. Before the learner has '
          + `answered, never name ${WITHHELD}. You cannot tap for the learner.`
        : 'The learner answers on the screen: taps a choice, lays units with + and Check, or taps objects '
          + 'into order and presses Check; the activity checks the work itself. You cannot tap, lay or place for the learner.',
    },
  };
}
