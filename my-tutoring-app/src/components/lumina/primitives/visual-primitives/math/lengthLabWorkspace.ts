/**
 * Length lab on the shared tutor/JEV teaching workspace: the ask, the spoken key, the activity's check and the scene,
 * which the boss (`lengthLab.boss.ts`), the component, the levers and the tests read.
 *
 * compare and indirect ask for one choice, which may also be said aloud: the boss hands the tutor its key
 * (`lengthKey`, a menu the ask says in full) and the activity checks a tap. Laying units with + and Check, guessing
 * then measuring, measuring with two units and putting objects in order have no key and are checked on screen; the
 * tutor is never handed `correctUnitCount`, `correctOrderCsv` or the objects' lengths.
 *
 * Pure: no React.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { LengthLabChallenge, LengthLabData } from './LengthLab';
import { LENGTH_MISSES, type LengthMiss } from './lengthLab.card';

export { LENGTH_MISSES, type LengthMiss };

const isSpoken = (c: LengthLabChallenge) => c.type === 'compare' || c.type === 'indirect';

/** The lesson's items, in order. */
export const lengthItems = (d: Pick<LengthLabData, 'challenges'>): LengthLabChallenge[] => d.challenges ?? [];

// ── The ask and the key ──────────────────────────────────────────────────────

/**
 * What the learner is asked. compare and indirect are asked in the words of their buttons ("pencil is longer",
 * "pencil is shorter", "They are the same length"; "ribbon is longer", "Same length"), so every choice is said in the
 * ask. The boards are asked their own instruction.
 */
export function lengthAsk(c: LengthLabChallenge): string {
  const a = c.objectName0, b = c.objectName1;
  if (c.type === 'compare') return `Is the ${a} longer or shorter than the ${b}, or are they the same length?`;
  if (c.type === 'indirect') return `Which is longer, the ${a} or the ${b}? Or are they the same length?`;
  return c.instruction;
}

/** The key a spoken answer is judged against; null on a board (checked on screen). */
export function lengthKey(c: LengthLabChallenge): SpokenKey | null {
  const a = c.objectName0, b = c.objectName1;
  if (!isSpoken(c) || !a || !b) return null;
  const same = { answer: 'the same', alsoAccept: ['same', 'same length', 'they are the same', 'neither'] };
  if (c.type === 'indirect') {
    const menu = [`the ${a}`, `the ${b}`, 'the same'];
    if (c.correctAnswer === 'same') return { ...same, menu,
      signatureError: `Naming the ${a} or the ${b} as longer is wrong: the clues make them the same length.` };
    const key = c.correctAnswer, other = key === a ? b : a;
    return { answer: `the ${key}`, alsoAccept: [key, `the ${key} is longer`, `the ${other} is shorter`], menu,
      signatureError: `The ${other}${c.referenceObjectName ? ` and the ${c.referenceObjectName}` : ''} are wrong, and so is "the same".` };
  }
  const menu = ['longer', 'shorter', 'the same'];
  if (c.correctAnswer === 'same') return { ...same, menu,
    signatureError: '"Longer" and "shorter" are wrong: the two are the same length.' };
  const longer = c.correctAnswer === 'longer';
  const [long, short] = longer ? [a, b] : [b, a];
  return { answer: c.correctAnswer, alsoAccept: [`the ${a} is ${c.correctAnswer}`, `the ${b} is ${longer ? 'shorter' : 'longer'}`],
    menu, acceptRule: `Naming the ${long} as the longer one, or the ${short} as the shorter one, counts.`,
    signatureError: `"${longer ? 'shorter' : 'longer'}" is wrong, and so is "the same".` };
}

/** A spoken choice's known wrong answers, with the tap's ids (`lengthMiss`, the card's lists), most specific first. */
export function lengthSpokenMisses(c: LengthLabChallenge): KnownMiss[] {
  const a = c.objectName0, b = c.objectName1;
  if (!isSpoken(c) || !a || !b) return [];
  if (c.correctAnswer === 'same') return [{ id: c.type === 'compare' ? 'missed_same' : 'chose_shorter',
    pattern: `The ${a} and the ${b} are the same length, but the learner names one of them as longer or shorter.`,
    examples: c.type === 'compare' ? ['longer', `the ${b} is longer`] : [`the ${a}`, `the ${b} is longer`] }];
  const same = { id: 'said_same', pattern: 'The learner says the two are the same length, though one is longer.',
    examples: ['the same', 'same length'] };
  if (c.type === 'indirect') {
    const key = c.correctAnswer, other = key === a ? b : a;
    return [{ id: 'chose_shorter', pattern: `The answer is the ${key}. The learner names the ${other}, the shorter one, as longer.`,
      examples: [`the ${other}`, `the ${other} is longer`] }, same];
  }
  const [long, short] = c.correctAnswer === 'longer' ? [a, b] : [b, a];
  const opposite = c.correctAnswer === 'longer' ? 'shorter' : 'longer';
  return [{ id: 'reversed', pattern: `The ${long} is longer. The learner swaps longer and shorter: says the ${a} is ${opposite}, `
    + `names the ${short} as longer, or the ${long} as shorter.`,
  examples: [opposite, `the ${short} is longer`] }, same];
}

/** The journey's spoken answers: the key's own words, or a plainly different choice from the same menu. */
export function lengthHarnessWords(c: LengthLabChallenge): { correct: string; plainWrong: string } {
  const key = lengthKey(c)!;
  if (c.type === 'indirect') {
    const other = c.correctAnswer === c.objectName0 ? c.objectName1 : c.objectName0;
    return { correct: key.answer, plainWrong: c.correctAnswer === 'same' ? `the ${c.objectName0}` : `the ${other}` };
  }
  return { correct: key.answer, plainWrong: c.correctAnswer === 'longer' ? 'shorter' : 'longer' };
}

// ── The activity's check ─────────────────────────────────────────────────────

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

// ── The scene ────────────────────────────────────────────────────────────────

/** This item's never-say rules and what teaching it is, from the old catalog guidance, by mode and what is on screen. */
function constraintsOf(c: LengthLabChallenge, view: LengthView): string {
  const marks = view.ticksShown ? '' : ' The unit marks are hidden: do not count cells.';
  switch (c.type) {
    case 'compare':
      return 'Before the learner answers, and after a wrong answer, never say which object is longer or shorter or whether '
        + `they are the same length. Teach comparing: line up the starting ends and look at the far ends.${marks}`;
    case 'indirect':
      return 'Before the learner answers, and after a wrong answer, never say which object is longer. Read the clues aloud '
        + 'and teach reading them as a chain through the reference object.';
    case 'order':
      return 'Before the learner checks, and after a wrong order, never say where an object goes or which is shortest or '
        + `longest. Teach comparing two objects at a time.${marks}`;
    case 'two_unit_compare':
      return 'Never say how many units reach the end or which unit was needed more. Teach laying units end to end, with no '
        + 'gaps or overlaps, from one end of the object to the other.';
    default:
      return 'Never say how many units reach the end, or whether to add or take away units: ask the learner to look where '
        + 'their units end against the object. Teach laying units end to end, with no gaps or overlaps, from one end to '
        + 'the other, counting each once.'
        + (c.type === 'estimate_then_tile' ? ' The guess is never marked: do not say whether it is close.' : '')
        + (view.fitShown ? '' : ' The fit line is hidden: do not say whether the units fit.');
  }
}

/** What is drawn and asked. The objects and units on screen are named; no length, count or order is. */
export function lengthScene(c: LengthLabChallenge, view: LengthView): SceneOf {
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
    }
    drawn.fitCheck = view.fitShown ? 'shown: a line says not enough, too many, or a fit' : 'hidden';
  } else if (c.type === 'two_unit_compare') {
    drawn.object = `${c.objectName0}, drawn as one bar`;
    drawn.units = `first ${unitName(view.unitA)}, then ${unitName(view.unitB)} (drawn wider)`;
  } else if (c.type === 'order') {
    drawn.objects = [c.objectName0, c.objectName1, c.objectName2].filter(Boolean).join(', ') + ', drawn as bars';
    drawn.unitMarks = ticks;
  } else if (c.type === 'indirect') {
    drawn.clues = [c.clue0, c.clue1].filter(Boolean).join(' ');
    if (c.referenceObjectName) drawn.reference = `${c.referenceObjectName}, drawn as a bar`;
    drawn.objectsNotDrawn = `${c.objectName0} and ${c.objectName1} are not drawn side by side`;
    drawn.choices = `${c.objectName0} is longer | ${c.objectName1} is longer | Same length`;
  }
  return {
    objects: [],
    facts: { kind: c.type, ...drawn, learnerWork: describeLengthWork(c, view), constraints: constraintsOf(c, view) },
  };
}
