/**
 * Print support marks for a cold read (handoff 22 L3): the pure half of `LuminaPrintSupport`.
 *
 * A cold read is print the learner decodes before anyone says it, so these marks are visual only and never carry
 * audio. Each mark changes how the print is drawn, never which letters are printed:
 * - sound dots: one dot under each grapheme (a digraph gets one dot);
 * - tracking underline: one underline segment under each word, left to right;
 * - chunk divider: a bar between the chunks of one word (base | ending, or the two words of a compound);
 * - changed letter: the one letter that differs from the word before it.
 */

/** Two or three letters that spell one sound; each gets one dot. Longest first. */
const DIGRAPHS = ['tch', 'sh', 'ch', 'th', 'wh', 'ck', 'ng', 'qu', 'ee', 'oo', 'ai', 'ay', 'oa', 'ea', 'ar', 'or', 'er', 'ir', 'ur',
  'll', 'ss', 'ff', 'zz'];

/** A printed word split into graphemes, one per sound. Letters are unchanged and in order; punctuation is its own piece. */
export function graphemes(word: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < word.length;) {
    const g = DIGRAPHS.find(d => word.toLowerCase().startsWith(d, i)) ?? word[i];
    out.push(word.slice(i, i + g.length));
    i += g.length;
  }
  return out;
}

/** True for a piece that is a letter group (gets a dot), false for punctuation. */
export const isLetters = (piece: string) => /[a-z]/i.test(piece);

/** Leak rule for the dots: true unless they cover the word's own letters, in order, and nothing else. */
export const dotsLeak = (word: string, drawn: readonly string[]) => drawn.join('') !== word;

/**
 * Where the chunk divider goes in `word`: after the first chunk, when the word starts with it and does not end
 * there. Chunks written as sounds (`/s/`) are not print, so only the first chunk is matched against the letters.
 */
export function chunkBreak(word: string, chunks: readonly string[]): number | null {
  const first = (chunks[0] ?? '').toLowerCase();
  if (!first || /[/]/.test(first)) return null;
  return word.toLowerCase().startsWith(first) && first.length < word.length ? first.length : null;
}

/** The one letter that differs between two same-length words, or null. */
export function changedLetter(previous: string, word: string): number | null {
  if (previous.length !== word.length) return null;
  let at: number | null = null;
  for (let i = 0; i < word.length; i++) {
    if (previous[i] === word[i]) continue;
    if (at !== null) return null;
    at = i;
  }
  return at;
}

/** The words of a printed line, split the way it is printed. */
export const printedWords = (text: string) => text.trim().split(/\s+/).filter(Boolean);
