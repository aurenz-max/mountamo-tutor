/**
 * practice-problem's boss (`components/live-activity/boss.ts`), bespoke because every mode is a handwritten
 * derivation the primitive's own checker reads, not one tap: the card is `practiceProblem.card.ts`; this file
 * validates a lesson, lists its one problem, asks it, carries the lever set and names the harness.
 */
import type { PracticeProblemData } from './PracticeProblem';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { PROBLEM_ID, workspaceTask, type PracticeChallenge } from './practiceProblemWorkspace';
import { PRACTICE_LEVERS } from './practiceProblemLevers';
import { practiceProblemCard, type PracticeMiss } from './practiceProblem.card';

/** Reject a practice problem the judge cannot check: one problem, a worked solution of 2+ steps, an answer. */
export function validatePracticeProblemData(value: unknown): PracticeProblemData {
  const d = value as PracticeProblemData;
  if (!d || typeof d.title !== 'string' || !d.problem || typeof d.problem.statement !== 'string' || !d.problem.statement.trim()
      || !Array.isArray(d.steps) || d.steps.length < 2
      || d.steps.some(s => !s || typeof s.title !== 'string' || typeof s.canonicalBody !== 'string' || !s.canonicalBody.trim())
      || typeof d.canonicalAnswer !== 'string' || !d.canonicalAnswer.trim())
    throw new Error('Generated practice problem has no checkable worked solution.');
  return d;
}

export const practiceProblemBoss = defineBoss<PracticeProblemData, PracticeChallenge, PracticeMiss>({
  card: practiceProblemCard,
  validate: validatePracticeProblemData,
  items: d => [{ ...d, id: PROBLEM_ID }],
  ask: workspaceTask,
  // A written solution the primitive's checker judges: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, workspaceTask(c), null),
  levers: PRACTICE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/PracticeProblem.tsx',
    instanceId: 'practice',
    defaults: { grade: 'Grade 8', mode: 'derive_medium', topic: 'Solving two-step linear equations' },
    mounted: '[data-pip-object="workspace"]',
    // Every mode is handwriting read by a vision transcription and checked by a model judge (`transcribeWork`,
    // `compareWork`). The sweep has no canvas image and no judge, so no input can produce a checked answer (J1
    // baselined); `PracticeProblem.workspace.test.tsx` drives the miss, Try again and the pass with both routes stubbed.
    play: (_right, c) => {
      throw new Error(`practice-problem ${String(c.evalMode ?? 'derive')} is not driven at W1 (handwriting read by a model judge)`);
    },
  },
});
