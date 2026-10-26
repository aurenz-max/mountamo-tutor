/**
 * knowledge-check's boss, bespoke and stepped (`components/live-activity/boss.ts`): the card is
 * `knowledgeCheck.card.ts`. Each item is one question, and its step (`knowledgeCheckStep`) says how it is answered:
 * said and judged by the tutor, touched and checked by the activity, or worked on the problem's own surface (and, for a
 * choice or true/false problem, said instead). This file holds the content check, the items, the ask and key, the levers
 * and the harness play; the assignment is `knowledgeCheckAssignment` (a spoken key, or a gesture with none).
 */
import type { ProblemData } from '../types';
import { defineBoss } from '../components/live-activity/boss';
import { knowledgeCheckCard } from './knowledgeCheck.card';
import { KNOWLEDGE_CHECK_LEVERS } from './knowledgeCheckLevers';
import {
  knowledgeCheckAsk, knowledgeCheckAssignment, knowledgeCheckGiven, knowledgeCheckItems, knowledgeCheckJourneyAnswers,
  knowledgeCheckKey, knowledgeCheckStep,
} from './knowledgeCheckWorkspace';

export type KnowledgeCheckPayload = { problems: ProblemData[]; title: string };

/** Reject an empty set. Every problem yields an item (a problem the spoken kinds cannot ask is worked on screen),
 *  because completion is counted per problem. */
export function validateKnowledgeCheckData(value: unknown): KnowledgeCheckPayload {
  const d = value as Partial<KnowledgeCheckPayload>;
  if (!d || !Array.isArray(d.problems) || !d.problems.length) throw new Error('Generated knowledge check has no problems.');
  if (!knowledgeCheckItems(d).judgedViable) throw new Error('This knowledge check has no items.');
  return { ...d, problems: d.problems, title: d.title || 'Knowledge Check' };
}

export const knowledgeCheckBoss = defineBoss({
  card: knowledgeCheckCard,
  validate: validateKnowledgeCheckData,
  items: (data: KnowledgeCheckPayload) => knowledgeCheckItems(data).items,
  ask: item => knowledgeCheckAsk(item),
  assignment: knowledgeCheckAssignment,
  spoken: { key: knowledgeCheckKey, given: knowledgeCheckGiven },
  stepOf: knowledgeCheckStep,
  levers: KNOWLEDGE_CHECK_LEVERS,
  drive: {
    component: 'primitives/KnowledgeCheck.tsx',
    instanceId: 'knowledge-check',
    defaults: { grade: 'Grade 2', mode: 'recall', topic: 'Plants and what they need to grow' },
    mounted: '[data-pip-object="question"]',
    leakTokens: ['KC_ITEM', 'KC_MOVE', 'KC_COMPLETE', 'KC_HEAR', 'KC_TAP'],
    // A spoken item answers with the pack's short form; a symbol menu or a sign in a number sentence is pressed.
    play: (right, item) => {
      const answers = knowledgeCheckJourneyAnswers(item);
      if (answers.press) return [{ type: 'choose', label: right ? answers.press.correct : answers.press.wrong }];
      return [{ type: 'answer', text: right ? answers.correct : answers.plainWrong }];
    },
  },
});
