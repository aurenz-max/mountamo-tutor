import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkUniqueOptions, containsWord } from './helpers';

/**
 * Vocabulary-explorer oracle. This primitive shipped the canonical answer-key
 * desync (2026-07-04: correct click marked wrong via a positional correctIndex
 * fallback), so its oracle exists to make that class impossible to re-ship:
 *
 * - match: every pair's term must exist in the term bank and its definition
 *   must be the bank's definition verbatim (term↔definition desync)
 * - fill_blank: the answer is re-derived INDEPENDENTLY from relatedTermId →
 *   term.word; the shipped correctIndex must point at that word; the sentence
 *   must not leak the word outside the blank; options must be unique
 */
export const vocabularyExplorerOracle: ContentOracle = {
  componentId: 'vocabulary-explorer',
  verify(data, _ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();

    const terms = asRecordArray(data.terms);
    const termById = new Map(terms.map((t) => [String(t.id), t]));
    const termByWord = new Map(terms.map((t) => [String(t.word), t]));

    if (terms.length === 0) {
      violations.push({ check: 'schema', where: 'terms', detail: 'term bank is empty' });
    }

    let checked = 0;
    const challenges = asRecordArray(data.challenges);
    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const type = String(c.type ?? '');
      const where = `challenge#${i + 1}(${type})`;

      if (type === 'match') {
        checked++;
        for (const p of asRecordArray(c.matchPairs)) {
          const term = String(p.term ?? '');
          const bank = termByWord.get(term);
          if (!bank) {
            violations.push({ check: 'answer-key-desync', where, detail: `pair term "${term}" is not in the term bank` });
            continue;
          }
          if (String(p.definition) !== String(bank.definition)) {
            violations.push({
              check: 'answer-key-desync',
              where,
              detail: `definition desync for "${term}": pair="${String(p.definition).slice(0, 50)}…" bank="${String(bank.definition).slice(0, 50)}…"`,
            });
          }
        }
        continue;
      }

      if (type === 'fill_blank') {
        checked++;
        const options = Array.isArray(c.options) ? c.options : [];
        const correctIndex = c.correctIndex;
        const sentence = String(c.sentence ?? '');
        const expected = termById.get(String(c.relatedTermId))?.word;

        if (!Number.isInteger(correctIndex) || (correctIndex as number) < 0 || (correctIndex as number) >= options.length) {
          violations.push({ check: 'schema', where, detail: `correctIndex ${JSON.stringify(correctIndex)} out of range for ${options.length} options` });
          continue;
        }
        if (typeof expected !== 'string') {
          violations.push({ check: 'schema', where, detail: `relatedTermId "${String(c.relatedTermId)}" does not resolve to a term` });
          continue;
        }
        // The desync check: solve independently, compare to the shipped key.
        const solved = options.findIndex((o: unknown) => String(o) === expected);
        if (solved === -1) {
          violations.push({ check: 'answer-key-desync', where, detail: `expected answer "${expected}" is not among the options at all` });
        } else if (solved !== correctIndex) {
          violations.push({
            check: 'answer-key-desync',
            where,
            detail: `oracle solves to "${expected}" (index ${solved}) but shipped correctIndex=${String(correctIndex)} ("${String(options[correctIndex as number])}")`,
          });
        }
        // Answer leak: the sentence (blank removed) must not contain the answer word.
        if (containsWord(sentence.replace(/_+/g, ' '), expected)) {
          violations.push({ check: 'answer-leak', where, detail: `sentence leaks the answer "${expected}": "${sentence}"` });
        }
        const dup = checkUniqueOptions(options, where);
        if (dup) violations.push(dup);
        continue;
      }

      uncheckedTypes.add(type);
    }

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
