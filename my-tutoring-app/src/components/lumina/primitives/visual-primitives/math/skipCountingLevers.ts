/**
 * The in-item levers on a skip-counting-runner item, one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/skip-counting-runner-levers-2026-10-09.md). No real-learner evidence: the misses are what
 * `skipMiss` observes. Pure: the component draws from these, the workspace publishes them, the tests hold each leak
 * rule. Every simpler item has the id `<item>~simpler`, the same mode, its own line, and is built by `practiceItem`.
 *
 * - count_along: `tick_numbers` (legend) the numbers of the count under its ticks; `count_trail` (layout) the written
 *   row of the learner's own landings ending "→ ?". Neither marks the next landing.
 * - predict: `jump_sizes` (marks) "+N" over each jump already made, never an arc or number past the character;
 *   `count_trail`.
 * - fill_missing: `step_arcs` (marks) an arc with "+N" between every two neighbouring numbers of the count, the "?"
 *   left on each gap; `ring_gaps` (marks) a ring on each "?" still open.
 * - find_skip_value: the jump size is the answer, so nothing on the item writes it. `hop_dots` (marks) an unnumbered
 *   dot on each whole number passed over in the first three jumps; `model_count` (model) a small line outside the
 *   item counting by another step, "+k" over its jumps.
 * - connect_multiplication: the number of jumps is the answer. `jump_marks` (marks) every jump drawn as its own arc in
 *   alternating colours, no numbers; `array_rows` (layout) one row of N squares per jump, the rows never counted.
 * - every mode: `simpler_count` (easier) the same mode on a plainer, shorter count, never the item's own landings,
 *   gaps or answer (`practiceLeaks`).
 *
 * Starting positions: the generator's support tier (`showOptions`, `supportTier`) sets which help starts shown
 * (`startsShown`); a starting position is not a pull. When the model comes is the set's `support`.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { SkipCountingRunnerData } from './SkipCountingRunner';
import { SKIP_MISSES, type SkipMode } from './skipCounting.card';
import { gapsOf, jumpsTo, linePositions, nextLanding, openingSpots, type SkipItem, type SkipLine } from './skipCountingWorkspace';

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

/** What a lever reads beyond the item: every item (for "still ahead") and the lesson's starting aids. */
export interface SkipLeverSession {
  challenges: readonly SkipItem[];
  showOptions?: SkipCountingRunnerData['showOptions'];
  supportTier?: SkipCountingRunnerData['supportTier'];
}

const ahead = (c: SkipItem, s: SkipLeverSession) => {
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

export function countModel(c: SkipItem): CountModel | null {
  if (c.type !== 'find_skip_value') return null;
  for (const step of MODEL_STEPS) {
    const m = { step, numbers: [0, 1, 2, 3, 4].map(k => k * step) };
    if (!modelLeaks(m, c.line)) return m;
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
const EASE: Record<SkipItem['type'], number[]> = {
  count_along: [10, 5, 2], predict: [10, 5, 2], fill_missing: [10, 5, 2], find_skip_value: [2, 5, 10], connect_multiplication: [],
};
const rank = (type: SkipItem['type'], step: number) =>
  EASE[type].includes(step) ? EASE[type].indexOf(step) : EASE[type].length;
const forward = (step: number, jumps: number): SkipLine => ({ skipValue: step, startFrom: 0, endAt: step * jumps, direction: 'forward' });

/** The answer an item asks for, as text: the landings to tap, the next landing, the gaps, the jump size or the jumps. */
export function answerOf(c: SkipItem, line: SkipLine = c.line): string {
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

const practiceOf = (c: SkipItem, line: SkipLine, fields: Partial<SkipItem>): SkipItem =>
  ({ ...c, id: `${c.id}${PRACTICE_SUFFIX}`, hint: '', narration: '', hiddenPositions: [], targetFact: null, ...fields, line });

/**
 * Leak rule for a simpler item: the same mode, its own id, never the item's own line and start, never the item's
 * answer (or a gap of the item, or a number the item asks for), and never the answer of a later item of the mode.
 */
export function practiceLeaks(p: SkipItem, c: SkipItem, s: SkipLeverSession): boolean {
  if (p.id === c.id || p.type !== c.type) return true;
  const pa = answerOf(p), ca = answerOf(c);
  const sameLine = p.line.skipValue === c.line.skipValue && p.line.startFrom === c.line.startFrom && p.line.endAt === c.line.endAt
    && p.line.direction === c.line.direction;
  if (sameLine && c.type !== 'fill_missing'
    && (p.startPosition ?? p.line.startFrom) === (c.startPosition ?? c.line.startFrom)) return true;
  if (pa === ca) return true;
  const own = new Set(ca.split(',').filter(Boolean));
  // A number the item asks for (predict's landing, a gap). count_along's taps are every landing of its count, which a
  // plainer count shares in part (10, 20 in a count by 5s): there the rule is a different step (`build`).
  if ((c.type === 'predict' || c.type === 'fill_missing') && pa.split(',').some(x => own.has(x))) return true;
  return ahead(c, s).some(x => answerOf(x) === pa);
}

function build(c: SkipItem, s: SkipLeverSession, step: number, sameStep: boolean): SkipItem | null {
  const line = c.line;
  switch (c.type) {
    case 'count_along': {
      if (sameStep) return null;
      const ln = forward(step, 3);
      return practiceOf(c, ln, { startPosition: 0, instruction: `Tap where it lands on each jump, counting by ${step}s up to ${ln.endAt}.` });
    }
    case 'predict': {
      const ln = sameStep ? line : forward(step, 5);
      const all = linePositions(ln);
      const itemAt = openingSpots(line, c).length - 1;
      for (let k = 1; k < all.length - 1; k++) {
        if (sameStep && k >= itemAt) break;
        const p = practiceOf(c, ln, { startPosition: all[k], instruction: `It is at ${all[k]}. Where does it land next?` });
        if (!practiceLeaks(p, c, s)) return p;
      }
      return null;
    }
    case 'fill_missing': {
      const ln = sameStep ? { ...line, endAt: line.startFrom + (line.direction === 'backward' ? -4 : 4) * line.skipValue } : forward(step, 4);
      // The same count is simpler only when it is shorter or hides fewer numbers.
      if (sameStep && ((linePositions(line).length <= 5 && gapsOf(c, line).length < 2) || ln.endAt < 0)) return null;
      for (const gap of linePositions(ln).slice(1, -1)) {
        const p = practiceOf(c, ln, { startPosition: ln.startFrom, hiddenPositions: [gap],
          instruction: 'One number is hidden. Type the missing number.' });
        if (!practiceLeaks(p, c, s)) return p;
      }
      return null;
    }
    case 'find_skip_value': {
      if (sameStep) return null;
      return practiceOf(c, forward(step, 4), { startPosition: 0, instruction: 'Look at the landings. How far is each jump?' });
    }
    case 'connect_multiplication': {
      const all = linePositions(line), itemJumps = jumpsTo(line, openingSpots(line, c).at(-1)!);
      for (const j of [2, 3, 4]) {
        if (j >= itemJumps || !all[j]) continue;
        const p = practiceOf(c, line, { startPosition: all[j], instruction: `It jumped to reach ${all[j]}. How many jumps did it make?` });
        if (!practiceLeaks(p, c, s)) return p;
      }
      return null;
    }
    default: return null;
  }
}

/** The simpler item for a session item, same mode, or null on an item already the plainest. */
export function practiceItem(c: SkipItem, s: SkipLeverSession): SkipItem | null {
  const own = rank(c.type, c.line.skipValue);
  for (const step of EASE[c.type].filter(k => k !== c.line.skipValue && rank(c.type, k) < own)) {
    const p = build(c, s, step, false);
    if (p && !practiceLeaks(p, c, s)) return p;
  }
  // No plainer count: the same count, smaller (an earlier landing, a shorter line).
  const p = build(c, s, c.line.skipValue, true);
  return p && !practiceLeaks(p, c, s) ? p : null;
}

/** The session item a practice id stands in for. */
export const practiceParent = <C extends { id: string }>(id: string | null | undefined, challenges: readonly C[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

/** Which help starts shown from the generator's support tier and aids (a starting position, not a pull). */
export function startsShown(c: SkipItem, s: Pick<SkipLeverSession, 'showOptions' | 'supportTier'>): string[] {
  const o = s.showOptions ?? {}, easy = s.supportTier === 'easy';
  const on: Record<string, boolean> = {
    [TICK_NUMBERS]: o.showTrackLabels !== false, [COUNT_TRAIL]: o.showSequenceChips !== false, [ARRAY_ROWS]: !!o.showArray,
    [JUMP_SIZES]: easy, [STEP_ARCS]: easy, [HOP_DOTS]: easy, [JUMP_MARKS]: easy,
  };
  return SKIP_LEVERS.idsFor(c.type).filter(id => on[id]);
}

// ── the lever set ──────────────────────────────────────────────────────────

/** What the screen holds that a lever reads: the lesson, where the character stands, and who it is. */
export interface SkipLeverContext { session: SkipLeverSession; position: number; character?: string }

const NEVER = 'Never say the next landing.';
const ALL = SKIP_MISSES;

/** Declared in the order the tutor reaches for them. */
export const SKIP_LEVERS = leverSet<SkipItem, SkipLeverContext>({
  modeOf: c => c.type,
  missesOf: mode => SKIP_MISSES[mode as SkipMode] ?? [],
  support: { tier: c => c.supportTier ?? 'medium', different: 'another count on a small number line, with its jump size '
    + 'written over each jump', own: 'this line\'s jump size' },
  specs: [
    { id: TICK_NUMBERS, type: 'legend', modes: ['count_along'], answers: ALL.count_along,
      when: 'The learner taps past the next landing: they lose track of where the count is.',
      does: `Writes the numbers of the count under their ticks. You may read the numbers already landed on. ${NEVER}`,
      fact: (_on: unknown, c, { character }) => leverFact(TICK_NUMBERS, c.line, character) },
    { id: COUNT_TRAIL, type: 'layout', modes: ['count_along'], answers: ALL.count_along,
      when: 'The learner taps past the next landing.',
      does: `Shows the written row of the learner's own landings, ending "→ ?". You may read the row with them. ${NEVER}`,
      fact: (_on: unknown, c, { character }) => leverFact(COUNT_TRAIL, c.line, character) },
    { id: JUMP_SIZES, type: 'marks', modes: ['predict'], answers: ['added_one', 'two_jumps', 'near_miss', 'off_count', 'stayed_put'],
      when: 'The learner adds the wrong amount: one, two jumps, or a near number.',
      does: `Writes the jump size over each jump already made; nothing past the character. You may point to the jumps; ${NEVER}`,
      offer: (c, { position }) => position !== c.line.startFrom,
      fact: (_on: unknown, c, { character }) => leverFact(JUMP_SIZES, c.line, character) },
    { id: COUNT_TRAIL, type: 'layout', modes: ['predict'], answers: ['stayed_put', 'wrong_way', 'two_jumps'],
      when: 'The learner gives the number it is on, or goes the wrong way.',
      does: `Shows the written row of landings so far, ending "→ ?". You may read the row with them. ${NEVER}`,
      fact: (_on: unknown, c, { character }) => leverFact(COUNT_TRAIL, c.line, character) },
    { id: STEP_ARCS, type: 'marks', modes: ['fill_missing'], answers: ['near_miss', 'off_count', 'not_a_gap'],
      when: 'The learner types a number that is not in the count, or one already shown.',
      does: 'Draws an arc with the jump size between every two neighbouring numbers; each gap keeps its "?". You may point '
        + 'to the number before a gap; never say a missing number.',
      fact: (_on: unknown, c, { character }) => leverFact(STEP_ARCS, c.line, character) },
    { id: RING_GAPS, type: 'marks', modes: ['fill_missing'], answers: ['already_filled', 'not_a_gap'],
      when: 'The learner types a number already on the line or already filled.',
      does: 'Rings each "?" still to fill. You may point to the rings; never say a missing number.',
      fact: (_on: unknown, c, { character }) => leverFact(RING_GAPS, c.line, character) },
    { id: HOP_DOTS, type: 'marks', modes: ['find_skip_value'],
      answers: ['one_short', 'one_over', 'short_by_more', 'over_by_more', 'half_the_step', 'twice_the_step'],
      when: 'The learner\'s jump size is off by one or more, or is double or half.',
      does: 'Puts an unnumbered dot on each whole number passed over in the first three jumps. You may point to the dots; '
        + 'never count them or say the jump size.',
      content: c => hopDots(c.line),
      fact: DOTS_FACT },
    { id: MODEL_COUNT, type: 'model', modes: ['find_skip_value'], answers: ['twice_the_step', 'half_the_step', 'typed_a_landing'],
      when: 'The learner types a landing, or double or half the jump size.',
      does: 'Draws a small number line beside the item counting by another step, with its jump size written over each jump. '
        + 'You may compare the two lines; never say the item\'s jump size.',
      content: c => countModel(c),
      fact: (m: CountModel) => modelFact(m) },
    { id: JUMP_MARKS, type: 'marks', modes: ['connect_multiplication'], answers: ['counted_start', 'one_short', 'short_by_more', 'over_by_more'],
      when: 'The learner\'s count of jumps is off: one more, one fewer, or further.',
      does: 'Draws every jump as its own arc in alternating colours, with no numbers. You may point along the arcs; never '
        + 'count them to the end or say how many.',
      fact: (_on: unknown, c, { character }) => leverFact(JUMP_MARKS, c.line, character) },
    { id: ARRAY_ROWS, type: 'layout', modes: ['connect_multiplication'], answers: ['typed_product', 'typed_skip', 'counted_start'],
      when: 'The learner types the number reached or the jump size instead of the number of jumps.',
      does: 'Shows an array, one row of squares for each jump. You may say each row is one jump; never count the rows or '
        + 'say how many.',
      fact: (_on: unknown, c, { character }) => leverFact(ARRAY_ROWS, c.line, character) },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', answers: 'all',
      when: 'The learner cannot do this item even with the help on screen: a plainer, shorter count first.',
      does: 'Opens an ungraded practice count of the same kind, plainer and shorter; then this item comes back blank.',
      content: (c, { session }) => practiceItem(c, session) },
  ],
});
