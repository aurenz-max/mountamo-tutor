import type { PolygonAreaBuilderData } from '../../../primitives/visual-primitives/math/PolygonAreaBuilder';
import { BUILD_COLS, BUILD_MAX_AREA, BUILD_MIN_AREA, BUILD_ROWS } from '../../../primitives/visual-primitives/math/polygonAreaBuild';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['decompose', 'find_area_triangle_parallelogram', 'find_area_trapezoid', 'composite_area',
  'coordinate_polygon', 'build_area'];
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
    const area = c.targetArea ?? 0;
    const ok = c.type === 'build_area'
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

/** What the live adapter needs from the polygon area builder; the catalog's `teachingWorkspace` declares the rest. */
export const polygonAreaBuilderLiveDomain: WorkspaceDomain<PolygonAreaBuilderData> = {
  validate: validatePolygonAreaData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
