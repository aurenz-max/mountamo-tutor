/**
 * spokenNumberWords — the ONE home for integer number words in the math DI
 * family.
 *
 * qa/di/BACKLOG.md item 18 flagged `numberWordFor` at TWO hand-synced copies
 * (`diSpokenPracticeScript.ts` 1-20, `countingBoardScript.ts` 1-30) and ruled
 * that a math port must extract rather than add a third. place-value-chart is
 * the port that needed the full range — its build items DICTATE numbers up to
 * five digits ("forty-seven thousand three hundred six") — so the extraction
 * lands here. Outputs are byte-compatible with the counting-board copy over its
 * whole 0-30 range (hyphenated compounds: "twenty-three"), so existing packs
 * can delegate here without a wording change.
 *
 * American style, no "and": 306 → "three hundred six". The style is a JUDGING
 * contract as much as a TTS one — these strings are spoken verbatim inside
 * `Say exactly: "…"` spans and compared against by leak gates, so one home is
 * the difference between gates that agree and gates that drift.
 */

const ONES_WORDS: readonly string[] = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
];

const DECADE_WORDS: readonly string[] = [
  '', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
];

/** "one".."nine" for a single digit 1-9 ("zero" for 0). */
export const digitWord = (digit: number): string => ONES_WORDS[digit] ?? String(digit);

/** "ten", "twenty".."ninety" for tens 1-9 (the DECADE, i.e. digit × 10). */
export const decadeWord = (tensDigit: number): string =>
  DECADE_WORDS[tensDigit] ?? String(tensDigit * 10);

const under100 = (n: number): string => {
  if (n <= 20) return ONES_WORDS[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? DECADE_WORDS[tens] : `${DECADE_WORDS[tens]}-${ONES_WORDS[ones]}`;
};

const under1000 = (n: number): string => {
  if (n < 100) return under100(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return rest === 0
    ? `${ONES_WORDS[hundreds]} hundred`
    : `${ONES_WORDS[hundreds]} hundred ${under100(rest)}`;
};

/**
 * The spoken words for an integer 0..999,999 — "two hundred forty-seven",
 * "four hundred six", "forty-seven thousand three hundred six". Matches the
 * counting-board copy byte-for-byte on 0-30. Out-of-range values fall back to
 * digits, the same failure shape the old copies had.
 */
export const spokenIntegerWord = (n: number): string => {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) return String(n);
  if (n < 1000) return under1000(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  return rest === 0
    ? `${under1000(thousands)} thousand`
    : `${under1000(thousands)} thousand ${under1000(rest)}`;
};

// ── Place vocabulary ────────────────────────────────────────────────────────

/** Spoken column names, ones..ten thousands. Places are powers of ten. */
const PLACE_WORDS: readonly string[] = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'];

/** The highest place this vocabulary covers (ten thousands). */
export const MAX_SPOKEN_PLACE = PLACE_WORDS.length - 1;

/** "ones" | "tens" | "hundreds" | "thousands" | "ten thousands". */
export const placeWord = (place: number): string => PLACE_WORDS[place] ?? `10^${place}`;

/** Display form: "Ones", "Ten Thousands". */
export const placeLabel = (place: number): string =>
  placeWord(place).replace(/\b[a-z]/g, (c) => c.toUpperCase());

/**
 * ONE digit's worth said with place vocabulary — the `place_value_word`
 * response class, as code: (4,1) → "forty" · (3,2) → "three hundred" ·
 * (9,4) → "ninety thousand" · (1,4) → "ten thousand" · (7,0) → "seven".
 * Digit 0 has NO spoken worth here by design: "zero" is an excluded spoken
 * answer family-wide, so callers gate zero digits out before asking.
 */
export const digitValueWord = (digit: number, place: number): string => {
  switch (place) {
    case 0: return digitWord(digit);
    case 1: return decadeWord(digit);
    case 2: return `${digitWord(digit)} hundred`;
    case 3: return `${digitWord(digit)} thousand`;
    case 4: return `${decadeWord(digit)} thousand`;
    default: return `${digitWord(digit)} times ten to the ${place}`;
  }
};
