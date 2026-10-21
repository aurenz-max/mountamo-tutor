/**
 * factor-tree's boss (`components/live-activity/boss.ts`), bespoke because every mode is a tree of splits the
 * activity checks: the card is `factorTree.card.ts`; this file validates a lesson, lists its trees, asks one, carries
 * the lever set and plays the harness.
 */
import type { FactorTreeData } from './FactorTree';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { factorHarnessSplits, factorizationForms, isPrime, workspaceTask } from './factorTreeWorkspace';
import { FACTOR_LEVERS, practiceParent, smallerTree } from './factorTreeLevers';
import { factorTreeCard, type FactorTreeMiss } from './factorTree.card';

/** Reject a factor-tree lesson whose challenges cannot be attempted: every root must be a composite to split. */
export function validateFactorTreeData(value: unknown): FactorTreeData {
  const d = value as FactorTreeData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id))
    throw new Error('Generated factor tree has invalid lesson content.');
  for (const c of d.challenges) {
    if (!Number.isInteger(c.rootValue) || c.rootValue < 4 || isPrime(c.rootValue))
      throw new Error(`A factor-tree challenge's number ${c.rootValue} is not a composite to split.`);
  }
  return d;
}

export const factorTreeBoss = defineBoss<FactorTreeData, FactorTreeData['challenges'][number], FactorTreeMiss>({
  card: factorTreeCard,
  validate: validateFactorTreeData,
  items: d => d.challenges,
  ask: workspaceTask,
  // Splits the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, workspaceTask(c), null),
  levers: FACTOR_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/FactorTree.tsx',
    instanceId: 'factor',
    defaults: { grade: 'Grade 5', mode: 'unguided', topic: 'Prime factorization with factor trees' },
    mounted: '[data-pip-object="workspace"]',
    // The session tree, or the practice tree a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as FactorTreeData).challenges ?? [];
      const parentId = practiceParent(String(ctx.itemId ?? ''));
      const parent = all.find(c => c.id === parentId);
      return parent && parentId !== ctx.itemId ? smallerTree(parent) ?? undefined : parent;
    },
    // Every mode through its real controls, from the leaves the scene reports (Try again keeps the right splits): tap
    // a number that is not prime ("Split 36"), type "Factor 1" and "Factor 2", press Split, until every leaf is prime.
    // A wrong answer is the first composite leaf split into its smallest prime and the partner plus one (`factorMiss`).
    play: (right, _c, ctx) => {
      const leaves = String(ctx.demand?.leaves ?? '').split(',').map(s => Number(s.trim())).filter(n => n > 0);
      if (!leaves.length) throw new Error('No factor-tree leaves in the scene');
      return factorHarnessSplits(leaves, right ? 'correct' : 'wrong').flatMap((s): DriverInput[] => [
        { type: 'choose', label: `Split ${s.value}` },
        { type: 'write', label: 'Factor 1', text: String(s.factor1) },
        { type: 'write', label: 'Factor 2', text: String(s.factor2) },
        { type: 'choose', label: 'Split' },
      ]);
    },
    // The typed factors are steps; the answer is the factorization the finished tree prints.
    replayKeys: ctx => {
      const parentId = practiceParent(String(ctx.itemId ?? ''));
      const parent = ((ctx.data as FactorTreeData).challenges ?? []).find(x => x.id === parentId);
      const c = parent && parentId !== ctx.itemId ? smallerTree(parent) : parent;
      return c ? factorizationForms(c.rootValue) : [];
    },
  },
});
