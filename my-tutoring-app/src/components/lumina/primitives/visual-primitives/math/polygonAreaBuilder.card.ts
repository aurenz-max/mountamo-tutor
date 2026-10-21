/**
 * polygon-area-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `polygonAreaBuilder.boss.ts`.
 * Five modes type an area into the Area box and press Check (decompose first slides the cut triangle into its slot);
 * the two open builds shade squares on an empty grid and press I'm done!. Every answer is checked by the activity,
 * one item at a time: a bespoke boss.
 */
import type { PolygonAreaChallengeType } from './PolygonAreaBuilder';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong typed area shows (`areaMiss`, `TeachingAttempt.miss`, handoff 20). Only the observable pattern:
 * - `forgot_half`: base × height on a triangle, or (b1 + b2) × h on a trapezoid (the ½ left out);
 * - `halved`: half the area of a parallelogram, rectangle or composite (a ½ that does not belong);
 * - `added_sides`: the labelled lengths added instead of multiplied;
 * - `one_piece`: one rectangle of a composite figure, not the whole;
 * - `bounding_box`: the rectangle around a coordinate polygon, not the polygon;
 * - `wrong_area`: any other area.
 */
export type AreaMiss = 'forgot_half' | 'halved' | 'added_sides' | 'one_piece' | 'bounding_box' | 'wrong_area';

/**
 * What an area build that does not pass shows (`buildAreaMiss`), in precedence order: the count (`one_short`,
 * `one_over`, `short_by_more`, `over_by_more`), then `not_connected` (more than one piece), then on the second shape
 * `same_as_first` (the first shape again, moved, turned or flipped).
 */
export type BuildAreaMiss = 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more' | 'not_connected' | 'same_as_first';
export const BUILD_AREA_MISSES: readonly BuildAreaMiss[] =
  ['one_short', 'one_over', 'short_by_more', 'over_by_more', 'not_connected', 'same_as_first'];

/**
 * What a perimeter build that does not pass shows (`buildPerimeterMiss`): `not_connected`, `has_hole`, `same_as_first`,
 * `counted_squares` (the squares number the target: the area made instead of the perimeter), else the count misses
 * (`two_short`, `two_over`, `short_by_more`, `over_by_more`).
 */
export type BuildPerimeterMiss = 'two_short' | 'two_over' | 'short_by_more' | 'over_by_more' | 'counted_squares'
  | 'not_connected' | 'has_hole' | 'same_as_first';
export const BUILD_PERIMETER_MISSES: readonly BuildPerimeterMiss[] =
  ['two_short', 'two_over', 'short_by_more', 'over_by_more', 'counted_squares', 'not_connected', 'has_hole', 'same_as_first'];

export type PolygonMiss = AreaMiss | BuildAreaMiss | BuildPerimeterMiss;

export const POLYGON_MISSES_BY_MODE: Record<PolygonAreaChallengeType, readonly PolygonMiss[]> = {
  decompose: ['halved', 'added_sides', 'wrong_area'],
  find_area_triangle_parallelogram: ['forgot_half', 'halved', 'added_sides', 'wrong_area'],
  find_area_trapezoid: ['forgot_half', 'added_sides', 'wrong_area'],
  composite_area: ['one_piece', 'halved', 'wrong_area'],
  // No forgot_half: `areaMiss` names a coordinate triangle's base × height `bounding_box` (it is the rectangle).
  coordinate_polygon: ['bounding_box', 'halved', 'wrong_area'],
  build_area: BUILD_AREA_MISSES,
  build_perimeter: BUILD_PERIMETER_MISSES,
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;
const TYPED = { ...CHECKED, answer: 'type', moves: 'types the area in the Area box, then presses Check' } as const;
const BUILT = { ...CHECKED, answer: 'build',
  moves: 'taps squares on the empty grid to shade them (taps a shaded square, or presses Clear grid, to clear), then '
    + 'presses I\'m done!' } as const;

export const polygonAreaBuilderCard = defineCard<PolygonMiss>({
  id: 'polygon-area-builder',
  grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'],
  // Every mode publishes levers (`polygonAreaLevers.ts`): a picture on the figure or the grid, an easier item.
  modes: {
    decompose: { ...TYPED, misses: POLYGON_MISSES_BY_MODE.decompose,
      moves: 'drags the purple cut triangle across into the dashed slot to make a rectangle, which unlocks the Area box, '
        + 'then types the area and presses Check' },
    find_area_triangle_parallelogram: { ...TYPED, misses: POLYGON_MISSES_BY_MODE.find_area_triangle_parallelogram },
    find_area_trapezoid: { ...TYPED, misses: POLYGON_MISSES_BY_MODE.find_area_trapezoid },
    composite_area: { ...TYPED, misses: POLYGON_MISSES_BY_MODE.composite_area },
    coordinate_polygon: { ...TYPED, misses: POLYGON_MISSES_BY_MODE.coordinate_polygon },
    build_area: { ...BUILT, misses: BUILD_AREA_MISSES },
    build_perimeter: { ...BUILT, misses: BUILD_PERIMETER_MISSES },
  },
  words: {
    job: 'find the area of a figure from the lengths or corners it labels, or shade squares on an empty grid into one '
      + 'shape with the area or the perimeter the instruction states',
    answer: 'the area they type or the shape they shade',
    question: 'the instruction, the figure, every length or corner it labels, and the area or perimeter a build asks for',
  },
  levers: true,
});
