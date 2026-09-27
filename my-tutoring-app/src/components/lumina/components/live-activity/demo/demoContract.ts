/**
 * Composed demonstrations (LA-15 pilot, extends LA-12's teaching moves).
 *
 * A demonstration is ONE teaching move drawn on ONE representation piece — a view taken
 * out of a full primitive (number line, place-value columns, clock face). The model
 * supplies the example values and the move; code builds every frame and every caption,
 * so a caption cannot state a relationship the drawing does not hold. Same division as
 * `moveContract.ts`: the model supplies scope, code supplies structure.
 *
 * Pure and client-safe. The authoring call lives in `service/manifest/composeDemonstration.ts`.
 */

export const DEMO_PIECES = ['number-line', 'place-value', 'clock'] as const;
export type DemoPiece = (typeof DEMO_PIECES)[number];

/** Operations each piece can draw. The authoring schema is built from this table. */
export const DEMO_OPERATIONS = {
  'number-line': ['add', 'subtract'],
  'place-value': ['compare', 'make-a-ten'],
  clock: ['minutes-from-numeral'],
} as const satisfies Record<DemoPiece, readonly string[]>;
export type DemoOperation = (typeof DEMO_OPERATIONS)[DemoPiece][number];

/** What each piece + operation draws, in the words the authoring model reads. */
export const DEMO_MENU = `- number-line / add, subtract: hops along a number line, one hop at a time. values = [start, change]. With denominator > 1 every value counts in that unit fraction (denominator 6, values [1, 3] = 1/6 + 3/6), and the ticks are those unit fractions. Up to 10 hops.
- place-value / compare: two whole numbers (up to 9,999) in place-value columns, compared from the largest place down, stopping at the first place that differs. values = [a, b].
- place-value / make-a-ten: a pile of 10 to 18 ones in the ones column, ten of them bundled into one ten, then written as tens and ones. values = [ones].
- clock / minutes-from-numeral: a clock face with the minute hand on a numeral; counts by fives around the face to that numeral. values = [hour 1-12, numeral 1-11].`;

export type Tone = 'plain' | 'focus' | 'done' | 'faded';

export interface NumberLineView {
  piece: 'number-line';
  /** All positions are integers in units of 1/denominator. */
  denominator: number;
  min: number;
  max: number;
  marks: Array<{ at: number; tone: Tone }>;
  hops: Array<{ from: number; to: number; label: string }>;
}
export interface PlaceValueView {
  piece: 'place-value';
  places: string[];
  rows: Array<{ label: string; digits: Array<number | null> }>;
  /** Index into `places` currently compared, or null. */
  focusPlace: number | null;
  /** make-a-ten: loose ones drawn in the ones column and bundles in the tens column. */
  looseOnes?: number;
  bundles?: number;
}
export interface ClockView {
  piece: 'clock';
  hour: number;
  minuteNumeral: number;
  /** Numerals labelled with their minutes (":05", ":10", ...). */
  labelled: number[];
}
export type DemoView = NumberLineView | PlaceValueView | ClockView;

export interface DemoFrame { view: DemoView; caption: string }

export interface Demonstration {
  piece: DemoPiece;
  operation: DemoOperation;
  title: string;
  frames: DemoFrame[];
  /** What the tutor should point at while it plays; from the authoring model, logged. */
  focus: string;
  answerExposure: 'partial';
}

/** The authoring model's output, flat for schema reliability. */
export interface DemoScript {
  piece: DemoPiece;
  operation: DemoOperation;
  values: number[];
  denominator?: number;
  focus: string;
  /** The values of the student's own problem, so code can refuse a demonstration of it. */
  studentValues: number[];
}

const PLACE_NAMES = ['thousands', 'hundreds', 'tens', 'ones'];
const fmt = (n: number, d: number) => (d === 1 ? String(n) : n === 0 ? '0' : `${n}/${d}`);
const grouped = (n: number) => n.toLocaleString('en-US');
const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const UNIT_NAMES: Record<number, [string, string]> = { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['fourth', 'fourths'], 5: ['fifth', 'fifths'],
  6: ['sixth', 'sixths'], 8: ['eighth', 'eighths'], 10: ['tenth', 'tenths'], 12: ['twelfth', 'twelfths'] };

/** The value set that would make this demonstration the student's own problem. */
function answerKey(operation: string, values: number[], denominator = 1): string {
  if (operation === 'minutes-from-numeral') return `clock:${values[1]}`;
  if (operation === 'compare') return `compare:${[...values].sort((a, b) => a - b).join(',')}`;
  if (operation === 'make-a-ten') return `ten:${values[0]}`;
  return `${operation}:${denominator}:${values.join(',')}`;
}

/** Why this script cannot be drawn, or null. */
export function demoRefusal(s: DemoScript): string | null {
  if (!(DEMO_PIECES as readonly string[]).includes(s.piece)) return `Unknown piece ${s.piece}.`;
  if (!(DEMO_OPERATIONS[s.piece] as readonly string[]).includes(s.operation)) return `${s.piece} cannot draw ${s.operation}.`;
  const v = s.values ?? [];
  const d = s.denominator ?? 1;
  switch (s.operation) {
    case 'add': case 'subtract': {
      if (!int(d, 1, 12) || v.length !== 2 || !int(v[0], 0, 100 * d) || !int(v[1], 1, 10)) return 'number-line needs [start, change] with change 1-10.';
      if (s.operation === 'subtract' && v[1] > v[0]) return 'Cannot subtract past zero.';
      break;
    }
    case 'compare':
      if (v.length !== 2 || !int(v[0], 0, 9999) || !int(v[1], 0, 9999) || v[0] === v[1]) return 'compare needs two different whole numbers up to 9,999.';
      break;
    case 'make-a-ten':
      if (v.length !== 1 || !int(v[0], 10, 18)) return 'make-a-ten needs [ones] from 10 to 18.';
      break;
    case 'minutes-from-numeral':
      if (v.length !== 2 || !int(v[0], 1, 12) || !int(v[1], 1, 11)) return 'clock needs [hour 1-12, numeral 1-11].';
      break;
  }
  if (s.studentValues?.length && answerKey(s.operation, s.studentValues, d) === answerKey(s.operation, v, d))
    return "This is the student's own problem; demonstrate a different example.";
  // Same answer is a leak too: 1/5 + 2/5 hands over the answer to 2/5 + 1/5.
  if ((s.operation === 'add' || s.operation === 'subtract') && s.studentValues?.length === 2) {
    const result = (x: number[]) => (s.operation === 'add' ? x[0] + x[1] : x[0] - x[1]);
    if (result(s.studentValues) === result(v)) return "This example has the same answer as the student's problem; choose one with a different answer.";
  }
  return null;
}

function numberLine(s: DemoScript): { title: string; frames: DemoFrame[] } {
  const d = s.denominator ?? 1;
  const [start, change] = s.values;
  const dir = s.operation === 'add' ? 1 : -1;
  const end = start + dir * change;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const min = d === 1 ? Math.max(0, lo - 2) : 0;
  const max = d === 1 ? hi + 2 : Math.max(d, Math.ceil(hi / d) * d);
  const unit = d === 1 ? 'one' : `1/${d}`;
  const hops: NumberLineView['hops'] = [];
  const frames: DemoFrame[] = [{
    view: { piece: 'number-line', denominator: d, min, max, marks: [{ at: start, tone: 'focus' }], hops: [] },
    caption: `Start at ${fmt(start, d)}. We are standing here; we have not hopped yet.`,
  }];
  for (let i = 1; i <= change; i++) {
    const from = start + dir * (i - 1);
    const to = start + dir * i;
    hops.push({ from, to, label: String(i) });
    if (i === 1 || i === change) {
      frames.push({
        view: { piece: 'number-line', denominator: d, min, max, marks: [{ at: start, tone: 'faded' }, { at: to, tone: i === change ? 'done' : 'focus' }], hops: [...hops] },
        caption: i === 1
          ? `Hop 1 moves ${unit} ${dir > 0 ? 'forward' : 'back'} and lands on ${fmt(to, d)}.`
            + (d === 1 ? ' The first number we count is where we land, not where we started.' : ` One hop is one ${UNIT_NAMES[d]?.[0] ?? `1/${d}`}.`)
          : `Hop ${i} lands on ${fmt(to, d)}. ${change} hops, so ${fmt(start, d)} ${dir > 0 ? '+' : '−'} ${fmt(change, d)} = ${fmt(end, d)}.`
            + (d > 1 ? ` Every hop was one ${UNIT_NAMES[d]?.[0] ?? `1/${d}`}; the size of the pieces never changed, only how many.` : ''),
      });
    }
  }
  return { title: d > 1 ? `Hopping in ${UNIT_NAMES[d]?.[1] ?? `steps of 1/${d}`}` : `${dir > 0 ? 'Counting on' : 'Counting back'}, one hop at a time`, frames };
}

function placeValue(s: DemoScript): { title: string; frames: DemoFrame[] } {
  if (s.operation === 'make-a-ten') {
    const [ones] = s.values;
    const base: Omit<PlaceValueView, 'rows' | 'focusPlace'> = { piece: 'place-value', places: ['tens', 'ones'] };
    return { title: 'Ten ones make one ten', frames: [
      { view: { ...base, rows: [{ label: `${ones} ones`, digits: [null, null] }], focusPlace: 1, looseOnes: ones, bundles: 0 },
        caption: `Here are ${ones} ones. That is too many for the ones place: it can only hold 0 to 9.` },
      { view: { ...base, rows: [{ label: `${ones} ones`, digits: [null, null] }], focusPlace: 0, looseOnes: ones - 10, bundles: 1 },
        caption: `Bundle ten of them. Ten ones make one ten, so the bundle moves to the tens place. ${ones - 10} ones are left.` },
      { view: { ...base, rows: [{ label: String(ones), digits: [1, ones - 10] }], focusPlace: null, looseOnes: ones - 10, bundles: 1 },
        caption: `Write 1 in the tens place and ${ones - 10} in the ones place: ${ones}. One digit per place.` },
    ] };
  }
  const [a, b] = s.values;
  const width = Math.max(String(a).length, String(b).length);
  const places = PLACE_NAMES.slice(4 - width);
  const digitsOf = (n: number) => String(n).padStart(width, ' ').split('').map(c => (c === ' ' ? null : Number(c)));
  const rows = [{ label: grouped(a), digits: digitsOf(a) }, { label: grouped(b), digits: digitsOf(b) }];
  const view = (focusPlace: number | null): PlaceValueView => ({ piece: 'place-value', places, rows, focusPlace });
  const frames: DemoFrame[] = [{ view: view(null), caption: `Line up ${grouped(a)} and ${grouped(b)} by place. Start with the biggest place.` }];
  for (let i = 0; i < width; i++) {
    const [x, y] = [rows[0].digits[i] ?? 0, rows[1].digits[i] ?? 0];
    if (x === y) { frames.push({ view: view(i), caption: `Both have ${x} ${places[i]}. Same, so look at the next place.` }); continue; }
    const [big, small] = x > y ? [a, b] : [b, a];
    frames.push({ view: view(i), caption: `${Math.max(x, y)} ${places[i]} is more than ${Math.min(x, y)} ${places[i]}, so ${grouped(big)} is greater than ${grouped(small)}. The smaller places cannot catch up, even if they are 9s.` });
    break;
  }
  return { title: 'Compare from the biggest place', frames };
}

function clock(s: DemoScript): { title: string; frames: DemoFrame[] } {
  const [hour, numeral] = s.values;
  const upto = Array.from({ length: numeral }, (_, i) => i + 1);
  const mm = String(numeral * 5).padStart(2, '0');
  return { title: 'Each number is 5 minutes', frames: [
    { view: { piece: 'clock', hour, minuteNumeral: numeral, labelled: [] },
      caption: `The long hand points to the ${numeral}. That ${numeral} does not mean ${numeral} minutes.` },
    { view: { piece: 'clock', hour, minuteNumeral: numeral, labelled: upto.slice(0, Math.min(3, numeral)) },
      caption: `Count by fives from the 12: ${upto.slice(0, Math.min(3, numeral)).map(n => n * 5).join(', ')}. Each number on the clock is 5 more minutes.` },
    { view: { piece: 'clock', hour, minuteNumeral: numeral, labelled: upto },
      caption: `Keep counting by fives to the ${numeral}. That makes ${numeral * 5} minutes, so the time is ${hour}:${mm}.` },
  ] };
}

/** Code builds the whole demonstration from a validated script. Throws on a refused script. */
export function buildDemonstration(s: DemoScript): Demonstration {
  const refusal = demoRefusal(s);
  if (refusal) throw new Error(refusal);
  const built = s.piece === 'number-line' ? numberLine(s) : s.piece === 'place-value' ? placeValue(s) : clock(s);
  return { piece: s.piece, operation: s.operation, focus: s.focus, answerExposure: 'partial', ...built };
}
