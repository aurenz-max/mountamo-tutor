import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray } from './helpers';

/**
 * Spelling-pattern-explorer oracle.
 *
 * Classic modes (one patternType per lesson): the dictation words are the answer key the component checks typed
 * spellings against. Checked: 1-10 dictation words of letters, none repeated, none already shown in the pattern words
 * (a word on screen is copied, not spelled), and no hint that prints its own word (answer-leak).
 *
 * pattern_build (`task: 'letter_build'`, every item `kind: 'pattern'`): there is no key; many words pass. What can be
 * wrong is an ask the board cannot answer. Re-derived here independently of the build's checker: each ask states its
 * pattern's letters and names none of its seed words; 3+ seed words contain the pattern's letters, fit the boxes
 * (6 at most) and are spelled only from bank letters; adjacent asks differ when the session has two patterns; `ways`
 * is 1 or 2.
 */
const KNOWN_TYPES = new Set(['short-vowel', 'long-vowel', 'r-controlled', 'suffix-change', 'latin-root', 'silent-letter', 'pattern-build']);
const MAX_BOXES = 6;

/** The letters a pattern id puts in a word, as a plain test: "a_e" -> a, one letter, e at the end. */
function holds(pattern: string, word: string): boolean {
  if (pattern.includes('_')) {
    const [v, e] = pattern.split('_');
    return new RegExp(`${v}[a-z]{1,2}${e}[sd]?$`).test(word);
  }
  if (pattern === 'kn' || pattern === 'wr') return word.startsWith(pattern);
  if (pattern === 'mb') return /mbs?$/.test(word);
  return word.includes(pattern);
}

function verifyBuild(items: Record<string, unknown>[]): OracleResult {
  const violations: OracleViolation[] = [];
  if (items.length < 3) violations.push({ check: 'schema', where: 'buildItems', detail: `only ${items.length} ask(s) — mastery-over-demo requires 3+` });
  let checked = 0;
  items.forEach((it, i) => {
    const where = String(it.id ?? `#${i + 1}`);
    const pattern = String(it.pattern ?? '');
    const ask = String(it.ask ?? '').toLowerCase();
    const bank = Array.isArray(it.bank) ? (it.bank as unknown[]).map(String) : [];
    const examples = Array.isArray(it.examples) ? (it.examples as unknown[]).map(String) : [];
    if (it.kind !== 'pattern' || !/^[a-z_]{2,3}$/.test(pattern)) {
      violations.push({ check: 'schema', where, detail: `kind ${JSON.stringify(it.kind)} / pattern ${JSON.stringify(it.pattern)} is not a pattern ask` });
      return;
    }
    checked++;
    if (!ask.includes(pattern)) violations.push({ check: 'schema', where, detail: `the ask "${ask}" does not state the pattern ${pattern}` });
    const named = examples.filter(w => new RegExp(`\\b${w}\\b`).test(ask));
    if (named.length) violations.push({ check: 'answer-leak', where, detail: `the ask names a passing word: ${named.join(', ')}` });
    const answerable = examples.filter(w => holds(pattern, w) && w.length <= MAX_BOXES && w.split('').every(l => bank.includes(l)));
    if (answerable.length < 3) violations.push({ check: 'answer-key-desync', where, detail: `only ${answerable.length} seed word(s) (${answerable.join(', ')}) hold ${pattern}, fit the boxes and come from the bank [${bank.join(' ')}]` });
    if (bank.length > 14) violations.push({ check: 'schema', where, detail: `bank of ${bank.length} letters (14 at most)` });
    if (it.ways !== undefined && it.ways !== 1 && it.ways !== 2) violations.push({ check: 'schema', where, detail: `ways ${JSON.stringify(it.ways)} is not 1 or 2` });
  });
  const patterns = items.map(it => String(it.pattern ?? ''));
  if (new Set(patterns).size > 1) patterns.forEach((p, i) => {
    if (i > 0 && p === patterns[i - 1]) violations.push({ check: 'clustering', where: String(items[i].id ?? `#${i + 1}`), detail: `the same pattern ${p} twice in a row` });
  });
  return { violations, uncheckedTypes: [], checkedChallenges: checked };
}

export const spellingPatternExplorerOracle: ContentOracle = {
  componentId: 'spelling-pattern-explorer',
  verify(data): OracleResult {
    if (data.task === 'letter_build') return verifyBuild(asRecordArray(data.buildItems));
    const violations: OracleViolation[] = [];
    const uncheckedTypes = KNOWN_TYPES.has(String(data.patternType ?? '')) ? [] : [String(data.patternType ?? '(missing patternType)')];
    const words = Array.isArray(data.dictationWords) ? (data.dictationWords as unknown[]).map(w => String(w).trim().toLowerCase()) : [];
    const shown = new Set((Array.isArray(data.patternWords) ? (data.patternWords as unknown[]) : []).map(w => String(w).trim().toLowerCase()));
    const hints = Array.isArray(data.dictationHints) ? (data.dictationHints as unknown[]).map(h => String(h ?? '').toLowerCase()) : [];
    if (!words.length || words.length > 10) violations.push({ check: 'schema', where: 'dictationWords', detail: `${words.length} dictation words (1-10)` });
    if (shown.size < 3) violations.push({ check: 'schema', where: 'patternWords', detail: `only ${shown.size} pattern word(s) to observe` });
    words.forEach((w, i) => {
      const where = `dictationWords[${i}]`;
      if (!/^[a-z][a-z' -]*$/.test(w)) violations.push({ check: 'schema', where, detail: `"${w}" is not a word of letters` });
      if (shown.has(w)) violations.push({ check: 'answer-leak', where, detail: `"${w}" is already on screen as a pattern word` });
      if (words.indexOf(w) !== i) violations.push({ check: 'clustering', where, detail: `"${w}" appears twice` });
      if (hints[i] && new RegExp(`\\b${w}\\b`).test(hints[i])) violations.push({ check: 'answer-leak', where, detail: `the hint "${hints[i]}" prints the word` });
    });
    return { violations, uncheckedTypes, checkedChallenges: words.length };
  },
};
