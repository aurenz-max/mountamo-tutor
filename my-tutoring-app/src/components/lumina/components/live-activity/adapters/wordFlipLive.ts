import type { WordFlipData } from '../../../primitives/visual-primitives/literacy/WordFlip';
import { flipAssignment } from '../../../primitives/visual-primitives/literacy/wordFlipWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['plural_s', 'plural_es', 'plural_y', 'irregulars', 'past_ed', 'past_irregular'];

/** Reject a challenge the frame cannot ask: every item needs its type, source word and code-derived answer. */
export const validateWordFlipData = (value: unknown): WordFlipData => validateChallengePool<WordFlipData>(value,
  c => !!c && TYPES.includes(c.type) && typeof c.sourceWord === 'string' && !!c.sourceWord.trim()
    && typeof c.answer === 'string' && !!c.answer.trim(),
  { pool: 'Generated word flip has invalid lesson content.', item: 'A word-flip challenge cannot be asked.' });

/** What the live adapter needs from word flip; the catalog's `teachingWorkspace` declares the rest. */
export const wordFlipLiveDomain: WorkspaceDomain<WordFlipData> = {
  validate: validateWordFlipData,
  initialState: data => workspaceOpening({ title: data.title, task: flipAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
