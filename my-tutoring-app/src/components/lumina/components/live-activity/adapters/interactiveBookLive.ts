import type { InteractiveBookData } from '../../../primitives/visual-primitives/literacy/InteractiveBook';
import { itemsFromChallenges } from '../../../primitives/visual-primitives/literacy/interactiveBookScript';
import { interactiveBookAssignment } from '../../../primitives/visual-primitives/literacy/interactiveBookWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a book the pack would not ask: no book, or a challenge its build gates drop (a lead the tutor
 *  cannot say, a glowing word not on its page, a feature text that is not printed). */
export function validateInteractiveBookData(value: unknown): InteractiveBookData {
  const d = value as InteractiveBookData;
  if (!d || !Array.isArray(d.books) || !d.books[0]) throw new Error('Generated interactive book has no book.');
  return validateChallengePool<InteractiveBookData>(value, c => !!c && itemsFromChallenges([c]).length === 1,
    { pool: 'Generated interactive book has invalid lesson content.', item: 'An interactive book item cannot be asked.' });
}

/** What the live adapter needs from the book; the catalog's `teachingWorkspace` declares the rest. */
export const interactiveBookLiveDomain: WorkspaceDomain<InteractiveBookData> = {
  validate: validateInteractiveBookData,
  initialState: data => {
    const items = itemsFromChallenges(data.challenges);
    return workspaceOpening({ title: data.title, task: interactiveBookAssignment(items[0]).task, total: items.length });
  },
};
