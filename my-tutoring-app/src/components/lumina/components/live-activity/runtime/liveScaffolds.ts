/**
 * The shared half of a primitive's misstep inventory.
 *
 * A live `scaffold` is the fourth support lane: in-item, error-specific, and it
 * never states the answer. The other three already exist and own most missteps —
 * the DI correction line (in-item, spoken, states the answer), `<primitive>Remediation`
 * (between items, from a saved observation) and `/add-support-tiers` (a difficulty
 * axis). Only what those cannot reach belongs here.
 *
 * What is shared is the SHAPE and the routing, never the pedagogy: every hint,
 * and every condition that selects it, is written beside the primitive that
 * teaches it. A hint copied between primitives encodes the wrong teaching.
 */

/** One aid, or a mode's always-available method reminder. */
export interface LiveScaffold<Item, Evidence> {
  /** Stable; the runtime keys the action and its fade on this. */
  strategyId: string;
  /**
   * The misstep this answers, in the tutor's words, as the tail of "for when …".
   * The model routes on this sentence, so it states the CONDITION, not the content.
   */
  when: string;
  /** Method only, never the answer, and speakable to a five-year-old as written. */
  hint: (item: Item) => string;
  /** Undefined = the mode's method reminder, always offered. */
  matches?: (item: Item, evidence: Evidence) => boolean;
}

/**
 * The mode's method reminder plus every misstep aid whose evidence currently fits,
 * so the tutor chooses between aids already known to apply instead of guessing.
 */
export function resolveScaffolds<Item, Evidence>(
  item: Item | null | undefined,
  evidence: Evidence,
  method: LiveScaffold<Item, Evidence> | undefined,
  aids: readonly LiveScaffold<Item, Evidence>[] = [],
): LiveScaffold<Item, Evidence>[] {
  if (!item) return [];
  return [
    ...(method ? [method] : []),
    ...aids.filter(aid => aid.matches?.(item, evidence)),
  ];
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };

/**
 * Spoken or written number → value, for ROUTING only — never for judging, which
 * belongs to the runner's own contract. Covers 0–120 because sequencing primitives
 * reach past a counting board's twenty.
 */
export const heardNumber = (text: string | null | undefined): number | null => {
  if (!text) return null;
  const digits = text.match(/\b\d{1,3}\b/);
  if (digits) return Number(digits[0]);
  const lower = text.toLowerCase();
  // "twenty-one", "ninety five": a tens word followed by a unit.
  const compound = lower.match(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[-\s]([a-z]+)\b/);
  if (compound) {
    const unit = ONES.indexOf(compound[2]);
    if (unit >= 1 && unit <= 9) return TENS[compound[1]] + unit;
  }
  // Last number word wins: a child who counts aloud ends on the total, which is
  // the same rule the judging contracts state.
  let found: number | null = null;
  for (const word of lower.match(/\b[a-z]+\b/g) ?? []) {
    const value = Object.hasOwn(TENS, word) ? TENS[word] : ONES.indexOf(word);
    if (value >= 0) found = value;
  }
  return found;
};

/** The number word for a value, or null above ninety-nine. Used only by the answer sweep. */
const wordFor = (n: number): string | null => {
  if (n >= 0 && n <= 20) return ONES[n];
  if (n > 99) return null;
  const tens = Math.floor(n / 10) * 10, unit = n % 10;
  const tensWord = Object.keys(TENS).find(k => TENS[k] === tens);
  if (!tensWord) return null;
  return unit ? `${tensWord}-${ONES[unit]}` : tensWord;
};

/**
 * Does this line state the number, as a digit or as its word? Every adoption
 * sweeps its advertised scaffolds through this, so no aid can say the answer.
 */
export const statesNumber = (text: string, n: number): boolean => {
  const word = wordFor(n);
  const alternatives = [String(n), ...(word ? [word, word.replace('-', ' ')] : [])]
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(?:${alternatives.join('|')})\\b`, 'i').test(text);
};
