/**
 * The key a spoken answer is judged against, in the one form every spoken boss shares (2026-10-18). A generator
 * writes the fields (`service/spokenKeySchema.ts`), code checks them (`spokenKeyLeaks`), and `spokenKeyText` writes
 * the sentence the tutor judges with, so the judge reads the same shape of key from every primitive.
 *
 * Three shapes: an exact answer, one word from a menu the ask says in full, and an idea judged by its meaning.
 * Pure: the server route and the catalog may import it.
 */

export interface SpokenKey {
  /** What the learner should say. On a meaning key, the shortest correct wording (an example, never required). */
  answer: string;
  /** Other answers that are equally right. */
  alsoAccept: readonly string[];
  /** A right answer that does not look right, as an instruction to the judge. */
  acceptRule?: string;
  /** A wrong answer that sounds right, as an instruction to the judge. */
  signatureError?: string;
  /** A menu key: the words the learner chooses from, all said in the ask. */
  menu?: readonly string[];
  /** A meaning key: the idea in one sentence, and what does not explain it ("the example read back"). */
  meaning?: { idea: string; notIt: string };
}

const quoted = (words: readonly string[]) => words.map(word => `"${word}"`).join(', ');
const clause = (s?: string) => (s?.trim() ? ` ${s.trim()}` : '');

/** The sentence the tutor judges with: the answer, what else counts, and what does not. */
export function spokenKeyText(key: SpokenKey): string {
  const tail = `${clause(key.acceptRule)}${clause(key.signatureError)}`;
  if (key.meaning) {
    const examples = [key.answer, ...key.alsoAccept].map(a => a.trim()).filter(Boolean);
    return `An explanation in the learner's own words that means: "${key.meaning.idea}" `
      + `For example ${quoted(examples)}, or any wording with that idea. Judge the meaning, not the words: `
      + 'the same words inside a sentence that means the opposite or a different idea are wrong, and so are '
      + `${key.meaning.notIt}.${tail}`;
  }
  const also = key.alsoAccept.length ? ` (also accept ${quoted(key.alsoAccept)})` : '';
  const menu = key.menu?.length
    ? ` The learner chooses one word from ${quoted(key.menu)}; any other word does not answer the question.` : '';
  return `"${key.answer}"${also}.${menu}${tail}`;
}

/** Lowercase word tokens, punctuation dropped. */
export const tokenize = (value: string): string[] =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** Whole-token subsequence match, so "cat" hits "the cat sat" and not "catalog". */
export const containsPhrase = (haystack: string, needle: string): boolean => {
  const hay = tokenize(haystack);
  const need = tokenize(needle);
  if (need.length === 0 || need.length > hay.length) return false;
  for (let i = 0; i + need.length <= hay.length; i++) {
    if (need.every((word, j) => hay[i + j] === word)) return true;
  }
  return false;
};

/** The answers a key accepts, non-empty. */
export const keyAnswers = (key: Pick<SpokenKey, 'answer' | 'alsoAccept'>) =>
  [key.answer, ...key.alsoAccept].filter(a => a.trim());

/**
 * Each surface (the ask, a printed stimulus, a picture's name) that names an accepted answer, with the first answer
 * it names. The caller lists only the surfaces that must not carry it: a print the learner reads aloud IS the answer.
 */
export function spokenKeyLeaks<F extends string>(key: Pick<SpokenKey, 'answer' | 'alsoAccept'>,
  surfaces: ReadonlyArray<{ field: F; text: string }>): Array<{ field: F; answer: string }> {
  const answers = keyAnswers(key);
  return surfaces.flatMap(({ field, text }) => {
    const answer = answers.find(a => containsPhrase(text, a));
    return answer ? [{ field, answer }] : [];
  });
}
