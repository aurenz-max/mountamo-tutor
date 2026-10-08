import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, containsWord } from './helpers';

/**
 * Word-flip oracle, `build_inflect` (the open build, OB-8L). The surface checks a row in code (`inflectBuild.ts`): one
 * base then one ending, the ending's job matches the ask, and the ending fits the base. This oracle spells every word
 * the board can make by its own reading of English plural and past rules, without the primitive's code.
 *
 * Checks (build_inflect only):
 *  - schema      : four ending cards s, es, ies, ed with no printed meaning, ies taking the place of a last y; 4-10 base
 *                  cards, lowercase letters, a picture, an id naming the kind (noun-/verb-), no word twice.
 *  - answer-key  : every listed example is a right build by the oracle's own rule; each ask has at least two right
 *                  builds (open build) and at least as many as the words it asks for; the board offers an ending that
 *                  does not fit (a real choice); every ask that names bases ("ends in y") names only bases that end so.
 *  - answer-leak : no ask names a word that passes, and no ask names an ending (s, es, ies, ed).
 *  - scope       : no irregular base (mouse, child, run), no verb whose past doubles a consonant or drops an e.
 *  - clustering  : no ask twice; every second item asks for two words unless the tier is easy.
 * The six spoken modes are reported as unchecked.
 */
const IRREGULAR = new Set(['man', 'woman', 'child', 'foot', 'tooth', 'goose', 'mouse', 'person', 'ox', 'sheep', 'fish', 'deer',
  'go', 'run', 'eat', 'see', 'come', 'sit', 'get', 'make', 'take', 'give', 'have', 'do', 'say', 'sleep']);

/** The oracle's own plural spelling. */
function pluralOf(base: string): string {
  if (/(s|x|z|ch|sh)$/.test(base)) return `${base}es`;
  if (/y$/.test(base) && !/[aeiou]y$/.test(base)) return `${base.slice(0, -1)}ies`;
  return `${base}s`;
}

interface Card { id: string; text: string; type: string; meaning: string; replaces?: string }

/** The word a base + ending row spells, under the card's own replace rule. */
const spell = (base: Card, ending: Card) =>
  ending.replaces && base.text.endsWith(ending.replaces) ? base.text.slice(0, -ending.replaces.length) + ending.text : base.text + ending.text;

export const wordFlipOracle: ContentOracle = {
  componentId: 'word-flip',
  modes: ['build_inflect'],
  verify(data): OracleResult {
    const violations: OracleViolation[] = [];
    if (data.task !== 'build_inflect') {
      const types = new Set(asRecordArray(data.challenges).map(c => String(c.type)));
      return { violations, uncheckedTypes: Array.from(types), checkedChallenges: 0 };
    }
    const board = asRecordArray(data.availableParts) as unknown as Card[];
    const items = asRecordArray(data.buildItems);
    const endings = board.filter(p => p.type === 'suffix');
    const bases = board.filter(p => p.type === 'root');
    const byId = new Map(board.map(p => [p.id, p]));

    if (endings.map(e => e.text).sort().join(',') !== 'ed,es,ies,s')
      violations.push({ check: 'schema', where: 'board', detail: `endings ${endings.map(e => e.text).join(',')}` });
    if (endings.some(e => (e.meaning ?? '').trim()))
      violations.push({ check: 'answer-leak', where: 'board', detail: 'an ending card prints a meaning: which ending does which job is the task' });
    if (endings.find(e => e.text === 'ies')?.replaces !== 'y')
      violations.push({ check: 'schema', where: 'board', detail: 'the ies card does not take the place of a last y' });
    if (bases.length < 4 || bases.length > 10) violations.push({ check: 'schema', where: 'board', detail: `${bases.length} base cards` });
    const texts = new Set<string>();
    for (const b of bases) {
      const where = `base ${b.id}`;
      if (!/^[a-z]{2,10}$/.test(b.text) || !/^(noun|verb)-/.test(b.id) || !b.meaning || /^[a-z0-9\s]*$/i.test(b.meaning))
        violations.push({ check: 'schema', where, detail: JSON.stringify(b) });
      if (texts.has(b.text)) violations.push({ check: 'clustering', where, detail: `${b.text} twice on the board` });
      texts.add(b.text);
      if (IRREGULAR.has(b.text)) violations.push({ check: 'scope', where, detail: `${b.text} changes irregularly` });
      if (b.id.startsWith('verb-') && (/e$/.test(b.text) || /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(b.text)))
        violations.push({ check: 'scope', where, detail: `${b.text} + ed needs a spelling change the board cannot make` });
    }

    /** The right builds for an ask, by the oracle's rule: a noun and its plural ending, or a verb and ed. */
    const rightBuilds = (plural: boolean, named: readonly string[] | undefined) => {
      const pool = bases.filter(b => b.id.startsWith(plural ? 'noun-' : 'verb-') && (!named?.length || named.includes(b.id)));
      return pool.flatMap(b => {
        const ending = plural ? endings.find(e => spell(b, e) === pluralOf(b.text)) : endings.find(e => e.text === 'ed');
        return ending ? [{ base: b, ending, word: spell(b, ending) }] : [];
      });
    };

    const asks = new Set<string>();
    let checked = 0;
    items.forEach((item, i) => {
      const where = `buildItems[${i}] ${item.id ?? ''}`.trim();
      checked++;
      const ask = String(item.ask ?? '');
      const plural = item.inflect === 'plural';
      if (item.inflect !== 'plural' && item.inflect !== 'past') { violations.push({ check: 'schema', where, detail: `inflect ${item.inflect}` }); return; }
      if (asks.has(ask.toLowerCase())) violations.push({ check: 'clustering', where, detail: `ask repeated: ${ask}` });
      asks.add(ask.toLowerCase());
      if (plural !== /more than one/i.test(ask) || (!plural && !/happened|yesterday/i.test(ask)))
        violations.push({ check: 'schema', where, detail: `the ask does not state the ${item.inflect} job: ${JSON.stringify(ask)}` });
      const named = Array.isArray(item.bases) ? item.bases.map(String) : undefined;
      if (named?.length) {
        const letters = ask.match(/ends in (.+)\.$/)?.[1]?.split(' or ').map(s => s.trim()) ?? [];
        for (const id of named) {
          const b = byId.get(id);
          if (!b || !letters.some(l => b.text.endsWith(l)))
            violations.push({ check: 'answer-key-desync', where, detail: `named base ${id} does not end as the ask says (${letters.join('/')})` });
        }
      }
      const right = rightBuilds(plural, named);
      const ways = item.ways === 2 ? 2 : 1;
      if (right.length < Math.max(2, ways))
        violations.push({ check: 'answer-key-desync', where, detail: `${right.length} right builds for ${ways} word(s): ${right.map(r => r.word).join(', ')}` });
      for (const ex of Array.isArray(item.examples) ? item.examples as string[][] : []) {
        const [b, e] = ex.map(id => byId.get(id));
        if (!b || !e || ex.length !== 2 || !right.some(r => r.base === b && r.ending === e))
          violations.push({ check: 'answer-key-desync', where, detail: `example ${ex.join('+')} is not a right build` });
      }
      const fitting = new Set(right.map(r => r.ending.text));
      if (endings.every(e => fitting.has(e.text))) violations.push({ check: 'answer-key-desync', where, detail: 'every ending fits: no real choice' });
      for (const r of right) if (containsWord(ask, r.word)) violations.push({ check: 'answer-leak', where, detail: `the ask names "${r.word}"` });
      if (/(^|[\s-])(s|es|ies|ed)\b/i.test(ask.replace(/\bends in\b.*$/, '')))
        violations.push({ check: 'answer-leak', where, detail: `the ask names an ending: ${JSON.stringify(ask)}` });
      const easy = data.supportTier === 'easy';
      if (ways !== (!easy && i % 2 === 1 ? 2 : 1))
        violations.push({ check: 'clustering', where, detail: `item ${i} asks for ${ways} word(s) at tier ${data.supportTier ?? 'default'}` });
    });
    return { violations, uncheckedTypes: [], checkedChallenges: checked };
  },
};
