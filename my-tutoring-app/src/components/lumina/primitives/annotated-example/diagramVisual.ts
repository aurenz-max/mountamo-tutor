/** Declarative diagram data. Coordinates never become executable SVG/HTML. */
export type DiagramVisual =
  | { kind: 'number-line'; min: number; max: number; divisions: number; start: number; jumps: number[] }
  | { kind: 'groups'; counts: number[]; itemLabel: string }
  | { kind: 'fraction-bar'; numerator: number; denominator: number }
  | { kind: 'drawing'; shapes: DrawingShape[] };

export interface DrawingShape {
  kind: 'line' | 'rect' | 'circle' | 'text';
  x: number; y: number;
  x2?: number; y2?: number;
  width?: number; height?: number; radius?: number;
  text?: string;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const integer = (v: unknown, lo: number, hi: number): v is number => finite(v) && Number.isInteger(v) && v >= lo && v <= hi;

/** Author integer tick moves, then derive distances. This prevents six rounded
 * 0.111 jumps from claiming to be exactly two thirds on a ninths scale. */
export function numberLineFromTicks(value: unknown): DiagramVisual {
  if (!value || typeof value !== 'object') throw new Error('Missing number-line tick model');
  const v = value as Record<string, unknown>;
  if (!finite(v.min) || !finite(v.max) || v.max <= v.min || !integer(v.divisions, 1, 40)
    || !integer(v.startTick, 0, v.divisions) || !Array.isArray(v.jumpTicks) || v.jumpTicks.length > 12
    || !v.jumpTicks.every(n => integer(n, -40, 40))) throw new Error('Invalid number-line tick model');
  const interval = (v.max - v.min) / v.divisions;
  return parseDiagramVisual({ kind: 'number-line', min: v.min, max: v.max, divisions: v.divisions,
    start: v.min + v.startTick * interval, jumps: v.jumpTicks.map(ticks => ticks * interval) });
}

export function parseDiagramVisual(value: unknown): DiagramVisual {
  if (!value || typeof value !== 'object') throw new Error('Diagram needs structured visual data');
  const v = value as Record<string, unknown>;
  if (v.kind === 'number-line') {
    const { min, max, divisions, start, jumps } = v;
    if (!finite(min) || !finite(max) || max <= min || !integer(divisions, 1, 40) || !finite(start)
      || start < min || start > max || !Array.isArray(jumps) || jumps.length > 12 || !jumps.every(finite)) {
      throw new Error('Invalid number-line scale or jumps');
    }
    let position = start;
    for (const jump of jumps) {
      position += jump;
      if (position < min - 1e-9 || position > max + 1e-9) throw new Error('Number-line jump leaves the visible scale');
    }
    return { kind: v.kind, min, max, divisions, start, jumps };
  }
  if (v.kind === 'groups') {
    if (!Array.isArray(v.counts) || !v.counts.length || v.counts.length > 10 || !v.counts.every(n => integer(n, 0, 20))
      || typeof v.itemLabel !== 'string' || !v.itemLabel.trim()) throw new Error('Invalid counted groups');
    return { kind: v.kind, counts: v.counts, itemLabel: v.itemLabel };
  }
  if (v.kind === 'fraction-bar') {
    if (!integer(v.denominator, 1, 24) || !integer(v.numerator, 0, v.denominator)) throw new Error('Invalid fraction bar');
    return { kind: v.kind, numerator: v.numerator, denominator: v.denominator };
  }
  if (v.kind === 'drawing' && Array.isArray(v.shapes) && v.shapes.length > 0 && v.shapes.length <= 40) {
    const shapes = v.shapes.map((raw: unknown): DrawingShape => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid drawing shape');
      const s = raw as DrawingShape;
      if (!finite(s.x) || !finite(s.y) || s.x < 0 || s.x > 640 || s.y < 0 || s.y > 360) throw new Error('Shape outside drawing');
      if (s.kind === 'line' && finite(s.x2) && finite(s.y2) && s.x2 >= 0 && s.x2 <= 640 && s.y2 >= 0 && s.y2 <= 360) return { kind: s.kind, x: s.x, y: s.y, x2: s.x2, y2: s.y2 };
      if (s.kind === 'rect' && finite(s.width) && finite(s.height) && s.width > 0 && s.height > 0 && s.x + s.width <= 640 && s.y + s.height <= 360) return { kind: s.kind, x: s.x, y: s.y, width: s.width, height: s.height };
      if (s.kind === 'circle' && finite(s.radius) && s.radius > 0 && s.x - s.radius >= 0 && s.x + s.radius <= 640 && s.y - s.radius >= 0 && s.y + s.radius <= 360) return { kind: s.kind, x: s.x, y: s.y, radius: s.radius };
      if (s.kind === 'text' && typeof s.text === 'string' && s.text.length > 0 && s.text.length <= 60) return { kind: s.kind, x: s.x, y: s.y, text: s.text };
      throw new Error('Invalid drawing shape dimensions');
    });
    if (shapes.every(s => s.kind === 'text')) throw new Error('A diagram must contain a visual, not only text');
    return { kind: v.kind, shapes };
  }
  throw new Error('Unsupported diagram visual');
}

export const diagramNumber = (n: number) => Number(n.toFixed(8)).toString();

/** Keep repeating unit-interval ticks exact (e.g. 6/9 rather than 0.66666667). */
export function numberLineLabel(v: Extract<DiagramVisual, { kind: 'number-line' }>, n: number): string {
  let denominator = v.divisions;
  if (!Number.isInteger(denominator) || denominator < 1) return diagramNumber(n);
  while (denominator % 2 === 0) denominator /= 2;
  while (denominator % 5 === 0) denominator /= 5;
  const numerator = Math.round(n * v.divisions);
  if (v.min === 0 && v.max === 1 && denominator > 1 && n !== 0 && n !== 1
    && Math.abs(n * v.divisions - numerator) < 1e-8) return `${numerator}/${v.divisions}`;
  return diagramNumber(n);
}

export function numberLineLandings(v: Extract<DiagramVisual, { kind: 'number-line' }>): number[] {
  return v.jumps.reduce<number[]>((points, jump) => [...points, points[points.length - 1] + jump], [v.start]);
}
