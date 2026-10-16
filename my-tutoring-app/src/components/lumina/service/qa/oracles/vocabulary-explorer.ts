import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkUniqueOptions, containsWord } from './helpers';

/**
 * Vocabulary-explorer oracle. Since 2026-10-16 code builds every item from the word bank and keys it by a word's id
 * (`vocabularyExplorerWorkspace.ts`), so the 2026-07-04 answer-key desync (a positional correctIndex) cannot recur by
 * construction. What can still ship broken is what the screen shows, checked here from the data alone:
 *
 * - every item names words of the bank, and a choice item's answer is one of its choices (answer-key-desync)
 * - the mode's challenge types are the only kinds, and each one has an item (schema)
 * - a sentence or situation the learner reads never contains the answer word or a form of it; the sentence has one
 *   blank (answer-leak)
 * - a meaning in a match never contains its own word or another word of that match (answer-leak)
 * - the meaning column is not in the word column's order (answer-leak: row alignment)
 * - no two choices are the same word (schema)
 */
const MODE_KINDS: Record<string, string[]> = { explore: ['match'], recall: ['match', 'fill_blank'], apply: ['fill_blank', 'context'] };

/** A form of the word: its first 70% (at least 4 letters) at the start of a word in the text. */
function hasForm(text: string, word: string): boolean {
  if (containsWord(text, word)) return true;
  const t = ` ${text.toLowerCase()}`;
  return word.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 5)
    .some(w => t.includes(` ${w.slice(0, Math.max(4, Math.ceil(w.length * 0.7)))}`));
}

export const vocabularyExplorerOracle: ContentOracle = {
  componentId: 'vocabulary-explorer',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const terms = asRecordArray(data.terms);
    const byId = new Map(terms.map(t => [String(t.id), t]));
    const word = (id: unknown) => String(byId.get(String(id))?.word ?? '');
    if (terms.length === 0) violations.push({ check: 'schema', where: 'terms', detail: 'word bank is empty' });

    const items = asRecordArray(data.items);
    if (items.length === 0) violations.push({ check: 'schema', where: 'items', detail: 'no code-built items' });
    const kinds = MODE_KINDS[ctx.evalMode];
    if (kinds) {
      for (const k of kinds) if (!items.some(i => i.kind === k)) violations.push({ check: 'schema', where: 'items', detail: `mode ${ctx.evalMode} has no ${k} item` });
    }

    let checked = 0;
    for (const item of items) {
      const kind = String(item.kind ?? '');
      const where = `${String(item.id)}(${kind})`;
      if (kinds && !kinds.includes(kind)) violations.push({ check: 'schema', where, detail: `kind ${kind} is not a ${ctx.evalMode} task` });

      if (kind === 'match') {
        checked++;
        const ws = Array.isArray(item.terms) ? item.terms.map(String) : [];
        const ds = Array.isArray(item.defs) ? item.defs.map(String) : [];
        if ([...ws, ...ds].some(id => !byId.has(id)) || !ws.every(w => ds.includes(w))) {
          violations.push({ check: 'answer-key-desync', where, detail: 'a word or meaning is not in the bank, or a word has no meaning in the column' });
          continue;
        }
        for (const d of ds) {
          const meaning = String(byId.get(d)?.definition ?? '');
          const named = ws.filter(w => hasForm(meaning, word(w)));
          if (named.length) violations.push({ check: 'answer-leak', where, detail: `meaning of "${word(d)}" names ${named.map(word).join(', ')}` });
        }
        if (ws.length > 1 && ws.every((w, i) => ds[i] === w)) violations.push({ check: 'answer-leak', where, detail: 'the meanings are in the same order as the words' });
        continue;
      }

      if (kind === 'fill_blank' || kind === 'context') {
        checked++;
        const options = Array.isArray(item.options) ? item.options.map(String) : [];
        const key = String(item.term ?? '');
        if (!byId.has(key) || !options.includes(key) || options.some(o => !byId.has(o))) {
          violations.push({ check: 'answer-key-desync', where, detail: `answer ${key} is not among the choices, or a choice is not in the bank` });
          continue;
        }
        const t = byId.get(key)!;
        const answer = word(key);
        // The text the learner reads, derived here: the cloze with the word blanked, or the situation.
        const clueSource = kind === 'fill_blank'
          ? [t.clozeSentence, t.exampleSentence].map(s => String(s ?? '')).find(s => /_{2,}/.test(s) || containsWord(s, answer)) ?? ''
          : String(item.clue === 'definition' ? t.definition : t.scenario ?? '');
        const clue = kind === 'fill_blank' ? clueSource.replace(new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____') : clueSource;
        if (!clue.trim()) violations.push({ check: 'schema', where, detail: 'no sentence or situation to read' });
        else if (hasForm(clue.replace(/_+/g, ' '), answer)) violations.push({ check: 'answer-leak', where, detail: `the text shows "${answer}": "${clue}"` });
        if (kind === 'fill_blank' && (clue.match(/_{2,}/g) ?? []).length !== 1) violations.push({ check: 'schema', where, detail: `the sentence needs exactly one blank: "${clue}"` });
        const dup = checkUniqueOptions(options.map(word), where);
        if (dup) violations.push(dup);
        continue;
      }
      uncheckedTypes.add(kind);
    }
    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
