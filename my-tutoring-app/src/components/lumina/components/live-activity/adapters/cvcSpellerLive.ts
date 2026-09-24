import type { CvcSpellerData } from '../../../primitives/visual-primitives/literacy/CvcSpeller';
import { cvcAssignment, cvcItem } from '../../../primitives/visual-primitives/literacy/cvcSpellerWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TASKS = ['fill-vowel', 'spell-word', 'word-sort'];

/** Reject a challenge the board cannot ask: a three-letter word whose middle letter is a short vowel. */
export const validateCvcSpellerData = (value: unknown): CvcSpellerData => validateChallengePool<CvcSpellerData>(value,
  c => !!c && TASKS.includes(c.taskType) && typeof c.targetWord === 'string' && cvcItem(c).letters.length === 3
    && 'aeiou'.includes(cvcItem(c).vowelLetter),
  { pool: 'Generated CVC speller has invalid lesson content.', item: 'A CVC speller challenge cannot be asked.' });

/** What the live adapter needs from the CVC speller; the catalog's `teachingWorkspace` declares the rest. */
export const cvcSpellerLiveDomain: WorkspaceDomain<CvcSpellerData> = {
  validate: validateCvcSpellerData,
  initialState: data => workspaceOpening({ title: data.title, task: cvcAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
