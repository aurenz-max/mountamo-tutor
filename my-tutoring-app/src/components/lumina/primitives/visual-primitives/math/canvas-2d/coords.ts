/**
 * Coordinate system for the shared 2D math canvas.
 *
 * Graph coords: math (xMin..xMax, yMin..yMax), y up.
 * Canvas coords: pixels (0..CANVAS_WIDTH, 0..CANVAS_HEIGHT), y down.
 */

import type { CurvePoint } from './types';

export const CANVAS_WIDTH = 700;
export const CANVAS_HEIGHT = 450;
export const PADDING = 55;

export interface CanvasConfig {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
}

export function graphToCanvas(gx: number, gy: number, cfg: CanvasConfig): { x: number; y: number } {
  const w = CANVAS_WIDTH - 2 * PADDING;
  const h = CANVAS_HEIGHT - 2 * PADDING;
  const x = PADDING + ((gx - cfg.xMin) / (cfg.xMax - cfg.xMin)) * w;
  const y = PADDING + ((cfg.yMax - gy) / (cfg.yMax - cfg.yMin)) * h;
  return { x, y };
}

export function canvasToGraph(cx: number, cy: number, cfg: CanvasConfig): CurvePoint {
  const w = CANVAS_WIDTH - 2 * PADDING;
  const h = CANVAS_HEIGHT - 2 * PADDING;
  const gx = cfg.xMin + ((cx - PADDING) / w) * (cfg.xMax - cfg.xMin);
  const gy = cfg.yMax - ((cy - PADDING) / h) * (cfg.yMax - cfg.yMin);
  return { x: gx, y: gy };
}
