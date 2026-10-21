/**
 * polygon-area-builder's boss (`components/live-activity/boss.ts`), bespoke because the modes mix a typed area with an
 * open build on a grid, every one checked by the activity: the card is `polygonAreaBuilder.card.ts`; this file
 * validates a lesson, lists its challenges, asks one, carries the lever set and plays the harness.
 */
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import type { PolygonAreaBuilderData, PolygonAreaChallenge } from './PolygonAreaBuilder';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import {
  BUILD_COLS, BUILD_MAX_AREA, BUILD_MAX_PERIMETER, BUILD_MIN_AREA, BUILD_MIN_PERIMETER, BUILD_ROWS, smallerArea,
  smallerPerimeter,
} from './polygonAreaBuild';
import { POLYGON_LEVERS, smallerFigure } from './polygonAreaLevers';
import { polygonAreaBuilderCard, type PolygonMiss } from './polygonAreaBuilder.card';

const CHALLENGE_TYPES = ['decompose', 'find_area_triangle_parallelogram', 'find_area_trapezoid', 'composite_area',
  'coordinate_polygon', 'build_area', 'build_perimeter'];
const positive = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Reject a polygon-area lesson whose challenges cannot be attempted. */
export function validatePolygonAreaData(value: unknown): PolygonAreaBuilderData {
  const d = value as PolygonAreaBuilderData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim() || !positive(c.expectedArea)))
    throw new Error('Generated polygon area builder has invalid lesson content.');
  // Each type needs the figure its own check reads, or it mounts unanswerable.
  for (const c of d.challenges) {
    const area = c.targetArea ?? 0, perimeter = c.targetPerimeter ?? 0;
    const ok = c.type === 'build_perimeter'
      ? Number.isInteger(perimeter) && perimeter % 2 === 0 && perimeter >= BUILD_MIN_PERIMETER
        && perimeter <= BUILD_MAX_PERIMETER && perimeter === c.expectedArea && (c.shapesAsked === 1 || c.shapesAsked === 2)
        && new RegExp(`\\b${perimeter}\\b`).test(c.instruction)
      : c.type === 'build_area'
      ? Number.isInteger(area) && area >= BUILD_MIN_AREA && area <= Math.min(BUILD_MAX_AREA, BUILD_COLS * BUILD_ROWS)
        && area === c.expectedArea && (c.shapesAsked === 1 || c.shapesAsked === 2)
        && new RegExp(`\\b${area}\\b`).test(c.instruction)
      : c.figureType === 'composite' ? Array.isArray(c.parts) && c.parts.length >= 2
      : c.figureType === 'coordinate' ? Array.isArray(c.vertices) && c.vertices.length >= 3
      : positive(c.base) && positive(c.height) && (c.figureType !== 'trapezoid' || positive(c.base2));
    if (!ok) throw new Error(`A polygon-area-builder ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The session item, or the easier practice item a simplify lever opened (`~smaller`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): PolygonAreaChallenge | undefined {
  const id = String(ctx.itemId ?? '');
  const session = ((ctx.data as PolygonAreaBuilderData).challenges ?? []).find(x => x.id === id.replace(/~smaller$/, ''));
  if (!session || !id.endsWith('~smaller')) return session;
  return (session.type === 'build_perimeter' ? smallerPerimeter(session)
    : session.type === 'build_area' ? smallerArea(session) : smallerFigure(session)) ?? undefined;
}

/**
 * Polygon area builder through its real controls. A typed area goes in the Area box, then Check; wrong is the mode's
 * signature error (the ½ left out of a triangle or trapezoid, else half the area). The open build shades squares on
 * the grid, then I'm done: the first shape fills rows left to right, a second shape fills columns three squares tall
 * (never the first one turned for any area of 4 or more). Try again keeps the build, so it is cleared first; wrong is
 * one square short. decompose needs a canvas drag the harness does not drive.
 */
function polygonAreaInputs(c: PolygonAreaChallenge, ctx: JourneyContext, wrong: boolean): DriverInput[] {
  if (c.type === 'decompose') throw new Error('polygon-area-builder decompose: the cut-triangle drag on the canvas is not driven');
  if (c.type === 'build_perimeter') return perimeterBuildInputs(ctx, c, wrong);
  if (c.type !== 'build_area') {
    const halfLeftOut = c.figureType === 'triangle' || c.figureType === 'trapezoid';
    const typed = wrong ? (halfLeftOut ? c.expectedArea * 2 : c.expectedArea / 2) : c.expectedArea;
    return [{ type: 'write', label: 'Area', text: String(typed) }, { type: 'check' }];
  }
  const area = c.targetArea ?? 0;
  const shade = (n: number, at: (i: number) => [number, number]): DriverInput[] =>
    Array.from({ length: n }, (_, i) => ({ type: 'touch' as const, target: `cell-${at(i)[0]}-${at(i)[1]}` }));
  const rows = (n: number) => shade(n, i => [i % 10, Math.floor(i / 10)]);
  const columns = (n: number) => shade(n, i => [Math.floor(i / 3), i % 3]);
  const clear: DriverInput[] = Number(ctx.demand?.squaresPlaced ?? 0) > 0 ? [{ type: 'choose', label: 'Clear grid' }] : [];
  const done: DriverInput = { type: 'choose', label: "I'm done!" };
  const second = ctx.demand?.shape === 'second';
  if (wrong) return [...clear, ...(second ? columns(area - 1) : rows(area - 1)), done];
  if (second) return [...clear, ...columns(area), done];
  return [...clear, ...rows(area), done, ...(c.shapesAsked === 2 ? [{ type: 'choose', label: 'Clear grid' } as DriverInput,
    ...columns(area), done] : [])];
}

/**
 * The perimeter build (`build_perimeter`): a P-unit perimeter as a rectangle h rows tall and P/2 - h wide. The first
 * shape is 1 row tall (2 when that would not fit the 10-wide grid), the second one row taller, so never the first one
 * turned. Wrong is the same rectangle one column narrower: its perimeter is two short.
 */
function perimeterBuildInputs(ctx: JourneyContext, c: PolygonAreaChallenge, wrong: boolean): DriverInput[] {
  const p = c.targetPerimeter ?? 0;
  const firstRows = p / 2 - 1 > 10 ? 2 : 1;
  const rect = (rows: number, narrower = 0): DriverInput[] => {
    const cols = p / 2 - rows - narrower;
    return Array.from({ length: rows * cols }, (_, i) => ({ type: 'touch' as const, target: `cell-${i % cols}-${Math.floor(i / cols)}` }));
  };
  const clear: DriverInput[] = Number(ctx.demand?.squaresPlaced ?? 0) > 0 ? [{ type: 'choose', label: 'Clear grid' }] : [];
  const done: DriverInput = { type: 'choose', label: "I'm done!" };
  const rows = ctx.demand?.shape === 'second' ? firstRows + 1 : firstRows;
  if (wrong) return [...clear, ...rect(rows, 1), done];
  return [...clear, ...rect(rows), done, ...(c.shapesAsked === 2 && rows === firstRows
    ? [{ type: 'choose', label: 'Clear grid' } as DriverInput, ...rect(firstRows + 1), done] : [])];
}

export const polygonAreaBuilderBoss = defineBoss<PolygonAreaBuilderData, PolygonAreaChallenge, PolygonMiss>({
  card: polygonAreaBuilderCard,
  validate: validatePolygonAreaData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A typed area or a shaded build, checked by the activity: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: POLYGON_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/PolygonAreaBuilder.tsx',
    instanceId: 'polygon-area',
    defaults: { grade: 'Grade 3', mode: 'build_area', topic: 'Area: make shapes with a given number of unit squares' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    play: (right, c, ctx) => polygonAreaInputs(c, ctx, !right),
  },
});
