/**
 * shape-builder's boss (`components/live-activity/boss.ts`), bespoke because its modes mix a build on the dot grid, a
 * board of tapped categories and tool toggles, every one checked by the activity: the card is `shapeBuilder.card.ts`;
 * this file validates a lesson, lists its challenges, asks one, carries the lever set and plays the harness.
 */
import type { ShapeBuilderChallenge, ShapeBuilderData } from './ShapeBuilder';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { askOf } from './shapeBuilderWorkspace';
import { askIsOpen, witnessesFor } from './shapeMakeBuild';
import { SHAPE_BUILDER_LEVERS, fewerShape, practiceParent } from './shapeBuilderLevers';
import { shapeBuilderCard, type ShapeBuilderMiss } from './shapeBuilder.card';

const CHALLENGE_TYPES = ['build', 'measure', 'classify', 'classify_by_lines', 'compose', 'find_symmetry', 'coordinate_shape', 'make_shape'];

/** Reject a shape-builder lesson whose challenges cannot be attempted. */
export function validateShapeBuilderData(value: unknown): ShapeBuilderData {
  const d = value as ShapeBuilderData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated shape builder has invalid lesson content.');
  // Each type needs the material its own check reads, or it mounts unanswerable.
  const shapes = (d.preloadedShapes ?? []).filter(s => Array.isArray(s?.vertices) && s.vertices.length >= 3);
  for (const c of d.challenges) {
    const ok = c.type === 'make_shape' ? askIsOpen(askOf(c), Math.min(d.grid?.size?.rows ?? 10, d.grid?.size?.columns ?? 10))
      : c.type === 'classify' || c.type === 'classify_by_lines'
        ? shapes.length > 0 && (d.classificationCategories ?? []).length > 0 && shapes.every(s => !!s.correctCategory)
        : c.type === 'measure' || c.type === 'find_symmetry' ? shapes.length > 0
          : true;
    if (!ok) throw new Error(`A shape-builder ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

const band = (d: ShapeBuilderData) => (d.gradeBand === '3-5' ? '3-5' : 'K-2');

export const shapeBuilderBoss = defineBoss<ShapeBuilderData, ShapeBuilderChallenge, ShapeBuilderMiss>({
  card: shapeBuilderCard,
  validate: validateShapeBuilderData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A shape, a sort, fold lines or tools the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: SHAPE_BUILDER_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/ShapeBuilder.tsx',
    instanceId: 'shapes-grid',
    defaults: { grade: 'Grade 3', mode: 'make_shape', topic: 'Quadrilaterals by their properties' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier ask a simplify lever opened (`~fewer`), rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as ShapeBuilderData;
      const parentId = practiceParent(String(ctx.itemId ?? ''));
      const parent = (data.challenges ?? []).find(c => c.id === parentId);
      return parent && parentId !== ctx.itemId ? fewerShape(parent, band(data)) ?? undefined : parent;
    },
    // make_shape through the real dot taps: the first shape the ask's menu proves passes, then "I'm done!". Try again
    // keeps the build, so a correct try clears the kept shape first. Wrong: a shape with the wrong number of sides
    // (`sides_off`); pressing done again on the kept wrong shape is the second wrong. The other modes place corners and
    // pick shapes by grid position on the svg, which the driver has no input for: undriven (no saved payload).
    play: (right, c, ctx) => {
      if (c.type !== 'make_shape') throw new Error(`shape-builder ${c.type}: placed by svg position, undriven`);
      const done: DriverInput = { type: 'choose', label: "I'm done!" };
      if (!right && ctx.demand?.shapeClosed === 'yes') return [done];
      const ask = askOf(c);
      const shape = right ? witnessesFor(ask)[0] : witnessesFor({ sides: ask.sides === 3 ? 4 : 3 })[0];
      if (!shape) throw new Error(`shape-builder make_shape: no passing shape for ${JSON.stringify(ask)}`);
      const kept = Number(ctx.demand?.cornersPlaced ?? 0) > 0;
      const tap = (p: { x: number; y: number }): DriverInput => ({ type: 'touch', target: `dot-${p.x + 1}-${p.y + 1}` });
      return [...(kept ? [{ type: 'choose' as const, label: 'Clear Shape' }] : []), ...shape.map(tap), tap(shape[0]), done];
    },
  },
});
