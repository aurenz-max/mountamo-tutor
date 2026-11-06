/**
 * marble-run-park's boss (`components/live-activity/boss.ts`), bespoke because make_the_loop is an experiment: the
 * learner runs the marble from pegs and settles on one, and the activity's own check judges it. The card is
 * `marbleRunPark.card.ts`; this file validates a lesson, lists its items, asks one and names the harness.
 */
import type { MarbleRunParkData } from './MarbleRunPark';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { marbleRunParkCard, type MarbleMiss } from './marbleRunPark.card';
import { MARBLE_TASKS, loopFair, type MarbleChallenge } from './marbleModel';
import { MARBLE_LEVERS, practiceItem, practiceParent } from './marbleLevers';

/** One item: a loop and 8 rising pegs that make a fair experiment (some fail, some get round). */
function validItem(c: MarbleChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !(MARBLE_TASKS as readonly string[]).includes(c.type)) return false;
  if (typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  if (!Number.isFinite(c.loopR) || c.loopR < 0.5 || c.loopR > 2) return false;
  if (!Array.isArray(c.pegs) || c.pegs.length !== 8 || c.pegs.some((h, i) => !Number.isFinite(h) || h <= 0 || (i > 0 && h <= c.pegs[i - 1]))) return false;
  if (typeof c.carpet !== 'boolean' || (c.goal !== 'any' && c.goal !== 'lowest')) return false;
  return loopFair(c);
}

/** Reject a marble-run session the workspace cannot run. */
export function validateMarbleRunParkData(value: unknown): MarbleRunParkData {
  const d = value as MarbleRunParkData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated marble run session has no title.');
  const items = Array.isArray(d.challenges) ? d.challenges : [];
  if (!items.length || items.length > 8 || new Set(items.map(c => c?.id)).size !== items.length || items.some(c => !validItem(c)))
    throw new Error('Generated marble run session has invalid lesson content.');
  return d;
}

export const marbleRunParkBoss = defineBoss<MarbleRunParkData, MarbleChallenge, MarbleMiss>({
  card: marbleRunParkCard,
  validate: validateMarbleRunParkData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // An experiment the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: MARBLE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/physics/MarbleRunPark.tsx',
    instanceId: 'marble',
    defaults: { grade: 'Grade 4', mode: 'make_the_loop', topic: 'Marble run: how high to start for the loop' },
    mounted: '[data-pip-object="workspace"]',
    // An easier item (`~easier`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const challenges: MarbleChallenge[] = ctx.data.challenges ?? [];
      const parent = practiceParent(ctx.itemId, challenges);
      return parent ? practiceItem(parent) ?? undefined : challenges.find(c => c.id === ctx.itemId);
    },
    // The marble rolls only as the 3D park (WebGL) runs, which the dry sweep's jsdom cannot draw
    // (journey-sweep-baseline: J1 by design); MarbleRunPark.workspace.test.tsx drives the commit through a stubbed scene.
    play: () => {
      throw new Error('Marble-run-park runs a 3D park, not driven at W1');
    },
  },
});
