/**
 * Pure drawing primitives for the shared 2D math canvas. Each function is
 * stateless: takes a 2D context, scene data, and a CanvasConfig, draws.
 *
 * No React. No interaction. Consumers wrap these in a useEffect-driven render
 * loop and add their own click/drag layer.
 */

import { CANVAS_WIDTH, CANVAS_HEIGHT, PADDING, graphToCanvas, type CanvasConfig } from './coords';
import type { CurvePoint, FeatureType } from './types';

export const FEATURE_COLORS: Record<FeatureType, string> = {
  root: '#ef4444',
  maximum: '#f59e0b',
  minimum: '#3b82f6',
  'y-intercept': '#8b5cf6',
  asymptote: '#ec4899',
};

/** Catmull-Rom spline interpolation through control points. */
export function catmullRomSpline(points: CurvePoint[], numSegments = 20): CurvePoint[] {
  if (points.length < 2) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const result: CurvePoint[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[Math.max(0, i - 1)];
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    const p3 = sorted[Math.min(sorted.length - 1, i + 2)];

    for (let t = 0; t <= 1; t += 1 / numSegments) {
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      result.push({ x, y });
    }
  }
  return result;
}

/** Normalized distance between a click point and a marker (graph coords). */
export function featureDistance(
  click: CurvePoint,
  feature: { x: number; y: number },
  xRange: number,
  yRange: number,
): number {
  const nx = (click.x - feature.x) / xRange;
  const ny = (click.y - feature.y) / yRange;
  return Math.sqrt(nx * nx + ny * ny);
}

export function drawAxes(ctx: CanvasRenderingContext2D, cfg: CanvasConfig) {
  const w = CANVAS_WIDTH - 2 * PADDING;
  const h = CANVAS_HEIGHT - 2 * PADDING;

  ctx.strokeStyle = 'rgba(100,116,139,0.2)';
  ctx.lineWidth = 0.5;
  const xStep = Math.max(1, Math.round((cfg.xMax - cfg.xMin) / 10));
  const yStep = Math.max(1, Math.round((cfg.yMax - cfg.yMin) / 8));

  for (let x = Math.ceil(cfg.xMin / xStep) * xStep; x <= cfg.xMax; x += xStep) {
    const { x: cx } = graphToCanvas(x, 0, cfg);
    ctx.beginPath(); ctx.moveTo(cx, PADDING); ctx.lineTo(cx, PADDING + h); ctx.stroke();
  }
  for (let y = Math.ceil(cfg.yMin / yStep) * yStep; y <= cfg.yMax; y += yStep) {
    const { y: cy } = graphToCanvas(0, y, cfg);
    ctx.beginPath(); ctx.moveTo(PADDING, cy); ctx.lineTo(PADDING + w, cy); ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(226,232,240,0.6)';
  ctx.lineWidth = 1.5;

  const yZero = Math.max(cfg.yMin, Math.min(cfg.yMax, 0));
  const { y: xAxisY } = graphToCanvas(0, yZero, cfg);
  ctx.beginPath(); ctx.moveTo(PADDING, xAxisY); ctx.lineTo(PADDING + w, xAxisY); ctx.stroke();

  const xZero = Math.max(cfg.xMin, Math.min(cfg.xMax, 0));
  const { x: yAxisX } = graphToCanvas(xZero, 0, cfg);
  ctx.beginPath(); ctx.moveTo(yAxisX, PADDING); ctx.lineTo(yAxisX, PADDING + h); ctx.stroke();

  ctx.fillStyle = 'rgba(203,213,225,0.7)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = Math.ceil(cfg.xMin / xStep) * xStep; x <= cfg.xMax; x += xStep) {
    if (x === 0) continue;
    const { x: cx } = graphToCanvas(x, yZero, cfg);
    ctx.fillText(String(x), cx, xAxisY + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = Math.ceil(cfg.yMin / yStep) * yStep; y <= cfg.yMax; y += yStep) {
    if (y === 0) continue;
    const { y: cy } = graphToCanvas(xZero, y, cfg);
    ctx.fillText(String(y), yAxisX - 6, cy);
  }

  ctx.fillStyle = 'rgba(226,232,240,0.9)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(cfg.xLabel, PADDING + w / 2, CANVAS_HEIGHT - 16);
  ctx.save();
  ctx.translate(14, PADDING + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(cfg.yLabel, 0, 0);
  ctx.restore();
}

export function drawCurve(
  ctx: CanvasRenderingContext2D,
  points: CurvePoint[],
  cfg: CanvasConfig,
  color: string,
  lineWidth = 2.5,
) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  let started = false;
  for (const pt of points) {
    const { x, y } = graphToCanvas(pt.x, pt.y, cfg);
    if (x < PADDING || x > CANVAS_WIDTH - PADDING || y < PADDING || y > CANVAS_HEIGHT - PADDING) {
      started = false;
      continue;
    }
    if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
  }
  ctx.stroke();
}

export function drawControlPoints(
  ctx: CanvasRenderingContext2D,
  points: CurvePoint[],
  cfg: CanvasConfig,
) {
  for (const pt of points) {
    const { x, y } = graphToCanvas(pt.x, pt.y, cfg);
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/**
 * Fill the polygon bounded above by `upper` (left→right) and below by `lower`
 * (right→left). Both curves should be sampled across the same x-interval.
 * Used for area-between-curves, Riemann strip overlays, etc.
 */
export function drawShadedRegion(
  ctx: CanvasRenderingContext2D,
  upper: CurvePoint[],
  lower: CurvePoint[],
  cfg: CanvasConfig,
  fillStyle: string,
  strokeStyle?: string,
) {
  if (upper.length < 2 || lower.length < 2) return;
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  let first = true;
  for (const p of upper) {
    const { x, y } = graphToCanvas(p.x, p.y, cfg);
    if (first) { ctx.moveTo(x, y); first = false; }
    else ctx.lineTo(x, y);
  }
  for (let i = lower.length - 1; i >= 0; i--) {
    const { x, y } = graphToCanvas(lower[i].x, lower[i].y, cfg);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Single arrow (line + filled triangular head) from `from` to `to` in graph coords. */
export function drawVector(
  ctx: CanvasRenderingContext2D,
  from: CurvePoint,
  to: CurvePoint,
  cfg: CanvasConfig,
  color: string,
  label?: string,
) {
  const { x: fx, y: fy } = graphToCanvas(from.x, from.y, cfg);
  const { x: tx, y: ty } = graphToCanvas(to.x, to.y, cfg);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  const angle = Math.atan2(ty - fy, tx - fx);
  const headLen = 10;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - headLen * Math.cos(angle - Math.PI / 6), ty - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(tx - headLen * Math.cos(angle + Math.PI / 6), ty - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  if (label) {
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, (fx + tx) / 2 + 8, (fy + ty) / 2 - 6);
  }
}

/**
 * Filled dot at `point` with a label offset to the upper-right. Use for
 * intersections, intercepts, and other "the answer is here" markers in the
 * annotated-example canvas-2d renderer.
 */
export function drawLabeledPoint(
  ctx: CanvasRenderingContext2D,
  point: CurvePoint,
  cfg: CanvasConfig,
  color: string,
  label: string,
  emphasis = false,
) {
  const { x, y } = graphToCanvas(point.x, point.y, cfg);
  ctx.beginPath();
  ctx.arc(x, y, emphasis ? 6 : 4.5, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (label) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 9, y - 9);
  }
}

export function drawFeatureMarkers(
  ctx: CanvasRenderingContext2D,
  markers: Array<{ x: number; y: number; type: string; label: string; hit?: boolean }>,
  cfg: CanvasConfig,
) {
  for (const m of markers) {
    const { x, y } = graphToCanvas(m.x, m.y, cfg);
    const color = m.hit ? '#22c55e' : (FEATURE_COLORS[m.type as FeatureType] ?? '#94a3b8');
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = m.hit ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(m.label, x, y - 12);
  }
}
