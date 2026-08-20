/**
 * spokenNameGates — the content gates every MATH judged pack needs the moment a
 * generated LABEL leaves the tutor's mouth.
 *
 * ── WHY THIS MODULE EXISTS (ordinal-line port, open decision 2) ──────────────
 *
 * `compare-objects` wrote three of these (sayability, ear-separability, and a
 * refuse-list over words that name the answer) and `ordinal-line` needed all
 * three the next port. The handoff put the choice on the table explicitly: lift
 * them, or copy them?
 *
 * LIFTED, for the reason the family already paid for once — letter-spotter's
 * two hand-synced copies of a sayability rule disagreed LIVE on what a sayable
 * sentence was (90 chars against 100), and the two sides of that wire could not
 * be reconciled by reading either one. The counter-argument in the brief is
 * real (a premature shared module is how `numberWordFor` ended up in two
 * copies) and it is answered by the shape here rather than by the decision:
 * `compareObjectsScript` RE-EXPORTS what it used to define, so its public API,
 * its generator's imports and its test file are untouched. One definition, two
 * import paths, no drift.
 *
 * ⭐ THE REFUSE-LIST IS PARAMETERISED, WHICH IS THE ACTUAL GENERALISATION.
 * Defect class 11 (a generated label that answers the ask out loud) has now bitten
 * TWICE — `compare-objects` drew *"small green bush"* against *"tall oak tree"*
 * for an ordering ask, and `ordinal-line` can draw *"First-Place Freddie"* for a
 * position ask. The SHAPE is identical and only the vocabulary differs, so the
 * scan is one function over a word list and each pack supplies its own list.
 * A third port adds a list, not a scanner.
 *
 * A label on a button is scenery; a label the tutor READS ALOUD is the question.
 */

/** The content words of a name, for ear-separability and refuse-list scans.
 *  Short function words are dropped — "the", "of", "a" distinguish nothing. */
export const contentWordsOf = (name: string): string[] =>
  name.toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter((w) => w.length > 2);

/**
 * A name the tutor can SAY and the judge can hear back. Bounds a pack's
 * generated-content surface:
 *   - real words only (a code-ish token would be read out character by
 *     character to a child);
 *   - at least three letters — `short_spoken_word` records VC-length words as
 *     unbenched at that length (the sound-swap deletion residual, #83);
 *   - at most four words, so the ask stays an ask and not a sentence.
 */
export const isSayableName = (name: unknown): name is string => {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 3) return false;
  if (!/^[a-zA-Z][a-zA-Z' -]*$/.test(trimmed)) return false;
  return trimmed.split(/\s+/).length <= 4;
};

/**
 * `closed_set_choice`'s ear-separability rule, applied to spoken names: every
 * name must carry at least one word no other name has, or an utterance fits two
 * of them and there is no honest verdict. "red block" against "blue block"
 * passes (red / blue); "block" against "small block" does NOT — the shorter
 * name is a subset of the longer, exactly the shape the class record says to
 * DROP rather than judge leniently.
 */
export const namesEarSeparable = (names: readonly string[]): boolean => {
  const lower = names.map((n) => n.trim().toLowerCase());
  if (new Set(lower).size !== lower.length) return false;
  const words = names.map(contentWordsOf);
  return words.every((own, i) => {
    if (own.length === 0) return false;
    const others = words.filter((_, j) => j !== i).flat();
    return own.some((w) => !others.includes(w));
  });
};

/**
 * ⭐ DOES THIS NAME ANSWER THE ASK OUT LOUD? (defect class 11, generalised.)
 *
 * Scans both the content words and the RAW whitespace split — the second pass
 * is what catches a two-letter or hyphen-joined tell that `contentWordsOf`
 * filters away ("Number Three" survives the first, "1st-Place Pip" needs the
 * second).
 *
 * Each pack supplies the vocabulary its own answer lives in. The list is
 * matched WHOLE-WORD, never as a substring, so "order" does not refuse
 * "border" and "ten" does not refuse "kitten".
 */
export const nameCarriesAny = (name: string, refused: readonly string[]): boolean => {
  const refuse = new Set(refused.map((w) => w.toLowerCase()));
  if (contentWordsOf(name).some((word) => refuse.has(word))) return true;
  return name
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .some((word) => refuse.has(word.replace(/[^a-z0-9']/g, '')));
};

/**
 * `compare-objects`' vocabulary: the magnitude adjectives that rank the objects
 * for the child before they have looked at the picture. Its first live
 * `order_three` draw returned *"small green bush"* / *"tall oak tree"* /
 * *"high kitchen chair"* — every machine gate passed, because the fault was in
 * the NOUN and not the key, the drawing or the menu.
 */
export const MEASURE_ADJECTIVES: readonly string[] = [
  'big', 'bigger', 'biggest', 'small', 'smaller', 'smallest',
  'large', 'larger', 'largest', 'little', 'tiny', 'huge', 'giant', 'mini', 'miniature',
  'long', 'longer', 'longest', 'short', 'shorter', 'shortest',
  'tall', 'taller', 'tallest', 'high', 'higher', 'highest', 'low', 'lower', 'lowest',
  'heavy', 'heavier', 'heaviest', 'light', 'lighter', 'lightest',
  'deep', 'deeper', 'deepest', 'shallow', 'thick', 'thin', 'wide', 'narrow',
  'full', 'empty', 'jumbo', 'oversized', 'enormous',
];

/**
 * `ordinal-line`'s vocabulary: anything that states a POSITION. A character
 * called *"First-Place Freddie"* or *"Number Three"* answers the ask out loud
 * — and on the Direction-B fork ("what place is Freddie in?") the name IS the
 * answer, verbatim.
 *
 * Cardinal words are in the list as well as ordinal ones, because the cardinal
 * form is one of this primitive's two SIGNATURE ERRORS: a character called
 * *"Three-Toed Sloth"* on a line whose third position gets asked about hands the
 * child the exact wrong answer the pack exists to refuse.
 */
export const ORDINAL_TOKENS: readonly string[] = [
  'first', 'second', 'third', 'fourth', 'fifth',
  'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  'last', 'place', 'number', 'winner', 'leader', 'front', 'back', 'position',
];
