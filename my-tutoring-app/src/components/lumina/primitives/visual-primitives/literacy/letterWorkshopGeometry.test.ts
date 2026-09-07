import { describe, expect, it } from 'vitest';
import { LETTER_TEMPLATES, evaluateLetterTrace, getLetterTemplate, pointsToPath, type LetterTemplate, type TraceStroke } from './letterWorkshopGeometry';

const trace = (template: LetterTemplate): TraceStroke[] => template.strokes.map(points => ({ pointerType: 'pen', points: points.map((p, t) => ({ ...p, t })) }));
describe('Letter Workshop guided trace geometry', () => {
  it('provides all 52 code-owned forms inside the writing space', () => {
    expect(new Set(LETTER_TEMPLATES.map(t => t.id)).size).toBe(52);
    for (const template of LETTER_TEMPLATES) {
      expect(template.strokes.length).toBeGreaterThan(0);
      for (const p of template.strokes.flat()) {
        expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(400);
        expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(285);
      }
    }
    expect(() => getLetterTemplate('unknown')).toThrow('Unknown letter template');
    expect(pointsToPath([{ x: 10, y: 20 }, { x: 30, y: 40 }])).toBe('M 10.00 20.00 L 30.00 40.00');
  });
  it.each(LETTER_TEMPLATES.map(t => [t.id, t] as const))('accepts exact guided strokes: %s', (_, template) => {
    const result = evaluateLetterTrace(template, trace(template));
    expect(result.passed).toBe(true);
    expect(result.coverage).toBeCloseTo(1); expect(result.precision).toBeCloseTo(1);
  });
  it.each(LETTER_TEMPLATES.map(t => [t.id, t] as const))('rejects taps and backwards traces: %s', (_, template) => {
    expect(evaluateLetterTrace(template, trace(template).map(s => ({ ...s, points: [s.points[0]] }))).passed).toBe(false);
    expect(evaluateLetterTrace(template, trace(template).map(s => ({ ...s, points: [...s.points].reverse() }))).passed).toBe(false);
  });
  it('rejects missing, extra, and reordered strokes', () => {
    const template = getLetterTemplate('uppercase-A');
    const strokes = trace(template);
    expect(evaluateLetterTrace(template, strokes.slice(0, 2)).passed).toBe(false);
    expect(evaluateLetterTrace(template, [...strokes, strokes[0]]).passed).toBe(false);
    const reordered = evaluateLetterTrace(template, [strokes[1], strokes[0], strokes[2]]);
    expect(reordered.passed).toBe(false);
    expect(reordered.correctionPoint).toEqual(template.strokes[0][0]);
  });
  it('accepts tapping the dot of i/j only after tracing the main stroke', () => {
    for (const id of ['lowercase-i', 'lowercase-j']) {
      const template = getLetterTemplate(id);
      const strokes = trace(template);
      strokes[1].points = [strokes[1].points[0]];
      expect(evaluateLetterTrace(template, strokes).passed).toBe(true);
      strokes[1].points[0] = { x: 30, y: 30, t: 0 };
      expect(evaluateLetterTrace(template, strokes).passed).toBe(false);
    }
  });
  it('rejects a short trace even when every captured point is on the guide', () => {
    const template = getLetterTemplate('lowercase-l');
    const strokes: TraceStroke[] = [{ pointerType: 'touch', points: [{ x: 200, y: 60, t: 0 }, { x: 200, y: 90, t: 1 }] }];
    expect(evaluateLetterTrace(template, strokes).passed).toBe(false);
  });
  it('rejects shortcuts whose sparse endpoints lie on the guide', () => {
    const template = getLetterTemplate('uppercase-V');
    const strokes = trace(template);
    strokes[0].points.splice(1, 1);
    expect(evaluateLetterTrace(template, strokes).passed).toBe(false);
  });
  it.each([
    ['lowercase-i', 'lowercase-l'], ['lowercase-a', 'lowercase-d'],
    ['lowercase-b', 'lowercase-p'], ['lowercase-o', 'lowercase-c'],
    ['uppercase-O', 'uppercase-C'], ['uppercase-U', 'uppercase-V'],
  ])('rejects another letter: %s versus %s', (target, other) => {
    expect(evaluateLetterTrace(getLetterTemplate(target), trace(getLetterTemplate(other))).passed).toBe(false);
    expect(evaluateLetterTrace(getLetterTemplate(other), trace(getLetterTemplate(target))).passed).toBe(false);
  });
  it('rejects a back-and-forth scribble even with full on-path coverage', () => {
    const template = getLetterTemplate('lowercase-l');
    const strokes = trace(template);
    const [start, end] = strokes[0].points;
    strokes[0].points = [start, end, start, end];
    const result = evaluateLetterTrace(template, strokes);
    expect(result.coverage).toBe(1); expect(result.precision).toBe(1);
    expect(result.passed).toBe(false);
  });
  it('weights traveled distance instead of pointer-event density', () => {
    const template = getLetterTemplate('uppercase-V');
    const sparse = trace(template);
    const dense = sparse.map(stroke => ({ ...stroke, points: stroke.points.flatMap((p, i, points) => {
      const next = points[i + 1];
      return next ? Array.from({ length: i ? 7 : 300 }, (_, j) => ({ x: p.x + (next.x - p.x) * j / (i ? 7 : 300), y: p.y + (next.y - p.y) * j / (i ? 7 : 300), t: j })) : [p];
    }) }));
    expect(evaluateLetterTrace(template, dense)).toEqual(evaluateLetterTrace(template, sparse));
    const invalid = trace(getLetterTemplate('lowercase-l'));
    invalid[0].points = [...Array.from({ length: 500 }, (_, t) => ({ x: 200, y: 60, t })), { x: 350, y: 150, t: 501 }, { x: 200, y: 240, t: 502 }];
    expect(evaluateLetterTrace(getLetterTemplate('lowercase-l'), invalid).passed).toBe(false);
  });
  it('accepts a small consistent motor deviation and rejects invalid coordinates', () => {
    const template = getLetterTemplate('uppercase-O');
    const strokes = trace(template).map(s => ({ ...s, points: s.points.map(p => ({ ...p, x: p.x + 8, y: p.y + 5 })) }));
    expect(evaluateLetterTrace(template, strokes).passed).toBe(true);
    strokes[0].points[0].x = Number.NaN;
    expect(evaluateLetterTrace(template, strokes).passed).toBe(false);
  });
});
