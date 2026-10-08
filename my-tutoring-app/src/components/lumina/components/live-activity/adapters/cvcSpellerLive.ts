import type { CvcSpellerData } from '../../../primitives/visual-primitives/literacy/CvcSpeller';
import { cvcAssignment, cvcItem } from '../../../primitives/visual-primitives/literacy/cvcSpellerWorkspace';
import { letterAssignment, letterItemsFrom } from '../../../primitives/visual-primitives/literacy/letterBuild';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TASKS = ['fill-vowel', 'spell-word', 'word-sort'];

/** The open build (make_word): every ask must pass the surface's own gate. */
function validateLetterBuild(d: CvcSpellerData): CvcSpellerData {
  if (typeof d.title !== 'string' || !Array.isArray(d.buildItems) || !d.buildItems.length || d.buildItems.length > 12
      || letterItemsFrom(d.buildItems, d.supportTier).length !== d.buildItems.length)
    throw new Error('Generated CVC speller has invalid lesson content.');
  return d;
}

/** Reject a challenge the board cannot ask: a three-letter word whose middle letter is a short vowel. */
export const validateCvcSpellerData = (value: unknown): CvcSpellerData => (value as CvcSpellerData)?.task === 'letter_build'
  ? validateLetterBuild(value as CvcSpellerData) : validateChallengePool<CvcSpellerData>(value,
  c => !!c && TASKS.includes(c.taskType) && typeof c.targetWord === 'string' && cvcItem(c).letters.length === 3
    && 'aeiou'.includes(cvcItem(c).vowelLetter),
  { pool: 'Generated CVC speller has invalid lesson content.', item: 'A CVC speller challenge cannot be asked.' });

/** What the live adapter needs from the CVC speller; the catalog's `teachingWorkspace` declares the rest. */
export const cvcSpellerLiveDomain: WorkspaceDomain<CvcSpellerData> = {
  validate: validateCvcSpellerData,
  initialState: data => data.task === 'letter_build'
    ? workspaceOpening({ title: data.title, task: letterAssignment(letterItemsFrom(data.buildItems ?? [], data.supportTier)[0]).task,
      total: data.buildItems?.length ?? 0 })
    : workspaceOpening({ title: data.title, task: cvcAssignment(data.challenges[0]).task, total: data.challenges.length }),
};
