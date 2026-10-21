/**
 * circle-explorer's boss (`components/live-activity/boss.ts`), bespoke because every mode is a typed number the
 * activity checks: the card is `circleExplorer.card.ts`; this file validates a lesson, lists its circles, asks one,
 * carries the lever set and plays the harness.
 */
import type { CircleExplorerData } from './CircleExplorer';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { circleAsk, circleHarnessText } from './circleExplorerWorkspace';
import { CIRCLE_LEVERS, practiceParent, simplerCircle } from './circleExplorerLevers';
import { circleExplorerCard, type CircleMiss } from './circleExplorer.card';

const TYPES = ['discover_pi', 'circumference', 'area', 'reverse', 'composite'];
const positive = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Reject a circle-explorer lesson whose challenges cannot be attempted. */
export function validateCircleExplorerData(value: unknown): CircleExplorerData {
  const d = value as CircleExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated circle explorer has invalid lesson content.');
  // Each item needs what its own check and its figure read: a positive radius, key and tolerance; a reverse item its
  // given value; a composite item its shape (and a circle-in-square its side).
  for (const c of d.challenges) {
    const ok = positive(c.radius) && positive(c.expectedAnswer) && positive(c.tolerance)
      && (c.type !== 'reverse' || positive(c.givenValue))
      && (c.type !== 'composite' || (!!c.compositeShape && (c.compositeShape !== 'circle_in_square' || positive(c.squareSide))));
    if (!ok) throw new Error(`A circle-explorer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

export const circleExplorerBoss = defineBoss<CircleExplorerData, CircleExplorerData['challenges'][number], CircleMiss>({
  card: circleExplorerCard,
  validate: validateCircleExplorerData,
  items: d => d.challenges,
  ask: c => circleAsk(c),
  // A typed number the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, circleAsk(c), null),
  levers: CIRCLE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/CircleExplorer.tsx',
    instanceId: 'circle',
    defaults: { grade: 'Grade 7', mode: 'circumference', topic: 'Circumference and area of a circle' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice problem a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as CircleExplorerData).challenges ?? [];
      const parentId = practiceParent(String(ctx.itemId ?? ''));
      const parent = all.find(c => c.id === parentId);
      return parent && parentId !== ctx.itemId ? simplerCircle(parent) ?? undefined : parent;
    },
    // Every mode through its real controls: on discover π "Unroll the circumference" first (until the scene says it is
    // unrolled; Try again keeps it), then the number typed into "Your answer" and Check. A wrong answer is the item's
    // signature error from `circleMiss` (the radius for the diameter, the radius not squared, the diameter for the
    // radius, the whole circle for the half, d ÷ C), else half again too high.
    play: (right, c, ctx) => {
      const unroll: DriverInput[] = c.type === 'discover_pi' && /has not unrolled/.test(String(ctx.demand?.learnerWork ?? ''))
        ? [{ type: 'choose', label: 'Unroll the circumference' }] : [];
      return [...unroll, { type: 'write', label: 'Your answer', text: circleHarnessText(c, right ? 'correct' : 'wrong') },
        { type: 'check' }];
    },
  },
});
