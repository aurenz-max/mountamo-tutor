import type { LetterWorkshopChallenge, LetterWorkshopData } from '../../../primitives/visual-primitives/literacy/LetterWorkshop';
import { getLetterTemplate } from '../../../primitives/visual-primitives/literacy/letterWorkshopGeometry';
import { isLetterWorkshopMode } from '../../../primitives/visual-primitives/literacy/letterWorkshopModes';
import { workspaceAssignment } from '../../../primitives/visual-primitives/literacy/letterWorkshopWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** A challenge the paper can check: a known mode and a code-owned letter template. */
function answerable(c: LetterWorkshopChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !isLetterWorkshopMode(c.type)) return false;
  try { return !!getLetterTemplate(c.templateId); } catch { return false; }
}

/** What the live adapter needs from the letter workshop; the catalog's `teachingWorkspace` declares the rest. */
export const letterWorkshopLiveDomain: WorkspaceDomain<LetterWorkshopData> = {
  validate: value => validateChallengePool<LetterWorkshopData>(value, answerable, {
    pool: 'Generated letter workshop has invalid lesson content.',
    item: 'A letter-workshop challenge has no letter the paper can check.' }),
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
