/**
 * Word problem setup's boss, bespoke and stepped (`components/live-activity/boss.ts`): the card is
 * `diWordProblemSetup.card.ts`. Each item is one step of a story (`stepOf`: its `kind`). This file holds the content
 * check, the ask, the levers and the harness play; the component builds its own assignment (`wordProblemAssignment`:
 * a spoken key, or a gesture with no key on the placing step).
 */
import type { DiWordProblemSetupData, WordProblemItem } from './diWordProblemScript';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { defineBoss } from '../../../components/live-activity/boss';
import { diWordProblemSetupCard } from './diWordProblemSetup.card';
import { diWordProblemHarnessAnswers, wordProblemAskFor, wordProblemDataValid, wordProblemHarnessPlacements, wordProblemItems,
  type SpokenWordProblemMiss, type WordProblemMiss } from './diWordProblemWorkspace';
import { WORD_PROBLEM_LEVERS } from './diWordProblemLevers';

/** Reject a payload whose problems cannot all be asked. */
export function validateDiWordProblemSetupData(value: unknown): DiWordProblemSetupData {
  const d = value as DiWordProblemSetupData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.problems) || !d.problems.length || d.problems.length > 6
      || new Set(d.problems.map(problem => problem?.id)).size !== d.problems.length)
    throw new Error('Generated word problems have invalid lesson content.');
  if (!wordProblemDataValid(d)) throw new Error('A word problem cannot run in the teaching workspace.');
  return d;
}

export const diWordProblemSetupBoss = defineBoss<DiWordProblemSetupData, WordProblemItem, WordProblemMiss | SpokenWordProblemMiss>({
  card: diWordProblemSetupCard,
  validate: validateDiWordProblemSetupData,
  items: wordProblemItems,
  ask: wordProblemAskFor,
  stepOf: item => item.kind,
  levers: WORD_PROBLEM_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/direct-instruction/DiWordProblemSetup.tsx',
    instanceId: 'wordproblem',
    defaults: { grade: 'Grade 1', mode: 'find_big_number', topic: 'Addition and subtraction word problems within 20' },
    mounted: '[data-word-problem-object="story"]',
    // The placing step taps each card, then its slot (the build commits after the stillness window); a wrong build puts
    // a small amount in the big slot. Every other step is one spoken answer.
    play: (right, item) => {
      if (item.kind === 'big_number') {
        const board = wordProblemHarnessPlacements(item, !right);
        return (['small1', 'small2', 'big'] as const).flatMap((slot): DriverInput[] => {
          const label = item.plan.quantities.find(q => q.id === board[slot])?.label;
          return label ? [{ type: 'choose', label: `Select ${label}` }, { type: 'touch', target: `slot-${slot}` }] : [];
        });
      }
      const answers = diWordProblemHarnessAnswers(item);
      return [{ type: 'answer', text: right ? answers.correct : answers.plainWrong }];
    },
  },
});
