/**
 * Geometry figure model for the `geometry` worked-example step.
 *
 * The model writes named points in real units (cm, m, units), the sides and
 * angles it wants marked, and their labels. Code draws the figure from those
 * coordinates, so it is always to scale, and code measures every side, angle
 * and polygon area. A numeric label that disagrees with the measured value
 * rejects the figure; a label with "?" or a letter marks an unknown and is
 * not checked.
 */

export interface GeometryPoint { name: string; x: number; y: number }
export interface GeometrySegment { from: string; to: string; label: string; style: 'solid' | 'dashed' }
export interface GeometryPolygon { vertices: string[]; label: string; shade: 'none' | 'a' | 'b' }
export interface GeometryAngle { vertex: string; from: string; to: string; label: string; kind: 'right' | 'arc' }

export interface GeometryFigure {
  unit: string;
  points: GeometryPoint[];
  polygons: GeometryPolygon[];
  segments: GeometrySegment[];
  angles: GeometryAngle[];
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const distance = (a: GeometryPoint, b: GeometryPoint) => Math.hypot(b.x - a.x, b.y - a.y);

/** Angle at `vertex` between rays to `from` and `to`, in degrees (0-180). */
export function angleDegrees(vertex: GeometryPoint, from: GeometryPoint, to: GeometryPoint): number {
  const a = Math.atan2(from.y - vertex.y, from.x - vertex.x);
  const b = Math.atan2(to.y - vertex.y, to.x - vertex.x);
  let d = Math.abs(a - b) * 180 / Math.PI;
  if (d > 180) d = 360 - d;
  return d;
}

/** Shoelace area; positive regardless of winding. */
export function polygonArea(points: GeometryPoint[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

const round = (n: number) => Number(n.toFixed(2));

/**
 * The number a label claims, or null when the label marks an unknown or names
 * something. "12 cm", "12", "5.5 m", "30°", "A = 15 m²" claim a number; "?",
 * "c", "x cm", "h" do not.
 */
export function claimedNumber(label: string, unit: string): number | null {
  if (!label || /\?/.test(label)) return null;
  const stripped = label
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\^\{?\\circ\}?|\\circ|°|degrees?/gi, '')
    .replace(/[$\\{}]/g, '')
    .replace(/^[A-Za-z]\w*\s*=\s*/, '')
    .replace(/(sq\.?\s*|square\s+)?(cm|mm|km|m|in|ft|yd|units?)(\^\{?2\}?|²)?(?![A-Za-z])/gi, '')
    .replace(new RegExp(unit ? `${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\^\\{?2\\}?|²)?(?![A-Za-z])` : '$^', 'gi'), '')
    .trim();
  if (!/^-?\d+(\.\d+)?$/.test(stripped)) return null;
  return Number(stripped);
}

export function parseGeometryFigure(value: unknown): GeometryFigure {
  if (!value || typeof value !== 'object') throw new Error('Geometry step needs a figure');
  const v = value as Record<string, unknown>;
  const unit = text(v.unit, 16);
  const rawPoints = Array.isArray(v.points) ? v.points : [];
  if (rawPoints.length < 2 || rawPoints.length > 16) throw new Error('A figure needs 2-16 named points');
  const points: GeometryPoint[] = rawPoints.map((raw) => {
    const p = raw as Record<string, unknown>;
    const name = text(p.name, 4);
    if (!name || !finite(p.x) || !finite(p.y)) throw new Error('Every point needs a name and numeric x, y');
    return { name, x: p.x, y: p.y };
  });
  const byName = new Map(points.map((p) => [p.name, p]));
  if (byName.size !== points.length) throw new Error('Point names must be unique');
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (!(span > 0)) throw new Error('Points must not all coincide');
  const need = (name: string, where: string) => {
    const p = byName.get(name);
    if (!p) throw new Error(`${where} names point "${name}", which is not in points`);
    return p;
  };

  const polygons: GeometryPolygon[] = (Array.isArray(v.polygons) ? v.polygons : []).slice(0, 6).map((raw) => {
    const g = raw as Record<string, unknown>;
    const vertices = (Array.isArray(g.vertices) ? g.vertices : []).map((n) => text(n, 4)).filter(Boolean);
    if (vertices.length < 3) throw new Error('A polygon needs at least 3 vertices');
    vertices.forEach((n) => need(n, 'A polygon'));
    const shade = g.shade === 'a' || g.shade === 'b' ? g.shade : 'none';
    return { vertices, label: text(g.label, 24), shade };
  });
  const segments: GeometrySegment[] = (Array.isArray(v.segments) ? v.segments : []).slice(0, 24).map((raw) => {
    const s = raw as Record<string, unknown>;
    const from = text(s.from, 4), to = text(s.to, 4);
    need(from, 'A segment'); need(to, 'A segment');
    if (from === to) throw new Error('A segment needs two different points');
    return { from, to, label: text(s.label, 24), style: s.style === 'dashed' ? 'dashed' : 'solid' };
  });
  const angles: GeometryAngle[] = (Array.isArray(v.angles) ? v.angles : []).slice(0, 8).map((raw) => {
    const a = raw as Record<string, unknown>;
    const vertex = text(a.vertex, 4), from = text(a.from, 4), to = text(a.to, 4);
    need(vertex, 'An angle'); need(from, 'An angle'); need(to, 'An angle');
    return { vertex, from, to, label: text(a.label, 16), kind: a.kind === 'right' ? 'right' : 'arc' };
  });
  if (polygons.length === 0 && segments.length === 0) throw new Error('A figure needs at least one polygon or segment');
  const figure = { unit, points, polygons, segments, angles };
  const mismatches = checkGeometryLabels(figure);
  if (mismatches.length) throw new Error(`The figure's labels disagree with its coordinates: ${mismatches.join('; ')}. Move the points so each labeled length or angle is true.`);
  return figure;
}

/** Labels whose number disagrees with what the coordinates measure. */
export function checkGeometryLabels(f: GeometryFigure): string[] {
  const at = new Map(f.points.map((p) => [p.name, p]));
  const issues: string[] = [];
  for (const s of f.segments) {
    const claimed = claimedNumber(s.label, f.unit);
    if (claimed === null) continue;
    const actual = distance(at.get(s.from)!, at.get(s.to)!);
    if (Math.abs(actual - claimed) > Math.max(0.01, actual * 0.01)) issues.push(`${s.from}${s.to} is labeled ${s.label} but measures ${round(actual)}`);
  }
  for (const a of f.angles) {
    const actual = angleDegrees(at.get(a.vertex)!, at.get(a.from)!, at.get(a.to)!);
    if (a.kind === 'right' && Math.abs(actual - 90) > 0.5) issues.push(`angle ${a.from}${a.vertex}${a.to} is marked right but measures ${round(actual)}°`);
    const claimed = claimedNumber(a.label, '');
    if (claimed !== null && Math.abs(actual - claimed) > 1) issues.push(`angle ${a.from}${a.vertex}${a.to} is labeled ${a.label} but measures ${round(actual)}°`);
  }
  for (const g of f.polygons) {
    const claimed = claimedNumber(g.label, f.unit);
    if (claimed === null) continue;
    const actual = polygonArea(g.vertices.map((n) => at.get(n)!));
    if (Math.abs(actual - claimed) > Math.max(0.01, actual * 0.01)) issues.push(`polygon ${g.vertices.join('')} is labeled ${g.label} but its area is ${round(actual)}`);
  }
  return issues;
}

/** Every side, marked angle and polygon area, measured from the coordinates. */
export function measureGeometry(f: GeometryFigure): string[] {
  const at = new Map(f.points.map((p) => [p.name, p]));
  const out: string[] = [];
  const seen = new Set<string>();
  const side = (a: string, b: string) => {
    const key = [a, b].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(`${a}${b} = ${round(distance(at.get(a)!, at.get(b)!))}`);
  };
  for (const g of f.polygons) g.vertices.forEach((n, i) => side(n, g.vertices[(i + 1) % g.vertices.length]));
  for (const s of f.segments) side(s.from, s.to);
  for (const a of f.angles) out.push(`angle ${a.from}${a.vertex}${a.to} = ${round(angleDegrees(at.get(a.vertex)!, at.get(a.from)!, at.get(a.to)!))}°`);
  for (const g of f.polygons) out.push(`area ${g.vertices.join('')} = ${round(polygonArea(g.vertices.map((n) => at.get(n)!)))}`);
  return out;
}

// ── Layout (shared by the renderer and tests) ─────────────────────────

export interface GeometryLayout {
  width: number;
  height: number;
  /** Map a figure point to SVG coordinates (y flipped so up is up). */
  toSvg: (p: { x: number; y: number }) => { x: number; y: number };
  /** SVG pixels per figure unit. */
  scale: number;
  centroid: { x: number; y: number };
}

export function layoutGeometry(f: GeometryFigure, width = 640, maxHeight = 380, pad = 56): GeometryLayout {
  const xs = f.points.map((p) => p.x), ys = f.points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 1e-9), h = Math.max(maxY - minY, 1e-9);
  const scale = Math.min((width - 2 * pad) / w, (maxHeight - 2 * pad) / h);
  const height = Math.min(maxHeight, h * scale + 2 * pad);
  const offX = (width - w * scale) / 2, offY = (height - h * scale) / 2;
  const toSvg = (p: { x: number; y: number }) => ({ x: offX + (p.x - minX) * scale, y: height - offY - (p.y - minY) * scale });
  const c = toSvg({ x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length });
  return { width, height, toSvg, scale, centroid: c };
}

/** One-line text form for reviewers and the agent: what is drawn, what is labeled, what it measures. */
export function geometrySummary(f: GeometryFigure): string {
  const pts = f.points.map((p) => `${p.name}(${round(p.x)},${round(p.y)})`).join(' ');
  const labels = [
    ...f.polygons.filter((g) => g.label).map((g) => `${g.vertices.join('')} "${g.label}"`),
    ...f.segments.filter((s) => s.label).map((s) => `${s.from}${s.to} "${s.label}"${s.style === 'dashed' ? ' dashed' : ''}`),
    ...f.angles.map((a) => `angle ${a.from}${a.vertex}${a.to} ${a.kind === 'right' ? 'right-angle mark' : `"${a.label}"`}`),
  ].join('; ');
  return `unit ${f.unit || 'units'}; points ${pts}; polygons ${f.polygons.map((g) => g.vertices.join('')).join(', ') || 'none'}; labels: ${labels || 'none'}; measured: ${measureGeometry(f).join(', ')}`;
}
