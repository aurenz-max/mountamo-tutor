/**
 * Skip counting runner on the shared tutor/JEV teaching workspace: the line, the runner's own check, the spoken key
 * and the scene, which the boss (`skipCounting.boss.ts`), the component, the levers and the tests read. Every
 * challenge is one workspace item, on its line (`skipItems` stamps the session's line on items that have none):
 *   - count_along: the learner taps the tick where the character lands next, one jump at a time, then Check; a tap
 *     past the next landing is a checked miss. No key;
 *   - predict / find_skip_value / connect_multiplication: one number, said (the tutor judges it against the key) or
 *     typed and checked (VB-1, 2026-10-13);
 *   - fill_missing: one "?" is said or typed, like the others; two or more are typed one at a time, each that fits
 *     fills its "?", and the item is checked correct when the last is filled (no key).
 * The scene never states the next landing, a gap, the jump size on find_skip_value or the jumps on connect.
 *
 * Pure: no React.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { numberMisses, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SkipCountingChallenge, SkipCountingRunnerData } from './SkipCountingRunner';
import type { SkipCountingMiss } from './skipCounting.card';

export type { SkipCountingMiss };

/** The number line every challenge of a lesson shares. */
export type SkipLine = Pick<SkipCountingRunnerData, 'skipValue' | 'startFrom' | 'endAt' | 'direction'>;

/** A challenge on the line it is drawn on, with the lesson's support tier (the levers' `support` reads it). */
export type SkipItem = SkipCountingChallenge & { line: SkipLine };

/** The line a lesson's data draws, with the component's defaults. */
export const lineOf = (d: Pick<SkipCountingRunnerData, 'skipValue' | 'endAt'> & Partial<SkipLine>): SkipLine =>
  ({ skipValue: d.skipValue, startFrom: d.startFrom ?? 0, endAt: d.endAt, direction: d.direction ?? 'forward' });

/** The lesson's items: each on its own line (find_skip_value) or the session's, with the lesson's tier (default medium). */
export const skipItems = (d: Pick<SkipCountingRunnerData, 'challenges' | 'skipValue' | 'endAt' | 'supportTier'> & Partial<SkipLine>): SkipItem[] =>
  (d.challenges ?? []).map(c => ({ ...c, line: c.line ?? lineOf(d), supportTier: c.supportTier ?? d.supportTier ?? 'medium' }));

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

/** What a wrong check shows, from the work the check reads (the ids and their meaning: the card's `SkipCountingMiss`). */
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

// ── Spoken answers (VB-1) ─────────────────────────────────────────────────────
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** 0-999 in words ("forty-five", "one hundred twenty"); digits past that. */
const words = (n: number): string => n < 0 || n > 999 ? String(n) : n < 20 ? ONES[n]
  : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')
    : `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${words(n % 100)}` : ''}`;

/** The opening landing the item is asked from (the start, or its startPosition). */
const atOf = (c: SkipCountingChallenge, line: SkipLine) => { const s = openingSpots(line, c); return s[s.length - 1]; };

/** The one number a spoken item is judged against; null when the item stays on screen (count_along, 2+ gaps). */
export function spokenSkipKey(c: SkipCountingChallenge, line: SkipLine): number | null {
  const at = atOf(c, line);
  switch (c.type) {
    case 'predict': return nextLanding(line, at);
    case 'find_skip_value': return line.skipValue > 0 ? line.skipValue : null;
    case 'connect_multiplication': { const j = jumpsTo(line, at); return j >= 1 ? j : null; }
    case 'fill_missing': { const gaps = gapsOf(c, line); return gaps.length === 1 ? gaps[0] : null; }
    default: return null;
  }
}

const forms = (n: number, ...more: string[]) => Array.from(new Set([words(n), ...more])).filter(f => f !== String(n));

/** The key a spoken item is judged against; null on an item answered on screen (count_along, two or more gaps). */
export function skipKey(c: SkipItem): SpokenKey | null {
  const { line } = c, key = spokenSkipKey(c, line);
  if (key === null) return null;
  const at = atOf(c, line), S = line.skipValue;
  switch (c.type) {
    case 'predict':
      return { answer: String(key), alsoAccept: forms(key),
        acceptRule: `${key} said alone, or in a sentence about where it lands next, counts.`,
        signatureError: `${at}, where the character stands now, the landing before it, or any other number is not it.` };
    case 'find_skip_value':
      return { answer: String(S), alsoAccept: forms(S, `by ${S}s`, `${words(S)} each time`, `plus ${S}`),
        acceptRule: `${S} said alone, or in a sentence about how far each jump goes, counts.`,
        signatureError: 'Another landing on the line, the number of jumps, or any other number is not it.' };
    case 'connect_multiplication':
      return { answer: String(key), alsoAccept: forms(key, `${key} jumps`, `${words(key)} jumps`, `${key} times ${S}`),
        acceptRule: `${key} said alone, or as ${key} jumps of ${S}, counts.`,
        signatureError: `The number reached (${at}), the jump size (${S}), or any other number is not it.` };
    case 'fill_missing':
      return { answer: String(key), alsoAccept: forms(key),
        signatureError: 'A number already shown on the line, or any other number, is not it.' };
    default: return null;
  }
}

/** What the ask says by design: connect_multiplication names the start, the number reached and the jump size; predict
 *  names where the character stands. */
export function skipGiven(c: SkipItem): string[] {
  const at = atOf(c, c.line);
  if (c.type === 'connect_multiplication') return [String(c.line.startFrom), String(at), String(c.line.skipValue)];
  return c.type === 'predict' ? [String(at)] : [];
}

/** A list-shaped miss: the values not yet claimed and above zero, or nothing when none is left. */
function listMiss(claimed: Set<number>, id: string, pattern: (vs: number[]) => string, values: number[]): KnownMiss[] {
  const fresh = Array.from(new Set(values)).filter(v => Number.isInteger(v) && v >= 1 && !claimed.has(v));
  if (!fresh.length) return [];
  fresh.forEach(v => claimed.add(v));
  return [{ id, pattern: pattern(fresh), examples: fresh.slice(0, 3).map(v => (v <= 20 ? words(v) : String(v))) }];
}

/**
 * A spoken item's known wrong answers, with the check's ids (`skipMiss`, the card's lists), concrete ones first.
 * A number that is the key is never an example, and a number two misses share goes to the first.
 */
export function skipSpokenMisses(c: SkipItem): KnownMiss[] {
  const { line } = c, key = spokenSkipKey(c, line);
  if (key === null) return [];
  const at = atOf(c, line), S = line.skipValue, step = stepOf(line);
  const near = (cl: Set<number>, what: string) => listMiss(cl, 'near_miss', vs => `The learner says ${vs.join(' or ')}, within 2 of ${what}: an adding slip.`,
    [key - 1, key + 1, key - 2, key + 2]);
  const other = (what: string): KnownMiss => ({ id: 'off_count', pattern: `Any other number that is not ${what}.` });
  switch (c.type) {
    case 'predict': {
      const ms = numberMisses(key, [
        { id: 'stayed_put', value: at, pattern: n => `The learner says ${n}, the number the character is on now.` },
        { id: 'added_one', value: at + Math.sign(step), pattern: n => `The learner says ${n}, counting on by one from ${at} instead of a jump of ${S}.` },
        { id: 'two_jumps', value: at + 2 * step, pattern: n => `The learner says ${n}, two jumps on from ${at}.` },
        { id: 'wrong_way', value: at - step, pattern: n => `The learner says ${n}, the landing before ${at}.` },
      ]);
      const cl = new Set<number>([key, at, at + Math.sign(step), at + 2 * step, at - step]);
      return [...ms, ...near(cl, 'the next landing'), other('the next landing')];
    }
    case 'fill_missing': {
      const cl = new Set<number>([key]);
      const shown = listMiss(cl, 'not_a_gap', vs => `The learner says ${vs.join(' or ')}, a number already shown on the line, not the hidden one.`,
        [key - step, key + step].filter(v => linePositions(line).includes(v)));
      return [...shown, ...near(cl, 'the hidden number'), other('the hidden number')];
    }
    case 'find_skip_value': {
      const cl = new Set<number>([key]);
      const ms = [
        ...listMiss(cl, 'twice_the_step', vs => `The learner says ${vs[0]}, two jumps' worth (twice the jump size).`, [2 * S]),
        ...listMiss(cl, 'half_the_step', vs => `The learner says ${vs[0]}, half the jump size.`, [S / 2]),
        ...listMiss(cl, 'typed_a_landing', vs => `The learner says a number on the line (${vs.join(', ')}) instead of how far each jump goes.`,
          linePositions(line)),
        ...listMiss(cl, 'one_short', vs => `The learner says ${vs[0]}, one less than the jump size.`, [S - 1]),
        ...listMiss(cl, 'one_over', vs => `The learner says ${vs[0]}, one more than the jump size.`, [S + 1]),
      ];
      return [...ms, ...(S - 2 >= 1 ? [{ id: 'short_by_more', pattern: `Any other number below ${S}.` }] : []),
        { id: 'over_by_more', pattern: `Any other number above ${S}.` }];
    }
    case 'connect_multiplication': {
      const ms = numberMisses(key, [
        { id: 'typed_product', value: at, pattern: n => `The learner says ${n}, the number reached, not the number of jumps.` },
        { id: 'typed_skip', value: S, pattern: n => `The learner says ${n}, the jump size, not the number of jumps.` },
        { id: 'counted_start', value: key + 1, pattern: n => `The learner says ${n}, one jump too many (the start counted as a jump).` },
        { id: 'one_short', value: key - 1, pattern: n => `The learner says ${n}, one jump too few.` },
      ]);
      return [...ms, ...(key - 2 >= 1 ? [{ id: 'short_by_more', pattern: `Any other number of jumps below ${key}.` }] : []),
        { id: 'over_by_more', pattern: `Any other number of jumps above ${key}.` }];
    }
    default: return [];
  }
}

/** The journey's spoken answers: the key, and the mode's signature error (one more than the key; predict counts on by one). */
export function skipHarnessWords(c: SkipItem): { correct: string; plainWrong: string } {
  const key = spokenSkipKey(c, c.line) ?? 0;
  const wrong = c.type === 'predict' ? atOf(c, c.line) + Math.sign(stepOf(c.line)) * (c.line.skipValue === 1 ? 2 : 1) : key + 1;
  return { correct: String(key), plainWrong: String(wrong) };
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

/** What each mode's answer is, which the tutor never says before the learner answers (how the learner answers is the
 *  card's `moves`; that the tutor cannot do the task is the doctrine's). */
const CONSTRAINTS: Record<SkipCountingChallenge['type'], string> = {
  count_along: 'Where the character lands next is the answer: never say it, and never count on past the character.',
  predict: 'The next landing is the answer: before the learner has answered, never say it or count on to it.',
  fill_missing: 'The hidden numbers are the answer: before the learner has answered, never say one or count across a "?".',
  find_skip_value: 'The jump size is the answer: before the learner has answered, never say it, a count-by phrase, or the '
    + 'difference between two landings.',
  connect_multiplication: 'The number of jumps is the answer: before the learner has answered, never say it or count the '
    + 'jumps aloud to the end.',
};

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
export function skipScene(c: SkipCountingChallenge, ctx: SkipSceneContext, view: SkipView): SceneOf {
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
  if (c.type === 'connect_multiplication') {
    facts.box = `The box completes "? x ${line.skipValue} = ${Math.abs(view.position - line.startFrom)}" with how many jumps ${who} made`;
  }
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
  facts.constraints = CONSTRAINTS[c.type];
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
