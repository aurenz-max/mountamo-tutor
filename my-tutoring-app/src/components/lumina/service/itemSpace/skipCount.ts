/**
 * Item space: skip counting (K.CC.1, 1.NBT.1/1.NBT.5, 2.NBT.2/2.NBT.8, 2.OA.3, 3.OA.7's multiples): count on
 * or back by a fixed step from a start and give the numbers that come next.
 *
 * An item is one counting line: a step, a start and a direction, run for RUN_JUMPS jumps (nine numbers).
 * Consumers draw that line: a number line runs it, a hundreds chart highlights it to the board's end, and a
 * text problem shows the first four numbers and asks the fifth. Scope (listed, about 4,500 lines): steps 2,
 * 3, 4, 5, 6, 7, 8, 9, 10, 25, 100; numbers 0 to 1000 (steps of 2, 5 and 25 stay within 200); a consumer
 * narrows it with `skipCountScope` (the grade's steps, starts and directions) and its own `accept`.
 *
 * Difficulty features (logits for a typical grade-2 learner who was taught to skip count):
 *   - tens: a step of 10 or 100 (-0.6). One digit changes and the rest stay (Fuson 1990; 1.NBT.5).
 *   - fives: a step of 5 (-0.3). The ones digit alternates 5, 0.
 *   - noPattern: a step of 3, 4, 6, 7, 8 or 9 (+0.7): no repeating ones digit, the learner adds each time
 *     (counting by 3s and 4s lags 2s, 5s, 10s in grade-2 and grade-3 data; Siegler & Robinson 1982 on
 *     counting strings; the multiplication facts' anchor families, see multDivFacts.ts).
 *   - bigStep: a step of 6 to 9 (+0.4) on top of noPattern.
 *   - quarter: a step of 25 (+0.4).
 *   - rote: the count starts at 0 or at the step itself, forward (-0.4): the memorized string ("5, 10, 15").
 *   - offMultiple: the start is not a multiple of the step (+0.6): 23, 33, 43 by 10s or the odd numbers by
 *     2s. The learner adds the step instead of reciting a known list (2.NBT.8).
 *   - backward: counting back (+0.7): backward counting strings are slower and break at decades
 *     (Fuson, Richards & Briars 1982; Baroody 1987).
 *   - crossHundred: the line passes a hundred inside it, 90, 100, 110 or 395, 405 (+0.4): the decade and
 *     hundred transitions are where counting strings break (Fuson et al. 1982; Miller & Stigler 1987).
 *   - threeDigit: the line reaches 100 or more with a step under 100 (+0.3).
 * Base -0.3. Which digits the start has beyond these (30 vs 50 by 10s) is incidental.
 * Priors; refit from first-try results when attempts exist.
 */
import type { ItemSpace } from './types';
import { linearBeta, pickSpread } from './spread';

export const RUN_JUMPS = 8;
export const SKIP_STEPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 100] as const;

export interface SkipCountFeatures {
  tens: number; fives: number; noPattern: number; bigStep: number; quarter: number;
  rote: number; offMultiple: number; backward: number; crossHundred: number; threeDigit: number;
}
export interface SkipCountItem {
  step: number;
  start: number;
  direction: 'forward' | 'backward';
  features: SkipCountFeatures;
  beta: number;
  structure: string;
}

export const SKIP_COUNT_WEIGHTS: Record<keyof SkipCountFeatures | 'base', number> = {
  base: -0.3, tens: -0.6, fives: -0.3, noPattern: 0.7, bigStep: 0.4, quarter: 0.4,
  rote: -0.4, offMultiple: 0.6, backward: 0.7, crossHundred: 0.4, threeDigit: 0.3,
};

/** The line's numbers, start first. */
export const skipRun = (it: Pick<SkipCountItem, 'step' | 'start' | 'direction'>, jumps = RUN_JUMPS): number[] =>
  Array.from({ length: jumps + 1 }, (_, i) => it.start + (it.direction === 'forward' ? i : -i) * it.step);

export function skipCountFeatures(step: number, start: number, direction: 'forward' | 'backward'): SkipCountFeatures {
  const run = skipRun({ step, start, direction });
  const lo = Math.min(...run), hi = Math.max(...run);
  // A hundred strictly inside the line (an end on 100 is a stop, not a crossing).
  let crosses = false;
  for (let h = 100; h < hi; h += 100) if (h > lo) crosses = true;
  return {
    tens: step === 10 || step === 100 ? 1 : 0,
    fives: step === 5 ? 1 : 0,
    noPattern: step >= 3 && step <= 9 && step !== 5 ? 1 : 0,
    bigStep: step >= 6 && step <= 9 ? 1 : 0,
    quarter: step === 25 ? 1 : 0,
    rote: direction === 'forward' && (start === 0 || start === step) ? 1 : 0,
    offMultiple: start % step !== 0 ? 1 : 0,
    backward: direction === 'backward' ? 1 : 0,
    crossHundred: step < 100 && crosses ? 1 : 0,
    threeDigit: step < 100 && hi >= 100 ? 1 : 0,
  };
}

/** The highest number a line of this step may reach. */
const stepCeiling = (step: number) => (step === 2 || step === 5 || step === 25 ? 200 : 1000);
/** Starts a step may take. Off-multiple starts only where a curriculum counts that way: by 10s and 100s
 *  from any number (2.NBT.8) and by 2s from an odd number (2.OA.3). By 5s from 3 is not a lesson. */
const offAllowed = (step: number) => step === 2 || step === 10 || step === 100;

function build(): SkipCountItem[] {
  const out: SkipCountItem[] = [];
  for (const step of SKIP_STEPS) {
    const top = stepCeiling(step);
    for (const direction of ['forward', 'backward'] as const) {
      for (let start = 0; start <= top; start++) {
        if (start % step !== 0 && !offAllowed(step)) continue;
        // Steps of 3 to 9 count the multiples near the facts: lines start within the first five multiples.
        if (step >= 3 && step <= 9 && step !== 5 && (direction === 'forward' ? start > 5 * step : start > 13 * step)) continue;
        const run = skipRun({ step, start, direction });
        if (Math.min(...run) < 0 || Math.max(...run) > top) continue;
        const features = skipCountFeatures(step, start, direction);
        const structure = `${step}|${direction === 'backward' ? 'back' : 'fwd'}|${features.rote ? 'rote' : features.offMultiple ? 'off' : 'on'}`
          + `${features.crossHundred ? '|x100' : features.threeDigit ? '|3d' : ''}`;
        out.push({ step, start, direction, features, beta: linearBeta(features, SKIP_COUNT_WEIGHTS), structure });
      }
    }
  }
  return out;
}

let cache: SkipCountItem[] | null = null;
export const skipCountItems = (): SkipCountItem[] => (cache ??= build());

/**
 * What a grade's skip-counting lessons allow (the scope, not the difficulty): steps, the highest number,
 * off-multiple starts and counting back. K counts by 10s to 100; grade 1 by 2s, 5s, 10s to 120 and on by
 * tens from any number; grade 2 adds 100s, 25s, odd numbers and counting back within 1000; grade 3 adds
 * the steps of the multiplication facts.
 */
export function skipCountScope(grade?: string): { steps: number[]; max: number; offStart: boolean; backward: boolean } {
  const g = (grade ?? '').trim().toUpperCase();
  if (g === 'K') return { steps: [10], max: 100, offStart: false, backward: false };
  if (g === '1') return { steps: [2, 5, 10], max: 120, offStart: true, backward: false };
  if (g === '2') return { steps: [2, 5, 10, 25, 100], max: 1000, offStart: true, backward: true };
  return { steps: [2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 100], max: 1000, offStart: true, backward: true };
}

/** A filter for one lesson: the grade's scope, narrowed to the steps the lesson names and its highest number. */
export function skipCountAccept(grade?: string, named: number[] = [], max?: number): (it: SkipCountItem) => boolean {
  const scope = skipCountScope(grade);
  const steps = named.filter((s) => (SKIP_STEPS as readonly number[]).includes(s));
  const allowed = steps.length ? steps : scope.steps;
  const top = Math.min(scope.max, max ?? scope.max);
  // A grade-1 lesson counts on from any number by 10s only (1.NBT.5); odd numbers by 2s wait for grade 2.
  return (it) => allowed.includes(it.step)
    && (scope.backward || it.direction === 'forward')
    && (it.start % it.step === 0 || (scope.offStart && (grade !== '1' || it.step === 10)))
    && Math.max(...skipRun(it)) <= top;
}

/** Text problems show four numbers and ask the fifth. */
const SHOWN = 4;

function distractors(it: SkipCountItem): { value: string; distance: 'near' | 'far' }[] {
  const run = skipRun(it);
  const answer = run[SHOWN];
  const last = run[SHOWN - 1];
  const sign = it.direction === 'forward' ? 1 : -1;
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v !== answer;
  // Near: counted by ones from the last number, counted the wrong way, one step too far.
  const near = [last + sign, last - sign * it.step, answer + sign * it.step]
    .filter(ok);
  // An off-multiple count by 10s or 100s snapped to the round number (23, 33, 43, 53 -> 60).
  if (it.features.offMultiple && it.step >= 10) near.unshift(Math.round(answer / it.step) * it.step);
  const picked: { value: string; distance: 'near' | 'far' }[] = [];
  const taken = new Set<number>([answer]);
  for (const v of near) {
    if (picked.length === (it.beta < -0.6 ? 1 : 2)) break;
    if (ok(v) && !taken.has(v)) { picked.push({ value: String(v), distance: 'near' }); taken.add(v); }
  }
  for (const k of [3, -3, 4, -4, 5, 2]) {
    if (picked.length === 3) break;
    const v = answer + k * it.step + (it.step >= 10 ? 0 : 1);
    if (ok(v) && !taken.has(v)) { picked.push({ value: String(v), distance: 'far' }); taken.add(v); }
  }
  for (let v = answer + 7; picked.length < 3; v++) if (ok(v) && !taken.has(v)) { picked.push({ value: String(v), distance: 'far' }); taken.add(v); }
  return picked;
}

const verb = (it: SkipCountItem) => `${it.direction === 'backward' ? 'Count back' : 'Count'} by ${it.step}s`;

export const SKIP_COUNT: ItemSpace<SkipCountItem> = {
  id: 'skip-count',
  describe: 'counting: skip count forward or back by 2s, 3s, 4s, 5s, 10s, 25s or 100s from a given number and say '
    + 'the numbers that come next (count by tens from 23: 23, 33, 43, ...); not counting by ones, comparing, '
    + 'or a multiplication fact',
  grades: ['K', '1', '2', '3'],
  criterion: 'Skip count from a number',
  wordingGrade: 'grade 2',
  // One start per session (by 5s from 35 and by 10s from 35 are the same opening).
  pick: (n, lo, hi, rand, accept) => pickSpread(skipCountItems(), n, lo, hi, rand, accept,
    (it) => `${it.step}|${it.start}|${it.direction}`, (it) => String(it.start)),
  items: skipCountItems,
  solve: (it) => {
    const run = skipRun(it);
    return {
      answer: String(run[SHOWN]),
      // The step is a given quantity too ("Count by 10s").
      shown: [String(it.step), ...run.slice(0, SHOWN).map(String)],
      spec: `${verb(it).toLowerCase()}: ${run.slice(0, SHOWN).join(', ')}, ? (the next number in the count; `
        + `every number is ${it.step} ${it.direction === 'backward' ? 'less' : 'more'} than the one before)`,
      // The task is reading the count. Told as a story the numbers became things ("her 120, 130, 140 buttons
      // using 10 extra ones", 10-14 probe), so the question prints the count itself.
      equation: `${verb(it)}: ${run.slice(0, SHOWN).join(', ')}, ?`,
    };
  },
  distractors: (it) => distractors(it),
  plainQuestion: (it) => `${verb(it)}: ${skipRun(it).slice(0, SHOWN).join(', ')}, ?. What number comes next?`,
};

/**
 * The lines for a tier inside one lesson's scope. When every tier's band holds `n` drawable lines, the band
 * decides. A narrow scope (a by-5s grade-1 lesson; a forward count on a board of 100) never reaches the hard
 * band, and its lines share few betas (45 odd-number counts at 0.3), so item thirds (`tierPick`) put one
 * structure in hard or the same beta in medium and hard. This takes thirds of the distinct betas instead,
 * and a third too small for `min` lines widens one value toward the middle at a time, then takes only `min`.
 */
export function pickSkipLines(
  n: number, band: [number, number], accept: (it: SkipCountItem) => boolean, log?: (m: string) => void, min = n,
): SkipCountItem[] {
  const bands = [[-2.5, -0.6], [-0.6, 0.6], [0.6, 3.5]] as const;
  const drawable = skipCountItems().filter(accept);
  if (bands.every(([lo, hi]) => drawable.filter((it) => it.beta >= lo && it.beta <= hi).length >= n)) {
    return SKIP_COUNT.pick(n, band[0], band[1], undefined, accept);
  }
  const betas = Array.from(new Set(drawable.map((it) => it.beta))).sort((a, b) => a - b);
  if (!betas.length) return [];
  const t = band[0] <= bands[0][0] ? 0 : band[0] <= bands[1][0] ? 1 : 2;
  let a = Math.floor((t * betas.length) / 3);
  // Disjoint thirds: four values split 1 / 1 / 2, so medium and hard never share a beta.
  let b = Math.max(a, Math.floor(((t + 1) * betas.length) / 3) - 1);
  let picks = SKIP_COUNT.pick(n, betas[a], betas[b], undefined, accept);
  while (picks.length < Math.min(min, n) && (a > 0 || b < betas.length - 1)) {
    if (t === 0 || (t === 1 && b - a <= 1)) b = Math.min(betas.length - 1, b + 1); else a = Math.max(0, a - 1);
    picks = SKIP_COUNT.pick(Math.min(min, n), betas[a], betas[b], undefined, accept);
  }
  log?.(`this scope cannot fill every tier's band; distinct-beta third [${betas[a]}, ${betas[b]}] of ${betas.length} values`);
  return picks;
}
