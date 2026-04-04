/**
 * Number Pool Service
 *
 * Generates grade-appropriate random number pools for Gemini generators.
 * Gemini structured output is near-deterministic — it converges on the same
 * values regardless of temperature. We own the randomness; Gemini owns the pedagogy.
 *
 * Usage in generators:
 *   const pool = createNumberPool(config?.numberRange);
 *   const promptSection = pool.toPromptSection();
 *   // Insert promptSection into Gemini prompt
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NumberRange {
  min: number;
  max: number;
}

export interface NumberPoolOptions {
  /** How many numbers to generate (default: 10) */
  count?: number;
  /** Force integers even if range has decimals (default: true) */
  integers?: boolean;
  /** Decimal precision when integers is false (default: 1) */
  decimals?: number;
  /** Ensure generated numbers have at least this many non-zero digits (default: 0 = no filter) */
  minNonZeroDigits?: number;
  /** Sort the pool ascending (default: false) */
  sorted?: boolean;
  /** Remove duplicates (default: true) */
  unique?: boolean;
}

export interface NumberPool {
  /** The generated numbers */
  numbers: number[];
  /** The range they were drawn from */
  range: NumberRange;
  /** First number — convenience for "primary value" use cases */
  primary: number;
  /** Prompt section to inject into Gemini prompt */
  toPromptSection: (opts?: PromptSectionOptions) => string;
}

export interface PromptSectionOptions {
  /** Label for the pool (default: "MANDATORY NUMBER POOL") */
  label?: string;
  /** Extra instructions appended to the section */
  extraInstructions?: string;
  /** Whether to instruct Gemini to use the first number as primary (default: true) */
  usePrimaryInstruction?: boolean;
}

// ---------------------------------------------------------------------------
// Core: random number in range
// ---------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, precision: number): number {
  const val = Math.random() * (max - min) + min;
  const factor = Math.pow(10, precision);
  return Math.round(val * factor) / factor;
}

// ---------------------------------------------------------------------------
// Ensure "interesting" numbers (multiple non-zero digits)
// ---------------------------------------------------------------------------

function ensureNonZeroDigits(n: number, minNonZero: number): number {
  if (minNonZero <= 0) return n;
  const digits = String(Math.abs(Math.floor(n))).split('').map(Number);
  const nonZeroCount = digits.filter(d => d > 0).length;
  if (nonZeroCount >= minNonZero) return n;
  // Replace zero digits with random 1-9
  const fixed = digits.map(d => d === 0 ? randInt(1, 9) : d);
  const result = Number(fixed.join(''));
  return n < 0 ? -result : result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a number pool from a manifest-provided range.
 * Returns null if no range provided (generator falls back to its own grade-band logic).
 */
export function createNumberPool(
  range: NumberRange | undefined | null,
  options?: NumberPoolOptions,
): NumberPool | null {
  if (!range) return null;

  const {
    count = 10,
    integers = true,
    decimals = 1,
    minNonZeroDigits = 0,
    sorted = false,
    unique = true,
  } = options ?? {};

  // Generate raw numbers
  const gen = integers
    ? () => randInt(range.min, range.max)
    : () => randFloat(range.min, range.max, decimals);

  // Over-generate to account for dedup and filtering
  const raw: number[] = [];
  const maxAttempts = count * 3;
  const seen = new Set<number>();

  for (let i = 0; i < maxAttempts && raw.length < count; i++) {
    let n = gen();
    if (minNonZeroDigits > 0) {
      n = ensureNonZeroDigits(n, minNonZeroDigits);
    }
    // Clamp back to range after digit fixup
    if (n < range.min) n = range.min;
    if (n > range.max) n = range.max;

    if (unique) {
      if (seen.has(n)) continue;
      seen.add(n);
    }
    raw.push(n);
  }

  const numbers = sorted ? raw.sort((a, b) => a - b) : raw;

  return {
    numbers,
    range,
    primary: numbers[0],
    toPromptSection: (opts) => buildPromptSection(numbers, range, opts),
  };
}

// ---------------------------------------------------------------------------
// Sub-range pool (for number-line style primitives)
// ---------------------------------------------------------------------------

export interface SubRangePool extends NumberPool {
  /** The display sub-range (narrower window within the full range) */
  displayRange: NumberRange;
}

/**
 * Create a number pool within a random sub-range of the full range.
 * Useful for number-line, skip-counting, and sequence primitives
 * where the display window should be narrower than the full range.
 *
 * @param spanFraction - What fraction of the full range the sub-range should be (default: 0.2-0.4)
 * @param minSpan - Minimum sub-range span (default: 5)
 */
export function createSubRangePool(
  range: NumberRange | undefined | null,
  options?: NumberPoolOptions & {
    spanFraction?: [number, number]; // [minFrac, maxFrac]
    minSpan?: number;
  },
): SubRangePool | null {
  if (!range) return null;

  const {
    spanFraction = [0.2, 0.4],
    minSpan = 5,
    count = 10,
    integers = true,
    ...rest
  } = options ?? {};

  const fullSpan = range.max - range.min;
  const subSpan = Math.max(
    Math.ceil(fullSpan * (spanFraction[0] + Math.random() * (spanFraction[1] - spanFraction[0]))),
    minSpan,
  );
  const displayMin = integers
    ? randInt(range.min, Math.max(range.min, range.max - subSpan))
    : randFloat(range.min, Math.max(range.min, range.max - subSpan), 1);
  const displayMax = integers
    ? displayMin + subSpan
    : Math.round((displayMin + subSpan) * 10) / 10;

  const displayRange: NumberRange = { min: displayMin, max: displayMax };

  const pool = createNumberPool(displayRange, { count, integers, sorted: true, ...rest });
  if (!pool) return null;

  return {
    ...pool,
    displayRange,
    toPromptSection: (opts) => buildSubRangePromptSection(pool.numbers, displayRange, range, opts),
  };
}

// ---------------------------------------------------------------------------
// Operand pair pool (for addition/subtraction/multiplication)
// ---------------------------------------------------------------------------

export interface OperandPair {
  a: number;
  b: number;
  result: number;
  operation: '+' | '-' | '×';
}

/**
 * Generate operand pairs for arithmetic primitives.
 * All values stay within the given range.
 */
export function createOperandPairs(
  range: NumberRange | undefined | null,
  operation: '+' | '-' | '×',
  count = 5,
): OperandPair[] | null {
  if (!range) return null;

  const pairs: OperandPair[] = [];
  const maxAttempts = count * 10;

  for (let i = 0; i < maxAttempts && pairs.length < count; i++) {
    const a = randInt(range.min, range.max);
    const b = randInt(range.min, range.max);
    let result: number;

    switch (operation) {
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      case '×': result = a * b; break;
    }

    // Only keep if result is within a reasonable range
    if (result >= range.min && result <= range.max * 2) {
      pairs.push({ a, b, result, operation });
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Prompt section builders
// ---------------------------------------------------------------------------

function buildPromptSection(
  numbers: number[],
  range: NumberRange,
  opts?: PromptSectionOptions,
): string {
  const label = opts?.label ?? 'MANDATORY NUMBER POOL';
  const usePrimary = opts?.usePrimaryInstruction ?? true;

  let section = `${label} (pre-selected by the adaptive system):
- Available numbers: ${numbers.join(', ')}`;

  if (usePrimary) {
    section += `\n- Use the FIRST number (${numbers[0]}) as the primary value for the activity.`;
    section += `\n- Pick from the remaining numbers for individual challenge values.`;
  } else {
    section += `\n- Pick values for challenges from this pool.`;
  }

  section += `\n- All numbers are within [${range.min}, ${range.max}] and are grade-appropriate.`;
  section += `\n- Do NOT invent your own numbers. Select from this pool only.`;

  if (opts?.extraInstructions) {
    section += `\n${opts.extraInstructions}`;
  }

  return section;
}

function buildSubRangePromptSection(
  numbers: number[],
  displayRange: NumberRange,
  fullRange: NumberRange,
  opts?: PromptSectionOptions,
): string {
  const label = opts?.label ?? 'MANDATORY NUMBER LINE VALUES';

  let section = `${label} (pre-selected by the adaptive system):
- Display range: ${displayRange.min} to ${displayRange.max}
- Number pool for challenges: ${numbers.join(', ')}
- Use the display range EXACTLY as the min/max boundaries.
- Pick challenge values from the number pool above.
- Do NOT invent your own numbers. Select from this pool only.`;

  if (opts?.extraInstructions) {
    section += `\n${opts.extraInstructions}`;
  }

  return section;
}
