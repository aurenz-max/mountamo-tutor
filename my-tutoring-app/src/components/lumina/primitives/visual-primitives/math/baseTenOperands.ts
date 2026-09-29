/**
 * Code-built operands for base-ten-blocks operate items, with an exact number of carries or borrows. The generator
 * uses them to land a tier's structural target (contract R9); the `single_regroup` lever uses them at runtime to
 * build a practice item with one regroup fewer (`baseTenLevers.ts`). Pure: the random source is a parameter, so
 * the lever can build the same practice item on every render. Digit arrays are ones-first.
 */

export type Rand = () => number;

export const randInt = (lo: number, hi: number, rand: Rand = Math.random): number =>
  lo + Math.floor(rand() * (Math.max(lo, hi) - lo + 1));
export const fromDigits = (digits: number[]): number => digits.reduce((n, d, i) => n + d * Math.pow(10, i), 0);
export const toDigits = (num: number, places: number): number[] => {
  const out: number[] = [];
  let n = Math.abs(Math.floor(num));
  for (let i = 0; i < places; i++) { out.push(n % 10); n = Math.floor(n / 10); }
  return out;
};

/** Pick [da, db] with da∈[aMin,9], db∈[bMin,9], da+db within [sumLo,sumHi]. */
function pickPair(sumLo: number, sumHi: number, aMin: number, bMin: number, rand: Rand): [number, number] {
  const lo = Math.max(sumLo, aMin + bMin);
  const hi = Math.min(Math.max(sumHi, lo), 18);
  const sum = randInt(lo, hi, rand);
  const daLo = Math.max(aMin, sum - 9);
  const daHi = Math.min(9, sum - bMin);
  const da = randInt(daLo, daHi, rand);
  const db = Math.min(9, Math.max(bMin, sum - da));
  return [da, db];
}

/**
 * Build two `places`-digit addends whose column addition produces EXACTLY
 * `carries` carry events, with NO carry out of the top column (sum stays
 * `places`-digit → in band). The lowest `carries` columns carry. When `chained`,
 * the highest carrying column carries only via the incoming carry (digits sum 9).
 */
export function buildAdditionOperands(places: number, carries: number, chained: boolean, rand: Rand = Math.random): [number, number] {
  const a = new Array(places).fill(0);
  const b = new Array(places).fill(0);
  let carryIn = 0;
  for (let i = 0; i < places; i++) {
    const top = i === places - 1;
    const aMin = top ? 1 : 0;
    const bMin = top ? 1 : 0;
    let da: number, db: number;
    if (i < carries) {
      const isChainTop = chained && i === carries - 1 && carryIn === 1;
      const sumLo = isChainTop ? 9 : Math.max(10 - carryIn, aMin + bMin);
      const sumHi = isChainTop ? 9 : 16;
      [da, db] = pickPair(sumLo, sumHi, aMin, bMin, rand);
      carryIn = 1;
    } else {
      [da, db] = pickPair(aMin + bMin, 9 - carryIn, aMin, bMin, rand);
      carryIn = 0;
    }
    a[i] = da; b[i] = db;
  }
  return [fromDigits(a), fromDigits(b)];
}

/**
 * Build minuend & subtrahend (`places`-digit) whose subtraction needs EXACTLY
 * `borrows` borrow events, with NO borrow out of the top column (M > S, both in
 * band). When `crossZero`, the minuend's tens digit is forced to 0 so the
 * ones-place borrow cascades across the zero (e.g. 305 − 78).
 */
export function buildSubtractionOperands(places: number, borrows: number, crossZero: boolean, rand: Rand = Math.random): [number, number] {
  const m = new Array(places).fill(0);
  const s = new Array(places).fill(0);
  let borrowIn = 0;
  for (let i = 0; i < places; i++) {
    const top = i === places - 1;
    const mMin = top ? 1 : 0;
    const sMin = top ? 1 : 0;
    let md: number, sd: number;
    if (i < borrows) {
      if (crossZero && i === 1) {
        md = 0; // force the across-zero column
        sd = randInt(Math.max(1, sMin), 9, rand);
      } else {
        md = randInt(mMin, 8, rand);
        const effM = md - borrowIn;
        sd = randInt(Math.max(sMin, effM + 1, 1), 9, rand);
        if (sd <= effM) sd = Math.min(9, effM + 1);
      }
      borrowIn = 1;
    } else {
      // No borrow: effective M (md - borrowIn) >= sd. TOP column forces STRICT
      // inequality so the whole minuend exceeds the subtrahend (M > S) even when
      // every lower column is equal (else a 0-borrow problem could land M == S).
      sd = randInt(sMin, 7, rand);
      const slack = top ? 1 : 0;
      md = randInt(Math.max(mMin, sd + borrowIn + slack), 9, rand);
      borrowIn = 0;
    }
    m[i] = md; s[i] = sd;
  }
  return [fromDigits(m), fromDigits(s)];
}

/** Count carry events when adding a + b across `places` columns. */
export function countCarries(a: number, b: number, places: number): number {
  const da = toDigits(a, places), db = toDigits(b, places);
  let carry = 0, n = 0;
  for (let i = 0; i < places; i++) {
    if (da[i] + db[i] + carry >= 10) { carry = 1; n++; } else carry = 0;
  }
  return n;
}

/** Count borrow events for m − s and flag whether any borrow crosses a zero. */
export function analyzeBorrows(m: number, s: number, places: number): { borrows: number; crossesZero: boolean } {
  const dm = toDigits(m, places), ds = toDigits(s, places);
  let borrow = 0, n = 0, crossesZero = false;
  for (let i = 0; i < places; i++) {
    if (dm[i] - borrow < ds[i]) {
      if (i + 1 < places && dm[i + 1] === 0) crossesZero = true;
      borrow = 1; n++;
    } else borrow = 0;
  }
  return { borrows: n, crossesZero };
}
