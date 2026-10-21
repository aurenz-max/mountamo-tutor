/**
 * transformation-lab's boss (`components/live-activity/boss.ts`), bespoke because its modes mix a drag of the image's
 * corners, a tapped transformation and a run of move buttons, every one checked by the activity: the card is
 * `transformationLab.card.ts`; this file validates a lesson, lists its challenges, asks one, carries the lever set and
 * plays the harness.
 */
import type { TransformationLabChallenge, TransformationLabData } from './TransformationLab';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { composeOf, inGrid, transformAsk, transformHarnessInputs, transformReplayKeys } from './transformationLabWorkspace';
import { TRANSFORM_LEVERS, practiceParent, simplerItem } from './transformationLabLevers';
import { transformationLabCard, type TransformMiss } from './transformationLab.card';

const TYPES = ['apply_translation_reflection', 'apply_rotation', 'identify_transformation', 'compose_sequence', 'dilation_similarity'];
const KINDS: Record<string, string> = {
  apply_translation_reflection: 'drag', apply_rotation: 'drag', dilation_similarity: 'drag',
  identify_transformation: 'identify', compose_sequence: 'sequence',
};
const points = (pts: unknown, n?: number) => Array.isArray(pts) && pts.length >= 3 && (n === undefined || pts.length === n)
  && pts.every(p => p && Number.isInteger(p.x) && Number.isInteger(p.y) && inGrid(p));

/** Reject a transformation-lab lesson whose challenges cannot be attempted. */
export function validateTransformationLabData(value: unknown): TransformationLabData {
  const d = value as TransformationLabData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || c.answerKind !== KINDS[c.type] || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated transformation lab has invalid lesson content.');
  // Each item needs what its own check reads: a pre-image and an image of the same corner count on the grid; on an
  // identify item the right option among four; on a compose item a palette move and slides that reach the target.
  for (const c of d.challenges) {
    const ok = points(c.preImage) && points(c.expectedImage, c.preImage.length)
      && (c.answerKind !== 'identify' || (Array.isArray(c.options) && c.options.length >= 2
        && Number.isInteger(c.correctOption) && !!c.options[c.correctOption ?? -1]))
      && (c.answerKind !== 'sequence' || composeOf(c) !== null);
    if (!ok) throw new Error(`A transformation-lab ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The session challenge, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): TransformationLabChallenge | undefined {
  const all = (ctx.data as TransformationLabData).challenges ?? [];
  const parentId = practiceParent(String(ctx.itemId ?? ''));
  const parent = all.find(c => c.id === parentId);
  return parent && parentId !== ctx.itemId ? simplerItem(parent) ?? undefined : parent;
}

export const transformationLabBoss = defineBoss<TransformationLabData, TransformationLabChallenge, TransformMiss>({
  card: transformationLabCard,
  validate: validateTransformationLabData,
  items: d => d.challenges,
  ask: c => transformAsk(c),
  // A figure, an option or a run of moves the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, transformAsk(c), null),
  levers: TRANSFORM_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/TransformationLab.tsx',
    instanceId: 'transform',
    defaults: { grade: 'Grade 8', mode: 'apply_rotation', topic: 'Rigid motions and dilations on the coordinate plane' },
    mounted: 'canvas[data-pip-object="canvas"]',
    current: currentItem,
    // Every mode through its real controls, from a blank start (Try again puts the figure back on the pre-image): the
    // drag modes drag each pink corner on the grid canvas; identify taps an option; compose presses the flip or turn and
    // then the slides; then Check. Wrong is the mode's signature miss (`transformHarnessInputs`).
    play: (right, c): DriverInput[] => transformHarnessInputs(c, right ? 'correct' : 'wrong'),
    // A drag's key is its image corners as printed, "(6, 0)", not the lone digits of the credited response.
    replayKeys: ctx => {
      const c = currentItem(ctx);
      return c ? transformReplayKeys(c) : [];
    },
  },
});
