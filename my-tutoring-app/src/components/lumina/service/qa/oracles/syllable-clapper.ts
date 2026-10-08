import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray } from './helpers';
import { SYLLABLE_WORDS } from '../../../primitives/visual-primitives/literacy/syllableBuildWords';
import { askableLetterItem, type LetterBuildItem } from '../../../primitives/visual-primitives/literacy/letterBuild';

/**
 * Syllable-clapper oracle, `build_parts` (the open build: make a word with N parts from syllable cards). The component
 * counts the cards a learner uses and asks the word judge whether the word is real. This oracle reads the seed table
 * (the data contract: each word's spoken parts) and searches it ITSELF for every word the bank can make, rather than
 * trusting the item's own example list.
 *
 * Checks (build_parts only):
 *  - schema            : a syllables item with 2-4 parts, a bank of distinct lowercase cards, and the surface keeps it.
 *  - answer-key        : at least two seed words with exactly N parts can be made from the bank (open build), and at
 *                        least one real seed word with another count can be made too (a wrong count is a real choice).
 *  - answer-leak       : the ask names the count and no word that passes; no seed word the bank can make has two of
 *                        its parts side by side in the bank.
 *  - scope             : Kindergarten asks two or three parts; grade 1 up to four.
 *  - clustering        : the part count varies (two or more counts, never the same twice in a row; SYC-1's class), and
 *                        no item's answers repeat another item's.
 * Other challenge types are reported as unchecked.
 */
const NUMBER = ['zero', 'one', 'two', 'three', 'four', 'five'];

/** Seed words whose every part is a card in the bank. */
export const makeable = (bank: readonly string[]) =>
  Object.entries(SYLLABLE_WORDS).filter(([, parts]) => parts.every(p => bank.includes(p))).map(([w, parts]) => ({ w, parts }));

export const syllableClapperOracle: ContentOracle = {
  componentId: 'syllable-clapper',
  modes: ['build_parts'],
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    if (data.task !== 'letter_build') {
      return { violations, uncheckedTypes: Array.from(new Set(asRecordArray(data.challenges).map(c => String(c.challengeType)))), checkedChallenges: 0 };
    }
    const items = asRecordArray(data.buildItems);
    const k = /^(k|kindergarten)$/i.test(String(ctx.grade ?? data.gradeLevel ?? '').replace(/^grade\s*/i, '').trim());
    const counts: number[] = [];
    const answersSeen = new Map<string, number>();
    items.forEach((raw, i) => {
      const where = `buildItems[${i}] ${raw.id ?? ''}`.trim();
      const n = Number(raw.parts);
      const bank = Array.isArray(raw.bank) ? raw.bank.map(String) : [];
      const ask = String(raw.ask ?? '');
      if (raw.kind !== 'syllables' || !Number.isInteger(n) || n < 2 || n > 4 || !bank.length
          || new Set(bank).size !== bank.length || bank.some(c => !/^[a-z]+$/.test(c))) {
        violations.push({ check: 'schema', where, detail: `unreadable build: ${JSON.stringify({ kind: raw.kind, n, bank })}` });
        return;
      }
      if (!askableLetterItem(raw as unknown as LetterBuildItem)) violations.push({ check: 'schema', where, detail: 'the surface drops this item' });
      counts.push(n);
      const words = makeable(bank);
      const right = words.filter(x => x.parts.length === n);
      if (right.length < 2) violations.push({ check: 'answer-key-desync', where,
        detail: `${right.length} seed word(s) with ${n} parts from ${bank.join(',')}: not an open build` });
      if (!words.some(x => x.parts.length !== n)) violations.push({ check: 'answer-key-desync', where,
        detail: 'no real word with another number of parts can be made: the count is not a choice' });
      for (const x of right) {
        if (answersSeen.has(x.w) && answersSeen.get(x.w) !== i) violations.push({ check: 'clustering', where, detail: `"${x.w}" answers two items` });
        answersSeen.set(x.w, i);
      }
      if (!new RegExp(`\\b${NUMBER[n]}\\b`, 'i').test(ask)) violations.push({ check: 'schema', where, detail: `the ask does not name ${NUMBER[n]}: ${JSON.stringify(ask)}` });
      const named = right.find(x => new RegExp(`\\b${x.w}\\b`, 'i').test(ask));
      if (named) violations.push({ check: 'answer-leak', where, detail: `the ask names "${named.w}"` });
      for (const x of words) {
        const touch = x.parts.findIndex((p, j) => j > 0 && p !== x.parts[j - 1] && Math.abs(bank.indexOf(p) - bank.indexOf(x.parts[j - 1])) === 1);
        if (touch > 0) violations.push({ check: 'answer-leak', where,
          detail: `"${x.parts[touch - 1]}" and "${x.parts[touch]}" of ${x.w} sit together in the bank` });
      }
      if (n > (k ? 3 : 4)) violations.push({ check: 'scope', where, detail: `${n} parts asked at ${k ? 'Kindergarten' : 'grade 1+'}` });
    });
    if (counts.length >= 2 && new Set(counts).size < 2) violations.push({ check: 'clustering', where: 'session',
      detail: `every item asks for ${counts[0]} parts: one answer for the count` });
    counts.forEach((n, i) => { if (i > 0 && n === counts[i - 1]) violations.push({ check: 'clustering', where: `buildItems[${i}]`,
      detail: `${n} parts twice in a row` }); });
    return { violations, uncheckedTypes: [], checkedChallenges: counts.length };
  },
};
