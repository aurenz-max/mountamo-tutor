/**
 * baseTenModel — the pure block-mat model behind the base-ten-blocks DI port.
 *
 * Code owns the physics (what is on the mat, what a trade does, whether the
 * trade the child made is the one that was asked for); the tutor owns the clock
 * and the voice. Every function here is pure and total so the component, the
 * script, the generator gates and the drive harness read the SAME arithmetic —
 * the balance-scale/number-bond split that kept those ports' scenes and
 * verdicts from drifting.
 *
 * Places are powers of ten: 0 = ones, 1 = tens, 2 = hundreds, 3 = thousands.
 * `BtColumns` is indexed by place, so `columns[1]` is the ten-stick count.
 * Non-standard columns are legal by construction — a traded mat holds fifteen
 * ones on purpose, and that state is the whole point of the manipulative.
 */
import { digitWord, digitValueWord, placeWord } from './spokenNumberWords';

/** Ones through thousands. The spoken vocabulary reaches further; the MAT does
 *  not — `BaseTenBlocks` renders at most a thousands column. */
export const MAX_BT_PLACE = 3;

export type BtColumns = readonly number[];

/** What the child SEES and the tutor SAYS, per place. The mat's nouns are not
 *  the chart's place names: a child points at ten-sticks, not at "the tens
 *  place" — that symbolic vocabulary belongs to place-value-chart, which owns
 *  the digit-side asks this pack deliberately does not duplicate. */
const BLOCK_NOUNS: readonly { one: string; many: string }[] = [
  { one: 'ones cube', many: 'ones cubes' },
  { one: 'ten-stick', many: 'ten-sticks' },
  { one: 'hundred-flat', many: 'hundred-flats' },
  { one: 'thousand-block', many: 'thousand-blocks' },
];

export const blockNoun = (place: number, count: number): string => {
  const noun = BLOCK_NOUNS[place] ?? { one: placeWord(place), many: placeWord(place) };
  return count === 1 ? noun.one : noun.many;
};

/** The plural noun, for asks that do not state a count ("how many ten-sticks"). */
export const blockNounPlural = (place: number): string => blockNoun(place, 2);

export const placeValueOf = (place: number): number => Math.pow(10, place);

export const isBtPlace = (place: unknown): place is number =>
  typeof place === 'number' && Number.isInteger(place) && place >= 0 && place <= MAX_BT_PLACE;

/** How many places this number occupies (247 gives 3). */
export const magnitudeOf = (n: number): number => String(Math.abs(Math.trunc(n))).length;

export const digitAtPlace = (n: number, place: number): number =>
  Math.floor(Math.abs(Math.trunc(n)) / placeValueOf(place)) % 10;

/** Standard form as columns, ones-first. 247 becomes [7, 4, 2]. */
export function standardColumns(n: number): number[] {
  const columns: number[] = [];
  for (let place = 0; place < magnitudeOf(n); place++) columns.push(digitAtPlace(n, place));
  return columns;
}

export const columnsValue = (columns: BtColumns): number =>
  columns.reduce((total, count, place) => total + count * placeValueOf(place), 0);

/** Every place holding at least one block, HIGH to LOW. */
export const occupiedPlaces = (columns: BtColumns): number[] =>
  columns.map((_, place) => place).filter((place) => (columns[place] ?? 0) > 0).reverse();

/**
 * Break ONE block of `fromPlace` into ten of the place below. Returns null when
 * the trade is not available, so a caller never silently invents blocks.
 */
export function tradeDown(columns: BtColumns, fromPlace: number): number[] | null {
  if (!isBtPlace(fromPlace) || fromPlace < 1 || (columns[fromPlace] ?? 0) < 1) return null;
  const next = [...columns];
  next[fromPlace] -= 1;
  next[fromPlace - 1] = (next[fromPlace - 1] ?? 0) + 10;
  return next;
}

/** The mat a correct trade produces — the code-computed answer key. */
export const tradedColumns = (start: BtColumns, fromPlace: number): number[] =>
  tradeDown(start, fromPlace) ?? [...start];

export const sameColumns = (a: BtColumns, b: BtColumns): boolean => {
  const width = Math.max(a.length, b.length);
  for (let place = 0; place < width; place++) if ((a[place] ?? 0) !== (b[place] ?? 0)) return false;
  return true;
};

// ============================================================================
// Problems — one generated challenge becomes one code-owned problem
// ============================================================================

export type BtMode = 'read_blocks' | 'regroup';

export interface BtProblem {
  id: string;
  mode: BtMode;
  /** The number the mat shows in standard form before any trade. */
  target: number;
  /** read_blocks: the place the child reads. regroup: the place broken down. */
  place: number;
  /** Standard-form starting mat, ones-first. */
  start: number[];
}

/**
 * READ: the child names a place's block count and then what those blocks are
 * WORTH, so the askable place must hold blocks and must sit above the ones —
 * on the ones column "how many" and "what are they worth" have the identical
 * answer, and the second ask is an echo rather than a skill.
 */
export const readablePlaces = (n: number): number[] =>
  occupiedPlaces(standardColumns(n)).filter((place) => place >= 1 && place <= MAX_BT_PLACE);

/**
 * TRADE: only the break-DOWN direction is renderable from a standard-form start
 * (the mat cannot show "23 ones" before the child makes them), so the place
 * traded must hold at least one block and sit above the ones.
 *
 * ⭐ AND THE RECEIVING PLACE MUST ALREADY HOLD A BLOCK. With it empty the
 * prediction is not an inference, it is a repetition: the ask says "trade one
 * ten-stick for TEN ones cubes, how many ones cubes will you have then?" and
 * the answer is the word the ask just said. Worse, the whole mode is built
 * around ONE signature error — answering "ten", the blocks the trade creates,
 * with the ones already on the mat forgotten — and on an empty receiving place
 * that wrong answer IS the right answer, so `predictJudging` hands the tutor a
 * contract that calls "ten" correct and incorrect in the same breath.
 * Forty is such a number, and so is every multiple of ten. They are DROPPED
 * (keep-or-drop, never repair) and the generator re-selects an outward
 * neighbour: 40 becomes 41, which has one ones cube to add the ten to.
 */
export const tradeablePlaces = (n: number): number[] =>
  readablePlaces(n).filter((place) => digitAtPlace(n, place - 1) >= 1);

/** Rotates the subject place across a session so consecutive items differ. */
export const pickPlace = (places: readonly number[], index: number): number | null =>
  places.length ? places[index % places.length] : null;

/** Build gate: an out-of-band or place-less number yields NO problem rather
 *  than a backfilled one (keep-or-drop, never repair). */
export function btProblem(target: unknown, mode: BtMode, index: number): BtProblem | null {
  if (typeof target !== 'number' || !Number.isInteger(target) || target < 10 || target > 9999) return null;
  const place = pickPlace(mode === 'regroup' ? tradeablePlaces(target) : readablePlaces(target), index);
  if (place === null) return null;
  return { id: `base-ten-${index + 1}`, mode, target, place, start: standardColumns(target) };
}

// ============================================================================
// The spoken answers — code-computed, never generated
// ============================================================================

/** read_blocks step 1: how many blocks sit in the subject place (1-9). */
export const readCount = (problem: BtProblem): number => problem.start[problem.place] ?? 0;

/** read_blocks step 2: what those blocks are worth — "forty", "three hundred". */
export const readWorthWord = (problem: BtProblem): string =>
  digitValueWord(readCount(problem), problem.place);

/** The lower-place count BEFORE the trade — stated in the ask, so the child
 *  reasons about it instead of reading it off a mat that has already changed. */
export const startingLowerCount = (problem: BtProblem): number =>
  problem.start[problem.place - 1] ?? 0;

/** regroup step 1: the lower-place count AFTER the trade. Never above 19,
 *  because a standard-form start caps the receiving digit at 9 — which is what
 *  keeps this whole mode inside the benched `number_word_to_20` class. */
export const predictedCount = (problem: BtProblem): number => startingLowerCount(problem) + 10;

export const wordFor = (value: number): string => digitWord(value);

// ============================================================================
// Scenes — what the TUTOR is told about the mat
// ============================================================================

/**
 * THE SCENE IS AN AUDIO CHANNEL (add-di-loop defect 6). On `read_blocks` the
 * block COUNTS are exactly what the child must say, so this description names
 * none of them — it says the mat exists and states its own non-speakability,
 * and the judging contract carries the private expected value. On `regroup` the
 * ask itself states the starting counts, so naming them here leaks nothing.
 */
export function btScene(problem: BtProblem, columns: BtColumns): string {
  if (problem.mode === 'read_blocks') {
    return `A block mat with ${occupiedPlaces(columns).length} filled columns. `
      + 'The block counts and the number they make are withheld from you and are never guessed aloud.';
  }
  const parts = occupiedPlaces(columns).map((place) => `${columns[place]} ${blockNoun(place, columns[place] ?? 0)}`);
  return `Block mat: ${parts.join(', ') || 'empty'}. The trade under way is one ${blockNoun(problem.place, 1)} `
    + `for ten ${blockNounPlural(problem.place - 1)}.`;
}

/** Hands-turn coaching, code-authored — never a verdict, never the answer. */
export function btTradeFeedback(problem: BtProblem, columns: BtColumns): string {
  if (sameColumns(columns, problem.start)) {
    return `The mat has not changed yet. Tap a ${blockNoun(problem.place, 1)} to trade it.`;
  }
  if (sameColumns(columns, tradedColumns(problem.start, problem.place))) {
    return 'The blocks have moved. Look at what you have now.';
  }
  return 'That is a different move from the trade we are making. You can put the blocks back and try again.';
}

/** Code-computed hands verdict: did the child make the trade that was asked? */
export const tradeSolved = (problem: BtProblem, columns: BtColumns): boolean =>
  sameColumns(columns, tradedColumns(problem.start, problem.place));
