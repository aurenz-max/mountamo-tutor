/**
 * Worked procedure's boss, on the spoken preset (`components/live-activity/boss.ts`): the card is
 * `diWorkedProcedure.card.ts`; this file is what the preset cannot know — the content check, the key, the known
 * misses, the levers and the harness's answers. The live adapter and the journey row are built from it.
 */
import type { DiWorkedProcedureData, WorkedProcedureItem } from './diWorkedProcedureScript';
import { spokenBoss } from '../../../components/live-activity/boss';
import { diWorkedProcedureCard } from './diWorkedProcedure.card';
import { diWorkedProcedureHarnessAnswers, workedProcedureAskFor, workedProcedureDataValid, workedProcedureItems,
  workedProcedureKey, workedProcedureSpokenMisses, type SpokenProcedureMiss } from './diWorkedProcedureWorkspace';
import { PROCEDURE_LEVERS } from './diWorkedProcedureLevers';

/** Reject a payload whose problems cannot all be asked. */
export function validateDiWorkedProcedureData(value: unknown): DiWorkedProcedureData {
  const d = value as DiWorkedProcedureData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.problems) || !d.problems.length || d.problems.length > 6
      || new Set(d.problems.map(problem => problem?.id)).size !== d.problems.length)
    throw new Error('Generated subtraction problems have invalid lesson content.');
  if (!workedProcedureDataValid(d)) throw new Error('A subtraction problem cannot run in the teaching workspace.');
  return d;
}

export const diWorkedProcedureBoss = spokenBoss<DiWorkedProcedureData, WorkedProcedureItem, SpokenProcedureMiss>({
  card: diWorkedProcedureCard,
  validate: validateDiWorkedProcedureData,
  items: workedProcedureItems,
  levers: PROCEDURE_LEVERS,
  speech: {
    ask: workedProcedureAskFor,
    key: workedProcedureKey,
    misses: workedProcedureSpokenMisses,
    // The pack's canonical move or number, or the column's signature miss.
    say: diWorkedProcedureHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/direct-instruction/DiWorkedProcedure.tsx',
    instanceId: 'procedure',
    defaults: { grade: 'Grade 2', mode: 'subtract_regroup', topic: 'Two-digit subtraction with regrouping' },
    mounted: '[data-procedure-object="problem"]',
    probes: { reward: { selector: '[data-procedure-digit]', kind: 'count' } },
  },
});
