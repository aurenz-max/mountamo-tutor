/**
 * Skip counting runner on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C12). Pure: the component, the journey row and any probe read the
 * same assignment, check and scene. Every challenge is answered on the screen and checked by the activity:
 *   - count_along: the learner taps the tick where the character lands next, one jump at a time, then Check;
 *     a tap past the next landing is a checked miss.
 *   - predict / find_skip_value / connect_multiplication: the learner types a number and presses Check.
 *   - fill_missing: the learner types one missing number at a time; each that fits fills its "?", and the item
 *     is checked correct when the last "?" is filled. A number that does not fit is a checked miss.
 * No key reaches the tutor: not the next landing, the gaps, the jump size on find_skip_value, or the number of
 * jumps on connect_multiplication.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { SkipCountingChallenge, SkipCountingRunnerData } from './SkipCountingRunner';

/** The number line every challenge of a lesson shares. */
export type SkipLine = Pick<SkipCountingRunnerData, 'skipValue' | 'startFrom' | 'endAt' | 'direction'>;

export function workspaceAssignment(c: SkipCountingChallenge): TeachingAssignment {
  return { id: c.id, task: c.instruction, response: 'gesture' };
}

const stepOf = (line: SkipLine) => (line.direction === 'backward' ? -line.skipValue : line.skipValue);

/** Every landing on the line, from the start. */
export function linePositions(line: SkipLine): number[] {
  const out: number[] = [];
  if (!(line.skipValue > 0)) return out;
  if (line.direction === 'backward') for (let n = line.startFrom; n >= line.endAt; n -= line.skipValue) out.push(n);
  else for (let n = line.startFrom; n <= line.endAt; n += line.skipValue) out.push(n);
  return out;
}

/** The landing after `position`, or null at the end of the line. */
export function nextLanding(line: SkipLine, position: number): number | null {
  const next = position + stepOf(line);
  return line.direction === 'backward' ? (next >= line.endAt ? next : null) : (next <= line.endAt ? next : null);
}

/** The landings a challenge opens with: the start up to its startPosition (the start alone without one). */
export function openingSpots(line: SkipLine, c: SkipCountingChallenge | null | undefined): number[] {
  const all = linePositions(line);
  const to = c?.startPosition;
  if (to === undefined || to === null || !all.includes(to)) return [line.startFrom];
  return all.slice(0, all.indexOf(to) + 1);
}

/** Jumps from the start of the line to a landing. */
export const jumpsTo = (line: SkipLine, position: number) => Math.round(Math.abs(position - line.startFrom) / line.skipValue);

/** fill_missing: the gaps ("?") a challenge asks for, never the start. */
export const gapsOf = (c: SkipCountingChallenge, line: SkipLine) => {
  const all = linePositions(line);
  return Array.from(new Set((c.hiddenPositions ?? []).filter(p => all.includes(p) && p !== line.startFrom))).sort((a, b) => a - b);
};

/** connect_multiplication: the number typed as the jumps ("7", or a whole fact "7 x 4 = 28", read by its first factor). */
export function parseJumps(text: string): number | null {
  const m = text.replace(/\s/g, '').match(/^(\d+)(?:[x×*]\d+(?:=\d+)?)?$/i);
  return m ? parseInt(m[1], 10) : null;
}

/** The learner's work on the current challenge, as the check and the tutor read it. */
export interface SkipView {
  /** Where the character stands: the last landing. */
  position: number;
  /** Every landing so far, from the start of the line. */
  landings: readonly number[];
  /** fill_missing: the gaps already filled. */
  filled: readonly number[];
  /** The number tapped (count_along) or typed and checked; null for count_along's final Check. */
  answer: number | null;
}

/** fill_missing: a typed number that fills a gap still open. */
export const fillFits = (c: SkipCountingChallenge, line: SkipLine, view: SkipView) =>
  view.answer !== null && gapsOf(c, line).includes(view.answer) && !view.filled.includes(view.answer);

/** The activity's own check of one checked move. fill_missing is correct only on the fill that closes the last gap. */
export function skipMatches(c: SkipCountingChallenge, line: SkipLine, view: SkipView): boolean {
  switch (c.type) {
    case 'count_along':
      return view.answer === null ? nextLanding(line, view.position) === null : view.answer === nextLanding(line, view.position);
    case 'predict': return view.answer !== null && view.answer === nextLanding(line, view.position);
    case 'fill_missing': return fillFits(c, line, view) && view.filled.length + 1 === gapsOf(c, line).length;
    case 'find_skip_value': return view.answer === line.skipValue;
    case 'connect_multiplication': return view.answer !== null && view.answer === jumpsTo(line, view.position);
    default: return false;
  }
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads; drawn from the
 * catalog's commonStruggles (losing the rhythm, prediction errors, not seeing the multiplication):
 * - count_along: `skipped_a_landing` (tapped two jumps ahead), `jumped_far` (three or more);
 * - predict: `stayed_put` (the number it is on), `added_one` (counted on by one), `two_jumps`, `wrong_way` (the
 *   landing before), `near_miss` (within 2 of the landing: an adding slip), `off_count`;
 * - fill_missing: `not_a_gap` (a number of the count that is not hidden), `already_filled`, `near_miss`, `off_count`;
 * - find_skip_value: `twice_the_step`, `half_the_step`, `typed_a_landing` (a number on the line), `one_short`,
 *   `one_over`, `short_by_more`, `over_by_more`;
 * - connect_multiplication: `typed_product` (the number reached), `typed_skip` (the jump size), `counted_start`
 *   (one more: the start counted as a jump), `one_short`, `short_by_more`, `over_by_more`.
 */
export type SkipCountingMiss = 'skipped_a_landing' | 'jumped_far'
  | 'stayed_put' | 'added_one' | 'two_jumps' | 'wrong_way' | 'near_miss' | 'off_count'
  | 'not_a_gap' | 'already_filled'
  | 'twice_the_step' | 'half_the_step' | 'typed_a_landing' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more'
  | 'typed_product' | 'typed_skip' | 'counted_start';

/** Every miss a mode's check can name (the catalog's `teachingWorkspace.misses`). */
export const SKIP_MISSES_BY_MODE: Record<SkipCountingChallenge['type'], SkipCountingMiss[]> = {
  count_along: ['skipped_a_landing', 'jumped_far'],
  predict: ['stayed_put', 'added_one', 'two_jumps', 'wrong_way', 'near_miss', 'off_count'],
  fill_missing: ['not_a_gap', 'already_filled', 'near_miss', 'off_count'],
  find_skip_value: ['twice_the_step', 'half_the_step', 'typed_a_landing', 'one_short', 'one_over', 'short_by_more', 'over_by_more'],
  connect_multiplication: ['typed_product', 'typed_skip', 'counted_start', 'one_short', 'short_by_more', 'over_by_more'],
};

export function skipMiss(c: SkipCountingChallenge | null, line: SkipLine, view: SkipView): SkipCountingMiss | undefined {
  if (!c || view.answer === null || skipMatches(c, line, view)) return undefined;
  const got = view.answer, step = stepOf(line);
  switch (c.type) {
    case 'count_along': {
      const ahead = Math.round((got - view.position) / step);
      return ahead === 2 ? 'skipped_a_landing' : ahead > 2 ? 'jumped_far' : undefined;
    }
    case 'predict': {
      const next = nextLanding(line, view.position);
      if (next === null) return undefined;
      if (got === view.position) return 'stayed_put';
      if (got === view.position + Math.sign(step)) return 'added_one';
      if (got === view.position + 2 * step) return 'two_jumps';
      if (got === view.position - step) return 'wrong_way';
      return Math.abs(got - next) <= 2 ? 'near_miss' : 'off_count';
    }
    case 'fill_missing': {
      if (fillFits(c, line, view)) return undefined; // a fitting fill is never a miss
      const gaps = gapsOf(c, line);
      if (view.filled.includes(got)) return 'already_filled';
      if (linePositions(line).includes(got)) return 'not_a_gap';
      return gaps.some(g => !view.filled.includes(g) && Math.abs(g - got) <= 2) ? 'near_miss' : 'off_count';
    }
    case 'find_skip_value': {
      const want = line.skipValue;
      if (got === want * 2) return 'twice_the_step';
      if (got * 2 === want) return 'half_the_step';
      if (linePositions(line).includes(got)) return 'typed_a_landing';
      return got === want - 1 ? 'one_short' : got === want + 1 ? 'one_over' : got < want ? 'short_by_more' : 'over_by_more';
    }
    case 'connect_multiplication': {
      const want = jumpsTo(line, view.position);
      if (got === Math.abs(view.position - line.startFrom) || got === view.position) return 'typed_product';
      if (got === line.skipValue) return 'typed_skip';
      if (got === want + 1) return 'counted_start';
      if (got === want - 1) return 'one_short';
      return got < want ? 'short_by_more' : 'over_by_more';
    }
    default: return undefined;
  }
}

/** The learner's checked work in their terms, never the key. */
export function describeSkipWork(c: SkipCountingChallenge, line: SkipLine, view: SkipView): string {
  const hops = view.landings.length - 1;
  switch (c.type) {
    case 'count_along':
      if (view.answer !== null) return `Tapped ${view.answer} right after landing on ${view.position}`;
      return hops > 0 ? `Made ${hops} jump${hops === 1 ? '' : 's'}, landing on ${view.landings.slice(1).join(', ')}` : 'No jumps yet';
    case 'predict': return view.answer === null ? 'Nothing typed yet' : `Typed ${view.answer} for the landing after ${view.position}`;
    case 'fill_missing': {
      const done = view.filled.length ? `Filled ${view.filled.join(', ')}` : 'No gap filled yet';
      return view.answer === null ? done : `${done}; typed ${view.answer}`;
    }
    case 'find_skip_value': return view.answer === null ? 'Nothing typed yet' : `Typed ${view.answer} for how far each jump goes`;
    case 'connect_multiplication': return view.answer === null ? 'Nothing typed yet' : `Typed ${view.answer} for the number of jumps`;
    default: return 'No work yet';
  }
}

/** What is on screen beside the line, as the component draws it (support tier and mode). */
export interface SkipAids {
  /** Numbers under the ticks. */
  labels: boolean;
  arcs: boolean;
  /** The written row of landings. */
  sequence: boolean;
  /** "Count by N" and "+N" on the Jump button (never on find_skip_value, where N is the answer). */
  jumpSize: boolean;
  /** The n x N = landing line (never on find_skip_value or connect_multiplication before credit). */
  equation: boolean;
  array: boolean;
}

/** The skip value is the answer on find_skip_value, the number of jumps on connect_multiplication: their aids hide it. */
export function aidsFor(c: SkipCountingChallenge | null, options: NonNullable<SkipCountingRunnerData['showOptions']>): SkipAids {
  const find = c?.type === 'find_skip_value', connect = c?.type === 'connect_multiplication';
  return {
    labels: options.showTrackLabels !== false,
    arcs: options.showJumpArcs !== false,
    sequence: options.showSequenceChips !== false,
    jumpSize: options.showSkipValueBadge !== false && !find,
    equation: !!options.showEquation && !find && !connect,
    array: !!options.showArray,
  };
}

const CHARACTER = (type: string | undefined) => (!type || type === 'custom' ? 'the character' : `the ${type}`);

function constraintsFor(c: SkipCountingChallenge, who: string, product: number): string {
  switch (c.type) {
    case 'count_along':
      return `The learner taps the number where ${who} lands next, one jump at a time, and presses Check at the end; `
        + 'the activity checks each tap. A tap past the next landing is a miss. You cannot jump for the learner.';
    case 'predict':
      return 'The learner types the next landing in the box and presses Check; the activity checks it. '
        + 'The next landing is the answer: never say it.';
    case 'fill_missing':
      return 'The learner types one missing number at a time and presses Check; each one that fits fills its "?", and the '
        + 'item is done when every "?" is filled. The missing numbers are the answer: never say them.';
    case 'find_skip_value':
      return 'The learner types how far each jump goes and presses Check; the activity checks it. The jump size is the '
        + 'answer: never say it, a count-by phrase, or the difference between two landings.';
    case 'connect_multiplication':
      return `The learner types how many jumps ${who} made to reach ${product}, completing "? x jump size = ${product}", `
        + 'and presses Check. The number of jumps is the answer: never say it or count the jumps aloud to the end.';
    default: return 'The learner answers on the screen; the activity checks it.';
  }
}

/** How far the tutor may go at this support tier, so it never says what the tier withheld on screen. */
function coaching(c: SkipCountingChallenge, tier: SkipCountingRunnerData['supportTier']): string | undefined {
  if (!tier) return undefined;
  if (c.type === 'find_skip_value') return tier === 'hard' ? 'Ask what changes from one landing to the next; nothing more.'
    : 'You may ask what is added from one landing to the next; never the amount.';
  return tier === 'easy' ? 'You may name the count-by strategy and walk the counting with the learner.'
    : tier === 'medium' ? 'Nudge the counting; do not solve the step for the learner.'
      : 'Do not name the count-by strategy; ask what the learner notices from one landing to the next.';
}

export interface SkipSceneContext {
  line: SkipLine;
  character?: string;
  supportTier?: SkipCountingRunnerData['supportTier'];
  aids: SkipAids;
}

/** What is drawn and asked. Never the next landing, a gap, the jump size on find, or the jumps on connect. */
export function workspaceScene(c: SkipCountingChallenge, ctx: SkipSceneContext, view: SkipView): WorkspaceScene {
  const { line, aids } = ctx, who = CHARACTER(ctx.character);
  const lo = Math.min(line.startFrom, line.endAt, 0), hi = Math.max(line.startFrom, line.endAt);
  const tip = coaching(c, ctx.supportTier);
  const facts: Record<string, string | number> = {
    kind: c.type,
    line: `A number line from ${lo} to ${hi}; ${who} starts at ${line.startFrom} and jumps ${line.direction === 'backward' ? 'down' : 'up'} it in equal jumps`,
    at: view.position,
    landed: view.landings.join(', '),
    labels: !aids.labels ? 'no numbers under the ticks; landings are marked'
      : c.type === 'predict' ? 'numbers under the landings so far; none ahead of the character'
        : 'numbers are written under the ticks of the count',
    jumpSize: aids.jumpSize ? `shown on screen ("Count by ${line.skipValue}s")` : 'not shown on screen',
  };
  if (c.type === 'fill_missing') {
    const gaps = gapsOf(c, line);
    facts.gaps = `${gaps.length} number${gaps.length === 1 ? '' : 's'} of the count hidden as "?"; ${view.filled.length} filled so far`;
    if (view.filled.length) facts.filled = view.filled.join(', ');
  }
  const shown = [aids.arcs && 'jump arcs', aids.sequence && 'the written row of landings', aids.equation && 'the multiplication line',
    aids.array && 'an array with one row per jump'].filter(Boolean);
  facts.aids = shown.length ? shown.join(', ') : 'none';
  if (ctx.supportTier) facts.supportTier = ctx.supportTier;
  if (tip) facts.coaching = tip;
  facts.learnerWork = describeSkipWork(c, line, view);
  facts.constraints = constraintsFor(c, who, Math.abs(view.position - line.startFrom));
  return { objects: [], facts };
}

export type SkipHarnessInput = { type: 'touch'; target: string } | { type: 'write'; label: string; text: string } | { type: 'check' };

/** The aria-label of each typed mode's box. */
export const INPUT_LABEL: Record<Exclude<SkipCountingChallenge['type'], 'count_along'>, string> = {
  predict: 'Next landing', fill_missing: 'Missing number', find_skip_value: 'Skip value', connect_multiplication: 'Number of jumps',
};

/**
 * The journey's inputs for one challenge through the real controls, from the current work (`at`, `filled`: the
 * scene facts, which Try again keeps): count_along taps each next tick then Check, the typed modes write and Check.
 * `wrong` is the mode's signature error: a tap two jumps ahead, one more than the next landing (find: the step + 1,
 * connect: one more jump), a number next to a gap.
 */
export function skipHarnessInputs(c: SkipCountingChallenge, line: SkipLine, wrong: boolean,
  work: { at?: number; filled?: readonly number[] } = {}): SkipHarnessInput[] {
  const check: SkipHarnessInput = { type: 'check' };
  const spots = openingSpots(line, c);
  const at = Number.isFinite(work.at) ? work.at! : spots[spots.length - 1];
  const write = (text: number) => ({ type: 'write' as const, label: INPUT_LABEL[c.type as keyof typeof INPUT_LABEL], text: String(text) });
  switch (c.type) {
    case 'count_along': {
      const taps: SkipHarnessInput[] = [];
      if (wrong) {
        const one = nextLanding(line, at), two = one === null ? null : nextLanding(line, one);
        if (two === null) throw new Error('skip-counting-runner count_along: one jump left, no tap is wrong');
        return [{ type: 'touch', target: `tick-${two}` }];
      }
      for (let p = nextLanding(line, at); p !== null; p = nextLanding(line, p)) taps.push({ type: 'touch', target: `tick-${p}` });
      return [...taps, check];
    }
    case 'predict': {
      const next = nextLanding(line, at);
      if (next === null) throw new Error('skip-counting-runner predict: no landing after the start position');
      return [write(wrong ? at + Math.sign(stepOf(line)) * (line.skipValue === 1 ? 2 : 1) : next), check];
    }
    case 'fill_missing': {
      const open = gapsOf(c, line).filter(g => !(work.filled ?? []).includes(g));
      if (!open.length) throw new Error('skip-counting-runner fill_missing: no gap to fill');
      if (wrong) return [write(open[0] + 1), check];
      return open.flatMap(g => [write(g), check]);
    }
    case 'find_skip_value': return [write(wrong ? line.skipValue + 1 : line.skipValue), check];
    case 'connect_multiplication': {
      const jumps = jumpsTo(line, at);
      return [write(wrong ? jumps + 1 : jumps), check];
    }
    default: throw new Error(`skip-counting-runner: no driver input for ${(c as SkipCountingChallenge).type}`);
  }
}
