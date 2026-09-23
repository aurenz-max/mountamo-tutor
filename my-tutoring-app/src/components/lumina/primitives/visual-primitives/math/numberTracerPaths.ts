/**
 * The guide strokes the number tracer draws and scores against, per numeral. Pure, so the live
 * journey spec can derive a traced answer without importing the component.
 */
import type { PathPoint } from './NumberTracer';

/** The canvas the paths are laid out on; `NumberTracer.tsx` renders at this size. */
export const TRACER_CANVAS_WIDTH = 500;

// Hardcoded stroke paths for digits 0-9 (normalized to ~200x280 bounding box centered in canvas)
// Each digit is an array of strokes (sub-paths), each stroke is an array of points
export const DIGIT_PATHS: Record<number, PathPoint[][]> = {
  0: [[
    { x: 250, y: 60 }, { x: 220, y: 65 }, { x: 195, y: 85 }, { x: 180, y: 115 },
    { x: 170, y: 155 }, { x: 170, y: 200 }, { x: 175, y: 240 }, { x: 185, y: 270 },
    { x: 200, y: 295 }, { x: 220, y: 315 }, { x: 245, y: 325 }, { x: 270, y: 325 },
    { x: 295, y: 315 }, { x: 315, y: 295 }, { x: 330, y: 270 }, { x: 340, y: 240 },
    { x: 345, y: 200 }, { x: 345, y: 155 }, { x: 335, y: 115 }, { x: 320, y: 85 },
    { x: 300, y: 65 }, { x: 275, y: 58 }, { x: 250, y: 60 },
  ]],
  1: [[
    { x: 220, y: 100 }, { x: 240, y: 80 }, { x: 260, y: 60 }, { x: 260, y: 100 },
    { x: 260, y: 150 }, { x: 260, y: 200 }, { x: 260, y: 250 }, { x: 260, y: 300 },
    { x: 260, y: 340 },
  ], [
    { x: 210, y: 340 }, { x: 260, y: 340 }, { x: 310, y: 340 },
  ]],
  2: [[
    { x: 180, y: 110 }, { x: 195, y: 85 }, { x: 220, y: 65 }, { x: 250, y: 58 },
    { x: 280, y: 62 }, { x: 305, y: 80 }, { x: 320, y: 105 }, { x: 325, y: 130 },
    { x: 315, y: 160 }, { x: 295, y: 190 }, { x: 270, y: 220 }, { x: 240, y: 255 },
    { x: 210, y: 290 }, { x: 180, y: 325 }, { x: 180, y: 340 }, { x: 220, y: 340 },
    { x: 260, y: 340 }, { x: 300, y: 340 }, { x: 335, y: 340 },
  ]],
  3: [[
    { x: 180, y: 80 }, { x: 215, y: 62 }, { x: 255, y: 58 }, { x: 290, y: 65 },
    { x: 315, y: 85 }, { x: 325, y: 115 }, { x: 320, y: 145 }, { x: 300, y: 170 },
    { x: 270, y: 185 }, { x: 255, y: 190 }, { x: 280, y: 200 }, { x: 310, y: 220 },
    { x: 330, y: 250 }, { x: 335, y: 280 }, { x: 325, y: 310 }, { x: 300, y: 330 },
    { x: 270, y: 340 }, { x: 235, y: 342 }, { x: 200, y: 330 }, { x: 180, y: 310 },
  ]],
  4: [[
    { x: 290, y: 340 }, { x: 290, y: 290 }, { x: 290, y: 240 }, { x: 290, y: 190 },
    { x: 290, y: 140 }, { x: 290, y: 90 }, { x: 290, y: 60 },
  ], [
    { x: 290, y: 60 }, { x: 265, y: 100 }, { x: 240, y: 140 }, { x: 215, y: 180 },
    { x: 190, y: 220 }, { x: 170, y: 250 },
  ], [
    { x: 170, y: 250 }, { x: 210, y: 250 }, { x: 250, y: 250 }, { x: 290, y: 250 },
    { x: 330, y: 250 },
  ]],
  5: [[
    { x: 320, y: 60 }, { x: 280, y: 60 }, { x: 240, y: 60 }, { x: 200, y: 60 },
  ], [
    { x: 200, y: 60 }, { x: 195, y: 100 }, { x: 190, y: 140 }, { x: 185, y: 180 },
  ], [
    { x: 185, y: 180 }, { x: 215, y: 170 }, { x: 250, y: 165 }, { x: 285, y: 175 },
    { x: 315, y: 200 }, { x: 330, y: 235 }, { x: 330, y: 270 }, { x: 315, y: 300 },
    { x: 290, y: 325 }, { x: 255, y: 340 }, { x: 220, y: 338 }, { x: 190, y: 320 },
    { x: 175, y: 295 },
  ]],
  6: [[
    { x: 310, y: 80 }, { x: 285, y: 62 }, { x: 255, y: 58 }, { x: 225, y: 65 },
    { x: 200, y: 85 }, { x: 185, y: 115 }, { x: 175, y: 155 }, { x: 172, y: 195 },
    { x: 175, y: 235 }, { x: 185, y: 270 }, { x: 200, y: 300 }, { x: 225, y: 325 },
    { x: 255, y: 335 }, { x: 285, y: 330 }, { x: 310, y: 310 }, { x: 325, y: 280 },
    { x: 330, y: 250 }, { x: 325, y: 220 }, { x: 310, y: 200 }, { x: 285, y: 185 },
    { x: 255, y: 182 }, { x: 225, y: 190 }, { x: 200, y: 205 }, { x: 180, y: 225 },
  ]],
  7: [[
    { x: 175, y: 60 }, { x: 215, y: 60 }, { x: 255, y: 60 }, { x: 295, y: 60 },
    { x: 335, y: 60 },
  ], [
    { x: 335, y: 60 }, { x: 320, y: 100 }, { x: 300, y: 145 }, { x: 280, y: 190 },
    { x: 265, y: 230 }, { x: 250, y: 270 }, { x: 240, y: 310 }, { x: 235, y: 340 },
  ]],
  8: [[
    { x: 255, y: 190 }, { x: 225, y: 175 }, { x: 200, y: 150 }, { x: 190, y: 125 },
    { x: 195, y: 95 }, { x: 215, y: 72 }, { x: 245, y: 60 }, { x: 275, y: 62 },
    { x: 300, y: 75 }, { x: 315, y: 100 }, { x: 315, y: 125 }, { x: 305, y: 150 },
    { x: 280, y: 175 }, { x: 255, y: 190 }, { x: 225, y: 210 }, { x: 195, y: 235 },
    { x: 180, y: 265 }, { x: 178, y: 295 }, { x: 190, y: 318 }, { x: 215, y: 335 },
    { x: 250, y: 342 }, { x: 285, y: 338 }, { x: 315, y: 320 }, { x: 330, y: 295 },
    { x: 332, y: 265 }, { x: 320, y: 235 }, { x: 295, y: 210 }, { x: 265, y: 195 },
    { x: 255, y: 190 },
  ]],
  9: [[
    { x: 325, y: 175 }, { x: 310, y: 200 }, { x: 285, y: 215 }, { x: 255, y: 220 },
    { x: 225, y: 210 }, { x: 200, y: 190 }, { x: 185, y: 165 }, { x: 180, y: 135 },
    { x: 190, y: 105 }, { x: 210, y: 80 }, { x: 240, y: 65 }, { x: 270, y: 60 },
    { x: 300, y: 68 }, { x: 320, y: 85 }, { x: 332, y: 110 }, { x: 335, y: 140 },
    { x: 332, y: 175 }, { x: 325, y: 210 }, { x: 315, y: 245 }, { x: 300, y: 280 },
    { x: 280, y: 310 }, { x: 255, y: 330 }, { x: 225, y: 340 }, { x: 200, y: 335 },
  ]],
};

// For multi-digit numbers (10-20), compose from individual digit paths
export function getDigitPaths(num: number): PathPoint[][] {
  if (num <= 9) return DIGIT_PATHS[num] ?? DIGIT_PATHS[0];
  const digits = String(num).split('').map(Number);
  const allPaths: PathPoint[][] = [];
  const charWidth = 180;
  const totalWidth = digits.length * charWidth;
  const startX = (TRACER_CANVAS_WIDTH - totalWidth) / 2;

  for (let i = 0; i < digits.length; i++) {
    const offsetX = startX + i * charWidth - (TRACER_CANVAS_WIDTH / 2 - charWidth / 2);
    const basePaths = DIGIT_PATHS[digits[i]] ?? DIGIT_PATHS[0];
    for (const stroke of basePaths) {
      allPaths.push(stroke.map(p => ({ x: p.x + offsetX, y: p.y })));
    }
  }
  return allPaths;
}
