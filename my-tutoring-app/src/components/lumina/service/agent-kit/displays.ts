/**
 * The kit's displays (USER 2026-11-08): what a child sees on an agent-assembled item, built once for every agent
 * primitive. The agent picks a display and writes its values; code checks them and draws it. A display is one entry in
 * `DEFS`: how the author is told about it, how a draft is read, why it cannot be drawn, how it is drawn, what it says in
 * words, what value it shows (so code can check a key) and how much reading it asks of a child.
 *
 * Every renderer returns an HTML string drawn on the Lumina dark glass, so the component and the author's screenshot
 * (`look.ts`) show the same thing. Agent SVG keeps a light paper behind it, because the author draws for a light page.
 * Pure: no DOM, no React. Roadmap and rules: `qa/agent-surfaces/DISPLAY_ROADMAP.md`.
 *
 * One registry serves every agent primitive. A primitive states which displays fit it with a `DisplayCapability`: a
 * biology primitive sees the science and data displays, a general one sees all of them. A display built for one domain
 * is a registry entry, so every primitive that takes the domain gains it.
 */

export type Display =
  | { kind: 'svg'; svg: string; name?: string }
  | { kind: 'bar_graph'; title?: string; y_label?: string; labels: string[]; values: number[] }
  | { kind: 'number_line'; min: number; max: number; step: number; marks?: Array<{ value: number; label: string }> }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'text'; text: string }
  | { kind: 'clock'; hour: number; minute: number; numerals?: boolean; highlight?: 'hour' | 'minute' }
  | { kind: 'base_ten'; hundreds: number; tens: number; ones: number; ones_first?: boolean; highlight?: 'hundreds' | 'tens' | 'ones' }
  | { kind: 'pattern_blocks'; target?: PatternTarget; pieces?: PatternPiece[]; tray?: PatternShape[]; highlight?: 'slots' }
  | { kind: 'ten_frame'; filled: number; frames?: number; second?: number; highlight?: 'empty' }
  | { kind: 'array'; rows: number; columns: number; grouping?: 'rows' | 'columns'; icon?: string; highlight?: 'row' | 'column' }
  | { kind: 'coins'; coins: CoinName[]; highlight?: 'values' }
  | { kind: 'pictograph'; title?: string; icon: string; key_value: number; labels: string[]; values: number[]; highlight?: string }
  | { kind: 'timeline'; title?: string; events: TimelineEvent[]; highlight?: string }
  | { kind: 'flow'; title?: string; steps: FlowStep[]; loop?: boolean; highlight?: string }
  | { kind: 'map'; title?: string; places: MapPlace[]; paths?: Array<[string, string]>; regions?: MapRegion[]; legend?: Array<{ icon: string; meaning: string }>; compass?: boolean; highlight?: string }
  | { kind: 'cell'; title?: string; cell?: CellKind; parts: CellPart[]; highlight?: string }
  | { kind: 'zoom'; title?: string; levels: ZoomLevel[]; highlight?: string }
  | { kind: 'food_web'; title?: string; living: WebLiving[]; eats: Array<[string, string]>; highlight?: string };

export type CellKind = 'animal' | 'plant' | 'bacterium';
/** How a part of a cell is drawn. The shape is drawing structure; what the part is called is the author's `label`. */
export type CellShape = 'round' | 'bean' | 'oval' | 'sac' | 'dots' | 'folds';
export interface CellPart { shape: CellShape; label?: string; count?: number }
export interface ZoomLevel { label: string; icon?: string }
export interface WebLiving { name: string; icon?: string; level: number }

export type PatternShape = 'triangle' | 'rhombus' | 'trapezoid' | 'hexagon';
export type PatternTarget = PatternShape | 'big_triangle';
export interface PatternPiece { shape: PatternShape; slots: number[] }
export type CoinName = 'penny' | 'nickel' | 'dime' | 'quarter' | 'half_dollar' | 'one_dollar' | 'five_dollar' | 'ten_dollar';
export interface TimelineEvent { label: string; at?: number; icon?: string }
export interface FlowStep { label: string; icon?: string }
export interface MapPlace { name?: string; icon?: string; x: number; y: number }
export interface MapRegion { type: 'water' | 'park'; x: number; y: number; w: number; h: number; name?: string }

export const DISPLAY_KINDS = ['svg', 'bar_graph', 'number_line', 'table', 'text', 'clock', 'base_ten', 'pattern_blocks', 'ten_frame', 'array', 'coins', 'pictograph', 'timeline', 'flow', 'map', 'cell', 'zoom', 'food_web'] as const;
export type DisplayKind = typeof DISPLAY_KINDS[number];

/** The value a display shows, in a unit code can compare with a label or a prompt. */
export type ReadingUnit = 'time' | 'count' | 'cents';
export interface Reading { unit: ReadingUnit; value: number; /** Two displays with the same value that still differ (3 rows of 5, 5 rows of 3). */ identity?: string }

/** How much reading a display asks of a child, for the computed difficulty. */
export interface DisplayLoad { score: number; why: string }

/** What a display is for. `general` displays go to every primitive; the rest go to a primitive that takes the domain. */
export type DisplayDomain = 'general' | 'data' | 'math' | 'social' | 'science' | 'biology';

/**
 * Which displays a primitive offers its author. `without` removes one the primitive cannot use: `svg` where the author
 * never sees its drawing, or a display that repeats a richer block the primitive already has.
 */
export interface DisplayCapability { domains: readonly DisplayDomain[] | 'all'; without?: readonly DisplayKind[] }
export const ALL_DISPLAYS: DisplayCapability = { domains: 'all' };

type Args = Record<string, unknown>;
type Of<K extends DisplayKind> = Extract<Display, { kind: K }>;

interface DisplayDef<D extends Display> {
  /** The line the author reads. */
  prompt: string;
  read(raw: Args): D;
  errors(d: D): string[];
  draw(d: D): string;
  words(d: D): string;
  reading?(d: D): Reading | null;
  load?(d: D): DisplayLoad | null;
  /** The `highlight` values this display can draw, so a help lever changes the screen. */
  highlights?: readonly string[];
}

// ── Shared helpers ──────────────────────────────────────────────────────────

const MAX_SVG = 24_000;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const whole = (v: unknown, lo: number, hi: number) => finite(v) && Number.isInteger(v) && v >= lo && v <= hi;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const r2 = (v: number) => Math.round(v * 100) / 100;

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** The Lumina palette a drawing uses on the dark glass (slate text, white hairlines, the cyan and amber accents). */
const INK = { text: '#e2e8f0', muted: '#94a3b8', line: 'rgba(255,255,255,0.18)', strong: 'rgba(255,255,255,0.5)', face: 'rgba(15,23,42,0.6)', cyan: '#22d3ee', amber: '#fbbf24', asked: '#fb923c' };

/** An agent SVG made safe to inline: no scripts, handlers, foreign content or outside references. */
export function sanitizeSvg(svg: string): string {
  return String(svg ?? '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<(iframe|object|embed|audio|video)[\s\S]*?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*(?!#)[^"']*\2/gi, '')
    .replace(/url\(\s*['"]?\s*(?!#)[^)]*\)/gi, 'none');
}

const svgOpen = (w: number, h: number, label: string, maxWidth = w) =>
  `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${maxWidth}px" role="img" aria-label="${esc(label)}">`;

// ── The first displays ──────────────────────────────────────────────────────

function barGraph(d: Of<'bar_graph'>): string {
  const max = Math.max(1, ...d.values);
  const step = max > 50 ? 10 : max > 10 ? 5 : 1, top = Math.ceil(max / step) * step;
  const W = 360, H = 220, L = 40, B = 40, T = 24;
  const bw = (W - L - 10) / d.labels.length;
  let g = svgOpen(W, H, d.title ?? 'bar graph');
  if (d.title) g += `<text x="${W / 2}" y="16" text-anchor="middle" font-size="13" font-weight="600" fill="${INK.text}">${esc(d.title)}</text>`;
  for (let v = 0; v <= top; v += step) {
    const y = H - B - (v / top) * (H - B - T);
    g += `<line x1="${L}" x2="${W - 10}" y1="${y}" y2="${y}" stroke="${INK.line}"/><text x="${L - 6}" y="${y + 4}" font-size="10" text-anchor="end" fill="${INK.muted}">${v}</text>`;
  }
  d.labels.forEach((l, i) => {
    const h = (d.values[i] / top) * (H - B - T), x = L + i * bw + bw * 0.2;
    g += `<rect x="${x}" y="${H - B - h}" width="${bw * 0.6}" height="${h}" rx="3" fill="${INK.cyan}"/><text x="${x + bw * 0.3}" y="${H - B + 14}" font-size="11" text-anchor="middle" fill="${INK.text}">${esc(l)}</text>`;
  });
  if (d.y_label) g += `<text x="12" y="${H / 2}" font-size="10" fill="${INK.muted}" transform="rotate(-90 12 ${H / 2})" text-anchor="middle">${esc(d.y_label)}</text>`;
  return `${g}</svg>`;
}

function numberLine(d: Of<'number_line'>): string {
  const W = 380, L = 20, R = W - 20, y = 40, x = (v: number) => L + ((v - d.min) / (d.max - d.min)) * (R - L);
  let g = `${svgOpen(W, 80, 'number line')}<line x1="${L}" x2="${R}" y1="${y}" y2="${y}" stroke="${INK.text}" stroke-width="2"/>`;
  const ticks = Math.round((d.max - d.min) / d.step);
  for (let i = 0; i <= ticks; i++) { const v = d.min + i * d.step; g += `<line x1="${x(v)}" x2="${x(v)}" y1="${y - 7}" y2="${y + 7}" stroke="${INK.text}"/>`; }
  for (const m of d.marks ?? []) {
    const q = String(m.label).trim() === '?';
    g += `<circle cx="${x(m.value)}" cy="${y}" r="5" fill="${q ? INK.asked : INK.cyan}"/><text x="${x(m.value)}" y="${y + 26}" font-size="13" text-anchor="middle" fill="${INK.text}">${esc(m.label)}</text>`;
  }
  return `${g}</svg>`;
}

// ── Clock (AD-1; drawing ported from `analog-clock`) ────────────────────────

function clock(d: Of<'clock'>): string {
  const S = 200, C = S / 2, R = 92;
  const at = (deg: number, r: number) => ({ x: r2(C + r * Math.sin((deg * Math.PI) / 180)), y: r2(C - r * Math.cos((deg * Math.PI) / 180)) });
  let g = `${svgOpen(S, S, 'clock', 240)}<circle cx="${C}" cy="${C}" r="${R}" fill="${INK.face}" stroke="${INK.strong}" stroke-width="2"/>`;
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0, a = at(i * 6, major ? R - 8 : R - 4), b = at(i * 6, R - 1);
    g += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${major ? INK.strong : INK.line}" stroke-width="${major ? 2 : 1}" stroke-linecap="round"/>`;
  }
  if (d.numerals !== false) for (let n = 1; n <= 12; n++) {
    const p = at(n * 30, R - 21);
    g += `<text x="${p.x}" y="${p.y + 6}" text-anchor="middle" font-size="17" font-weight="600" fill="${INK.text}">${n}</text>`;
  }
  const hand = (deg: number, length: number, width: number, color: string, lit: boolean) => {
    const halo = lit ? `<line x1="${C}" y1="${C}" x2="${C}" y2="${C - length}" stroke="${INK.amber}" stroke-opacity="0.35" stroke-width="${width + 9}" stroke-linecap="round" transform="rotate(${deg} ${C} ${C})"/>` : '';
    return `${halo}<line x1="${C}" y1="${C}" x2="${C}" y2="${C - length}" stroke="${lit ? INK.amber : color}" stroke-width="${width}" stroke-linecap="round" transform="rotate(${deg} ${C} ${C})"/>`;
  };
  g += hand((d.hour % 12) * 30 + d.minute / 2, 46, 7, INK.text, d.highlight === 'hour');
  g += hand(d.minute * 6, 72, 4, INK.cyan, d.highlight === 'minute');
  g += `<circle cx="${C}" cy="${C}" r="6" fill="${INK.text}"/>`;
  return `${g}</svg>`;
}

/** Where the hands point, never the time as digits: the tutor can coach from it without saying the answer. */
function clockWords(d: Of<'clock'>): string {
  const after = d.hour % 12 || 12, next = (d.hour % 12) + 1;
  const short = d.minute === 0 ? `at ${after}` : `between ${after} and ${next}`;
  const long = d.minute % 5 === 0 ? `at ${d.minute === 0 ? 12 : d.minute / 5}` : `${d.minute} small marks past 12`;
  return `a clock${d.numerals === false ? ' with no numbers' : ''}: short hand ${short}, long hand ${long}`;
}

function clockLoad(d: Of<'clock'>): DisplayLoad {
  const [extra, grain] = d.minute === 0 ? [0, 'to the hour'] : d.minute === 30 ? [0.2, 'to the half hour'] : d.minute % 15 === 0 ? [0.4, 'to the quarter hour'] : d.minute % 5 === 0 ? [0.6, 'to five minutes'] : [0.8, 'to the minute'];
  const bare = d.numerals === false ? 0.3 : 0;
  return { score: 0.4 + extra + bare, why: `reading a clock ${grain}${bare ? ' with no numbers' : ''}` };
}

// ── Base ten blocks (AD-3) ──────────────────────────────────────────────────

const PLACE = { hundreds: { color: '#818cf8', value: 100 }, tens: { color: INK.cyan, value: 10 }, ones: { color: '#34d399', value: 1 } } as const;
type Place = keyof typeof PLACE;

function baseTen(d: Of<'base_ten'>): string {
  const cell = 8, side = cell * 10, gap = 6, top = 16;
  const piece = (place: Place, i: number): { x: number; y: number; w: number; h: number; body: string } => {
    const color = PLACE[place].color;
    if (place === 'hundreds') {
      const x = (i % 3) * (side + gap), y = Math.floor(i / 3) * (side + gap);
      let lines = '';
      for (let n = 1; n < 10; n++) lines += `<line x1="${x + n * cell}" x2="${x + n * cell}" y1="${y}" y2="${y + side}" stroke="#0f172a" stroke-opacity="0.45"/><line y1="${y + n * cell}" y2="${y + n * cell}" x1="${x}" x2="${x + side}" stroke="#0f172a" stroke-opacity="0.45"/>`;
      return { x, y, w: side, h: side, body: `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="2" fill="${color}"/>${lines}` };
    }
    if (place === 'tens') {
      const x = (i % 10) * (cell + gap), y = Math.floor(i / 10) * (side + gap);
      let lines = '';
      for (let n = 1; n < 10; n++) lines += `<line x1="${x}" x2="${x + cell}" y1="${y + n * cell}" y2="${y + n * cell}" stroke="#0f172a" stroke-opacity="0.45"/>`;
      return { x, y, w: cell, h: side, body: `<rect x="${x}" y="${y}" width="${cell}" height="${side}" rx="1.5" fill="${color}"/>${lines}` };
    }
    const x = (i % 5) * (cell + gap), y = Math.floor(i / 5) * (cell + gap);
    return { x, y, w: cell, h: cell, body: `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1.5" fill="${color}"/>` };
  };
  const order: Place[] = d.ones_first ? ['ones', 'tens', 'hundreds'] : ['hundreds', 'tens', 'ones'];
  let x = 4, height = 0, body = '';
  for (const place of order) {
    const count = d[place];
    if (!count) continue;
    const pieces = Array.from({ length: count }, (_, i) => piece(place, i));
    const w = Math.max(...pieces.map(p => p.x + p.w)), h = Math.max(...pieces.map(p => p.y + p.h));
    let g = pieces.map(p => p.body).join('');
    if (d.highlight === place) {
      const first = pieces[0];
      g += `<rect x="${first.x - 2}" y="${first.y - 2}" width="${first.w + 4}" height="${first.h + 4}" rx="3" fill="none" stroke="${INK.amber}" stroke-width="2"/><text x="${first.x + first.w / 2}" y="${first.y - 5}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK.amber}">${PLACE[place].value}</text>`;
    }
    body += `<g transform="translate(${x} ${top})">${g}</g>`;
    x += w + 16;
    height = Math.max(height, h);
  }
  const W = Math.max(x - 12, 40), H = height + top + 4;
  return `${svgOpen(W, H, 'base ten blocks', Math.min(W * 1.6, 420))}${body}</svg>`;
}

function baseTenWords(d: Of<'base_ten'>): string {
  const parts = [d.hundreds ? `${d.hundreds} hundred flat${d.hundreds === 1 ? '' : 's'}` : '', d.tens ? `${d.tens} ten rod${d.tens === 1 ? '' : 's'}` : '', d.ones ? `${d.ones} one cube${d.ones === 1 ? '' : 's'}` : ''].filter(Boolean);
  return `base ten blocks: ${parts.join(', ')}`;
}

// ── Pattern blocks (AD-4; the small triangles a shape is cut into, so code knows what fills it) ──

type Lattice = [number, number];
const HEX_RING: Lattice[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const hexWedge = (i: number): Lattice[] => [[0, 0], HEX_RING[i], HEX_RING[(i + 1) % 6]];
const BIG_TRIANGLE: Lattice[][] = [[[0, 0], [1, 0], [0, 1]], [[1, 0], [1, 1], [0, 1]], [[1, 0], [2, 0], [1, 1]], [[0, 1], [1, 1], [0, 2]]];
const TARGET_CELLS: Record<PatternTarget, Lattice[][]> = {
  triangle: [hexWedge(0)], rhombus: [hexWedge(0), hexWedge(1)], trapezoid: [hexWedge(0), hexWedge(1), hexWedge(2)],
  hexagon: [0, 1, 2, 3, 4, 5].map(hexWedge), big_triangle: BIG_TRIANGLE,
};
const PIECE_AREA: Record<PatternShape, number> = { triangle: 1, rhombus: 2, trapezoid: 3, hexagon: 6 };
const PIECE_COLOR: Record<PatternShape, string> = { triangle: '#34d399', rhombus: '#60a5fa', trapezoid: '#f87171', hexagon: '#fbbf24' };
const PATTERN_SHAPES = Object.keys(PIECE_AREA) as PatternShape[];
const PATTERN_TARGETS = Object.keys(TARGET_CELLS) as PatternTarget[];
const edgeKey = (a: Lattice, b: Lattice) => [a.join(','), b.join(',')].sort().join('|');
const cellEdges = (c: Lattice[]) => [edgeKey(c[0], c[1]), edgeKey(c[1], c[2]), edgeKey(c[2], c[0])];

/** The cells joined by shared edges, so a piece is one shape and not scattered triangles. */
function connected(cells: Lattice[][]): boolean {
  if (cells.length < 2) return true;
  const seen = new Set([0]);
  for (let grew = true; grew;) {
    grew = false;
    cells.forEach((c, i) => {
      if (seen.has(i)) return;
      if (Array.from(seen).some(j => cellEdges(cells[j]).some(e => cellEdges(c).includes(e)))) { seen.add(i); grew = true; }
    });
  }
  return seen.size === cells.length;
}

const PATTERN_UNIT = 34;
const toPx = ([u, v]: Lattice): [number, number] => [r2((u + v / 2) * PATTERN_UNIT), r2(-v * PATTERN_UNIT * 0.866)];

/** One piece drawn from its cells: filled triangles with only the outer edges stroked, so it reads as one block. */
function patternPiece(cells: Lattice[][], color: string): string {
  const counts = new Map<string, number>();
  const allEdges: Array<[Lattice, Lattice]> = [];
  for (const c of cells) for (const [a, b] of [[c[0], c[1]], [c[1], c[2]], [c[2], c[0]]] as Array<[Lattice, Lattice]>) {
    counts.set(edgeKey(a, b), (counts.get(edgeKey(a, b)) ?? 0) + 1);
    allEdges.push([a, b]);
  }
  const fill = cells.map(c => `<polygon points="${c.map(p => toPx(p).join(',')).join(' ')}" fill="${color}" stroke="${color}" stroke-width="0.6"/>`).join('');
  const outline = allEdges.filter(([a, b]) => counts.get(edgeKey(a, b)) === 1).map(([a, b]) => {
    const [x1, y1] = toPx(a), [x2, y2] = toPx(b);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>`;
  }).join('');
  return fill + outline;
}

/** The cells a loose block is drawn from in the tray. */
const shapeCells = (shape: PatternShape): Lattice[][] => TARGET_CELLS[shape];

function bounds(points: Lattice[]) {
  const px = points.map(toPx);
  const xs = px.map(p => p[0]), ys = px.map(p => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function patternBlocks(d: Of<'pattern_blocks'>): string {
  const pad = 6;
  let y = pad, W = 0, body = '';
  if (d.target) {
    const cells = TARGET_CELLS[d.target];
    const b = bounds(cells.flat());
    let g = cells.map(c => `<polygon points="${c.map(p => toPx(p).join(',')).join(' ')}" fill="${INK.face}"/>`).join('');
    if (d.highlight === 'slots') for (const c of cells) {
      const pts = c.map(toPx);
      g += `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${INK.amber}" stroke-width="1" stroke-dasharray="3 3"/>`;
    }
    for (const piece of d.pieces ?? []) g += patternPiece(piece.slots.map(i => cells[i]), PIECE_COLOR[piece.shape]);
    const counts = new Map<string, number>();
    const edges: Array<[Lattice, Lattice]> = [];
    for (const c of cells) for (const [a, e] of [[c[0], c[1]], [c[1], c[2]], [c[2], c[0]]] as Array<[Lattice, Lattice]>) { counts.set(edgeKey(a, e), (counts.get(edgeKey(a, e)) ?? 0) + 1); edges.push([a, e]); }
    for (const [a, e] of edges.filter(([p, q]) => counts.get(edgeKey(p, q)) === 1)) {
      const [x1, y1] = toPx(a), [x2, y2] = toPx(e);
      g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK.text}" stroke-width="2" stroke-linecap="round"/>`;
    }
    W = Math.max(W, b.x1 - b.x0);
    body += `<g transform="translate(${pad - b.x0} ${y - b.y0})">${g}</g>`;
    y += b.y1 - b.y0 + (d.tray?.length ? 16 : 0);
  }
  if (d.tray?.length) {
    let x = pad, rowH = 0;
    for (const shape of d.tray) {
      const cells = shapeCells(shape), b = bounds(cells.flat());
      const w = b.x1 - b.x0;
      if (x + w > 240 && x > pad) { x = pad; y += rowH + 8; rowH = 0; }
      body += `<g transform="translate(${x - b.x0} ${y - b.y0})">${patternPiece(cells, PIECE_COLOR[shape])}</g>`;
      x += w + 10;
      rowH = Math.max(rowH, b.y1 - b.y0);
      W = Math.max(W, x - pad);
    }
    y += rowH;
  }
  const size = (d.target ? bounds(TARGET_CELLS[d.target].flat()) : null);
  const H = (d.target || d.tray?.length) ? r2(y + pad) : 40;
  const WW = r2(W + pad * 2);
  return `${svgOpen(WW, H, 'pattern blocks', Math.max(size ? (size.x1 - size.x0) * 1.5 : 0, 180))}${body}</svg>`;
}

function patternWords(d: Of<'pattern_blocks'>): string {
  const bits: string[] = [];
  if (d.target) {
    const covered = (d.pieces ?? []).reduce((s, p) => s + p.slots.length, 0), total = TARGET_CELLS[d.target].length;
    bits.push(`the outline of a ${d.target.replace('_', ' ')}${(d.pieces ?? []).length ? ` with ${d.pieces!.map(p => `a ${p.shape}`).join(', ')} placed on it, ${total - covered} of ${total} small parts still empty` : ', empty'}`);
  }
  if (d.tray?.length) bits.push(`loose blocks: ${d.tray.join(', ')}`);
  return `pattern blocks: ${bits.join('; ')}`;
}

/** What a pattern-block display covers, for the check that a key really fills its shape. */
export function patternFill(d: Display | undefined): { target: number; covered: number; tray: number } | null {
  if (d?.kind !== 'pattern_blocks') return null;
  return { target: d.target ? TARGET_CELLS[d.target].length : 0, covered: (d.pieces ?? []).reduce((s, p) => s + p.slots.length, 0), tray: (d.tray ?? []).reduce((s, x) => s + PIECE_AREA[x], 0) };
}

// ── Ten frame (AD-5) ────────────────────────────────────────────────────────

const framesOf = (d: Of<'ten_frame'>) => d.frames ?? (d.filled > 10 ? 2 : 1);

function tenFrame(d: Of<'ten_frame'>): string {
  const cell = 44, pad = 4, frames = framesOf(d), H = frames * (cell * 2 + 12) + pad;
  let g = svgOpen(cell * 5 + pad * 2, H, 'ten frame', 260);
  const second = d.second ?? 0, firstCount = d.filled - second;
  for (let i = 0; i < frames * 10; i++) {
    const frame = Math.floor(i / 10), at = i % 10, x = pad + (at % 5) * cell, y = pad + frame * (cell * 2 + 12) + (at >= 5 ? cell : 0);
    const filled = i < d.filled;
    g += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="rgba(255,255,255,0.04)" stroke="${!filled && d.highlight === 'empty' ? INK.amber : INK.strong}" stroke-width="${!filled && d.highlight === 'empty' ? 2.5 : 1.5}"${!filled && d.highlight === 'empty' ? ' stroke-dasharray="5 4"' : ''}/>`;
    if (filled) g += `<circle cx="${x + cell / 2}" cy="${y + cell / 2}" r="15" fill="${i < firstCount ? INK.cyan : INK.amber}"/>`;
  }
  return `${g}</svg>`;
}

// ── Array (AD-7) ────────────────────────────────────────────────────────────

function arrayDrawn(d: Of<'array'>): string {
  const cell = 30, pad = 8, W = d.columns * cell + pad * 2, H = d.rows * cell + pad * 2;
  let g = svgOpen(W, H, 'array', Math.min(W * 1.2, 320));
  if (d.highlight === 'row') g += `<rect x="${pad - 2}" y="${pad - 2}" width="${d.columns * cell + 4}" height="${cell + 4}" rx="8" fill="${INK.amber}" fill-opacity="0.25" stroke="${INK.amber}"/>`;
  if (d.highlight === 'column') g += `<rect x="${pad - 2}" y="${pad - 2}" width="${cell + 4}" height="${d.rows * cell + 4}" rx="8" fill="${INK.amber}" fill-opacity="0.25" stroke="${INK.amber}"/>`;
  const groups = d.grouping === 'rows' ? d.rows : d.grouping === 'columns' ? d.columns : 0;
  for (let i = 0; i < groups; i++) {
    const x = pad + (d.grouping === 'columns' ? i * cell : 0), y = pad + (d.grouping === 'rows' ? i * cell : 0);
    g += `<rect x="${x + 1}" y="${y + 1}" width="${(d.grouping === 'columns' ? cell : d.columns * cell) - 2}" height="${(d.grouping === 'rows' ? cell : d.rows * cell) - 2}" rx="7" fill="none" stroke="${INK.line}" stroke-dasharray="4 3"/>`;
  }
  for (let r = 0; r < d.rows; r++) for (let c = 0; c < d.columns; c++) {
    const x = pad + c * cell + cell / 2, y = pad + r * cell + cell / 2;
    g += d.icon ? `<text x="${x}" y="${y + 7}" text-anchor="middle" font-size="20">${esc(d.icon)}</text>` : `<circle cx="${x}" cy="${y}" r="10" fill="${INK.cyan}"/>`;
  }
  return `${g}</svg>`;
}

// ── Coins (AD-8) ────────────────────────────────────────────────────────────

const COINS: Record<CoinName, { cents: number; r?: number; color: string; word: string }> = {
  penny: { cents: 1, r: 17, color: '#c2743c', word: 'penny' },
  nickel: { cents: 5, r: 19, color: '#94a3b8', word: 'nickel' },
  dime: { cents: 10, r: 15.5, color: '#cbd5e1', word: 'dime' },
  quarter: { cents: 25, r: 21, color: '#e2e8f0', word: 'quarter' },
  half_dollar: { cents: 50, r: 25, color: '#e2e8f0', word: 'half dollar' },
  one_dollar: { cents: 100, color: '#34d399', word: '$1' },
  five_dollar: { cents: 500, color: '#34d399', word: '$5' },
  ten_dollar: { cents: 1000, color: '#34d399', word: '$10' },
};
const coinName = (v: unknown): string => {
  const n = String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/^pennies$/, 'penny').replace(/s$/, '');
  return n === 'dollar' || n === 'dollar_bill' || n === 'one_dollar_bill' ? 'one_dollar' : n;
};
const valueText = (cents: number) => (cents >= 100 ? `$${cents / 100}` : `${cents}¢`);

function coins(d: Of<'coins'>): string {
  const W = 320, top = d.highlight === 'values' ? 16 : 4;
  let x = 4, y = top, rowH = 0, body = '';
  for (const name of d.coins) {
    const c = COINS[name], w = c.r ? c.r * 2 : 76, h = c.r ? c.r * 2 : 38;
    if (x + w > W - 4 && x > 4) { x = 4; y += rowH + (d.highlight === 'values' ? 20 : 8); rowH = 0; }
    const cx = x + w / 2, cy = y + h / 2;
    if (c.r) body += `<circle cx="${cx}" cy="${cy}" r="${c.r}" fill="${c.color}" stroke="#0f172a" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="${c.r - 3}" fill="none" stroke="#0f172a" stroke-opacity="0.35"/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="${name === 'half_dollar' ? 8.5 : 9.5}" font-weight="700" fill="#0f172a">${c.word}</text>`;
    else body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${c.color}" stroke="#0f172a" stroke-width="1.5"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="16" font-weight="800" fill="#0f172a">${c.word}</text>`;
    if (d.highlight === 'values') body += `<text x="${cx}" y="${y - 3}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK.amber}">${valueText(c.cents)}</text>`;
    x += w + 8;
    rowH = Math.max(rowH, h);
  }
  return `${svgOpen(W, y + rowH + 4, 'coins', W)}${body}</svg>`;
}

function coinWords(d: Of<'coins'>): string {
  const counts = new Map<CoinName, number>();
  for (const c of d.coins) counts.set(c, (counts.get(c) ?? 0) + 1);
  return `money: ${Array.from(counts).map(([name, n]) => `${n} ${COINS[name].word}${n === 1 ? '' : name === 'penny' ? '' : 's'}`.replace('1 penny', '1 penny')).join(', ')}`;
}

// ── Picture graph (AD-9) ────────────────────────────────────────────────────

function pictograph(d: Of<'pictograph'>): string {
  const left = 86, size = 26, rowH = 32, top = d.title ? 26 : 8;
  const iconsIn = (v: number) => v / d.key_value;
  const most = Math.max(1, ...d.values.map(v => Math.ceil(iconsIn(v))));
  const W = Math.max(left + most * size + 10, 240), H = top + d.labels.length * rowH + 28;
  let g = svgOpen(W, H, d.title ?? 'picture graph', Math.min(W * 1.25, 420));
  if (d.title) g += `<text x="${W / 2}" y="16" text-anchor="middle" font-size="13" font-weight="600" fill="${INK.text}">${esc(d.title)}</text>`;
  d.labels.forEach((label, i) => {
    const y = top + i * rowH;
    if (d.highlight === label) g += `<rect x="2" y="${y + 1}" width="${W - 4}" height="${rowH - 2}" rx="6" fill="${INK.amber}" fill-opacity="0.22"/>`;
    g += `<text x="${left - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" font-size="12" fill="${INK.text}">${esc(label)}</text><line x1="${left - 2}" x2="${left - 2}" y1="${y + 2}" y2="${y + rowH - 2}" stroke="${INK.line}"/>`;
    const n = iconsIn(d.values[i]);
    for (let k = 0; k < Math.floor(n); k++) g += `<text x="${left + k * size + size / 2}" y="${y + rowH / 2 + 7}" text-anchor="middle" font-size="20">${esc(d.icon)}</text>`;
    if (n % 1) {
      const k = Math.floor(n), ix = left + k * size;
      g += `<svg x="${ix}" y="${y}" width="${size / 2}" height="${rowH}" viewBox="0 0 ${size / 2} ${rowH}"><text x="${size / 2}" y="${rowH / 2 + 7}" text-anchor="middle" font-size="20">${esc(d.icon)}</text></svg>`;
    }
  });
  g += `<text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="12" fill="${INK.muted}">Key: ${esc(d.icon)} = ${d.key_value}</text>`;
  return `${g}</svg>`;
}

// ── Timeline (AD-10) ────────────────────────────────────────────────────────

function timeline(d: Of<'timeline'>): string {
  const W = 440, axis = 96, L = 34, R = W - 34, top = d.title ? 20 : 0, H = axis + 84 + top;
  const dated = d.events.every(e => finite(e.at));
  const lo = dated ? Math.min(...d.events.map(e => e.at!)) : 0, hi = dated ? Math.max(...d.events.map(e => e.at!)) : d.events.length - 1;
  const span = Math.max(hi - lo, 1);
  const xAt = (e: TimelineEvent, i: number) => r2(L + (((dated ? e.at! : i) - lo) / span) * (R - L));
  let g = svgOpen(W, H, d.title ?? 'timeline', W);
  if (d.title) g += `<text x="${W / 2}" y="14" text-anchor="middle" font-size="13" font-weight="600" fill="${INK.text}">${esc(d.title)}</text>`;
  g += `<line x1="${L - 18}" x2="${R + 18}" y1="${axis + top}" y2="${axis + top}" stroke="${INK.text}" stroke-width="2.5"/><path d="M ${R + 18} ${axis + top - 5} L ${R + 26} ${axis + top} L ${R + 18} ${axis + top + 5} Z" fill="${INK.text}"/>`;
  d.events.forEach((e, i) => {
    const x = xAt(e, i), up = i % 2 === 0, y = axis + top;
    const asked = e.label.trim() === '?', lit = d.highlight === e.label;
    const dot = asked ? INK.asked : lit ? INK.amber : INK.cyan;
    const tip = up ? y - 34 : y + 34;
    g += `<line x1="${x}" x2="${x}" y1="${y}" y2="${tip}" stroke="${INK.line}"/><circle cx="${x}" cy="${y}" r="6" fill="${dot}"/>`;
    const textY = up ? tip - 8 : tip + 16;
    g += `<text x="${x}" y="${textY}" text-anchor="middle" font-size="12" font-weight="${asked || lit ? 700 : 500}" fill="${asked ? INK.asked : lit ? INK.amber : INK.text}">${esc(`${e.icon ? `${e.icon} ` : ''}${e.label}`)}</text>`;
    if (dated) g += `<text x="${x}" y="${up ? y + 18 : y - 10}" text-anchor="middle" font-size="11" fill="${INK.muted}">${esc(e.at)}</text>`;
  });
  return `${g}</svg>`;
}

// ── Flow (AD-11; a chain of steps, or a loop when the last leads back to the first) ──

const FLOW_W = 92, FLOW_H = 56;

/** A straight arrow from one point to another. */
function flowArrow(x1: number, y1: number, x2: number, y2: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1), head = 8;
  const p = (t: number) => `${r2(x2 - head * Math.cos(a + t))} ${r2(y2 - head * Math.sin(a + t))}`;
  return `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${INK.strong}" stroke-width="2"/><path d="M ${r2(x2)} ${r2(y2)} L ${p(0.45)} L ${p(-0.45)} Z" fill="${INK.strong}"/>`;
}

/** A step's label on at most two lines. */
function flowLines(label: string): string[] {
  const words = label.split(/\s+/);
  if (label.length <= 13 || words.length < 2) return [label];
  const gap = (i: number) => Math.abs(words.slice(0, i).join(' ').length - label.length / 2);
  let best = 1;
  for (let i = 1; i < words.length; i++) if (gap(i) < gap(best)) best = i;
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

function flowNode(s: FlowStep, cx: number, cy: number, lit: boolean): string {
  const asked = s.label.trim() === '?', stroke = asked ? INK.asked : lit ? INK.amber : INK.strong;
  const lines = flowLines(s.label), textTop = s.icon ? cy + 12 : cy + 5 - (lines.length - 1) * 7;
  let g = `<rect x="${r2(cx - FLOW_W / 2)}" y="${r2(cy - FLOW_H / 2)}" width="${FLOW_W}" height="${FLOW_H}" rx="10" fill="${INK.face}" stroke="${stroke}" stroke-width="${asked || lit ? 2.5 : 1.5}"/>`;
  if (s.icon) g += `<text x="${r2(cx)}" y="${r2(cy - 4)}" text-anchor="middle" font-size="20">${esc(s.icon)}</text>`;
  lines.forEach((l, i) => { g += `<text x="${r2(cx)}" y="${r2(textTop + i * (s.icon ? 11 : 14))}" text-anchor="middle" font-size="${s.icon && lines.length > 1 ? 10 : 12}" font-weight="${asked || lit ? 700 : 500}" fill="${asked ? INK.asked : lit ? INK.amber : INK.text}">${esc(l)}</text>`; });
  return g;
}

function flowDrawn(d: Of<'flow'>): string {
  const n = d.steps.length, top = d.title ? 24 : 0;
  const title = (w: number) => (d.title ? `<text x="${w / 2}" y="15" text-anchor="middle" font-size="13" font-weight="600" fill="${INK.text}">${esc(d.title)}</text>` : '');
  if (d.loop) {
    const R = Math.max(104, 36 * n), W = 2 * R + FLOW_W + 16, H = 2 * R + FLOW_H + 16 + top, cx = W / 2, cy = top + (H - top) / 2;
    const at = (i: number) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; };
    let g = `${svgOpen(W, H, d.title ?? 'cycle', 400)}${title(W)}`;
    for (let i = 0; i < n; i++) {
      const a = at(i), b = at((i + 1) % n), len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      // Trimmed to the edge of each box: the distance along this line to the box's nearer side.
      const trim = Math.min((FLOW_W / 2) / Math.max(Math.abs(ux), 0.001), (FLOW_H / 2) / Math.max(Math.abs(uy), 0.001)) + 5;
      g += flowArrow(a.x + ux * trim, a.y + uy * trim, b.x - ux * trim, b.y - uy * trim);
    }
    d.steps.forEach((s, i) => { const p = at(i); g += flowNode(s, p.x, p.y, d.highlight === s.label); });
    return `${g}</svg>`;
  }
  const perRow = 4, gap = 30, rows = Math.ceil(n / perRow), rowH = FLOW_H + 34;
  const W = Math.min(n, perRow) * FLOW_W + (Math.min(n, perRow) - 1) * gap + 8, H = top + rows * rowH - 26;
  const at = (i: number) => ({ x: 4 + FLOW_W / 2 + (i % perRow) * (FLOW_W + gap), y: top + 4 + FLOW_H / 2 + Math.floor(i / perRow) * rowH });
  let g = `${svgOpen(W, H, d.title ?? 'flow', Math.min(W, 460))}${title(W)}`;
  for (let i = 0; i < n - 1; i++) {
    const a = at(i), b = at(i + 1);
    if (a.y === b.y) { g += flowArrow(a.x + FLOW_W / 2 + 2, a.y, b.x - FLOW_W / 2 - 2, b.y); continue; }
    // The row ends: down from the last box, back along the gap, into the top of the next row's first box.
    const mid = a.y + FLOW_H / 2 + 17;
    g += `<path d="M ${a.x} ${a.y + FLOW_H / 2 + 2} L ${a.x} ${mid} L ${b.x} ${mid}" fill="none" stroke="${INK.strong}" stroke-width="2"/>${flowArrow(b.x, mid, b.x, b.y - FLOW_H / 2 - 2)}`;
  }
  d.steps.forEach((s, i) => { const p = at(i); g += flowNode(s, p.x, p.y, d.highlight === s.label); });
  return `${g}</svg>`;
}

// ── Map (AD-10) ─────────────────────────────────────────────────────────────

function mapDrawn(d: Of<'map'>): string {
  const U = 28, pad = 22, grid = U * 10, top = d.title ? 22 : 0, legendH = d.legend?.length ? 22 * Math.ceil(d.legend.length / 2) + 6 : 0;
  const px = (x: number) => pad + x * U, py = (y: number) => top + pad + (10 - y) * U;
  const W = grid + pad * 2, H = top + grid + pad * 2 + legendH;
  let g = svgOpen(W, H, d.title ?? 'map', 380);
  if (d.title) g += `<text x="${W / 2}" y="15" text-anchor="middle" font-size="13" font-weight="600" fill="${INK.text}">${esc(d.title)}</text>`;
  g += `<rect x="${pad}" y="${top + pad}" width="${grid}" height="${grid}" rx="8" fill="${INK.face}" stroke="${INK.line}"/>`;
  for (const r of d.regions ?? []) {
    const fill = r.type === 'water' ? 'rgba(56,189,248,0.32)' : 'rgba(52,211,153,0.25)';
    g += `<rect x="${px(r.x)}" y="${py(r.y + r.h)}" width="${r.w * U}" height="${r.h * U}" rx="6" fill="${fill}"/>`;
    if (r.name) g += `<text x="${px(r.x + r.w / 2)}" y="${py(r.y + r.h / 2) + 4}" text-anchor="middle" font-size="11" font-style="italic" fill="${INK.muted}">${esc(r.name)}</text>`;
  }
  const byName = new Map((d.places).filter(p => p.name).map(p => [p.name!, p]));
  for (const [a, b] of d.paths ?? []) {
    const from = byName.get(a)!, to = byName.get(b)!;
    g += `<line x1="${px(from.x)}" y1="${py(from.y)}" x2="${px(to.x)}" y2="${py(to.y)}" stroke="${INK.muted}" stroke-width="2.5" stroke-dasharray="6 5"/>`;
  }
  for (const p of d.places) {
    const x = px(p.x), y = py(p.y), lit = d.highlight === p.name;
    if (lit) g += `<circle cx="${x}" cy="${y}" r="16" fill="${INK.amber}" fill-opacity="0.3" stroke="${INK.amber}" stroke-width="2"/>`;
    g += p.icon ? `<text x="${x}" y="${y + 7}" text-anchor="middle" font-size="20">${esc(p.icon)}</text>` : `<circle cx="${x}" cy="${y}" r="6" fill="${INK.cyan}"/>`;
    if (p.name) g += `<text x="${x}" y="${y + 24}" text-anchor="middle" font-size="11" font-weight="600" fill="${lit ? INK.amber : INK.text}">${esc(p.name)}</text>`;
  }
  if (d.compass !== false) {
    const cx = pad + grid - 26, cy = top + pad + 28;
    g += `<circle cx="${cx}" cy="${cy}" r="20" fill="#0f172a" fill-opacity="0.75" stroke="${INK.line}"/><path d="M ${cx} ${cy - 15} L ${cx - 4} ${cy} L ${cx + 4} ${cy} Z" fill="${INK.amber}"/><path d="M ${cx} ${cy + 15} L ${cx - 4} ${cy} L ${cx + 4} ${cy} Z" fill="${INK.muted}"/>`;
    g += `<text x="${cx}" y="${cy - 22}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK.text}">N</text><text x="${cx}" y="${cy + 31}" text-anchor="middle" font-size="10" fill="${INK.muted}">S</text><text x="${cx + 27}" y="${cy + 4}" text-anchor="middle" font-size="10" fill="${INK.muted}">E</text><text x="${cx - 27}" y="${cy + 4}" text-anchor="middle" font-size="10" fill="${INK.muted}">W</text>`;
  }
  (d.legend ?? []).forEach((l, i) => {
    const x = pad + (i % 2) * (grid / 2), y = top + grid + pad * 2 + 16 + Math.floor(i / 2) * 22;
    g += `<text x="${x}" y="${y}" font-size="13" fill="${INK.text}">${esc(l.icon)} = ${esc(l.meaning)}</text>`;
  });
  return `${g}</svg>`;
}

// ── Biology: a cell, a zoom through scales, a food web ──────────────────────

export const CELL_SHAPES: readonly CellShape[] = ['round', 'bean', 'oval', 'sac', 'dots', 'folds'];
const CELL_FILL: Record<CellShape, string> = { round: '#a78bfa', bean: '#fb7185', oval: '#4ade80', sac: '#7dd3fc', dots: '#fbbf24', folds: '#f0abfc' };
const MAX_CELL_INSTANCES = 16;
/** Where the small parts sit, in a fixed order, so every card of an item is drawn in one frame. */
const CELL_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [62, 64], [172, 52], [206, 92], [186, 146], [78, 148], [40, 104], [128, 38], [132, 166], [216, 124], [98, 30], [160, 118],
  [148, 82], [50, 130], [196, 66], [120, 146], [96, 158], [30, 84], [226, 104], [210, 146], [62, 36], [194, 38], [44, 146],
];
const ROUND_AT = { x: 112, y: 100, r: 30 }, SAC_AT = { x: 172, y: 104, rx: 32, ry: 44 };

/** Where every drawn part goes, or null when the small parts do not fit. Big parts have fixed places; one of each. */
function cellLayout(d: Of<'cell'>): Array<{ part: CellPart; x: number; y: number }> | null {
  const hasRound = d.parts.some(p => p.shape === 'round'), hasSac = d.parts.some(p => p.shape === 'sac');
  const free = CELL_SLOTS.filter(([x, y]) => {
    if (hasRound && Math.hypot(x - ROUND_AT.x, y - ROUND_AT.y) < ROUND_AT.r + 16) return false;
    if (hasSac && ((x - SAC_AT.x) / (SAC_AT.rx + 14)) ** 2 + ((y - SAC_AT.y) / (SAC_AT.ry + 12)) ** 2 < 1) return false;
    return d.cell !== 'bacterium' || (y > 56 && y < 144);
  });
  const out: Array<{ part: CellPart; x: number; y: number }> = [];
  let next = 0;
  for (const part of d.parts) {
    if (part.shape === 'round') { out.push({ part, x: ROUND_AT.x, y: ROUND_AT.y }); continue; }
    if (part.shape === 'sac') { out.push({ part, x: SAC_AT.x, y: SAC_AT.y }); continue; }
    for (let i = 0; i < (part.count ?? 1); i++) {
      if (next >= free.length) return null;
      const [x, y] = free[next++];
      out.push({ part, x, y });
    }
  }
  return out;
}

function cellShape(shape: CellShape, x: number, y: number): string {
  const f = CELL_FILL[shape];
  switch (shape) {
    case 'round': return `<circle cx="${x}" cy="${y}" r="${ROUND_AT.r}" fill="${f}" fill-opacity="0.55" stroke="${f}" stroke-width="2"/><circle cx="${x + 6}" cy="${y - 5}" r="9" fill="${f}"/>`;
    case 'sac': return `<ellipse cx="${x}" cy="${y}" rx="${SAC_AT.rx}" ry="${SAC_AT.ry}" fill="${f}" fill-opacity="0.35" stroke="${f}" stroke-width="2"/>`;
    case 'bean': return `<ellipse cx="${x}" cy="${y}" rx="15" ry="9" fill="${f}" fill-opacity="0.75" stroke="${f}"/><path d="M ${x - 11} ${y} q 3 -7 6 0 t 6 0 t 6 0 t 4 0" fill="none" stroke="#7f1d1d" stroke-width="1.5"/>`;
    case 'oval': return `<ellipse cx="${x}" cy="${y}" rx="14" ry="8" fill="${f}" fill-opacity="0.8" stroke="${f}"/>${[-6, 0, 6].map(dx => `<line x1="${x + dx}" x2="${x + dx}" y1="${y - 5}" y2="${y + 5}" stroke="#14532d" stroke-width="1.5"/>`).join('')}`;
    case 'dots': return [[-6, 2], [0, -4], [6, 3]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="2.6" fill="${f}"/>`).join('');
    case 'folds': return [0, 5, 10].map(dy => `<path d="M ${x - 14} ${y - 5 + dy} q 14 -9 28 0" fill="none" stroke="${f}" stroke-width="2.4" stroke-linecap="round"/>`).join('');
  }
}

function cellDrawn(d: Of<'cell'>): string {
  // A "?" is drawn on the part itself, so a card with no other labels has no legend beside it.
  const named = d.parts.filter(p => p.label && p.label !== '?');
  const asking = new Set<CellPart>();
  const top = d.title ? 22 : 0, W = named.length ? 410 : 262, H = 200 + top;
  let g = svgOpen(W, H, d.title ?? 'a cell', W);
  if (d.title) g += `<text x="${W / 2}" y="15" text-anchor="middle" font-size="13" font-weight="600" fill="${INK.text}">${esc(d.title)}</text>`;
  g += `<g transform="translate(0 ${top})">`;
  const skin = `fill="rgba(148,163,184,0.12)" stroke="${INK.strong}" stroke-width="3"`;
  g += d.cell === 'plant' ? `<rect x="5" y="7" width="250" height="186" rx="14" fill="none" stroke="#65a30d" stroke-width="5"/><rect x="12" y="14" width="236" height="172" rx="10" ${skin}/>`
    : d.cell === 'bacterium' ? `<rect x="8" y="42" width="244" height="116" rx="58" ${skin}/>`
    : `<ellipse cx="130" cy="100" rx="124" ry="92" ${skin}/>`;
  for (const { part, x, y } of cellLayout(d) ?? []) {
    g += cellShape(part.shape, x, y);
    if (d.highlight !== undefined && part.label === d.highlight) {
      const [rx, ry] = part.shape === 'round' ? [ROUND_AT.r + 5, ROUND_AT.r + 5] : part.shape === 'sac' ? [SAC_AT.rx + 5, SAC_AT.ry + 5] : [20, 14];
      g += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${INK.amber}" stroke-width="2.5"/>`;
    }
    if (part.label === '?' && !asking.has(part)) {
      asking.add(part);
      g += `<text x="${x}" y="${y - (part.shape === 'round' ? ROUND_AT.r + 4 : part.shape === 'sac' ? SAC_AT.ry + 4 : 13)}" text-anchor="middle" font-size="16" font-weight="700" fill="${INK.asked}">?</text>`;
    }
  }
  named.forEach((p, i) => {
    const y = 30 + i * 26, asked = false, lit = p.label === d.highlight;
    g += `<g transform="translate(290 ${y}) scale(0.62) translate(-290 ${-y})">${p.shape === 'round' ? `<circle cx="290" cy="${y}" r="12" fill="${CELL_FILL.round}"/>` : p.shape === 'sac' ? `<ellipse cx="290" cy="${y}" rx="12" ry="15" fill="${CELL_FILL.sac}" fill-opacity="0.6"/>` : cellShape(p.shape, 290, y)}</g>`;
    g += `<text x="306" y="${y + 4}" font-size="12.5" font-weight="${asked || lit ? 700 : 500}" fill="${asked ? INK.asked : lit ? INK.amber : INK.text}">${esc(p.label)}</text>`;
  });
  return `${g}</g></svg>`;
}

function zoomDrawn(d: Of<'zoom'>): string {
  const B = 96, gap = 34, n = d.levels.length, top = d.title ? 24 : 0, W = n * B + (n - 1) * gap + 4, H = B + 44 + top;
  let g = svgOpen(W, H, d.title ?? 'zooming in', Math.min(W, 620));
  if (d.title) g += `<text x="${W / 2}" y="15" text-anchor="middle" font-size="13" font-weight="600" fill="${INK.text}">${esc(d.title)}</text>`;
  d.levels.forEach((l, i) => {
    const x = 2 + i * (B + gap), y = top + 2, asked = l.label.trim() === '?', lit = l.label === d.highlight;
    const stroke = asked ? INK.asked : lit ? INK.amber : INK.strong;
    if (i < n - 1) {
      const lx = x + B - 18, ly = y + B / 2;
      g += `<circle cx="${lx}" cy="${ly}" r="10" fill="none" stroke="${INK.cyan}" stroke-width="2"/><line x1="${lx}" y1="${ly - 10}" x2="${x + B + gap}" y2="${y}" stroke="${INK.cyan}" stroke-dasharray="4 3"/><line x1="${lx}" y1="${ly + 10}" x2="${x + B + gap}" y2="${y + B}" stroke="${INK.cyan}" stroke-dasharray="4 3"/>`;
    }
    g += `<rect x="${x}" y="${y}" width="${B}" height="${B}" rx="12" fill="${INK.face}" stroke="${stroke}" stroke-width="${asked || lit ? 2.5 : 1.5}"/>`;
    g += `<text x="${x + B / 2 - (i < n - 1 ? 10 : 0)}" y="${y + B / 2 + 13}" text-anchor="middle" font-size="36" fill="${asked ? INK.asked : INK.text}">${esc(asked ? '?' : l.icon ?? '')}</text>`;
    flowLines(l.label).forEach((t, j) => { g += `<text x="${x + B / 2}" y="${y + B + 16 + j * 13}" text-anchor="middle" font-size="12" font-weight="${asked || lit ? 700 : 500}" fill="${asked ? INK.asked : lit ? INK.amber : INK.text}">${esc(t)}</text>`; });
  });
  return `${g}</svg>`;
}

function foodWebDrawn(d: Of<'food_web'>): string {
  const NW = 92, NH = 46, rowH = 84, top = d.title ? 24 : 0;
  const levels = Array.from(new Set(d.living.map(l => l.level))).sort((a, b) => b - a);
  const W = 460, H = levels.length * rowH + top;
  const at = new Map<string, { x: number; y: number }>();
  levels.forEach((lv, r) => {
    const row = d.living.filter(l => l.level === lv);
    row.forEach((l, i) => at.set(l.name, { x: ((i + 0.5) * W) / row.length, y: top + r * rowH + rowH / 2 }));
  });
  let g = svgOpen(W, H, d.title ?? 'food web', W);
  if (d.title) g += `<text x="${W / 2}" y="15" text-anchor="middle" font-size="13" font-weight="600" fill="${INK.text}">${esc(d.title)}</text>`;
  for (const [eater, eaten] of d.eats) {
    const a = at.get(eaten)!, b = at.get(eater)!, len = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const trim = Math.min((NW / 2) / Math.max(Math.abs(ux), 0.001), (NH / 2) / Math.max(Math.abs(uy), 0.001)) + 3;
    g += flowArrow(a.x + ux * trim, a.y + uy * trim, b.x - ux * trim, b.y - uy * trim);
  }
  for (const l of d.living) g += flowNode({ label: l.name, ...(l.icon ? { icon: l.icon } : {}) }, at.get(l.name)!.x, at.get(l.name)!.y, l.name === d.highlight);
  return `${g}</svg>`;
}

const iconOk = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && Array.from(v.trim()).length <= 4;
const textOr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

// ── The registry ────────────────────────────────────────────────────────────

const DATA_LOAD: DisplayLoad = { score: 0.4, why: 'reading a graph, number line or table' };

const DEFS: { [K in DisplayKind]: DisplayDef<Of<K>> } = {
  svg: {
    prompt: `{kind:"svg", name:"a few words for what you drew", svg:"<svg viewBox='0 0 200 200' ...>...</svg>"}: a picture you draw. Self-contained SVG on a light background, no scripts, no outside images, no text that gives the answer away. Use it only for what no display below can show.`,
    read: raw => ({ kind: 'svg', svg: str(raw.svg), ...(str(raw.name) ? { name: str(raw.name) } : {}) }),
    errors: d => {
      if (typeof d.svg !== 'string' || !/^\s*<svg[\s>]/i.test(d.svg) || !/<\/svg>\s*$/i.test(d.svg)) return ['svg: one complete <svg>...</svg> element'];
      return d.svg.length > MAX_SVG ? [`svg: at most ${MAX_SVG} characters`] : [];
    },
    draw: d => `<div class="ks-svg">${sanitizeSvg(d.svg)}</div>`,
    words: () => 'a picture',
  },
  bar_graph: {
    prompt: `{kind:"bar_graph", title, y_label, labels:[...], values:[numbers]}: code draws it.`,
    read: raw => ({ kind: 'bar_graph', title: str(raw.title) || undefined, y_label: str(raw.y_label) || undefined, labels: list(raw.labels).map(String), values: list(raw.values).map(num) }),
    errors: d => {
      if (!Array.isArray(d.labels) || !Array.isArray(d.values) || d.labels.length !== d.values.length || d.labels.length < 2 || d.labels.length > 6) return ['bar_graph: 2-6 labels with one value each'];
      return d.values.every(v => finite(v) && v >= 0) ? [] : ['bar_graph: values are numbers 0 or more'];
    },
    draw: barGraph,
    words: d => `a bar graph${d.title ? ` "${d.title}"` : ''}: ${d.labels.map((l, i) => `${l} ${d.values[i]}`).join(', ')}`,
    load: () => DATA_LOAD,
  },
  number_line: {
    prompt: `{kind:"number_line", min, max, step, marks:[{value, label}]}: code draws it. A mark labeled "?" is the point asked about. Values may be decimals (0.75).`,
    read: raw => ({ kind: 'number_line', min: num(raw.min), max: num(raw.max), step: num(raw.step), marks: list(raw.marks).map(m => ({ value: num((m as Args)?.value), label: String((m as Args)?.label ?? '') })) }),
    errors: d => {
      if (!finite(d.min) || !finite(d.max) || !finite(d.step) || d.max <= d.min || d.step <= 0 || (d.max - d.min) / d.step > 40) return ['number_line: min < max, step > 0, at most 40 ticks'];
      return (d.marks ?? []).some(m => !finite(m.value) || m.value < d.min || m.value > d.max) ? ['number_line: every mark lies between min and max'] : [];
    },
    draw: numberLine,
    words: d => `a number line from ${d.min} to ${d.max} in steps of ${d.step}${(d.marks ?? []).length ? `, marked ${(d.marks ?? []).map(m => m.label).join(', ')}` : ''}`,
    load: () => DATA_LOAD,
  },
  table: {
    prompt: `{kind:"table", headers:[...], rows:[[...]]}`,
    read: raw => ({ kind: 'table', headers: list(raw.headers).map(String), rows: list(raw.rows).map(r => (Array.isArray(r) ? r.map(String) : [])) }),
    errors: d => (!Array.isArray(d.headers) || d.headers.length < 1 || !Array.isArray(d.rows) || !d.rows.length || d.rows.some(r => !Array.isArray(r) || r.length !== d.headers.length) ? ['table: headers and rows of the same length'] : []),
    draw: d => `<table class="ks-table"><thead><tr>${d.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
    words: d => `a table (${d.headers.join(', ')}): ${d.rows.map(r => r.join(', ')).join('; ')}`,
    load: () => DATA_LOAD,
  },
  text: {
    prompt: `{kind:"text", text}: short text (the tutor reads it aloud to young children).`,
    read: raw => ({ kind: 'text', text: str(raw.text) }),
    errors: d => (typeof d.text === 'string' && d.text.trim() ? [] : ['text: some text']),
    draw: d => `<p class="ks-text">${esc(d.text)}</p>`,
    words: d => `text: "${d.text}"`,
  },
  clock: {
    prompt: `{kind:"clock", hour:1-12, minute:0-59, numerals:false to hide the numbers (optional), highlight:"hour"|"minute" (optional, for a help)}: code draws an analog clock with the hands in the right place. Never put the time in a label on a clock card.`,
    read: raw => ({ kind: 'clock', hour: num(raw.hour), minute: num(raw.minute ?? 0), ...(raw.numerals === false ? { numerals: false } : {}),
      ...(raw.highlight === 'hour' || raw.highlight === 'minute' ? { highlight: raw.highlight } : {}) }),
    errors: d => (whole(d.hour, 1, 12) && whole(d.minute, 0, 59) ? [] : ['clock: hour is a whole number 1-12, minute is a whole number 0-59']),
    draw: clock,
    words: clockWords,
    reading: d => ({ unit: 'time', value: (d.hour % 12) * 60 + d.minute }),
    load: clockLoad,
    highlights: ['hour', 'minute'],
  },
  base_ten: {
    prompt: `{kind:"base_ten", hundreds, tens, ones, ones_first:true to draw the ones on the left (optional, a place-value trap), highlight:"hundreds"|"tens"|"ones" (optional, for a help: outlines one block and writes its value)}: code draws base ten blocks. Tens or ones above 9 are allowed for regrouping (2 tens and 14 ones).`,
    read: raw => ({ kind: 'base_ten', hundreds: num(raw.hundreds ?? 0), tens: num(raw.tens ?? 0), ones: num(raw.ones ?? 0), ...(raw.ones_first === true ? { ones_first: true } : {}),
      ...(['hundreds', 'tens', 'ones'].includes(str(raw.highlight)) ? { highlight: str(raw.highlight) as Of<'base_ten'>['highlight'] } : {}) }),
    errors: d => {
      if (!whole(d.hundreds, 0, 9) || !whole(d.tens, 0, 20) || !whole(d.ones, 0, 20)) return ['base_ten: hundreds 0-9, tens and ones 0-20, whole numbers'];
      return d.hundreds + d.tens + d.ones > 0 ? [] : ['base_ten: at least one block'];
    },
    draw: baseTen,
    words: baseTenWords,
    reading: d => ({ unit: 'count', value: d.hundreds * 100 + d.tens * 10 + d.ones }),
    load: d => ({ score: 0.4 + (d.tens > 9 || d.ones > 9 ? 0.4 : 0) + (d.ones_first ? 0.3 : 0), why: `reading base ten blocks${d.tens > 9 || d.ones > 9 ? ' that need regrouping' : ''}${d.ones_first ? ' with the ones drawn first' : ''}` }),
    highlights: ['hundreds', 'tens', 'ones'],
  },
  pattern_blocks: {
    prompt: `{kind:"pattern_blocks", target:"hexagon"|"trapezoid"|"rhombus"|"triangle"|"big_triangle" (optional outline), pieces:[{shape:"triangle"|"rhombus"|"trapezoid"|"hexagon", slots:[...]}] (optional, blocks placed on the outline), tray:["trapezoid", ...] (optional, loose blocks), highlight:"slots" (optional, for a help: shows the small triangles)}: code draws pattern blocks. A target is cut into small triangles numbered as slots: hexagon 0-5 going around, trapezoid 0-2, rhombus 0-1, triangle 0, big_triangle 0 left, 1 middle, 2 right, 3 top. A triangle covers 1 slot, a rhombus 2 touching slots, a trapezoid 3 touching slots, a hexagon all 6. Show a tray to ask which blocks fill a shape, or pieces to ask what is still missing.`,
    read: raw => {
      const target = str(raw.target) as PatternTarget;
      const pieces = list(raw.pieces).map(p => ({ shape: str((p as Args)?.shape) as PatternShape, slots: list((p as Args)?.slots).map(num) }));
      const tray = list(raw.tray).map(s => str(s) as PatternShape);
      return { kind: 'pattern_blocks', ...(target ? { target } : {}), ...(pieces.length ? { pieces } : {}), ...(tray.length ? { tray } : {}), ...(raw.highlight === 'slots' ? { highlight: 'slots' as const } : {}) };
    },
    errors: d => {
      if (d.target && !PATTERN_TARGETS.includes(d.target)) return [`pattern_blocks: target is one of ${PATTERN_TARGETS.join(', ')}`];
      if (!d.target && !(d.tray ?? []).length) return ['pattern_blocks: give a target outline, a tray of blocks, or both'];
      if ((d.tray ?? []).length > 8 || (d.tray ?? []).some(s => !PATTERN_SHAPES.includes(s))) return [`pattern_blocks: tray is up to 8 of ${PATTERN_SHAPES.join(', ')}`];
      if ((d.pieces ?? []).length && !d.target) return ['pattern_blocks: pieces sit on a target outline'];
      if (!d.target) return [];
      const cells = TARGET_CELLS[d.target], used = new Set<number>();
      for (const p of d.pieces ?? []) {
        if (!PATTERN_SHAPES.includes(p.shape)) return [`pattern_blocks: a piece is one of ${PATTERN_SHAPES.join(', ')}`];
        if (p.slots.length !== PIECE_AREA[p.shape]) return [`pattern_blocks: a ${p.shape} covers ${PIECE_AREA[p.shape]} slot${PIECE_AREA[p.shape] === 1 ? '' : 's'}, not ${p.slots.length}`];
        if (p.slots.some(s => !whole(s, 0, cells.length - 1))) return [`pattern_blocks: the slots of a ${d.target} are 0-${cells.length - 1}`];
        if (p.slots.some(s => used.has(s))) return ['pattern_blocks: two pieces overlap on a slot'];
        p.slots.forEach(s => used.add(s));
        if (!connected(p.slots.map(s => cells[s]))) return [`pattern_blocks: the slots of a ${p.shape} must touch along an edge`];
      }
      return [];
    },
    draw: patternBlocks,
    words: patternWords,
    load: d => ({ score: 0.5 + ((d.tray ?? []).length > 2 ? 0.2 : 0), why: 'composing shapes from pattern blocks' }),
    highlights: ['slots'],
  },
  ten_frame: {
    prompt: `{kind:"ten_frame", filled:0-20, frames:1 or 2 (optional), second:how many of the filled counters are drawn in a second color (optional, for showing parts like 5 and 3), highlight:"empty" (optional, for a help: outlines the empty boxes)}: code draws one or two ten frames, filled left to right.`,
    read: raw => ({ kind: 'ten_frame', filled: num(raw.filled), ...(raw.frames !== undefined ? { frames: num(raw.frames) } : {}), ...(raw.second !== undefined ? { second: num(raw.second) } : {}), ...(raw.highlight === 'empty' ? { highlight: 'empty' as const } : {}) }),
    errors: d => {
      const frames = d.frames ?? (d.filled > 10 ? 2 : 1);
      if (!whole(frames, 1, 2) || !whole(d.filled, 0, frames * 10)) return ['ten_frame: 1 or 2 frames, filled from 0 up to what they hold'];
      return d.second === undefined || whole(d.second, 0, d.filled) ? [] : ['ten_frame: second is a whole number no bigger than filled'];
    },
    draw: tenFrame,
    words: d => `${framesOf(d) === 2 ? 'two ten frames' : 'a ten frame'}: ${d.filled} counter${d.filled === 1 ? '' : 's'}`,
    reading: d => ({ unit: 'count', value: d.filled }),
    load: () => ({ score: 0.3, why: 'reading a ten frame' }),
    highlights: ['empty'],
  },
  array: {
    prompt: `{kind:"array", rows:1-12, columns:1-12, grouping:"rows"|"columns" (optional, circles each group), icon:"one emoji" (optional, dots if left out), highlight:"row"|"column" (optional, for a help)}: code draws a rectangular array.`,
    read: raw => ({ kind: 'array', rows: num(raw.rows), columns: num(raw.columns), ...(raw.grouping === 'rows' || raw.grouping === 'columns' ? { grouping: raw.grouping } : {}), ...(textOr(raw.icon) ? { icon: textOr(raw.icon)! } : {}), ...(raw.highlight === 'row' || raw.highlight === 'column' ? { highlight: raw.highlight } : {}) }),
    errors: d => {
      if (!whole(d.rows, 1, 12) || !whole(d.columns, 1, 12)) return ['array: rows and columns are whole numbers 1-12'];
      return d.icon === undefined || iconOk(d.icon) ? [] : ['array: icon is one emoji'];
    },
    draw: arrayDrawn,
    words: d => `an array: ${d.rows} row${d.rows === 1 ? '' : 's'}, ${d.columns} column${d.columns === 1 ? '' : 's'}${d.icon ? ` of ${d.icon}` : ''}`,
    reading: d => ({ unit: 'count', value: d.rows * d.columns, identity: `${d.rows}x${d.columns}` }),
    load: () => ({ score: 0.3, why: 'reading an array' }),
    highlights: ['row', 'column'],
  },
  coins: {
    prompt: `{kind:"coins", coins:["quarter","dime","nickel","penny","half_dollar","one_dollar","five_dollar","ten_dollar", ...] (up to 15, in the order you want them shown), highlight:"values" (optional, for a help: writes each value)}: code draws US coins and bills, sized like the real ones.`,
    read: raw => ({ kind: 'coins', coins: list(raw.coins).map(coinName) as CoinName[], ...(raw.highlight === 'values' ? { highlight: 'values' as const } : {}) }),
    errors: d => {
      if (!Array.isArray(d.coins) || d.coins.length < 1 || d.coins.length > 15) return ['coins: 1-15 coins or bills'];
      const bad = d.coins.find(c => !COINS[c]);
      return bad ? [`coins: "${bad}" is not one of ${Object.keys(COINS).join(', ')}`] : [];
    },
    draw: coins,
    words: coinWords,
    reading: d => ({ unit: 'cents', value: d.coins.reduce((s, c) => s + COINS[c].cents, 0) }),
    load: d => ({ score: 0.4 + (new Set(d.coins).size - 1) * 0.1, why: 'counting money' }),
    highlights: ['values'],
  },
  pictograph: {
    prompt: `{kind:"pictograph", title, icon:"one emoji", key_value:how much one picture stands for, labels:[...], values:[the true amounts], highlight:"a row's label" (optional, for a help)}: code draws a picture graph and its key. Each value is a multiple of key_value, or a half picture more when key_value is even.`,
    read: raw => ({ kind: 'pictograph', title: textOr(raw.title), icon: str(raw.icon), key_value: num(raw.key_value), labels: list(raw.labels).map(String), values: list(raw.values).map(num), ...(textOr(raw.highlight) ? { highlight: textOr(raw.highlight) } : {}) }),
    errors: d => {
      if (!iconOk(d.icon)) return ['pictograph: icon is one emoji'];
      if (!whole(d.key_value, 1, 100)) return ['pictograph: key_value is a whole number 1 or more'];
      if (!Array.isArray(d.labels) || !Array.isArray(d.values) || d.labels.length !== d.values.length || d.labels.length < 2 || d.labels.length > 6) return ['pictograph: 2-6 labels with one value each'];
      for (const v of d.values) {
        if (!finite(v) || v < 0) return ['pictograph: values are numbers 0 or more'];
        const pictures = v / d.key_value;
        if (!Number.isInteger(pictures * 2)) return [`pictograph: ${v} is not a whole or half number of pictures when each stands for ${d.key_value}`];
        if (!Number.isInteger(pictures) && d.key_value % 2) return [`pictograph: a half picture needs an even key_value, and ${d.key_value} is odd`];
        if (pictures > 12) return ['pictograph: at most 12 pictures in a row'];
      }
      return d.highlight !== undefined && !d.labels.includes(d.highlight) ? ['pictograph: highlight is one of the labels'] : [];
    },
    draw: pictograph,
    words: d => `a picture graph${d.title ? ` "${d.title}"` : ''} where each ${d.icon} stands for ${d.key_value}: ${d.labels.map((l, i) => `${l} ${d.values[i] / d.key_value} pictures`).join(', ')}`,
    load: d => ({ score: 0.4 + (d.key_value > 1 ? 0.3 : 0) + (d.values.some(v => (v / d.key_value) % 1) ? 0.2 : 0), why: `reading a picture graph${d.key_value > 1 ? ' with a key above 1' : ''}` }),
  },
  timeline: {
    prompt: `{kind:"timeline", title, events:[{label, at:a year or number (give at on all events or none), icon:"emoji" (optional)}], highlight:"an event's label" (optional, for a help)}: code draws a timeline left to right, oldest first. 2-8 events. Without at the events are evenly spaced in the order you give. An event labeled "?" is the one asked about.`,
    read: raw => ({ kind: 'timeline', title: textOr(raw.title), events: list(raw.events).map(e => { const x = e as Args; return { label: String(x?.label ?? '').trim(), ...(x?.at !== undefined && x?.at !== null ? { at: num(x.at) } : {}), ...(textOr(x?.icon) ? { icon: textOr(x?.icon) } : {}) }; }), ...(textOr(raw.highlight) ? { highlight: textOr(raw.highlight) } : {}) }),
    errors: d => {
      if (!Array.isArray(d.events) || d.events.length < 2 || d.events.length > 8) return ['timeline: 2-8 events'];
      if (d.events.some(e => !e.label || e.label.length > 28)) return ['timeline: every event has a label of at most 28 characters'];
      const dated = d.events.filter(e => e.at !== undefined);
      if (dated.length && dated.length !== d.events.length) return ['timeline: give at on every event or on none'];
      if (dated.some(e => !finite(e.at))) return ['timeline: at is a number'];
      if (dated.length && new Set(dated.map(e => e.at)).size !== dated.length) return ['timeline: two events share one at'];
      return d.highlight !== undefined && !d.events.some(e => e.label === d.highlight) ? ['timeline: highlight is one of the event labels'] : [];
    },
    draw: timeline,
    words: d => `a timeline${d.title ? ` "${d.title}"` : ''}: ${d.events.map(e => `${e.at !== undefined ? `${e.at} ` : ''}${e.label}`).join(', ')}`,
    load: () => ({ score: 0.4, why: 'reading a timeline' }),
  },
  flow: {
    prompt: `{kind:"flow", title (optional), steps:[{label, icon:"one emoji" (optional)}], loop:true when the last step leads back to the first (optional), highlight:"a step's label" (optional, for a help)}: code draws the steps joined by arrows: a life cycle, a food chain, a path through a body, the water cycle. 2-8 steps, at least 3 in a loop. A step labeled "?" is the one asked about.`,
    read: raw => ({ kind: 'flow', title: textOr(raw.title), steps: list(raw.steps).map(s => { const x = s as Args; return { label: str(x?.label), ...(textOr(x?.icon) ? { icon: textOr(x?.icon) } : {}) }; }), ...(raw.loop === true ? { loop: true } : {}), ...(textOr(raw.highlight) ? { highlight: textOr(raw.highlight) } : {}) }),
    errors: d => {
      if (!Array.isArray(d.steps) || d.steps.length < 2 || d.steps.length > 8) return ['flow: 2-8 steps'];
      if (d.loop && d.steps.length < 3) return ['flow: a loop has at least 3 steps'];
      if (d.steps.some(s => !s.label || s.label.length > 26)) return ['flow: every step has a label of at most 26 characters'];
      if (d.steps.some(s => s.icon !== undefined && !iconOk(s.icon))) return ['flow: an icon is one emoji'];
      if (new Set(d.steps.map(s => s.label)).size !== d.steps.length) return ['flow: two steps share a label'];
      return d.highlight !== undefined && !d.steps.some(s => s.label === d.highlight) ? ['flow: highlight is one of the step labels'] : [];
    },
    draw: flowDrawn,
    words: d => `${d.loop ? 'a cycle' : 'a flow'}${d.title ? ` "${d.title}"` : ''}: ${d.steps.map(s => s.label).join(', then ')}${d.loop ? ', then back to the start' : ''}`,
    load: () => ({ score: 0.3, why: 'following steps joined by arrows' }),
  },
  map: {
    prompt: `{kind:"map", title, places:[{name, icon:"emoji", x:0-10, y:0-10}] (y grows north, x grows east; name or icon may be left out), paths:[["place name","place name"]] (optional roads), regions:[{type:"water"|"park", x, y, w, h, name}] (optional), legend:[{icon, meaning}] (optional map key), compass:false to hide it (optional), highlight:"a place's name" (optional, for a help)}: code draws a simple map with a compass. To ask the child to use a map key, leave the name off the places and give a legend.`,
    read: raw => ({ kind: 'map', title: textOr(raw.title),
      places: list(raw.places).map(p => { const x = p as Args; return { ...(textOr(x?.name) ? { name: textOr(x?.name) } : {}), ...(textOr(x?.icon) ? { icon: textOr(x?.icon) } : {}), x: num(x?.x), y: num(x?.y) }; }),
      ...(list(raw.paths).length ? { paths: list(raw.paths).map(p => (Array.isArray(p) ? [String(p[0]), String(p[1])] : ['', '']) as [string, string]) } : {}),
      ...(list(raw.regions).length ? { regions: list(raw.regions).map(r => { const x = r as Args; return { type: (x?.type === 'park' ? 'park' : 'water') as MapRegion['type'], x: num(x?.x), y: num(x?.y), w: num(x?.w), h: num(x?.h), ...(textOr(x?.name) ? { name: textOr(x?.name) } : {}) }; }) } : {}),
      ...(list(raw.legend).length ? { legend: list(raw.legend).map(l => ({ icon: str((l as Args)?.icon), meaning: str((l as Args)?.meaning) })) } : {}),
      ...(raw.compass === false ? { compass: false } : {}), ...(textOr(raw.highlight) ? { highlight: textOr(raw.highlight) } : {}) }),
    errors: d => {
      const inside = (v: unknown) => finite(v) && v >= 0 && v <= 10;
      if (!Array.isArray(d.places) || d.places.length < 2 || d.places.length > 12) return ['map: 2-12 places'];
      if (d.places.some(p => !inside(p.x) || !inside(p.y))) return ['map: x and y are numbers 0-10'];
      if (d.places.some(p => !p.name && !p.icon)) return ['map: every place has a name or an icon'];
      if (d.places.some(p => p.icon !== undefined && !iconOk(p.icon))) return ['map: an icon is one emoji'];
      const names = d.places.map(p => p.name).filter(Boolean);
      if (new Set(names).size !== names.length) return ['map: two places share a name'];
      if ((d.paths ?? []).some(([a, b]) => !names.includes(a) || !names.includes(b))) return ['map: a path joins two named places'];
      if ((d.regions ?? []).some(r => !inside(r.x) || !inside(r.y) || !finite(r.w) || !finite(r.h) || r.w <= 0 || r.h <= 0 || r.x + r.w > 10 || r.y + r.h > 10)) return ['map: a region is inside the 0-10 map'];
      if ((d.legend ?? []).some(l => !iconOk(l.icon) || !l.meaning)) return ['map: a legend entry has one emoji and its meaning'];
      return d.highlight !== undefined && !names.includes(d.highlight) ? ['map: highlight is one of the place names'] : [];
    },
    draw: mapDrawn,
    words: d => `a map${d.title ? ` "${d.title}"` : ''}: ${d.places.map(p => `${p.name ?? p.icon} at ${p.x} east, ${p.y} north`).join('; ')}${(d.legend ?? []).length ? `. Key: ${d.legend!.map(l => `${l.icon} means ${l.meaning}`).join(', ')}` : ''}`,
    load: () => ({ score: 0.4, why: 'reading a map' }),
  },
  cell: {
    prompt: `{kind:"cell", title (optional), cell:"animal"|"plant"|"bacterium", parts:[{shape:"round"|"bean"|"oval"|"sac"|"dots"|"folds", label (optional), count (optional, how many are drawn)}], highlight:"a part's label" (optional, for a help)}: code draws a cell with its parts in one fixed frame, so cards can differ only in what you change (how many of a part, which part is there). The shape is only how it looks: round = a big ball, bean = a bean with wavy folds, oval = a green disc with stripes, sac = a big water bag, dots = tiny specks, folds = stacked curves. Leave a label off, or write "?", when the child has to work out what the part is.`,
    read: raw => ({ kind: 'cell', title: textOr(raw.title), ...(raw.cell === 'plant' || raw.cell === 'bacterium' || raw.cell === 'animal' ? { cell: raw.cell } : {}),
      parts: list(raw.parts).map(p => { const x = p as Args; return { shape: str(x?.shape) as CellShape, ...(textOr(x?.label) ? { label: textOr(x?.label) } : {}), ...(x?.count !== undefined && x?.count !== null ? { count: num(x.count) } : {}) }; }),
      ...(textOr(raw.highlight) ? { highlight: textOr(raw.highlight) } : {}) }),
    errors: d => {
      if (!Array.isArray(d.parts) || d.parts.length < 1 || d.parts.length > 7) return ['cell: 1-7 parts'];
      if (d.parts.some(p => !CELL_SHAPES.includes(p.shape))) return [`cell: a shape is one of ${CELL_SHAPES.join(', ')}`];
      if (d.parts.some(p => p.count !== undefined && !whole(p.count, 1, 12))) return ['cell: count is a whole number 1-12'];
      if (['round', 'sac'].some(s => d.parts.filter(p => p.shape === s).length > 1)) return ['cell: at most one round and one sac part'];
      if (d.parts.some(p => (p.shape === 'round' || p.shape === 'sac') && (p.count ?? 1) !== 1)) return ['cell: a round or sac part is drawn once'];
      if (d.parts.some(p => p.label && p.label.length > 18)) return ['cell: a label has at most 18 characters'];
      const labels = d.parts.map(p => p.label).filter(Boolean);
      if (new Set(labels).size !== labels.length) return ['cell: two parts share a label'];
      if (d.parts.reduce((n, p) => n + (p.count ?? 1), 0) > MAX_CELL_INSTANCES) return [`cell: at most ${MAX_CELL_INSTANCES} parts drawn in all`];
      if (!cellLayout(d)) return ['cell: too many small parts fit around the big ones; draw fewer'];
      return d.highlight !== undefined && !labels.includes(d.highlight) ? ['cell: highlight is one of the part labels'] : [];
    },
    draw: cellDrawn,
    words: d => `${d.cell === 'plant' ? 'a plant cell' : d.cell === 'bacterium' ? 'a bacterium' : 'an animal cell'}${d.title ? ` "${d.title}"` : ''} with ${d.parts.map(p => `${p.count ?? 1} ${p.shape}-shaped part${(p.count ?? 1) > 1 ? 's' : ''}${p.label ? ` labeled ${p.label}` : ''}`).join(', ')}`,
    load: () => ({ score: 0.3, why: 'reading a drawing of a cell' }),
  },
  zoom: {
    prompt: `{kind:"zoom", title (optional), levels:[{label, icon:"one emoji" (optional)}], highlight:"a level's label" (optional, for a help)}: code draws each level inside a lens on the one before it: a runner, a leg muscle, a muscle cell, a part inside it; a forest, a tree, a leaf, a leaf cell. 2-5 levels, biggest first. A level labeled "?" is the one asked about.`,
    read: raw => ({ kind: 'zoom', title: textOr(raw.title), levels: list(raw.levels).map(l => { const x = l as Args; return { label: str(x?.label), ...(textOr(x?.icon) ? { icon: textOr(x?.icon) } : {}) }; }), ...(textOr(raw.highlight) ? { highlight: textOr(raw.highlight) } : {}) }),
    errors: d => {
      if (!Array.isArray(d.levels) || d.levels.length < 2 || d.levels.length > 5) return ['zoom: 2-5 levels'];
      if (d.levels.some(l => !l.label || l.label.length > 26)) return ['zoom: every level has a label of at most 26 characters'];
      if (d.levels.some(l => l.icon !== undefined && !iconOk(l.icon))) return ['zoom: an icon is one emoji'];
      if (new Set(d.levels.map(l => l.label)).size !== d.levels.length) return ['zoom: two levels share a label'];
      return d.highlight !== undefined && !d.levels.some(l => l.label === d.highlight) ? ['zoom: highlight is one of the level labels'] : [];
    },
    draw: zoomDrawn,
    words: d => `zooming in${d.title ? ` "${d.title}"` : ''}: ${d.levels.map(l => l.label).join(', inside it ')}`,
    load: () => ({ score: 0.2, why: 'following a zoom through sizes' }),
  },
  food_web: {
    prompt: `{kind:"food_web", title (optional), living:[{name, icon:"one emoji" (optional), level:1 for what makes its own food, 2 for what eats it, 3 and 4 above}], eats:[["eater name","eaten name"]], highlight:"a name" (optional, for a help)}: code draws who eats whom, arrows pointing the way the food's energy goes (from the eaten to the eater). 3-9 living things, at most 4 on one level. A living thing named "?" is the one asked about.`,
    read: raw => ({ kind: 'food_web', title: textOr(raw.title), living: list(raw.living).map(l => { const x = l as Args; return { name: str(x?.name), ...(textOr(x?.icon) ? { icon: textOr(x?.icon) } : {}), level: num(x?.level) }; }),
      eats: list(raw.eats).map(p => { const x = p as Args; return (Array.isArray(p) ? [String(p[0]), String(p[1])] : [str(x?.eater), str(x?.eaten)]) as [string, string]; }),
      ...(textOr(raw.highlight) ? { highlight: textOr(raw.highlight) } : {}) }),
    errors: d => {
      if (!Array.isArray(d.living) || d.living.length < 3 || d.living.length > 9) return ['food_web: 3-9 living things'];
      if (d.living.some(l => !l.name || l.name.length > 26)) return ['food_web: every living thing has a name of at most 26 characters'];
      if (d.living.some(l => l.icon !== undefined && !iconOk(l.icon))) return ['food_web: an icon is one emoji'];
      if (d.living.some(l => !whole(l.level, 1, 4))) return ['food_web: level is 1-4'];
      const names = d.living.map(l => l.name);
      if (new Set(names).size !== names.length) return ['food_web: two living things share a name'];
      if ([1, 2, 3, 4].some(lv => d.living.filter(l => l.level === lv).length > 4)) return ['food_web: at most 4 living things on one level'];
      if (!Array.isArray(d.eats) || !d.eats.length || d.eats.some(([a, b]) => !names.includes(a) || !names.includes(b) || a === b)) return ['food_web: eats joins two different named living things'];
      return d.highlight !== undefined && !names.includes(d.highlight) ? ['food_web: highlight is one of the names'] : [];
    },
    draw: foodWebDrawn,
    words: d => `a food web${d.title ? ` "${d.title}"` : ''}: ${d.eats.map(([a, b]) => `${a} eats ${b}`).join('; ')}`,
    load: () => ({ score: 0.5, why: 'following arrows through a food web' }),
  },
};

const defOf = (kind: DisplayKind) => DEFS[kind] as unknown as DisplayDef<Display>;
const known = (kind: unknown): kind is DisplayKind => (DISPLAY_KINDS as readonly unknown[]).includes(kind);

/** Which primitives a display fits. A new kind fails to compile until it is listed here. */
const DOMAINS: { [K in DisplayKind]: readonly DisplayDomain[] } = {
  svg: ['general'], text: ['general'], table: ['general'],
  bar_graph: ['data', 'math', 'science'], pictograph: ['data', 'math', 'science'],
  number_line: ['math'], clock: ['math'], base_ten: ['math'], pattern_blocks: ['math'], ten_frame: ['math'], array: ['math'], coins: ['math'],
  timeline: ['social', 'science'], map: ['social'], flow: ['science'],
  cell: ['biology'], zoom: ['biology'], food_web: ['biology'],
};

/** The displays a primitive offers its author, in registry order. */
export const displayMenu = (cap: DisplayCapability): DisplayKind[] => DISPLAY_KINDS.filter(kind =>
  !cap.without?.includes(kind) && (cap.domains === 'all' || DOMAINS[kind].some(d => d === 'general' || cap.domains.includes(d))));

// ── What the rest of the kit calls ──────────────────────────────────────────

/** The displays a primitive offers, one line each. `hide` removes some for a before-and-after measurement. */
export const displayPrompt = (cap: DisplayCapability = ALL_DISPLAYS, hide: readonly string[] = []) =>
  displayMenu(cap).filter(kind => !hide.includes(kind)).map(kind => `- ${defOf(kind).prompt}`).join('\n');

/** A tool field holding a list of displays, for a writer declared with `parametersJsonSchema`. */
export const displayToolSchema = (cap: DisplayCapability) => ({
  type: 'array', items: { type: 'object', properties: { kind: { type: 'string', enum: displayMenu(cap) } }, required: ['kind'], additionalProperties: true },
}) as const;

/** A draft's display as code reads it, or null for an unknown kind. */
export function readDisplay(v: unknown): Display | null {
  const raw = (v ?? {}) as Args;
  const kind = str(raw.kind);
  return known(kind) ? defOf(kind).read(raw) : null;
}

/**
 * A tool's displays as code reads them: an array, one display, or JSON text (for a tool schema that cannot hold an open
 * object). A draft of an unknown kind stays in the list so `displayIssues` can say what is wrong with it.
 */
export function readDisplays(v: unknown): Display[] {
  let raw = v;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return [{ kind: raw } as unknown as Display]; } }
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map(x => readDisplay(x) ?? (x as Display));
}

/** Why these displays cannot be shown by this primitive, one sentence each. */
export function displayIssues(shown: readonly Display[], cap: DisplayCapability): string[] {
  const menu = displayMenu(cap);
  return shown.flatMap(d => {
    if (d && known(d.kind) && !menu.includes(d.kind)) return [`a ${d.kind} display is not offered here; use one of ${menu.join(', ')}`];
    if (!d || !known(d.kind)) return [`a display kind is one of ${menu.join(', ')}`];
    return displayErrors(d);
  });
}

/** Why a display cannot be drawn. */
export function displayErrors(d: Display): string[] {
  if (!d || !known(d.kind)) return [`a display kind is one of ${DISPLAY_KINDS.join(', ')}`];
  const errors = defOf(d.kind).errors(d);
  const allowed = defOf(d.kind).highlights ?? [];
  const lit = (d as { highlight?: unknown }).highlight;
  if (lit !== undefined && !errors.length && allowed.length && !allowed.includes(String(lit))) return [`${d.kind}: highlight is one of ${allowed.join(', ')}`];
  return errors;
}

/** One display as HTML for the dark glass panel. */
export const displayHtml = (d: Display): string => (d && known(d.kind) ? defOf(d.kind).draw(d) : '');

/** A display in words, for the tutor's scene and the solver fallback. Never draws or names a key. */
export const displayWords = (d: Display): string => (d && known(d.kind) ? defOf(d.kind).words(d) : '');

/** Every word a display puts on screen or tells the tutor, for a primitive's check that no display states the answer. */
export function displayText(d: Display): string {
  const drawn = d?.kind === 'svg' ? Array.from(d.svg.matchAll(/<text[^>]*>([^<]*)</gi)).map(m => m[1]).join(' ') : '';
  return `${displayWords(d)} ${d?.kind === 'svg' ? d.name ?? '' : ''} ${drawn}`.trim();
}

/** The highlight values a display can draw. */
export const displayHighlights = (kind: DisplayKind): readonly string[] => defOf(kind).highlights ?? [];

/** The value a display shows, when code can read one. */
export const displayReading = (d: Display | undefined): Reading | null => (d && known(d.kind) ? defOf(d.kind).reading?.(d) ?? null : null);

/** The reading a display asks of a child, for the computed difficulty. */
export const displayLoad = (d: Display | undefined): DisplayLoad | null => (d && known(d.kind) ? defOf(d.kind).load?.(d) ?? null : null);

/** The same display with a highlight, when it can draw that one. */
export function withHighlight(d: Display, value: string): Display | null {
  return (defOf(d.kind).highlights ?? []).includes(value) ? ({ ...d, highlight: value } as Display) : null;
}

/** True when two displays show the same state and differ at most in their highlight. */
export function sameState(a: Display, b: Display): boolean {
  const bare = (d: Display) => JSON.stringify({ ...d, highlight: undefined });
  return bare(a) === bare(b);
}

// ── Values stated in words ──────────────────────────────────────────────────

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const HOUR = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const hourOf = (s: string) => WORD_NUMBERS[s.toLowerCase()] ?? Number(s);
const clockMinutes = (h: number, m: number) => (((h % 12) * 60 + m) % 720 + 720) % 720;

const all = (s: string, re: RegExp) => Array.from(s.matchAll(re));

function statedTimes(s: string): number[] {
  return [
    ...all(s, /\b(\d{1,2}):(\d{2})\b/g).map(m => clockMinutes(Number(m[1]), Number(m[2]))),
    ...all(s, new RegExp(`\\b${HOUR}\\s*o['’]?\\s*clock\\b`, 'gi')).map(m => clockMinutes(hourOf(m[1]), 0)),
    ...all(s, new RegExp(`\\bhalf past ${HOUR}\\b`, 'gi')).map(m => clockMinutes(hourOf(m[1]), 30)),
    ...all(s, new RegExp(`\\bquarter past ${HOUR}\\b`, 'gi')).map(m => clockMinutes(hourOf(m[1]), 15)),
    ...all(s, new RegExp(`\\bquarter (?:to|till) ${HOUR}\\b`, 'gi')).map(m => clockMinutes(hourOf(m[1]) - 1, 45)),
  ];
}

function statedCents(s: string): number[] {
  return [
    ...all(s, /\$\s*(\d+)(?:\.(\d{2}))?/g).map(m => Number(m[1]) * 100 + Number(m[2] ?? 0)),
    ...all(s, /\b(\d+)\s*(?:¢|cents?\b)/gi).map(m => Number(m[1])),
  ];
}

const statedCounts = (s: string) => all(s, /(?<![\d:/.$])\b\d+\b(?![:/.\d¢])/g).map(m => Number(m[0]));

/** Every value of this unit stated in a piece of text. */
export function statedValues(text: string | undefined, unit: ReadingUnit): number[] {
  const s = String(text ?? '');
  return unit === 'time' ? statedTimes(s) : unit === 'cents' ? statedCents(s) : statedCounts(s);
}

export const sameValue = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// ── Styles ──────────────────────────────────────────────────────────────────

/** The styles every display panel uses (component and screenshot alike). */
export const DISPLAY_CSS = `.ks-svg{background:#fff;border-radius:10px;padding:4px}.ks-svg svg{width:100%;height:auto;max-height:220px;display:block}
.ks-table{border-collapse:collapse;color:#e2e8f0;font-size:14px}.ks-table td,.ks-table th{border:1px solid rgba(255,255,255,.18);padding:4px 10px;text-align:left}
.ks-table th{background:rgba(255,255,255,.06)}.ks-text{margin:0;color:#e2e8f0;font-size:15px;line-height:1.5}`;
