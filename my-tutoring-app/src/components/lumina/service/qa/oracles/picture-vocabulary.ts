import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray } from './helpers';
import { CLASH, PAIR_PICTURES } from '../../../primitives/visual-primitives/literacy/picturePairBuild';

/**
 * Picture-vocabulary oracle, `pair_build` (the open build). The component judges a pair from the picture table: two
 * opposites are the same kind at other poles; two that go together are listed partners. This oracle reads the table
 * (the data contract) and applies its own reading of that rule to every pair on every board.
 *
 * Checks (pair_build only):
 *  - schema           : a known relation; 4-10 distinct pictures, every one in the table under that relation; the
 *                       table's partners point at each other.
 *  - answer-key       : 2+ right pairs (3+ on an item that asks for two), at least one misconception decoy (alike on
 *                       opposites, same kind on goes together), and no unlisted pair the audit found a child could
 *                       fairly call right (CLASH, an animal with a food it is not paired with).
 *  - answer-leak      : no right pair side by side or one above the other on the 4-column board; the title and the
 *                       description name no picture on any board.
 *  - clustering       : no right pair on two boards of one session.
 * Other modes are reported as unchecked.
 */
type Pic = (typeof PAIR_PICTURES)[number];
const table = new Map<string, Pic>(PAIR_PICTURES.map(p => [p.word, p]));
const COLUMNS = 4;
const pk = (a: string, b: string) => [a, b].sort().join('+');

function verdict(a: Pic, b: Pic, relation: string): 'right' | 'decoy' | 'other' {
  if (relation === 'opposite') {
    if (a.kind !== b.kind) return 'other';
    return a.pole !== b.pole ? 'right' : 'decoy';
  }
  if (a.partner === b.word && b.partner === a.word) return 'right';
  return a.kind && a.kind === b.kind ? 'decoy' : 'other';
}

export const pictureVocabularyOracle: ContentOracle = {
  componentId: 'picture-vocabulary',
  modes: ['pair_build'],
  verify(data): OracleResult {
    const violations: OracleViolation[] = [];
    if (data.task !== 'pair_build') return { violations, uncheckedTypes: [String(data.challengeType ?? 'unknown')], checkedChallenges: 0 };
    for (const p of PAIR_PICTURES) if (p.partner && table.get(p.partner)?.partner !== p.word)
      violations.push({ check: 'schema', where: `table ${p.word}`, detail: `partner ${p.partner} does not point back` });
    const items = asRecordArray(data.pairItems);
    if (!items.length) violations.push({ check: 'schema', where: 'pairItems', detail: 'no boards' });
    const tier = String(data.supportTier ?? 'medium');
    const seenRight = new Map<string, string>();
    const words = new Set<string>();
    items.forEach((item, i) => {
      const where = `pairItems[${i}] ${item.id ?? ''}`.trim();
      const relation = String(item.relation ?? '');
      const board = Array.isArray(item.board) ? item.board.map(String) : [];
      const pics = board.map(w => table.get(w));
      board.forEach(w => words.add(w));
      if (!['opposite', 'goes_with'].includes(relation) || board.length < 4 || board.length > 10 || new Set(board).size !== board.length
        || pics.some(p => !p || p.relation !== relation)) {
        violations.push({ check: 'schema', where, detail: `unreadable board: ${JSON.stringify({ relation, board })}` });
        return;
      }
      const right: string[] = [];
      let decoys = 0;
      for (let a = 0; a < board.length; a++) for (let b = a + 1; b < board.length; b++) {
        const A = pics[a]!, B = pics[b]!;
        const v = verdict(A, B, relation);
        if (v === 'right') right.push(pk(A.word, B.word));
        if (v === 'decoy') decoys++;
        if (v !== 'right' && relation === 'goes_with' && (CLASH.has(pk(A.word, B.word))
          || (A.kind === 'animal' && B.kind === 'food') || (A.kind === 'food' && B.kind === 'animal')))
          violations.push({ check: 'answer-key-desync', where, detail: `${A.word} and ${B.word} could fairly be called a pair but are judged wrong` });
      }
      const ways = tier !== 'easy' && i % 2 === 1 ? 2 : 1;
      if (right.length < (ways === 2 ? 3 : 2)) violations.push({ check: 'answer-key-desync', where,
        detail: `${right.length} right pair(s) on a board that asks for ${ways}: a closed answer or none` });
      if (!decoys) violations.push({ check: 'answer-key-desync', where, detail: `no ${relation === 'opposite' ? 'alike' : 'same-kind'} decoy: the misconception is never offered` });
      const rightSet = new Set(right);
      board.forEach((w, n) => {
        const side = n % COLUMNS < COLUMNS - 1 ? board[n + 1] : undefined;
        const below = board[n + COLUMNS];
        for (const o of [side, below]) if (o && rightSet.has(pk(w, o)))
          violations.push({ check: 'answer-leak', where, detail: `right pair ${w} and ${o} sit next to each other on the board` });
      });
      for (const r of right) {
        if (seenRight.has(r)) violations.push({ check: 'clustering', where, detail: `right pair ${r} already on ${seenRight.get(r)}` });
        else seenRight.set(r, where);
      }
    });
    const text = `${data.title ?? ''} ${data.description ?? ''}`.toLowerCase();
    for (const w of Array.from(words)) if (new RegExp(`\\b${w}\\b`).test(text))
      violations.push({ check: 'answer-leak', where: 'title/description', detail: `names a board picture: ${w}` });
    return { violations, uncheckedTypes: [], checkedChallenges: items.length };
  },
};
