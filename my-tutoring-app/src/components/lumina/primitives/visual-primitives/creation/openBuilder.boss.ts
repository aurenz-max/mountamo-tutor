/**
 * open-builder's boss (`components/live-activity/boss.ts`), bespoke because the one mode is a free build a vision
 * judge (the building buddy) reads from a picture of the board: the card is `openBuilder.card.ts`; this file
 * validates a studio, lists its projects, asks one, carries the lever set and names the harness.
 */
import type { OpenBuilderData } from './OpenBuilder';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { SCENES, type OpenBuilderChallenge } from './openBuilderModel';
import { OPEN_BUILDER_LEVERS, practiceItem, practiceParent } from './openBuilderLevers';
import { openBuilderCard, type OpenBuilderMiss } from './openBuilder.card';

/** Reject a studio the workspace cannot run: every project needs an id, a goal and a scene the board can draw. */
export function validateOpenBuilderData(value: unknown): OpenBuilderData {
  const d = value as OpenBuilderData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated open builder has no title.');
  const projects = Array.isArray(d.challenges) ? d.challenges : [];
  if (!projects.length || projects.length > 12 || new Set(projects.map(c => c?.id)).size !== projects.length
      || projects.some(c => !c || typeof c.id !== 'string' || !c.id || c.type !== 'build_to_goal'
        || typeof c.goal !== 'string' || !c.goal.trim()
        || typeof c.sceneId !== 'string' || !Object.prototype.hasOwnProperty.call(SCENES, c.sceneId)))
    throw new Error('Generated open builder has invalid lesson content.');
  return d;
}

export const openBuilderBoss = defineBoss<OpenBuilderData, OpenBuilderChallenge, OpenBuilderMiss>({
  card: openBuilderCard,
  validate: validateOpenBuilderData,
  items: d => d.challenges,
  ask: c => c.goal,
  // A build the buddy reads: there is no key, and none reaches the tutor.
  assignment: c => bossAssignment(c.id, c.goal, null),
  levers: OPEN_BUILDER_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/creation/OpenBuilder.tsx',
    instanceId: 'ob',
    defaults: { grade: 'Grade 1', mode: 'build_to_goal', topic: 'Building a home: foundation, walls, a door and a roof' },
    mounted: '[data-pip-object="workspace"]',
    // The session project, or the smaller practice project a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = ((ctx.data as OpenBuilderData).challenges ?? []) as OpenBuilderChallenge[];
      const parent = practiceParent(String(ctx.itemId ?? ''), all);
      return parent ? practiceItem(parent, all) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
    // The check is the building buddy, a vision model reading a picture of the board. The sweep has no rasterized
    // board and no judge, so no input can produce a checked build (J1 baselined); `OpenBuilder.workspace.test.tsx`
    // and `OpenBuilder.levers.workspace.test.tsx` drive the miss, Try again and the pass with the judge stubbed.
    play: (_right, c) => {
      throw new Error(`open-builder ${c.type} is not driven at W1 (a build read by a vision judge)`);
    },
  },
});
