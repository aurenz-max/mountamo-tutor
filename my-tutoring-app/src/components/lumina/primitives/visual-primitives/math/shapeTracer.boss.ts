/**
 * shape-tracer's boss (`components/live-activity/boss.ts`), bespoke because every mode is dots tapped on the canvas,
 * which the activity checks itself: the card is `shapeTracer.card.ts`; this file validates a lesson, lists its items,
 * asks one, carries the lever set and plays the harness.
 */
import type { ShapeTracerChallenge, ShapeTracerData } from './ShapeTracer';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { drawCorners, shapeTask } from './shapeTracerWorkspace';
import { SHAPE_TRACER_LEVERS, practiceItem, practiceParent } from './shapeTracerLevers';
import { shapeTracerCard, type ShapeTracerMiss } from './shapeTracer.card';

const CHALLENGE_TYPES = ['trace', 'complete', 'draw-from-description', 'connect-dots'];
const point = (p: unknown) => !!p && Number.isFinite((p as { x: number }).x) && Number.isFinite((p as { y: number }).y);
const points = (ps: unknown, min: number) => Array.isArray(ps) && ps.length >= min && ps.every(point);

/** Each type needs the material its own check reads, or it mounts unanswerable. */
function answerable(c: ShapeTracerChallenge): boolean {
  switch (c.type) {
    case 'trace': return points(c.tracePath, 3);
    case 'complete': return points(c.remainingVertices, 1) && Array.isArray(c.drawnSides)
      && c.drawnSides.every(s => s && point(s.from) && point(s.to));
    case 'draw-from-description': return !c.requiredProperties
      || (c.requiredProperties.sides ?? c.requiredProperties.corners ?? 3) >= 3;
    default: {
      const n = c.dots?.length ?? 0, order = c.correctOrder ?? [];
      return points(c.dots, 3) && order.length === n && new Set(order).size === n && order.every(i => Number.isInteger(i) && i >= 0 && i < n);
    }
  }
}

/** Reject a shape lesson whose challenges cannot be attempted. */
export function validateShapeTracerData(value: unknown): ShapeTracerData {
  const d = value as ShapeTracerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated shape tracer has invalid lesson content.');
  for (const c of d.challenges) {
    if (!answerable(c)) throw new Error(`A shape-tracer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

const touch = (prefix: string, ids: number[]): DriverInput[] => ids.map(i => ({ type: 'touch', target: `${prefix}-${i}` }));
const each = (list: readonly unknown[] | undefined) => (list ?? []).map((_, i) => i);

export const shapeTracerBoss = defineBoss<ShapeTracerData, ShapeTracerChallenge, ShapeTracerMiss>({
  card: shapeTracerCard,
  validate: validateShapeTracerData,
  items: d => d.challenges,
  // The instruction, plus a drawing's clue or a numbered trace's corner numbers (`shapeTask`).
  ask: c => shapeTask(c),
  // Tapped dots the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, shapeTask(c), null),
  levers: SHAPE_TRACER_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/ShapeTracer.tsx',
    instanceId: 'shapes',
    defaults: { grade: 'Kindergarten', mode: 'trace', topic: 'Drawing triangles, squares and rectangles' },
    mounted: '[data-pip-object="canvas"]',
    // The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as ShapeTracerData).challenges ?? [];
      const parent = practiceParent(String(ctx.itemId ?? ''), all);
      return parent ? practiceItem(parent) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
    // Every type through its real dots. trace and complete tap the corners in turn and finish themselves; a tap out of
    // turn is refused on the dot, never checked, so they have no wrong input. connect-dots: the wrong answer starts at
    // the second number (`started_elsewhere`). draw-from-description places a regular polygon on the grid
    // (`drawCorners`) and presses Check Shape; the wrong one has one corner fewer (one more on a triangle).
    play: (right, c, ctx) => {
      if (c.type === 'trace') return right ? touch('vertex', each(c.tracePath)) : [];
      if (c.type === 'complete') return right ? touch('remaining', each(c.remainingVertices)) : [];
      if (c.type === 'connect-dots') {
        const order = c.correctOrder ?? [];
        return touch('dot', right ? order : [order[1]]);
      }
      return [...touch('grid', drawCorners(c, (ctx.data as ShapeTracerData).gridSize ?? 50, !right)), { type: 'check' }];
    },
  },
});
