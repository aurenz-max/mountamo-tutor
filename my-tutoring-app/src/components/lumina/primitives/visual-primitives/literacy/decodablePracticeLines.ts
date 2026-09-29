/**
 * The decodable practice pool for the reading simplify levers (handoff 22 L3): word-workout sentence reading,
 * decodable-reader, read-aloud-studio and interactive-book read-focus-word build their easier practice item here,
 * in code, never from the LLM.
 *
 * R3: a practice line never contains a word of the item (or of anything else the session prints), so reading it
 * never rehearses the item's own print. Every line is three decodable words: a name, a short-vowel verb and a
 * short-vowel word, and each line uses its own name so one clash rules out one line only.
 */

export interface PracticeLine { text: string; /** The one CVC word a read-focus practice glows. */ focus: string }

export const PRACTICE_LINES: readonly PracticeLine[] = [
  { text: 'Sam can hop.', focus: 'hop' }, { text: 'Pip got wet.', focus: 'wet' }, { text: 'Meg fed Rex.', focus: 'fed' },
  { text: 'Gus ran fast.', focus: 'ran' }, { text: 'Bob has gum.', focus: 'gum' }, { text: 'Nan met Liz.', focus: 'met' },
  { text: 'Jim cut ham.', focus: 'ham' }, { text: 'Pam sips pop.', focus: 'pop' }, { text: 'Ted zips up.', focus: 'Ted' },
  { text: 'Rob hugs Mom.', focus: 'Rob' }, { text: 'Val pets pups.', focus: 'Val' }, { text: 'Kit digs in.', focus: 'Kit' },
  { text: 'Ken fixes vans.', focus: 'Ken' }, { text: 'Dan hid a bug.', focus: 'bug' }, { text: 'Deb sat on a log.', focus: 'log' },
];

/** The words of a printed text, lower case and without punctuation. */
export const wordsOf = (text: string | undefined) =>
  (text ?? '').toLowerCase().split(/[^a-z']+/).filter(Boolean);

/** Leak rule (R3): true when the line shares any word with what the session prints. */
export const practiceLineLeak = (line: string, printed: ReadonlySet<string>) => wordsOf(line).some(w => printed.has(w));

/** The first pool line shorter than `maxWords` that shares no word with `printed`, or null. */
export function practiceLine(printed: ReadonlySet<string>, maxWords: number): PracticeLine | null {
  return PRACTICE_LINES.find(l => wordsOf(l.text).length < maxWords && !practiceLineLeak(l.text, printed)) ?? null;
}

/** Every word of these texts, for `practiceLine`. */
export const printedSet = (...texts: Array<string | undefined>) => new Set(texts.flatMap(wordsOf));
