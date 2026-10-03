/**
 * diShapesMenu — the code-owned shape menu, pure, so the generator and the runtime levers
 * (`diShapesLevers.ts`) read one table. Moved out of `gemini-di-shapes.ts` 2026-10-03.
 */
import type { DiShapeName } from './diShapesScript';

export interface ShapeSpec {
  word: string;
  article: 'a' | 'an';
  sides: number | null;
  corners: number | null;
  /** In the K.G.2 core five. Extended shapes serve G1+ or a naming objective. */
  core: boolean;
  /** Names the judge must also accept (stated per-item in the contract). */
  spokenAlternates?: string[];
  /** Passive ASR cross-check aliases (never the judge). */
  asrAliases: string[];
  /** Rotation cap (±deg). Square stays low — a 45° square reads as a diamond,
   *  which at K is a DIFFERENT percept than the skill being drilled. Curves
   *  don't rotate meaningfully. */
  maxRotationDeg: number;
}

export const SHAPE_MENU: Record<DiShapeName, ShapeSpec> = {
  circle: { word: 'circle', article: 'a', sides: null, corners: null, core: true, asrAliases: ['circle', 'circles', 'surkle'], maxRotationDeg: 0 },
  triangle: { word: 'triangle', article: 'a', sides: 3, corners: 3, core: true, asrAliases: ['triangle', 'triangles', 'twiangle'], maxRotationDeg: 25 },
  square: { word: 'square', article: 'a', sides: 4, corners: 4, core: true, asrAliases: ['square', 'squares', 'sware'], maxRotationDeg: 10 },
  rectangle: { word: 'rectangle', article: 'a', sides: 4, corners: 4, core: true, asrAliases: ['rectangle', 'rectangles', 'wectangle'], maxRotationDeg: 15 },
  hexagon: { word: 'hexagon', article: 'a', sides: 6, corners: 6, core: true, asrAliases: ['hexagon', 'hexagons'], maxRotationDeg: 25 },
  oval: { word: 'oval', article: 'an', sides: null, corners: null, core: false, asrAliases: ['oval', 'ovals'], maxRotationDeg: 0 },
  pentagon: { word: 'pentagon', article: 'a', sides: 5, corners: 5, core: false, asrAliases: ['pentagon', 'pentagons'], maxRotationDeg: 25 },
  rhombus: { word: 'rhombus', article: 'a', sides: 4, corners: 4, core: false, spokenAlternates: ['diamond'], asrAliases: ['rhombus', 'diamond', 'rhombuses'], maxRotationDeg: 15 },
  trapezoid: { word: 'trapezoid', article: 'a', sides: 4, corners: 4, core: false, asrAliases: ['trapezoid', 'trapezoids'], maxRotationDeg: 20 },
};

