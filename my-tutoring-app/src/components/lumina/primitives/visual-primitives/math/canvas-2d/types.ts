/**
 * Shared 2D math canvas types — used by both interactive primitives
 * (e.g. FunctionSketch) and the annotated-example display renderer.
 */

export interface CurvePoint {
  x: number;
  y: number;
}

export type FeatureType = 'root' | 'maximum' | 'minimum' | 'y-intercept' | 'asymptote';

export interface FeatureMarker {
  type: FeatureType;
  x: number;
  y: number;
  label: string;
  tolerance: number;
}
