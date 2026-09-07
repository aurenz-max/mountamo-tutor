/**
 * diWorkedProcedurePlan — the CODE-OWNED step chain behind di-worked-procedure.
 *
 * The pack's thesis (design brief 2026-09-07, "DI for Older Learners"): the K-2
 * packs judge a WORD; this one judges a MOVE. The child narrates a multi-digit
 * subtraction one column at a time, and the tutor judges each step where it
 * happens. For that to be honest, the canonical chain — which columns regroup,
 * what every column reads after a lend, what each difference is — has to come
 * from code, never from the model. This module is that chain, and nothing in
 * it knows about cues, React, or Gemini.
 *
 * PILOT CONTENT GATES (every one is a "true by construction" rule so the judge
 * is never asked to discriminate something the bench cannot see):
 *  - NO ZERO DIFFERENCE IN ANY COLUMN. "zero" as a spoken answer is an owed
 *    bench check for `number_word_to_20` (di-shapes rung-2 residual), so a
 *    problem whose column lands on 0 is refused rather than shipped.
 *  - NO BORROWING ACROSS A ZERO. The cascade (300 − 148) is the G3 structural
 *    rung above this pilot; a column that must lend has to hold ≥ 1 after its
 *    own lend, or the problem is refused.
 *  - THE FLIPPED COLUMN NEVER LANDS ON THE RIGHT DIGIT. Smaller-from-larger is
 *    the signature error the judge must refuse, and for pairs where
 *    bottom − top = 5 the flip (8 − 3 = 5) equals the regrouped result
 *    (13 − 8 = 5). A judge hearing "five" could not tell them apart, so those
 *    columns are refused: on every shipped regroup column the wrong move also
 *    produces the wrong digit.
 *  - SAME WIDTH, BOTH NUMBERS. The stage is a column grid; a 2-digit minus a
 *    1-digit is a different visual (and a different skill) and is not built.
 */

// ── Number words 0..999 (the pack's spoken range) ────────────────────────────

const ONES_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS_WORDS: Record<number, string> = {
  2: 'twenty', 3: 'thirty', 4: 'forty', 5: 'fifty',
  6: 'sixty', 7: 'seventy', 8: 'eighty', 9: 'ninety',
};

/**
 * 0..999 as the tutor and the child say it: "fifty-three", "three hundred
 * forty-two", no "and". Out of range is a programmer error surfaced loudly
 * rather than an `undefined` spoken into a cue.
 */
export const numberWord = (n: number): string => {
  if (!Number.isInteger(n) || n < 0 || n > 999) {
    throw new Error(`numberWord: ${n} is outside the pack's 0..999 range`);
  }
  if (n < 20) return ONES_WORDS[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return ones === 0 ? TENS_WORDS[tens] : `${TENS_WORDS[tens]}-${ONES_WORDS[ones]}`;
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return rest === 0 ? `${ONES_WORDS[hundreds]} hundred` : `${ONES_WORDS[hundreds]} hundred ${numberWord(rest)}`;
};

// ── Places ───────────────────────────────────────────────────────────────────

export type Place = 'ones' | 'tens' | 'hundreds';
export const PLACES: readonly Place[] = ['ones', 'tens', 'hundreds'];

/** The unit ONE of the place above is worth, in this place's words:
 *  "one ten becomes ten ones", "one hundred becomes ten tens". */
export const PLACE_UNIT: Record<Place, string> = {
  ones: 'one', tens: 'ten', hundreds: 'hundred',
};

// ── The problem plan ─────────────────────────────────────────────────────────

export interface SubtractionColumn {
  index: number;
  place: Place;
  /** The digit printed on the page. */
  top: number;
  bottom: number;
  /** True when the column BELOW regrouped, so this digit lent one and now
   *  reads `top − 1` (the strike-and-write-above mark on the page). */
  lent: boolean;
  /** What the top digit reads at the moment this column is worked. */
  topAfterLend: number;
  /** True when the column must regroup from the one above (topAfterLend < bottom). */
  regroup: boolean;
  /** `topAfterLend`, plus ten when the column regrouped — the number actually subtracted from. */
  effectiveTop: number;
  /** effectiveTop − bottom, always 1..9 under the pilot gates. */
  difference: number;
}

export interface SubtractionPlan {
  minuend: number;
  subtrahend: number;
  difference: number;
  /** 2 or 3, the width of both numbers. */
  digits: number;
  /** Ones first — the order the child works them. */
  columns: SubtractionColumn[];
  regroupCount: number;
}

const digitAt = (n: number, index: number): number => Math.floor(n / 10 ** index) % 10;
const widthOf = (n: number): number => String(n).length;

/**
 * Plan one column subtraction, or return null when the pair violates a pilot
 * gate (see the module docblock). The caller never backfills a null — a
 * problem that fails here is dropped, exactly as an unaskable item is dropped
 * from a judged pack.
 */
export function planSubtraction(minuend: number, subtrahend: number): SubtractionPlan | null {
  if (!Number.isInteger(minuend) || !Number.isInteger(subtrahend)) return null;
  if (minuend <= subtrahend || subtrahend < 10 || minuend > 999) return null;
  const digits = widthOf(minuend);
  if (digits < 2 || digits > 3 || widthOf(subtrahend) !== digits) return null;

  const columns: SubtractionColumn[] = [];
  let borrow = 0;
  for (let index = 0; index < digits; index++) {
    const top = digitAt(minuend, index);
    const bottom = digitAt(subtrahend, index);
    const lent = borrow === 1;
    const topAfterLend = top - borrow;
    if (topAfterLend < 0) return null; // borrowing across a zero — the cascade rung
    const regroup = topAfterLend < bottom;
    if (regroup && index === digits - 1) return null; // cannot happen while minuend > subtrahend
    const effectiveTop = topAfterLend + (regroup ? 10 : 0);
    const difference = effectiveTop - bottom;
    if (difference === 0) return null; // "zero" is unbenched as a spoken answer
    if (regroup && bottom - topAfterLend === difference) return null; // flip == result: judge cannot discriminate
    columns.push({
      index, place: PLACES[index], top, bottom, lent, topAfterLend, regroup, effectiveTop, difference,
    });
    borrow = regroup ? 1 : 0;
  }
  return {
    minuend,
    subtrahend,
    difference: minuend - subtrahend,
    digits,
    columns,
    regroupCount: columns.filter((c) => c.regroup).length,
  };
}

// ── The pool ─────────────────────────────────────────────────────────────────

export interface ProblemShape {
  /** Width of both numbers. */
  digits: 2 | 3;
  /** How many columns must regroup. 0 = the no-regroup mode; 1 = one column
   *  (ones for 2-digit; ones OR tens for 3-digit); 2 = both (3-digit only). */
  regroups: 0 | 1 | 2;
}

export interface ProblemPair {
  minuend: number;
  subtrahend: number;
}

/**
 * The legal shape for a request: a 2-digit problem can regroup at most once,
 * and a request that cannot exist in the width is clamped rather than refused
 * (the caller reports saturation from `regroups` vs. the plan it got back).
 */
export const clampShape = (shape: ProblemShape): ProblemShape => ({
  digits: shape.digits,
  regroups: shape.digits === 2 ? (Math.min(shape.regroups, 1) as 0 | 1) : shape.regroups,
});

let seed = 0x2f6e2b1;
/** Deterministic PRNG so a test can pin a session; the generator reseeds from time. */
export const reseedProblemPool = (value: number): void => { seed = value >>> 0 || 1; };
const rand = (): number => {
  // xorshift32 — good enough for sampling problem pairs.
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0x100000000;
};
const randInt = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));

/**
 * Draw `count` distinct problems of one shape. VARIANCE is code-owned: the
 * session never drills the same ones-column fact twice (a talk-through whose
 * three problems all open "three minus eight" teaches one fact, not the
 * procedure), and every pair passes `planSubtraction`'s gates.
 *
 * Sampling, not enumeration — the 3-digit space is ~800k pairs. The attempt
 * cap is generous (the gates refuse roughly half of random pairs) and a short
 * draw is returned honestly rather than padded.
 */
export function drawProblems(shape: ProblemShape, count: number): ProblemPair[] {
  const { digits, regroups } = clampShape(shape);
  const lo = digits === 2 ? 10 : 100;
  const hi = digits === 2 ? 99 : 999;
  const out: ProblemPair[] = [];
  const seenPairs = new Set<string>();
  const seenOnesFacts = new Set<string>();
  let attempts = 0;
  while (out.length < count && attempts < 8000) {
    attempts++;
    const subtrahend = randInt(lo, hi - 1);
    const minuend = randInt(subtrahend + 1, hi);
    const key = `${minuend}-${subtrahend}`;
    if (seenPairs.has(key)) continue;
    const plan = planSubtraction(minuend, subtrahend);
    if (!plan || plan.regroupCount !== regroups) continue;
    const onesFact = `${plan.columns[0].top}-${plan.columns[0].bottom}`;
    if (seenOnesFacts.has(onesFact)) continue;
    seenPairs.add(key);
    seenOnesFacts.add(onesFact);
    out.push({ minuend, subtrahend });
  }
  return out;
}
