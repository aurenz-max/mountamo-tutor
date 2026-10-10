import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { FunctionSketchChallenge } from './FunctionSketch';
import {
  EMPTY_WORK, FUNCTION_SKETCH_MISSES_BY_MODE, checkWork, familyOf, functionSketchHarnessInput, inPlot, isStraight,
  revealSketch, sketchScore,
} from './functionSketchWorkspace';
import {
  FEATURE_MODEL, MODEL_FEATURES, FLIP_MODEL, functionSketchLevers, isPracticeItem, leverFacts, leverTextLeaks, modelLeaks,
  practiceLeaks, sample, simplerItem, staircase, turnsAndCrossings,
} from './functionSketchLevers';

const axes = { xLabel: 'x', xMin: -3, xMax: 3, yLabel: 'y', yMin: -6, yMax: 8 };
const FAMILIES = ['linear', 'quadratic', 'cubic', 'exponential', 'logarithmic', 'sinusoidal'];
const classifyItems: FunctionSketchChallenge[] = FAMILIES.map((key, i) => ({ ...axes, id: `c${i}`, type: 'classify-shape',
  instruction: 'What type of function is this curve?', classifyCurve: sample(key === 'linear' ? x => x : x => x * x - 2, -3, 3),
  options: [key, ...FAMILIES.filter(f => f !== key).slice(0, 3)], correctType: key }));
const compareItems: FunctionSketchChallenge[] = ['Which curve grows faster and faster?', 'Which curve is a straight line?', 'Which curve has a period of pi?']
  .map((question, i) => ({ ...axes, id: `m${i}`, type: 'compare-functions', instruction: 'Two curves.', question,
    curveA: sample(x => x + 1, -3, 3), curveB: sample(x => 2 ** x, -3, 3), labelA: 'Model A', labelB: 'Model B', correctCurve: i % 2 ? 'A' : 'B' }));
const identifyItems: FunctionSketchChallenge[] = [
  { ...axes, id: 'i0', type: 'identify-features', instruction: 'Find the features.', expression: 'y = 4 - x^2', showFeatureLabels: true, referenceCurve: sample(x => 4 - x * x, -3, 3),
    features: [{ type: 'root', x: -2, y: 0, label: 'left root', tolerance: 0.36 }, { type: 'maximum', x: 0, y: 4, label: 'top', tolerance: 0.36 }] },
  { ...axes, id: 'i1', type: 'identify-features', instruction: 'Find the features.', expression: 'y = (x - 2)^2', showFeatureHints: false, showFeatureLabels: false,
    referenceCurve: sample(x => (x - 2) ** 2, -3, 3),
    features: [{ type: 'minimum', x: 2, y: 0, label: 'vertex', tolerance: 0.36 }, { type: 'y-intercept', x: 0, y: 4, label: 'start', tolerance: 0.36 }] },
  { ...axes, id: 'i2', type: 'identify-features', instruction: 'Find the features.', expression: 'y = (x - 1)^2 - 4', referenceCurve: sample(x => (x - 1) ** 2 - 4, -3, 3),
    features: [{ type: 'root', x: -1, y: 0, label: 'root', tolerance: 0.36 }, { type: 'minimum', x: 1, y: -4, label: 'min', tolerance: 0.36 }] },
];
const sketchItems: FunctionSketchChallenge[] = [
  { ...axes, id: 's0', type: 'sketch-match', instruction: 'Sketch it.', sketchExpression: 'y = x^2 - 4', revealCurve: sample(x => x * x - 4, -3, 3), minPoints: 4,
    keyFeatures: [{ type: 'zero', description: '', x: -2, y: 0, tolerance: 0.48, weight: 0.25 }, { type: 'intercept', description: '', x: 0, y: -4, tolerance: 0.48, weight: 0.5 },
      { type: 'zero', description: '', x: 2, y: 0, tolerance: 0.48, weight: 0.25 }] },
  { ...axes, id: 's1', type: 'sketch-match', instruction: 'Sketch it.', sketchExpression: 'y = x^2 - 1', sketchDescription: 'A parabola', revealCurve: sample(x => x * x - 1, -3, 3),
    minPoints: 4, keyFeatures: [{ type: 'peak', description: '', x: 0, y: -1, tolerance: 0.48, weight: 1 }] },
  { ...axes, id: 's2', type: 'sketch-match', instruction: 'Sketch it.', sketchExpression: 'y = x^2', revealCurve: sample(x => x * x, -3, 3), minPoints: 4,
    keyFeatures: [{ type: 'peak', description: '', x: 0, y: 0, tolerance: 0.48, weight: 1 }] },
];
const ALL = [...classifyItems, ...compareItems, ...identifyItems, ...sketchItems];

describe('lever declarations', () => {
  it.each(ALL.map(c => [c.id, c] as const))('%s: every miss of its mode is answered by a lever; no digit in when/does', (_id, c) => {
    const levers = functionSketchLevers(c, []);
    for (const l of levers) {
      expect(leverTextLeaks(l.when), `${l.id} when`).toBe(false);
      expect(leverTextLeaks(l.does), `${l.id} does`).toBe(false);
    }
    for (const miss of FUNCTION_SKETCH_MISSES_BY_MODE[c.type]) expect(nextLever(levers, miss), `${c.id} ${miss}`).toBeTruthy();
  });

  it('this miss, then this lever', () => {
    expect(nextLever(functionSketchLevers(classifyItems[1], []), 'line_for_curve')).toBe('family_gallery');
    expect(nextLever(functionSketchLevers(compareItems[0], []), 'other_curve')).toBe('equal_steps');
    expect(nextLever(functionSketchLevers(identifyItems[0], []), 'missed_root')).toBe('feature_guide');
    expect(nextLever(functionSketchLevers(identifyItems[0], ['feature_guide']), 'missed_root')).toBe('axis_glow');
    expect(nextLever(functionSketchLevers(sketchItems[0], []), 'upside_down')).toBe('sketch_steps');
    expect(nextLever(functionSketchLevers(sketchItems[0], ['sketch_steps']), 'upside_down')).toBe('flip_model');
  });

  it('feature_names only where the tier hid the names; a model only off the item', () => {
    expect(functionSketchLevers(identifyItems[0], []).map(l => l.id)).not.toContain('feature_names');
    expect(functionSketchLevers(identifyItems[1], []).map(l => l.id)).toContain('feature_names');
    // The worked example is y = (x - 1)² - 4: never offered on that curve.
    expect(modelLeaks(identifyItems[2], MODEL_FEATURES)).toBe(true);
    expect(functionSketchLevers(identifyItems[2], []).map(l => l.id)).not.toContain('model_features');
    expect(modelLeaks(sketchItems[2], FLIP_MODEL)).toBe(true);
    expect(functionSketchLevers(sketchItems[2], []).map(l => l.id)).not.toContain('flip_model');
    expect(FEATURE_MODEL.features).toHaveLength(4);
  });

  it('a pulled lever\'s fact names what is drawn, never a place or a curve\'s letter', () => {
    expect(leverFacts(compareItems[0], ['equal_steps', 'turn_marks'])).not.toMatch(/Curve [AB]|Model [AB]/);
    expect(leverFacts(identifyItems[1], ['feature_names'])).toBe("The list under the graph names each feature's kind: minimum, y-intercept.");
    expect(leverFacts(identifyItems[0], ['axis_glow', 'feature_guide'])).not.toMatch(/\(-?\d/);
  });
});

describe('help pictures', () => {
  it('turn and crossing dots sit where the curve turns or crosses', () => {
    const marks = turnsAndCrossings(sample(x => 4 - x * x, -3, 3, 21));
    expect(marks.some(p => Math.abs(p.x) < 1e-9 && p.y === 4)).toBe(true);
    expect(marks.filter(p => p.y === 0).map(p => Math.round(p.x * 10) / 10).sort()).toEqual([-2, 2]);
  });
  it('a line\'s staircase has equal risers; an exponential\'s grow by a factor', () => {
    const rise = (s: ReturnType<typeof staircase>) => s.map(x => x.to.y - x.from.y);
    const line = rise(staircase(sample(x => 2 * x, -3, 3)));
    expect(new Set(line.map(v => v.toFixed(6))).size).toBe(1);
    const exp = rise(staircase(sample(x => 2 ** x, -3, 3, 61)));
    expect(exp[5] / exp[4]).toBeCloseTo(exp[2] / exp[1], 1);
  });
});

describe('simplify', () => {
  it.each(ALL.map(c => [c.id, c] as const))('%s: same mode, own id, ask and answer, never the item\'s key; the row can solve it', (_id, c) => {
    const p = simplerItem(c);
    expect(p, c.id).not.toBeNull();
    expect(isPracticeItem(p!)).toBe(true);
    expect(p!.type).toBe(c.type);
    expect(practiceLeaks(c, p!)).toBe(false);
    expect(simplerItem(p!)).toBeNull();
    // The row's correct input credits it; the wrong one does not.
    const work = (intent: 'correct' | 'wrong') => {
      const input = functionSketchHarnessInput(p!, intent);
      if (input.kind === 'choose') {
        return p!.type === 'classify-shape' ? { ...EMPTY_WORK, chosen: input.label }
          : { ...EMPTY_WORK, curve: (input.label === (p!.labelA ?? 'Curve A') ? 'A' : 'B') as 'A' | 'B' };
      }
      return p!.type === 'identify-features' ? { ...EMPTY_WORK, found: input.points.map((_, i) => i) } : { ...EMPTY_WORK, points: input.points };
    };
    expect(checkWork(p!, work('correct')).correct, `${c.id} correct`).toBe(true);
    expect(checkWork(p!, work('wrong')).correct, `${c.id} wrong`).toBe(false);
    if (p!.type === 'classify-shape') {
      expect(isStraight(p!.classifyCurve!, p!.yMax - p!.yMin)).toBe(familyOf(p!.correctType) === 'linear');
      expect(p!.options).toHaveLength(2);
      expect(familyOf(p!.options!.find(o => o !== p!.correctType))).not.toBe(familyOf(c.correctType));
    }
    if (p!.type === 'identify-features') expect(p!.features!.every(f => inPlot(p!, f))).toBe(true);
    if (p!.type === 'sketch-match') expect(sketchScore(p!, revealSketch(p!))).toBeGreaterThanOrEqual(60);
  });

  it('the practice leak rule catches the learner\'s own key and item', () => {
    const c = classifyItems[1];
    const p = simplerItem(c)!;
    expect(practiceLeaks(c, { ...p, options: ['quadratic', 'linear'] })).toBe(true);
    expect(practiceLeaks(c, { ...p, id: c.id })).toBe(true);
    const m = compareItems[0];
    expect(practiceLeaks(m, { ...simplerItem(m)!, question: m.question })).toBe(true);
    const i = identifyItems[0];
    expect(practiceLeaks(i, { ...simplerItem(i)!, expression: i.expression })).toBe(true);
  });
});
