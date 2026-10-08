import type { AngleWorkshopChallenge, AngleWorkshopData } from '../../../primitives/visual-primitives/math/AngleWorkshop';
import { fitsTarget, passingOpening } from '../../../primitives/visual-primitives/math/angleWorkshopWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
const RELATIONS = ['complementary', 'supplementary', 'vertical', 'adjacent'];

/** Whether the activity's own check can be answered as generated: each mode needs the material its check reads. */
function answerable(c: AngleWorkshopChallenge): boolean {
  if (!c || typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  switch (c.type) {
    case 'make_angle':
      // An opening the step buttons reach must pass, and a range must sit inside 0..180.
      return (c.targetKind !== 'range' || (num(c.targetMin) && num(c.targetMax) && c.targetMin! >= 5 && c.targetMin! < c.targetMax! && c.targetMax! <= 180))
        && fitsTarget(c, passingOpening(c));
    case 'classify_pairs':
      return RELATIONS.includes(c.expectedRelationship ?? '') && c.relationship === c.expectedRelationship;
    case 'measure': case 'solve_unknown': case 'solve_algebraic': case 'transversal':
      return num(c.expectedAnswer) && num(c.tolerance) && c.tolerance > 0;
    default:
      return false;
  }
}

/** Reject an angle lesson whose challenges cannot be attempted. */
export const validateAngleWorkshopData = (value: unknown): AngleWorkshopData => validateChallengePool<AngleWorkshopData>(
  value, answerable,
  { pool: 'Generated angle workshop has invalid lesson content.', item: 'An angle-workshop challenge cannot be answered as generated.' });

/** What the live adapter needs from the angle workshop; the catalog's `teachingWorkspace` declares the rest. */
export const angleWorkshopLiveDomain: WorkspaceDomain<AngleWorkshopData> = {
  validate: validateAngleWorkshopData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
