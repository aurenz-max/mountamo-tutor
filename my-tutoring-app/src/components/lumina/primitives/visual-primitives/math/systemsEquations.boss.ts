/**
 * systems-equations-visualizer's boss (`components/live-activity/boss.ts`), bespoke because every mode is a typed pair
 * the activity checks: the card is `systemsEquations.card.ts`; this file validates a lesson, lists its systems, asks
 * one, carries the lever set and plays the harness.
 */
import type { SystemsEquationsChallenge, SystemsEquationsVisualizerData } from './SystemsEquationsVisualizer';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { onLine, pairText, systemsHarnessPoint } from './systemsEquationsWorkspace';
import { SYSTEMS_LEVERS, practiceParent, simplerItem } from './systemsEquationsLevers';
import { systemsEquationsCard, type SystemsMiss } from './systemsEquations.card';

const TYPES = ['graph', 'substitution', 'elimination'];
const num = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Reject a systems-of-equations lesson whose challenges cannot be attempted. */
export function validateSystemsEquationsData(value: unknown): SystemsEquationsVisualizerData {
  const d = value as SystemsEquationsVisualizerData;
  const range = (r: unknown) => Array.isArray(r) && r.length === 2 && num(r[0]) && num(r[1]) && r[0] < r[1];
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !range(d.xRange) || !range(d.yRange)
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated systems of equations has invalid lesson content.');
  // Each item needs what its own check reads: two drawable lines that are not parallel and both pass through the
  // item's (expectedX, expectedY), so the one point that solves both is the key the check compares against.
  for (const c of d.challenges) {
    const eqs = [c.equationA, c.equationB];
    const key = { x: c.expectedX, y: c.expectedY };
    const ok = num(c.expectedX) && num(c.expectedY)
      && eqs.every(e => e && typeof e.display === 'string' && e.display.trim() && num(e.slope) && num(e.yIntercept))
      && Math.abs(c.equationA.slope - c.equationB.slope) > 1e-9
      && eqs.every(e => onLine(e, key));
    if (!ok) throw new Error(`A systems-equations ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The item on screen in a journey: the session system, or the easier practice system a simplify lever opened. */
function currentSystem(data: SystemsEquationsVisualizerData, itemId: string): SystemsEquationsChallenge | undefined {
  const parentId = practiceParent(itemId);
  const parent = (data.challenges ?? []).find(c => c.id === parentId);
  return parent && parentId !== itemId ? simplerItem(parent) ?? undefined : parent;
}

export const systemsEquationsBoss = defineBoss<SystemsEquationsVisualizerData, SystemsEquationsChallenge, SystemsMiss>({
  card: systemsEquationsCard,
  validate: validateSystemsEquationsData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A typed pair the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: SYSTEMS_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/SystemsEquationsVisualizer.tsx',
    instanceId: 'systems',
    defaults: { grade: 'Grade 8', mode: 'graph', topic: 'Solving systems of linear equations' },
    mounted: '[data-pip-object="workspace"]',
    current: ctx => currentSystem(ctx.data as SystemsEquationsVisualizerData, String(ctx.itemId ?? '')),
    // x and y typed into their boxes, then Check. A wrong answer is the item's first signature miss
    // (`systemsHarnessPoint`): x and y swapped, a sign flipped, or one step off.
    play: (right, c) => {
      const p = systemsHarnessPoint(c, right ? 'correct' : 'wrong');
      return [{ type: 'write', label: 'x', text: String(p.x) }, { type: 'write', label: 'y', text: String(p.y) }, { type: 'check' }];
    },
    // The key as a pair, as the screen prints it once solved.
    replayKeys: ctx => {
      const c = currentSystem(ctx.data as SystemsEquationsVisualizerData, String(ctx.itemId ?? ''));
      return c ? [pairText({ x: c.expectedX, y: c.expectedY })] : [];
    },
  },
});
