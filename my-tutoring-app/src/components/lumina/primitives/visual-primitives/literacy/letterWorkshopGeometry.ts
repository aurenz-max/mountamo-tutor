/** Editable school-manuscript models, in a 400 × 300 writing space. */
export interface TracePoint { x: number; y: number; t: number }
export interface TraceStroke { points: TracePoint[]; pointerType: string }
type Point = { x: number; y: number };
export interface LetterTemplate {
  id: string;
  letter: string;
  letterCase: 'uppercase' | 'lowercase';
  strokes: Point[][];
}
export interface TraceAssessment {
  passed: boolean;
  coverage: number;
  precision: number;
  startAccuracy: number;
  directionAccuracy: number;
  strokeCountMatch: boolean;
  feedback: string;
  correctionPoint?: Point;
}

// Provisional assisted-tracing thresholds, not a handwriting/mastery classifier.
export const TRACE_TOLERANCES = {
  version: 'assisted-trace-v1', sampleSpacing: 4, pathRadius: 18,
  startRadius: 22, progressionRadius: 30, minimumCoverage: 0.9,
  minimumPrecision: 0.92, minimumDirection: 0.85,
  minimumLengthRatio: 0.8, maximumLengthRatio: 1.3, dotMaximumLength: 8,
} as const;

/** Practice feedback only. Horizontal placement is free; writing-line height is preserved. */
export const FORMATION_TOLERANCES = {
  version: 'provisional-formation-v1', pathRadius: 24, minimumCoverage: 0.8,
  minimumPrecision: 0.85, minimumDirection: 0.75, startRadius: 30,
  minimumLengthRatio: 0.7, maximumLengthRatio: 1.4,
} as const;

const line = (...xy: number[]): Point[] => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[i * 2], y: xy[i * 2 + 1] }));
// Angles use screen coordinates: positive angles travel clockwise.
const arc = (cx: number, cy: number, rx: number, ry: number, start: number, end: number): Point[] => {
  const steps = Math.ceil(Math.abs(end - start) / 10);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (start + (end - start) * i / steps) * Math.PI / 180;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
};
const bowl = (x: number, top: number, bottom: number, width: number) => arc(x, (top + bottom) / 2, width, (bottom - top) / 2, -90, 90);
const oval = (cy: number, rx = 50, ry = 45) => arc(200, cy, rx, ry, -35, -395);
const upper: Record<string, Point[][]> = {
  A: [line(200,60,130,240), line(200,60,270,240), line(158,170,242,170)],
  B: [line(145,60,145,240), [ ...line(145,60,195,60), ...bowl(195,60,150,60), ...line(195,150,145,150)], [ ...line(145,150,200,150), ...bowl(200,150,240,60), ...line(200,240,145,240)]],
  C: [arc(205,150,75,90,-40,-320)],
  D: [line(145,60,145,240), [...line(145,60,180,60), ...bowl(180,60,240,90), ...line(180,240,145,240)]],
  E: [line(145,60,145,240), line(145,60,265,60), line(145,150,245,150), line(145,240,265,240)],
  F: [line(145,60,145,240), line(145,60,265,60), line(145,150,245,150)],
  G: [arc(205,150,75,90,-40,-360), line(280,150,220,150)],
  H: [line(140,60,140,240), line(260,60,260,240), line(140,150,260,150)],
  I: [line(200,60,200,240), line(145,60,255,60), line(145,240,255,240)],
  J: [[...line(255,60,255,185), ...arc(200,185,55,55,0,180)], line(175,60,280,60)],
  K: [line(145,60,145,240), line(265,60,145,160), line(185,126,270,240)],
  L: [line(150,60,150,240,270,240)],
  M: [line(130,240,130,60,200,160,270,60,270,240)],
  N: [line(140,240,140,60,260,240,260,60)],
  O: [oval(150,75,90)],
  P: [line(145,60,145,240), [...line(145,60,195,60), ...bowl(195,60,150,65), ...line(195,150,145,150)]],
  Q: [oval(150,75,90), line(220,200,285,255)],
  R: [line(145,60,145,240), [...line(145,60,195,60), ...bowl(195,60,150,65), ...line(195,150,145,150)], line(195,150,270,240)],
  S: [[...arc(200,105,65,45,-35,-270), ...arc(200,195,65,45,-90,145)]],
  T: [line(130,60,270,60), line(200,60,200,240)],
  U: [[...line(140,60,140,180), ...arc(200,180,60,60,180,0), ...line(260,180,260,60)]],
  V: [line(130,60,200,240,270,60)],
  W: [line(110,60,155,240,200,125,245,240,290,60)],
  X: [line(135,60,265,240), line(265,60,135,240)],
  Y: [line(135,60,200,150), line(265,60,200,150,200,240)],
  Z: [line(130,60,270,60,130,240,270,240)],
};
const lower: Record<string, Point[][]> = {
  a: [oval(195), line(250,150,250,240)],
  b: [line(150,60,150,240), arc(200,195,50,45,180,540)],
  c: [arc(205,195,55,45,-35,-325)],
  d: [oval(195), line(250,60,250,240)],
  e: [[...line(150,195,250,195), ...arc(200,195,50,45,0,-325)]],
  f: [[...arc(215,100,35,40,-20,-180), ...line(180,100,180,240)], line(145,150,235,150)],
  g: [oval(195), [...line(250,150,250,250), ...arc(205,250,45,35,0,160)]],
  h: [line(150,60,150,240), [...line(150,190), ...arc(200,190,50,40,180,360), ...line(250,190,250,240)]],
  i: [line(200,150,200,240), line(200,113,200,119)],
  j: [[...line(225,150,225,250), ...arc(195,250,30,35,0,170)], line(225,113,225,119)],
  k: [line(155,60,155,240), line(245,150,155,205), line(185,187,250,240)],
  l: [line(200,60,200,240)],
  m: [line(125,150,125,240), [...line(125,183), ...arc(162.5,183,37.5,33,180,360), ...line(200,183,200,240)], [...line(200,183), ...arc(237.5,183,37.5,33,180,360), ...line(275,183,275,240)]],
  n: [line(150,150,150,240), [...line(150,190), ...arc(200,190,50,40,180,360), ...line(250,190,250,240)]],
  o: [oval(195)],
  p: [line(150,150,150,285), arc(200,195,50,45,180,540)],
  q: [oval(195), line(250,150,250,285)],
  r: [line(170,150,170,240), arc(215,185,45,35,180,315)],
  s: [[...arc(200,172.5,45,22.5,-30,-270), ...arc(200,217.5,45,22.5,-90,150)]],
  t: [[...line(185,90,185,215), ...arc(215,215,30,25,180,35)], line(150,150,240,150)],
  u: [[...line(150,150,150,200), ...arc(200,200,50,40,180,0), ...line(250,200,250,150)], line(250,150,250,240)],
  v: [line(145,150,200,240,255,150)],
  w: [line(115,150,155,240,200,170,245,240,285,150)],
  x: [line(150,150,250,240), line(250,150,150,240)],
  y: [line(145,150,200,240), line(255,150,175,285)],
  z: [line(150,150,250,150,150,240,250,240)],
};
export const LETTER_TEMPLATES: LetterTemplate[] = [
  ...Object.entries(upper).map(([letter, strokes]) => ({ id: `uppercase-${letter}`, letter, letterCase: 'uppercase' as const, strokes })),
  ...Object.entries(lower).map(([letter, strokes]) => ({ id: `lowercase-${letter}`, letter, letterCase: 'lowercase' as const, strokes })),
];
export function getLetterTemplate(id: string): LetterTemplate {
  const template = LETTER_TEMPLATES.find(item => item.id === id);
  if (!template) throw new Error(`Unknown letter template: ${id}`);
  return template;
}
export const pointsToPath = (points: readonly Point[]): string => points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const length = (points: readonly Point[]) => points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
const valid = (points: readonly Point[]) => points.length > 0 && points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y));
function sample(points: readonly Point[], count: number): Point[] {
  const total = length(points);
  if (!total) return Array.from({ length: count }, () => points[0]);
  let segment = 1;
  let consumed = 0;
  return Array.from({ length: count }, (_, i) => {
    const target = total * i / (count - 1);
    while (segment < points.length - 1 && consumed + distance(points[segment - 1], points[segment]) < target) {
      consumed += distance(points[segment - 1], points[segment]); segment++;
    }
    const a = points[segment - 1], b = points[segment];
    const ratio = distance(a, b) ? (target - consumed) / distance(a, b) : 0;
    return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
  });
}
const fractionNear = (source: Point[], target: Point[], radius: number) => source.filter(p => target.some(q => distance(p, q) <= radius)).length / source.length;

/** Score each ordered stroke at uniform arc-length intervals, never event density. */
export function evaluateLetterTrace(template: LetterTemplate, strokes: TraceStroke[]): TraceAssessment {
  const t = TRACE_TOLERANCES;
  const result: TraceAssessment = { passed: false, coverage: 0, precision: 0, startAccuracy: 0, directionAccuracy: 0,
    strokeCountMatch: strokes.length === template.strokes.length, feedback: 'Start at the numbered dot and trace each stroke in order.' };
  const count = template.strokes.length;
  let allPassed = result.strokeCountMatch;
  let firstProblem = '';
  template.strokes.forEach((reference, index) => {
    const actual = strokes[index]?.points;
    let problem = '';
    const dot = (template.id === 'lowercase-i' || template.id === 'lowercase-j') && index === 1;
    if (dot && actual && valid(actual) && length(actual) <= t.dotMaximumLength && actual.every(p => distance(p, reference[0]) <= t.pathRadius)) {
      // Dotting is a tap gesture; the rest of i/j must still satisfy the full trace contract.
      result.coverage += 1 / count; result.precision += 1 / count;
      result.startAccuracy += 1 / count; result.directionAccuracy += 1 / count;
    } else if (!actual || !valid(actual) || length(actual) === 0) {
      problem = 'Trace the whole stroke from its numbered starting dot.';
    } else {
      const referenceLength = length(reference), actualLength = length(actual);
      const referenceSamples = sample(reference, Math.max(12, Math.ceil(referenceLength / t.sampleSpacing) + 1));
      // Cap resampling work for pathological input without granting a long scribble a pass.
      const actualSamples = sample(actual, Math.min(2000, Math.max(12, Math.ceil(actualLength / t.sampleSpacing) + 1)));
      const coverage = fractionNear(referenceSamples, actualSamples, t.pathRadius);
      const precision = fractionNear(actualSamples, referenceSamples, t.pathRadius);
      const starts = distance(actual[0], reference[0]) <= t.startRadius ? 1 : 0;
      const progression = sample(actual, referenceSamples.length);
      const direction = progression.filter((p, i) => distance(p, referenceSamples[i]) <= t.progressionRadius).length / progression.length;
      result.coverage += coverage / count; result.precision += precision / count;
      result.startAccuracy += starts / count; result.directionAccuracy += direction / count;
      const ratio = actualLength / referenceLength;
      if (!starts) problem = 'Begin at this stroke’s numbered dot. Follow the stroke order.';
      else if (ratio < t.minimumLengthRatio || coverage < t.minimumCoverage) problem = 'Keep going along the guide until the whole stroke is traced.';
      else if (ratio > t.maximumLengthRatio || precision < t.minimumPrecision) problem = 'Stay close to the guide, with one smooth trace for each stroke.';
      else if (direction < t.minimumDirection) problem = 'Follow the arrow from the starting dot to the end of the stroke.';
    }
    if (problem) {
      allPassed = false;
      if (!firstProblem) { firstProblem = problem; result.correctionPoint = reference[0]; }
    }
  });
  result.passed = allPassed;
  result.feedback = allPassed ? 'You followed the letter’s guided strokes!' : firstProblem || `Use ${count} ${count === 1 ? 'stroke' : 'strokes'}, lifting between the numbered guides.`;
  return result;
}

/** Compare an untraced production after horizontal translation only, never reflection/rotation. */
export function evaluateLetterFormation(template: LetterTemplate, strokes: TraceStroke[]): TraceAssessment {
  const t = FORMATION_TOLERANCES;
  const result: TraceAssessment = { passed: false, coverage: 0, precision: 0, startAccuracy: 0,
    directionAccuracy: 0, strokeCountMatch: strokes.length === template.strokes.length,
    feedback: 'Compare your writing with the model. Notice its parts and where they meet the lines.' };
  const ink = strokes.flatMap(stroke => stroke.points);
  if (!ink.length || !valid(ink) || ink.some(p => p.x < 0 || p.x > 400 || p.y < 0 || p.y > 300)) return result;
  const reference = template.strokes.flat();
  const centerX = (points: readonly Point[]) => {
    let min = Infinity, max = -Infinity;
    for (const point of points) { min = Math.min(min, point.x); max = Math.max(max, point.x); }
    return (min + max) / 2;
  };
  const dx = centerX(reference) - centerX(ink);
  let passed = result.strokeCountMatch;
  template.strokes.forEach((path, index) => {
    const actual = strokes[index]?.points.map(p => ({ x: p.x + dx, y: p.y }));
    const count = template.strokes.length;
    if (!actual?.length) { passed = false; return; }
    const dot = (template.id === 'lowercase-i' || template.id === 'lowercase-j') && index === 1;
    if (dot && length(actual) <= TRACE_TOLERANCES.dotMaximumLength && actual.every(p => distance(p, path[0]) <= t.pathRadius)) {
      result.coverage += 1 / count; result.precision += 1 / count;
      result.startAccuracy += 1 / count; result.directionAccuracy += 1 / count;
      return;
    }
    if (!length(actual)) { passed = false; return; }
    const expected = sample(path, Math.max(12, Math.ceil(length(path) / 4)));
    const observed = sample(actual, Math.min(2000, Math.max(12, Math.ceil(length(actual) / 4))));
    const coverage = fractionNear(expected, observed, t.pathRadius);
    const precision = fractionNear(observed, expected, t.pathRadius);
    const ordered = sample(actual, expected.length);
    const direction = ordered.filter((p, i) => distance(p, expected[i]) <= 35).length / expected.length;
    const start = distance(actual[0], path[0]) <= t.startRadius ? 1 : 0;
    const ratio = length(actual) / length(path);
    result.coverage += coverage / count; result.precision += precision / count;
    result.startAccuracy += start / count; result.directionAccuracy += direction / count;
    passed &&= coverage >= t.minimumCoverage && precision >= t.minimumPrecision && direction >= t.minimumDirection
      && start === 1 && ratio >= t.minimumLengthRatio && ratio <= t.maximumLengthRatio;
  });
  result.passed = passed;
  if (passed) result.feedback = 'Your letter follows the model’s shape and writing lines. Keep practicing!';
  return result;
}
