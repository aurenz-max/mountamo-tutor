/**
 * Familiar 2D-object stimuli shared by the two early-shape packs.
 *
 * The object/shape pairing is code-owned: generators choose only an object id,
 * and the answer is always derived from this table. Labels deliberately avoid
 * geometric vocabulary so the stimulus never prints the answer.
 */
export type RealWorldShapeObjectId =
  | 'clock'
  | 'door'
  | 'yield-sign'
  | 'window'
  | 'kite'
  | 'egg';

export type RealWorldObjectShape =
  | 'circle'
  | 'rectangle'
  | 'triangle'
  | 'square'
  | 'diamond'
  | 'oval';

export interface RealWorldShapeObjectSpec {
  id: RealWorldShapeObjectId;
  label: string;
  shape: RealWorldObjectShape;
  sides: number | null;
  corners: number;
}

export const REAL_WORLD_SHAPE_OBJECTS: readonly RealWorldShapeObjectSpec[] = [
  { id: 'clock', label: 'clock face', shape: 'circle', sides: null, corners: 0 },
  { id: 'door', label: 'door', shape: 'rectangle', sides: 4, corners: 4 },
  { id: 'yield-sign', label: 'yield sign', shape: 'triangle', sides: 3, corners: 3 },
  { id: 'window', label: 'window', shape: 'square', sides: 4, corners: 4 },
  { id: 'kite', label: 'kite', shape: 'diamond', sides: 4, corners: 4 },
  { id: 'egg', label: 'egg', shape: 'oval', sides: null, corners: 0 },
] as const;

export const realWorldShapeObjectById = (
  id: string | undefined,
): RealWorldShapeObjectSpec | undefined =>
  REAL_WORLD_SHAPE_OBJECTS.find((object) => object.id === id);

export const REAL_WORLD_OBJECT_SHAPE_WORDS: readonly string[] = [
  'circle', 'rectangle', 'triangle', 'square', 'diamond', 'rhombus', 'oval',
  'pentagon', 'hexagon', 'trapezoid',
];

export const objectLabelLeaksShape = (label: string): boolean => {
  const normalized = label.toLowerCase();
  return REAL_WORLD_OBJECT_SHAPE_WORDS.some(
    (shape) => new RegExp(`\\b${shape}s?\\b`, 'i').test(normalized),
  );
};

