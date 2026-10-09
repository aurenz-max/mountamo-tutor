/**
 * The in-item levers on a number-tracer item (`/add-support-tiers`, report
 * qa/eval-reports/number-tracer-levers-2026-10-08.md). No real-learner evidence: the misses are what `numberTracerMiss`
 * observes. Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule. Every
 * simpler item has the id `<item>~simpler`, the same mode, and is built here.
 *
 * - trace (the numeral is drawn by design): `ghost_path`, `start_dots`, `stroke_arrows` (help) on the canvas; `trace_part`
 *   (simplify) one stroke of the numeral, or the first half of a one-stroke numeral, checked by geometry alone.
 * - copy (the model is the task): `start_dots` (help) on the canvas, `model_strokes` (help) the model drawn as its strokes
 *   in the model panel, never on the canvas; `one_digit` (simplify) on a two-digit number, its first digit alone.
 * - write (from memory): `start_dots` (help) points only, `first_part` (help) the opening of the first stroke, never more
 *   than a third of the numeral (`firstPartLeaks`); `one_digit` (simplify) as on copy.
 * - sequence (the missing numeral is the answer, so nothing about its shape is drawn, NT-7): `count_dots` (help) a row of
 *   dots under each SHOWN number, none under the gap (`countDotsLeak`); `count_on_run` (simplify) a different run with
 *   the gap last that never contains this item's answer (`runLeaks`). Formation misses here have no lever.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { NumberTracerChallenge, PathPoint } from './NumberTracer';
import type { NumberTracerMiss } from './numberTracerWorkspace';
import { getDigitPaths } from './numberTracerPaths';

export const GHOST_LEVER = 'ghost_path';
export const DOTS_LEVER = 'start_dots';
export const ARROWS_LEVER = 'stroke_arrows';
export const FIRST_PART_LEVER = 'first_part';
export const MODEL_STROKES_LEVER = 'model_strokes';
export const COUNT_DOTS_LEVER = 'count_dots';
export const TRACE_PART_LEVER = 'trace_part';
export const ONE_DIGIT_LEVER = 'one_digit';
export const COUNT_ON_LEVER = 'count_on_run';
export const SIMPLER_SUFFIX = '~simpler';

const ALL: readonly NumberTracerMiss[] = ['other_numeral', 'digits_swapped', 'not_readable', 'poorly_formed', 'part_left_out', 'shape_off'];
/** Sequence misses no lever can answer: any formation guide draws the hidden numeral. */
export const SEQUENCE_UNANSWERED: readonly NumberTracerMiss[] = ['poorly_formed', 'part_left_out', 'shape_off'];

/** The guide strokes the canvas draws and scores against (the component's own fallback). */
export const guideOf = (ch: NumberTracerChallenge): PathPoint[][] =>
  ch.strokePaths?.length ? ch.strokePaths : getDigitPaths(ch.digit);

type Decl = Omit<WorkspaceLever, 'pulled'>;
const DECL: Record<string, Decl> = {
  [GHOST_LEVER]: { id: GHOST_LEVER, kind: 'help', carrier: 'shown',
    when: 'the writing does not follow the numeral and no dotted numeral is on the canvas',
    does: 'Draws the dotted numeral on the canvas to trace over. Say that it is there; do not trace or describe it for the learner.',
    answers: ['shape_off', 'other_numeral', 'not_readable', 'digits_swapped', 'part_left_out'] },
  [DOTS_LEVER]: { id: DOTS_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner starts the numeral in the wrong place or draws its parts out of order',
    does: 'Puts a green dot where each stroke of the numeral starts, numbered in drawing order. Point to dot 1; '
      + 'do not describe the shape of any stroke.',
    answers: ['shape_off', 'poorly_formed', 'not_readable', 'other_numeral', 'digits_swapped'] },
  [ARROWS_LEVER]: { id: ARROWS_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner follows the numeral the wrong way or stops partway along it',
    does: 'Draws arrows along each stroke of the dotted numeral, showing which way it goes.',
    answers: ['poorly_formed', 'shape_off', 'part_left_out'] },
  [FIRST_PART_LEVER]: { id: FIRST_PART_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner cannot begin the numeral from memory, or leaves part of it out',
    does: 'Draws the opening part of the numeral\'s first stroke dotted on the canvas; the learner writes the rest. '
      + 'Do not describe the rest of the shape.',
    answers: ['part_left_out', 'shape_off', 'poorly_formed', 'not_readable', 'other_numeral'] },
  [MODEL_STROKES_LEVER]: { id: MODEL_STROKES_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner\'s copy does not look like the model',
    does: 'Draws the model numeral beside the canvas as its strokes, each with a numbered start dot and an arrow. '
      + 'The canvas stays blank.',
    answers: ['poorly_formed', 'shape_off', 'part_left_out', 'not_readable', 'other_numeral'] },
  [COUNT_DOTS_LEVER]: { id: COUNT_DOTS_LEVER, kind: 'help', carrier: 'shown',
    when: 'the learner writes a number that does not belong in the gap',
    does: 'Puts a row of dots under each shown number, as many dots as the number; nothing goes under the gap. '
      + 'Never say how many dots the gap would need or what number belongs there.',
    answers: ['other_numeral', 'not_readable'] },
  [TRACE_PART_LEVER]: { id: TRACE_PART_LEVER, kind: 'simplify', carrier: 'shown',
    when: 'tracing the whole numeral is too much at once',
    does: 'Opens an easier, ungraded practice: trace one stroke of this numeral (or its first half). Then the whole numeral comes back blank.',
    answers: ALL },
  [ONE_DIGIT_LEVER]: { id: ONE_DIGIT_LEVER, kind: 'simplify', carrier: 'shown',
    when: 'a two-digit number is too much at once',
    does: 'Opens an easier, ungraded practice: the first digit of this number on its own. Then the whole number comes back blank.',
    answers: ['poorly_formed', 'shape_off', 'part_left_out', 'not_readable', 'digits_swapped', 'other_numeral'] },
  [COUNT_ON_LEVER]: { id: COUNT_ON_LEVER, kind: 'simplify', carrier: 'shown',
    when: 'finding a gap inside the run is too much at once',
    does: 'Opens an easier, ungraded practice: a different counting run whose LAST number is missing. '
      + 'Never say this item\'s missing number. Then this item comes back.',
    answers: ['other_numeral', 'not_readable', 'digits_swapped'] },
};

/** The levers an item declares, in the order `nextLever` reads them (help before simplify). */
export function leverIdsFor(ch: NumberTracerChallenge): string[] {
  switch (ch.type) {
    case 'trace': return [GHOST_LEVER, DOTS_LEVER, ARROWS_LEVER, ...(tracePart(ch) ? [TRACE_PART_LEVER] : [])];
    case 'copy': return [DOTS_LEVER, MODEL_STROKES_LEVER, ...(oneDigit(ch) ? [ONE_DIGIT_LEVER] : [])];
    case 'write': return [DOTS_LEVER, FIRST_PART_LEVER, ...(oneDigit(ch) ? [ONE_DIGIT_LEVER] : [])];
    case 'sequence': return [...(countDots(ch) ? [COUNT_DOTS_LEVER] : []), ...(countOnRun(ch) ? [COUNT_ON_LEVER] : [])];
  }
}

/** Where an item's guides start (its support tier's painted guides), as lever ids. Not a pull: never recorded. */
export function startingLevers(ch: NumberTracerChallenge, painted: { ghost: boolean; arrows: boolean; startDot: boolean }): string[] {
  if (ch.type === 'sequence') return [];
  return [
    ...(ch.type === 'trace' && painted.ghost ? [GHOST_LEVER] : []),
    ...(ch.type !== 'write' && painted.startDot ? [DOTS_LEVER] : []),
    ...(ch.type === 'trace' && painted.arrows ? [ARROWS_LEVER] : []),
  ];
}

export function numberTracerLevers(ch: NumberTracerChallenge, pulled: readonly string[]): WorkspaceLever[] {
  return leverIdsFor(ch).map(id => ({ ...DECL[id], pulled: pulled.includes(id) }));
}

/** What a pulled help lever has put on screen, in words the tutor and JEV read. Never the answer. */
export function leverFacts(ch: NumberTracerChallenge, pulled: readonly string[]): string | undefined {
  const strokes = guideOf(ch).length;
  const facts: Record<string, string> = {
    [GHOST_LEVER]: 'The dotted numeral is drawn on the canvas to trace over.',
    [DOTS_LEVER]: strokes > 1
      ? `A green dot marks where each of the ${strokes} strokes starts, numbered in drawing order.`
      : 'A green dot marks where the stroke starts.',
    [ARROWS_LEVER]: 'Arrows along the dotted numeral show which way each stroke goes.',
    [FIRST_PART_LEVER]: 'The opening part of the first stroke is drawn dotted on the canvas; the rest of the canvas is blank.',
    [MODEL_STROKES_LEVER]: 'Beside the canvas the model is drawn as its strokes, each with a numbered start dot and an arrow.',
    [COUNT_DOTS_LEVER]: 'Under each shown number is a row of that many dots; nothing is drawn under the gap.',
  };
  const on = leverIdsFor(ch).filter(id => pulled.includes(id) && facts[id]).map(id => facts[id]);
  return on.length ? on.join(' ') : undefined;
}

// ── help-lever geometry and leak rules ──────────────────────────────────────

/** Where each stroke starts, numbered in drawing order. Points only: never a stroke's shape. */
export const startDots = (paths: PathPoint[][]): PathPoint[] => paths.filter(s => s.length > 0).map(s => s[0]);

/** The opening of the first stroke a write item's `first_part` draws: a prefix of it, at most a third of the numeral. */
export function firstPart(paths: PathPoint[][]): PathPoint[] {
  const total = paths.reduce((n, s) => n + s.length, 0), first = paths[0] ?? [];
  if (first.length < 3) return [];
  const take = Math.max(2, Math.min(Math.floor(total / 3), first.length - 1));
  return first.slice(0, take);
}

/** `first_part` leaks when it draws more than a third of the numeral's points, a whole stroke, or anything not its start. */
export function firstPartLeaks(paths: PathPoint[][], part: PathPoint[]): boolean {
  const total = paths.reduce((n, s) => n + s.length, 0), first = paths[0] ?? [];
  if (part.length > Math.max(2, Math.floor(total / 3)) || part.length >= first.length) return true;
  return part.some((p, i) => p.x !== first[i]?.x || p.y !== first[i]?.y);
}

/** `count_dots`: one row per shown number, as many dots as the number; the gap's row is null. Only for runs up to 20. */
export function countDots(ch: NumberTracerChallenge): (number | null)[] | null {
  const run = ch.sequenceNumbers;
  if (ch.type !== 'sequence' || !run?.length || ch.missingIndex == null) return null;
  if (run.some((n, i) => i !== ch.missingIndex && (!Number.isInteger(n) || n < 0 || n > 20))) return null;
  return run.map((n, i) => (i === ch.missingIndex ? null : n));
}

/** `count_dots` leaks when any dots stand under the gap, or a row's count differs from its printed number. */
export function countDotsLeak(ch: NumberTracerChallenge, rows: (number | null)[]): boolean {
  const run = ch.sequenceNumbers ?? [];
  return rows.length !== run.length || rows.some((r, i) => (i === ch.missingIndex ? r !== null : r !== run[i]));
}

// ── simplify builders ───────────────────────────────────────────────────────

const simplerId = (ch: NumberTracerChallenge) => `${ch.id}${SIMPLER_SUFFIX}`;

/** trace: one stroke of the numeral, or the first half of a one-stroke numeral. Checked by geometry alone (`strokePart`). */
export function tracePart(ch: NumberTracerChallenge): NumberTracerChallenge | null {
  if (ch.type !== 'trace') return null;
  const paths = guideOf(ch);
  const part = paths.length > 1 ? [paths[0]] : paths[0]?.length >= 6 ? [paths[0].slice(0, Math.ceil(paths[0].length / 2) + 1)] : null;
  if (!part || part[0].length < 2) return null;
  return { id: simplerId(ch), type: 'trace', digit: ch.digit, instruction: `Trace this part of the ${ch.digit}!`,
    strokePaths: part, showModel: false, showArrows: ch.showArrows, strokePart: true,
    ...(ch.supportTier ? { supportTier: ch.supportTier, showGhostDigit: true, showStrokeArrows: ch.showStrokeArrows,
      showStartDot: ch.showStartDot } : {}) };
}

/** copy / write: the first digit of a two-digit (or three-digit) number on its own. None for a one-digit numeral. */
export function oneDigit(ch: NumberTracerChallenge): NumberTracerChallenge | null {
  if ((ch.type !== 'copy' && ch.type !== 'write') || ch.digit < 10) return null;
  const digit = Number(String(ch.digit)[0]);
  const verb = ch.type === 'copy' ? 'Copy' : 'Write';
  return { id: simplerId(ch), type: ch.type, digit, instruction: `${verb} the number ${digit}!`, strokePaths: [],
    showModel: ch.type === 'copy', showArrows: false,
    ...(ch.supportTier ? { supportTier: ch.supportTier, showGhostDigit: ch.showGhostDigit, showStrokeArrows: ch.showStrokeArrows,
      showStartDot: ch.showStartDot } : {}) };
}

/**
 * sequence: a run of the same length with the LAST number missing (counting on), from the decade of this item's answer,
 * that never shows or asks this item's answer. None when this item's gap is already last.
 */
export function countOnRun(ch: NumberTracerChallenge): NumberTracerChallenge | null {
  const run = ch.sequenceNumbers;
  if (ch.type !== 'sequence' || !run || run.length < 2 || ch.missingIndex == null) return null;
  if (ch.missingIndex === run.length - 1) return null;
  const answer = run[ch.missingIndex], len = run.length, ceiling = Math.max(9, ...run), decade = Math.floor(answer / 10) * 10;
  // Up from the answer's decade, then down from it: the nearest run that leaves this item's answer out.
  const starts = [...Array.from({ length: Math.max(0, ceiling - len + 2 - decade) }, (_, k) => decade + k),
    ...Array.from({ length: decade }, (_, k) => decade - 1 - k)];
  for (const s of starts) {
    const next = Array.from({ length: len }, (_, k) => s + k);
    if (next.includes(answer)) continue;
    return { id: simplerId(ch), type: 'sequence', digit: next[len - 1], instruction: 'What\'s the missing number? Fill in the blank!',
      strokePaths: [], showModel: false, showArrows: false, sequenceNumbers: next, missingIndex: len - 1,
      hint: 'Count up by ones — each number is one more than the last.' };
  }
  return null;
}

/** A sequence practice run leaks when it shows or asks the source's answer, or is the source run. */
export function runLeaks(source: NumberTracerChallenge, practice: NumberTracerChallenge): boolean {
  const answer = source.sequenceNumbers?.[source.missingIndex ?? -1];
  return answer == null || (practice.sequenceNumbers ?? []).includes(answer)
    || JSON.stringify(practice.sequenceNumbers) === JSON.stringify(source.sequenceNumbers);
}

/** The easier item a simplify lever opens. */
export function practiceItem(ch: NumberTracerChallenge, lever: string): NumberTracerChallenge | null {
  if (lever === TRACE_PART_LEVER) return tracePart(ch);
  if (lever === ONE_DIGIT_LEVER) return oneDigit(ch);
  if (lever === COUNT_ON_LEVER) return countOnRun(ch);
  return null;
}

export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back blank after it.';
