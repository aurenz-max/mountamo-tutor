/**
 * function-sketch's boss (`components/live-activity/boss.ts`), bespoke because its modes mix a choice tapped and a
 * sketch placed, every one checked by the activity: the card is `functionSketch.card.ts`; this file validates a
 * lesson, lists its challenges, asks one, carries the lever set and plays the harness.
 */
import type { FunctionSketchChallenge, FunctionSketchData } from './FunctionSketch';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import {
  SKETCH_PASS, axesOf, canvasPixel, familyOf, functionSketchHarnessInput, inPlot, isStraight, revealSketch, sketchAsk,
  sketchScore,
} from './functionSketchWorkspace';
import { FUNCTION_SKETCH_LEVERS, practiceParent, simplerItem } from './functionSketchLevers';
import { functionSketchCard, type FunctionSketchMiss } from './functionSketch.card';

const TYPES = ['identify-features', 'classify-shape', 'sketch-match', 'compare-functions'];
const num = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const curve = (pts: unknown) => Array.isArray(pts) && pts.length >= 2 && pts.every(p => num(p?.x) && num(p?.y));

/** Whether the item's own check can be passed, and only by its key. */
function answerable(c: FunctionSketchChallenge): boolean {
  const a = axesOf(c);
  if (![a.xMin, a.xMax, a.yMin, a.yMax].every(num) || a.xMin >= a.xMax || a.yMin >= a.yMax) return false;
  if (c.type === 'classify-shape') {
    // Distinct choices, the key among them once, and a key that does not contradict the curve: a straight line is
    // linear, and a linear key needs a straight line.
    const opts = c.options ?? [];
    const norm = opts.map(o => o.trim().toLowerCase());
    if (!curve(c.classifyCurve) || opts.length < 2 || new Set(norm).size !== opts.length) return false;
    if (!c.correctType || opts.filter(o => o === c.correctType).length !== 1) return false;
    return isStraight(c.classifyCurve!, a.yMax - a.yMin) === (familyOf(c.correctType) === 'linear');
  }
  if (c.type === 'compare-functions') {
    // Two curves, a key that names one, and two different button labels (the learner picks by label).
    if (!curve(c.curveA) || !curve(c.curveB) || (c.correctCurve !== 'A' && c.correctCurve !== 'B')) return false;
    return (c.labelA || 'Curve A').trim() !== (c.labelB || 'Curve B').trim();
  }
  if (c.type === 'identify-features') {
    // At least two features (one alone is the whole answer at once), each on the plotted axes.
    const f = c.features ?? [];
    return curve(c.referenceCurve) && f.length >= 2 && f.every(x => num(x.x) && num(x.y) && num(x.tolerance) && inPlot(c, x));
  }
  // sketch-match: weighted key features, and the function's own curve, sketched point by point, is credited.
  const kfs = c.keyFeatures ?? [];
  if (!curve(c.revealCurve) || !kfs.length || !kfs.every(k => num(k.x) && num(k.y) && num(k.weight) && k.weight > 0)) return false;
  const reveal = revealSketch(c);
  return reveal.length >= (c.minPoints ?? 3) && sketchScore(c, reveal) >= SKETCH_PASS;
}

/** Reject a function-sketch lesson whose challenges cannot be attempted. */
export function validateFunctionSketchData(value: unknown): FunctionSketchData {
  const d = value as FunctionSketchData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated function sketch has invalid lesson content.');
  for (const c of d.challenges) {
    if (!answerable(c)) throw new Error(`A function-sketch ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The session challenge, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): FunctionSketchChallenge | undefined {
  const all = (ctx.data as FunctionSketchData).challenges ?? [];
  const parentId = practiceParent(String(ctx.itemId ?? ''));
  const parent = all.find(c => c.id === parentId);
  return parent && parentId !== ctx.itemId ? simplerItem(parent) ?? undefined : parent;
}

export const functionSketchBoss = defineBoss<FunctionSketchData, FunctionSketchChallenge, FunctionSketchMiss>({
  card: functionSketchCard,
  validate: validateFunctionSketchData,
  items: d => d.challenges,
  ask: c => sketchAsk(c),
  // A choice, the features found or a sketch, all checked by the activity: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, sketchAsk(c), null),
  levers: FUNCTION_SKETCH_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/FunctionSketch.tsx',
    instanceId: 'fsketch',
    defaults: { grade: 'Grade 10', mode: 'classify-shape', topic: 'Families of functions and their graphs' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    // Every mode through its real controls (`functionSketchHarnessInput`), then Check Answer: classify taps a family,
    // compare taps a curve's button, identify taps features on the canvas (one-point strokes in canvas pixels), sketch
    // taps the function's own curve point by point. A wrong answer is the item's signature miss: a confused family, the
    // other curve, one feature only, the sketch upside down or a flat line.
    play: (right, c): DriverInput[] => {
      const input = functionSketchHarnessInput(c, right ? 'correct' : 'wrong');
      if (input.kind === 'choose') return [{ type: 'choose', label: input.label }, { type: 'check' }];
      return [{ type: 'draw', strokes: input.points.map(p => [canvasPixel(c, p)]) }, { type: 'check' }];
    },
    // The key as the screen prints it: the family (classify). A curve, a feature or a sketch has no one printed key.
    replayKeys: ctx => {
      const c = currentItem(ctx);
      return c?.type === 'classify-shape' && c.correctType ? [c.correctType] : [];
    },
  },
});
