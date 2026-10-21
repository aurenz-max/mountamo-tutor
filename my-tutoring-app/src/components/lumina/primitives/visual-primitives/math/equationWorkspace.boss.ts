/**
 * equation-workspace's boss (`components/live-activity/boss.ts`), bespoke because the solving modes are a run of
 * operations the activity checks one at a time, not one tap: the card is `equationWorkspace.card.ts`; this file
 * validates a lesson, lists its equations, asks one, carries the lever set and plays the harness.
 */
import type { EquationWorkspaceChallenge, EquationWorkspaceData } from './EquationWorkspace';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { equationHarnessChoices, mergeCommutingSteps, stepsDoneFrom, workspaceTask } from './equationWorkspaceDomain';
import { EQUATION_LEVERS, fewerSteps, practiceParent } from './equationWorkspaceLevers';
import { equationWorkspaceCard, type EquationMiss } from './equationWorkspace.card';

const TYPES = ['guided-solve', 'solve', 'multi-step', 'identify-operation'];

/**
 * An item the activity can check: a known type, an equation and variable, at least one solution step, and every step
 * (and the identify key) an operation the menu offers, so the right answer can be tapped.
 */
function answerable(c: EquationWorkspaceChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)) return false;
  if (typeof c.equation !== 'string' || !c.equation.trim() || typeof c.targetVariable !== 'string' || !c.targetVariable.trim()) return false;
  if (!Array.isArray(c.solutionSteps) || !c.solutionSteps.length || !Array.isArray(c.availableOperations)) return false;
  const ids = new Set(c.availableOperations.map(o => o?.id));
  if (ids.size !== c.availableOperations.length || ids.size < 2) return false;
  if (!c.solutionSteps.every(s => s && ids.has(s.operationId) && typeof s.resultLatex === 'string')) return false;
  return c.type !== 'identify-operation' || ids.has(c.correctOperationId ?? c.solutionSteps[0].operationId);
}

/** Reject an equation-workspace lesson whose items cannot be answered from their menus (merged as the component runs them). */
export const validateEquationWorkspaceData = (value: unknown) => validateChallengePool<EquationWorkspaceData>(value,
  c => answerable(c) && answerable(mergeCommutingSteps(c)),
  { pool: 'Generated equation workspace has invalid lesson content.', item: 'An equation-workspace challenge cannot be answered from its menu.' });

/** The equation on screen in a journey: the session item as the component runs it (adjacent combine steps merged), or
 *  the practice equation a simplify lever opened (`~simpler`), rebuilt from its parent with the same builder. */
function currentEquationItem(ctx: JourneyContext): EquationWorkspaceChallenge | undefined {
  const parentId = practiceParent(String(ctx.itemId ?? ''));
  const raw = ((ctx.data as EquationWorkspaceData).challenges ?? []).find(c => c.id === parentId);
  const parent = raw ? mergeCommutingSteps(raw) : undefined;
  return parent && parentId !== ctx.itemId ? fewerSteps(parent) ?? undefined : parent;
}

export const equationWorkspaceBoss = defineBoss<EquationWorkspaceData, EquationWorkspaceChallenge, EquationMiss>({
  card: equationWorkspaceCard,
  validate: validateEquationWorkspaceData,
  items: d => d.challenges.map(mergeCommutingSteps),
  ask: workspaceTask,
  // Operations the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, workspaceTask(c), null),
  levers: EQUATION_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/EquationWorkspace.tsx',
    instanceId: 'equation',
    defaults: { grade: 'Grade 8', mode: 'solve', topic: 'Solving two-step linear equations' },
    mounted: '[data-pip-object="workspace"]',
    current: currentEquationItem,
    // Every mode through its real controls, from the line the scene reports (Try again keeps the applied steps): tap
    // each remaining step's operation by its label, or under identify-operation choose one and press Check. A wrong
    // answer is the item's signature error from `equationMiss`: the opposite operation on the same number, else a
    // later step, else another operation in the menu.
    play: (right, c, ctx) => {
      const done = stepsDoneFrom(c, ctx.demand?.currentEquation as string | undefined);
      const labels = equationHarnessChoices(c, done, right ? 'correct' : 'wrong');
      if (!labels.length) throw new Error(`equation-workspace ${c.type}: no ${right ? 'correct' : 'wrong'} operation in the menu`);
      const taps = labels.map((label): DriverInput => ({ type: 'choose', label }));
      return c.type === 'identify-operation' ? [...taps, { type: 'check' }] : taps;
    },
  },
});
