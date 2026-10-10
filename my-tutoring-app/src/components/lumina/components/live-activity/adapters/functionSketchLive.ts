import type { FunctionSketchChallenge, FunctionSketchData } from '../../../primitives/visual-primitives/math/FunctionSketch';
import {
  SKETCH_PASS, axesOf, familyOf, inPlot, isStraight, revealSketch, sketchScore, workspaceAssignment,
} from '../../../primitives/visual-primitives/math/functionSketchWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

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

/** What the live adapter needs from the function sketch; the catalog's `teachingWorkspace` declares the rest. */
export const functionSketchLiveDomain: WorkspaceDomain<FunctionSketchData> = {
  validate: validateFunctionSketchData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
