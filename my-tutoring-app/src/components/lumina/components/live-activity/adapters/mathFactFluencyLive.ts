import type { MathFactFluencyData } from '../../../primitives/visual-primitives/math/MathFactFluency';
import { equationResult, mathFactAssignment, mathFactChannel } from '../../../primitives/visual-primitives/math/mathFactFluencyWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a fact the activity cannot check: a choice row, equation row or picture row must hold the answer. */
export const validateMathFactFluencyData = (value: unknown): MathFactFluencyData => validateChallengePool<MathFactFluencyData>(value,
  c => {
    if (!c || typeof c.instruction !== 'string' || !c.instruction || typeof c.correctAnswer !== 'number') return false;
    const channel = mathFactChannel(c);
    if (channel === 'choice') return c.options!.includes(c.correctAnswer);
    if (channel === 'equation') return Array.isArray(c.equationOptions) && c.equationOptions.some(eq => equationResult(eq) === c.correctAnswer);
    if (channel === 'picture') return Array.isArray(c.visualOptions) && c.visualOptions.some(v => v.count === c.correctAnswer);
    return true;
  },
  { pool: 'Generated math fact fluency has invalid lesson content.', item: 'A math fact cannot be checked.' });

/** What the live adapter needs from math fact fluency; the catalog's `teachingWorkspace` declares the rest. */
export const mathFactFluencyLiveDomain: WorkspaceDomain<MathFactFluencyData> = {
  validate: validateMathFactFluencyData,
  initialState: data => workspaceOpening({ title: data.title, task: mathFactAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
