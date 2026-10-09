import type { FastFactChallenge, FastFactData } from '../../../primitives/visual-primitives/core/FastFact';
import { factQuestion, isAnswerCorrect } from '../../../primitives/visual-primitives/core/fastFactWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['recognize', 'recall', 'apply'];

/** A question with at least two distinct choices, exactly one of which the activity's check credits. */
function answerable(c: FastFactChallenge): boolean {
  const options = Array.isArray(c.options) ? c.options.filter(o => typeof o === 'string' && o.trim()) : [];
  return options.length >= 2 && new Set(options.map(o => o.trim().toLowerCase())).size === options.length
    && typeof c.correctAnswer === 'string' && options.filter(o => isAnswerCorrect(o, c)).length === 1;
}

/** Reject a fast-fact lesson whose challenges cannot be attempted. */
export function validateFastFactData(value: unknown): FastFactData {
  const d = value as FastFactData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.challengeType)
        || !c.prompt || typeof c.prompt.text !== 'string' || !factQuestion(c).trim()))
    throw new Error('Generated fast fact has invalid lesson content.');
  for (const c of d.challenges)
    if (!answerable(c)) throw new Error(`A fast-fact ${c.challengeType} challenge cannot be answered as generated.`);
  return d;
}

/** What the live adapter needs from the fast fact drill; the catalog's `teachingWorkspace` declares the rest. */
export const fastFactLiveDomain: WorkspaceDomain<FastFactData> = {
  validate: validateFastFactData,
  initialState: d => workspaceOpening({ title: d.title, task: factQuestion(d.challenges[0]), total: d.challenges.length }),
};
