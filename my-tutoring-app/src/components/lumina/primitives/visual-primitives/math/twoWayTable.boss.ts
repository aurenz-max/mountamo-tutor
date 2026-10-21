/**
 * two-way-table's boss (`components/live-activity/boss.ts`), bespoke because every mode is a typed answer the activity
 * checks: the card is `twoWayTable.card.ts`; this file validates a lesson, lists its tables, asks one, carries the
 * lever set and plays the harness.
 */
import type { TwoWayTableData } from './TwoWayTable';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { locateTarget, probabilityOf, twoWayHarnessText } from './twoWayTableWorkspace';
import { TWO_WAY_LEVERS, practiceParent, simplerTable } from './twoWayTableLevers';
import { twoWayTableCard, type TwoWayMiss } from './twoWayTable.card';

const TYPES = ['joint_probability', 'marginal_distribution', 'conditional_probability', 'independence_test'];
const count = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Reject a two-way-table lesson whose challenges cannot be attempted. */
export function validateTwoWayTableData(value: unknown): TwoWayTableData {
  const d = value as TwoWayTableData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.challengeType)
        || typeof c.question !== 'string' || !c.question.trim()))
    throw new Error('Generated two-way table has invalid lesson content.');
  // Each item needs what its own check and its levers read: a full table of counts with its category names, a
  // probability between 0 and 1, and a cell, row or column of the table whose probability that is.
  for (const c of d.challenges) {
    const R = c.rowCategories?.length ?? 0, C = c.columnCategories?.length ?? 0;
    const table = Array.isArray(c.frequencies) && R >= 2 && C >= 2 && c.frequencies.length === R
      && c.frequencies.every(row => Array.isArray(row) && row.length === C && row.every(count));
    const p = c.expectedProbability;
    const target = table ? locateTarget(c) : null;
    const ok = table && typeof p === 'number' && p > 0 && p <= 1 && !!target
      && Math.abs((probabilityOf(c.challengeType, c.frequencies, target) ?? -1) - p) < 1e-3;
    if (!ok) throw new Error(`A two-way-table ${c.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

export const twoWayTableBoss = defineBoss<TwoWayTableData, TwoWayTableData['challenges'][number], TwoWayMiss>({
  card: twoWayTableCard,
  validate: validateTwoWayTableData,
  items: d => d.challenges,
  ask: c => c.question,
  // A typed probability the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.question, null),
  levers: TWO_WAY_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/TwoWayTable.tsx',
    instanceId: 'twt',
    defaults: { grade: 'Grade 8', mode: 'joint_probability', topic: 'Probability from two-way tables' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice table a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as TwoWayTableData).challenges ?? [];
      const parentId = practiceParent(String(ctx.itemId ?? ''));
      const parent = all.find(c => c.id === parentId);
      return parent && parentId !== ctx.itemId ? simplerTable(parent) ?? undefined : parent;
    },
    // A probability typed into "Your answer" and Check. A wrong answer is the item's signature miss from `twoWayMiss`
    // (the cell out of its own row, a conditional out of everyone, one cell for a marginal, the observed cell for
    // independence), else 0.3 off.
    play: (right, c) => [{ type: 'write', label: 'Your answer', text: twoWayHarnessText(c, right ? 'correct' : 'wrong') },
      { type: 'check' }],
  },
});
