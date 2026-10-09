/**
 * The in-item levers on a skip-counting-runner item (`/add-support-tiers`, report
 * qa/eval-reports/skip-counting-runner-levers-2026-10-09.md). No real-learner evidence: the misses are what
 * `skipMiss` observes. Pure: the component draws from these, the workspace publishes them, the tests hold each leak
 * rule. Every simpler item has the id `<item>~simpler`, the same mode, its own line, and is built by `practiceItem`.
 *
 * - count_along: `tick_numbers` (help) the numbers of the count under its ticks; `count_trail` (help) the written row
 *   of the learner's own landings ending "→ ?". Neither marks the next landing.
 * - predict: `jump_sizes` (help) "+N" over each jump already made, never an arc or number past the character;
 *   `count_trail`.
 * - fill_missing: `step_arcs` (help) an arc with "+N" between every two neighbouring numbers of the count, the "?"
 *   left on each gap; `ring_gaps` (help) a ring on each "?" still open.
 * - find_skip_value: the jump size is the answer, so nothing on the item writes it. `hop_dots` (help) an unnumbered
 *   dot on each whole number passed over in the first three jumps; `model_count` (help) a small line outside the item
 *   counting by another step, "+k" over its jumps.
 * - connect_multiplication: the number of jumps is the answer. `jump_marks` (help) every jump drawn as its own arc in
 *   alternating colours, no numbers; `array_rows` (help) one row of N squares per jump, the rows never counted.
 * - every mode: `simpler_count` (simplify) the same mode on a plainer, shorter count, never the item's own landings,
 *   gaps or answer (`practiceLeaks`).
 *
 * Starting positions: the generator's support tier (`showOptions`, `supportTier`) sets which help starts shown; a
 * starting position is not a pull.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { SkipCountingChallenge, SkipCountingRunnerData } from './SkipCountingRunner';
import { SKIP_MISSES_BY_MODE, gapsOf, jumpsTo, linePositions, nextLanding, openingSpots, type SkipCountingMiss, type SkipLine }
  from './skipCountingWorkspace';

export const TICK_NUMBERS = 'tick_numbers';
export const COUNT_TRAIL = 'count_trail';
export const JUMP_SIZES = 'jump_sizes';
export const STEP_ARCS = 'step_arcs';
export const RING_GAPS = 'ring_gaps';
export const HOP_DOTS = 'hop_dots';
export const MODEL_COUNT = 'model_count';
export const JUMP_MARKS = 'jump_marks';
export const ARRAY_ROWS = 'array_rows';
export const SIMPLER_LEVER = 'simpler_count';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'An easier practice count, ungraded; the full item comes back after it.';

/** What a lever reads beyond the item. */
export interface SkipLeverSession {
  challenges: readonly SkipCountingChallenge[];
  line: SkipLine;
  showOptions?: SkipCountingRunnerData['showOptions'];
  supportTier?: SkipCountingRunnerData['supportTier'];
}

/** A simpler item and the line it is drawn on. */
export interface SkipPractice { challenge: SkipCountingChallenge; line: SkipLine }

const ahead = (c: SkipCountingChallenge, s: SkipLeverSession) => {
  const at = s.challenges.findIndex(x => x.id === c.id);
  return at < 0 ? [] : s.challenges.slice(at + 1).filter(x => x.type === c.type);
};

// ── hop_dots: find_skip_value, the whole numbers passed over ───────────────

/** The first three jumps of the line, as [from, to] pairs. */
const firstJumps = (line: SkipLine) => {
  const all = linePositions(line);
  return all.slice(0, 4).slice(1).map((to, i) => [all[i], to] as const);
};

/** The whole numbers strictly inside each of the first three jumps; null on a count by 1 (nothing is passed over). */
export function hopDots(line: SkipLine): number[] | null {
  if (line.skipValue < 2) return null;
  const dots: number[] = [];
  for (const [a, b] of firstJumps(line)) for (let n = Math.min(a, b) + 1; n < Math.max(a, b); n++) dots.push(n);
  return dots;
}

/** Leak rule: a dot never sits on a landing or outside the first three jumps (and is never numbered: it is drawn bare). */
export function dotsLeak(line: SkipLine, dots: readonly number[]): boolean {
  const landings = new Set(linePositions(line));
  const jumps = firstJumps(line);
  return dots.some(d => landings.has(d) || !jumps.some(([a, b]) => d > Math.min(a, b) && d < Math.max(a, b)));
}

export const DOTS_FACT = 'A small dot on each whole number passed over in the first three jumps; no numbers are written on '
  + 'the dots and none are counted';

// ── model_count: find_skip_value, a model outside the item ─────────────────

export interface CountModel { step: number; numbers: number[] }
const MODEL_STEPS = [10, 2, 5, 3, 4];

/** Leak rule: never the item's jump size, as the model's step or as one of its numbers. */
export const modelLeaks = (m: CountModel, line: SkipLine) => m.step === line.skipValue || m.numbers.includes(line.skipValue);

export function countModel(c: SkipCountingChallenge, line: SkipLine): CountModel | null {
  if (c.type !== 'find_skip_value') return null;
  for (const step of MODEL_STEPS) {
    const m = { step, numbers: [0, 1, 2, 3, 4].map(k => k * step) };
    if (!modelLeaks(m, line)) return m;
  }
  return null;
}

export const modelFact = (m: CountModel) => `A small model number line beside the item counting by ${m.step}s from 0 to `
  + `${m.numbers[m.numbers.length - 1]}, "+${m.step}" written over each of its jumps; nothing is drawn on the item's line`;

// ── the other help facts ───────────────────────────────────────────────────

const who = (character?: string) => (!character || character === 'custom' ? 'the character' : `the ${character}`);
export const leverFact = (id: string, line: SkipLine, character?: string): string => {
  const sign = line.direction === 'backward' ? '-' : '+';
  switch (id) {
    case TICK_NUMBERS: return 'The numbers of the count are written under their ticks';
    case COUNT_TRAIL: return 'The written row of landings so far, ending "→ ?"';
    case JUMP_SIZES: return `"${sign}${line.skipValue}" written over each jump made so far; nothing is drawn past ${who(character)}`;
    case STEP_ARCS: return `An arc with "${sign}${line.skipValue}" between every two neighbouring numbers of the count; each gap keeps its "?"`;
    case RING_GAPS: return 'A ring around each "?" still to fill';
    case JUMP_MARKS: return `Each jump ${who(character)} made drawn as its own arc, alternating colours; no numbers on the arcs`;
    case ARRAY_ROWS: return `An array beside the line, one row of ${line.skipValue} squares for each jump; the rows are not numbered or counted`;
    default: return '';
  }
};

// ── simpler items ──────────────────────────────────────────────────────────

/** Plainest first: a count by 10s, then 5s, then 2s; find_skip_value: the smallest gap to count first. */
const EASE: Record<SkipCountingChallenge['type'], number[]> = {
  count_along: [10, 5, 2], predict: [10, 5, 2], fill_missing: [10, 5, 2], find_skip_value: [2, 5, 10], connect_multiplication: [],
};
const rank = (type: SkipCountingChallenge['type'], step: number) =>
  EASE[type].includes(step) ? EASE[type].indexOf(step) : EASE[type].length;
const forward = (step: number, jumps: number): SkipLine => ({ skipValue: step, startFrom: 0, endAt: step * jumps, direction: 'forward' });

/** The answer an item asks for, as text: the landings to tap, the next landing, the gaps, the jump size or the jumps. */
export function answerOf(c: SkipCountingChallenge, line: SkipLine): string {
  const spots = openingSpots(line, c), at = spots[spots.length - 1];
  switch (c.type) {
    case 'count_along': return linePositions(line).filter(p => !spots.includes(p)).join(',');
    case 'predict': return String(nextLanding(line, at));
    case 'fill_missing': return gapsOf(c, line).join(',');
    case 'find_skip_value': return String(line.skipValue);
    case 'connect_multiplication': return String(jumpsTo(line, at));
    default: return '';
  }
}

const practiceOf = (c: SkipCountingChallenge, fields: Partial<SkipCountingChallenge>): SkipCountingChallenge =>
  ({ ...c, id: `${c.id}${PRACTICE_SUFFIX}`, hint: '', narration: '', hiddenPositions: [], targetFact: null, ...fields });

/**
 * Leak rule for a simpler item: the same mode, its own id, never the item's own line and start, never the item's
 * answer (or a gap of the item, or a number the item asks for), and never the answer of a later item of the mode.
 */
export function practiceLeaks(p: SkipPractice, c: SkipCountingChallenge, s: SkipLeverSession): boolean {
  if (p.challenge.id === c.id || p.challenge.type !== c.type) return true;
  const pa = answerOf(p.challenge, p.line), ca = answerOf(c, s.line);
  const sameLine = p.line.skipValue === s.line.skipValue && p.line.startFrom === s.line.startFrom && p.line.endAt === s.line.endAt
    && p.line.direction === s.line.direction;
  if (sameLine && c.type !== 'fill_missing'
    && (p.challenge.startPosition ?? p.line.startFrom) === (c.startPosition ?? s.line.startFrom)) return true;
  if (pa === ca) return true;
  const own = new Set(ca.split(',').filter(Boolean));
  // A number the item asks for (predict's landing, a gap). count_along's taps are every landing of its count, which a
  // plainer count shares in part (10, 20 in a count by 5s): there the rule is a different step (`build`).
  if ((c.type === 'predict' || c.type === 'fill_missing') && pa.split(',').some(x => own.has(x))) return true;
  return ahead(c, s).some(x => answerOf(x, s.line) === pa);
}

function build(c: SkipCountingChallenge, s: SkipLeverSession, step: number, sameStep: boolean): SkipPractice | null {
  const line = s.line;
  switch (c.type) {
    case 'count_along': {
      if (sameStep) return null;
      const ln = forward(step, 3);
      return { line: ln, challenge: practiceOf(c, { startPosition: 0,
        instruction: `Tap where it lands on each jump, counting by ${step}s up to ${ln.endAt}.` }) };
    }
    case 'predict': {
      const ln = sameStep ? line : forward(step, 5);
      const all = linePositions(ln);
      const itemAt = openingSpots(line, c).length - 1;
      for (let k = 1; k < all.length - 1; k++) {
        if (sameStep && k >= itemAt) break;
        const p = { line: ln, challenge: practiceOf(c, { startPosition: all[k],
          instruction: `It is at ${all[k]}. Where does it land next?` }) };
        if (!practiceLeaks(p, c, s)) return p;
      }
      return null;
    }
    case 'fill_missing': {
      const ln = sameStep ? { ...line, endAt: line.startFrom + (line.direction === 'backward' ? -4 : 4) * line.skipValue } : forward(step, 4);
      // The same count is simpler only when it is shorter or hides fewer numbers.
      if (sameStep && ((linePositions(line).length <= 5 && gapsOf(c, line).length < 2) || ln.endAt < 0)) return null;
      for (const gap of linePositions(ln).slice(1, -1)) {
        const p = { line: ln, challenge: practiceOf(c, { startPosition: ln.startFrom, hiddenPositions: [gap],
          instruction: `One number is hidden. Type the missing number.` }) };
        if (!practiceLeaks(p, c, s)) return p;
      }
      return null;
    }
    case 'find_skip_value': {
      if (sameStep) return null;
      return { line: forward(step, 4), challenge: practiceOf(c, { startPosition: 0,
        instruction: 'Look at the landings. How far is each jump?' }) };
    }
    case 'connect_multiplication': {
      const all = linePositions(line), itemJumps = jumpsTo(line, openingSpots(line, c).at(-1)!);
      for (const j of [2, 3, 4]) {
        if (j >= itemJumps || !all[j]) continue;
        const p = { line, challenge: practiceOf(c, { startPosition: all[j],
          instruction: `It jumped to reach ${all[j]}. How many jumps did it make?` }) };
        if (!practiceLeaks(p, c, s)) return p;
      }
      return null;
    }
    default: return null;
  }
}

/** The simpler item for a session item, same mode, or null on an item already the plainest. */
export function practiceItem(c: SkipCountingChallenge, s: SkipLeverSession): SkipPractice | null {
  const own = rank(c.type, s.line.skipValue);
  for (const step of EASE[c.type].filter(k => k !== s.line.skipValue && rank(c.type, k) < own)) {
    const p = build(c, s, step, false);
    if (p && !practiceLeaks(p, c, s)) return p;
  }
  // No plainer count: the same count, smaller (an earlier landing, a shorter line).
  const p = build(c, s, s.line.skipValue, true);
  return p && !practiceLeaks(p, c, s) ? p : null;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, challenges: readonly SkipCountingChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

/** Which help starts shown from the generator's support tier (a starting position, not a pull). */
export function helpStartsShown(id: string, s: SkipLeverSession): boolean {
  const o = s.showOptions ?? {}, easy = s.supportTier === 'easy';
  switch (id) {
    case TICK_NUMBERS: return o.showTrackLabels !== false;
    case COUNT_TRAIL: return o.showSequenceChips !== false;
    case ARRAY_ROWS: return !!o.showArray;
    case JUMP_SIZES: case STEP_ARCS: case HOP_DOTS: case JUMP_MARKS: return easy;
    default: return false;
  }
}

const ALL = SKIP_MISSES_BY_MODE;

/** The levers on a session item. `pulled` holds this item's runtime pulls; `position` is where the character stands. */
export function skipLevers(c: SkipCountingChallenge | null, s: SkipLeverSession, pulled: readonly string[],
  position: number): WorkspaceLever[] {
  if (!c) return [];
  const levers: WorkspaceLever[] = [];
  const help = (id: string, when: string, does: string, answers: SkipCountingMiss[]) =>
    levers.push({ id, kind: 'help', carrier: 'shown', when, does, answers,
      pulled: helpStartsShown(id, s) || pulled.includes(id) });
  const never = 'Never say the next landing.';
  switch (c.type) {
    case 'count_along':
      help(TICK_NUMBERS, 'The learner taps past the next landing: they lose track of where the count is.',
        `Writes the numbers of the count under their ticks. You may read the numbers already landed on. ${never}`, ALL.count_along);
      help(COUNT_TRAIL, 'The learner taps past the next landing.',
        `Shows the written row of the learner's own landings, ending "→ ?". You may read the row with them. ${never}`, ALL.count_along);
      break;
    case 'predict':
      if (position !== s.line.startFrom) help(JUMP_SIZES, 'The learner adds the wrong amount: one, two jumps, or a near number.',
        'Writes the jump size over each jump already made; nothing past the character. You may point to the jumps; '
          + `${never}`, ['added_one', 'two_jumps', 'near_miss', 'off_count', 'stayed_put']);
      help(COUNT_TRAIL, 'The learner gives the number it is on, or goes the wrong way.',
        `Shows the written row of landings so far, ending "→ ?". You may read the row with them. ${never}`,
        ['stayed_put', 'wrong_way', 'two_jumps']);
      break;
    case 'fill_missing':
      help(STEP_ARCS, 'The learner types a number that is not in the count, or one already shown.',
        'Draws an arc with the jump size between every two neighbouring numbers; each gap keeps its "?". You may point '
          + 'to the number before a gap; never say a missing number.', ['near_miss', 'off_count', 'not_a_gap']);
      help(RING_GAPS, 'The learner types a number already on the line or already filled.',
        'Rings each "?" still to fill. You may point to the rings; never say a missing number.', ['already_filled', 'not_a_gap']);
      break;
    case 'find_skip_value':
      if (hopDots(s.line)) help(HOP_DOTS, 'The learner\'s jump size is off by one or more, or is double or half.',
        'Puts an unnumbered dot on each whole number passed over in the first three jumps. You may point to the dots; '
          + 'never count them or say the jump size.', ['one_short', 'one_over', 'short_by_more', 'over_by_more', 'half_the_step', 'twice_the_step']);
      if (countModel(c, s.line)) help(MODEL_COUNT, 'The learner types a landing, or double or half the jump size.',
        'Draws a small number line beside the item counting by another step, with its jump size written over each jump. '
          + 'You may compare the two lines; never say the item\'s jump size.', ['twice_the_step', 'half_the_step', 'typed_a_landing']);
      break;
    case 'connect_multiplication':
      help(JUMP_MARKS, 'The learner\'s count of jumps is off: one more, one fewer, or further.',
        'Draws every jump as its own arc in alternating colours, with no numbers. You may point along the arcs; never '
          + 'count them to the end or say how many.', ['counted_start', 'one_short', 'short_by_more', 'over_by_more']);
      help(ARRAY_ROWS, 'The learner types the number reached or the jump size instead of the number of jumps.',
        'Shows an array, one row of squares for each jump. You may say each row is one jump; never count the rows or '
          + 'say how many.', ['typed_product', 'typed_skip', 'counted_start']);
      break;
  }
  if (practiceItem(c, s)) levers.push({ id: SIMPLER_LEVER, kind: 'simplify', carrier: 'shown',
    when: 'The learner cannot do this item even with the help on screen: a plainer, shorter count first.',
    does: 'Opens an ungraded practice count of the same kind, plainer and shorter; then this item comes back blank.',
    pulled: pulled.includes(SIMPLER_LEVER), answers: ALL[c.type] });
  return levers;
}
