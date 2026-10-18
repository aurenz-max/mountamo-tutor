/**
 * Deduction's boss, on the spoken preset (`components/live-activity/boss.ts`): the card is `diDeduction.card.ts`;
 * this file is what the preset cannot know — the content check, the key, the known misses, the levers and the
 * harness's answers. The live adapter and the journey row are built from it.
 */
import type { DiDeductionData } from './DiDeduction';
import type { DeductionItem } from './diDeductionScript';
import { spokenBoss } from '../../../components/live-activity/boss';
import { diDeductionCard } from './diDeduction.card';
import { deductionAskFor, deductionDataValid, deductionItems, deductionKey, deductionSpokenMisses,
  diDeductionHarnessAnswers, type SpokenDeductionMiss } from './diDeductionWorkspace';
import { DEDUCTION_LEVERS } from './diDeductionLevers';

/** Reject a payload whose rules cannot all be asked: the component would silently drop a rule the plan gates
 *  refuse, so the service boundary refuses the payload instead. */
export function validateDiDeductionData(value: unknown): DiDeductionData {
  const d = value as DiDeductionData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.rules) || !d.rules.length || d.rules.length > 6
      || new Set(d.rules.map(rule => rule?.id)).size !== d.rules.length)
    throw new Error('Generated deduction rules have invalid lesson content.');
  if (!deductionDataValid(d)) throw new Error('A deduction rule cannot run in the teaching workspace.');
  return d;
}

export const diDeductionBoss = spokenBoss<DiDeductionData, DeductionItem, SpokenDeductionMiss>({
  card: diDeductionCard,
  validate: validateDiDeductionData,
  items: deductionItems,
  levers: DEDUCTION_LEVERS,
  speech: {
    ask: deductionAskFor,
    key: deductionKey,
    misses: deductionSpokenMisses,
    // The pack's canonical verdict and reason, or the case's plainest wrong verdict.
    say: diDeductionHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/direct-instruction/DiDeduction.tsx',
    instanceId: 'deduction',
    defaults: { grade: 'Grade 3', mode: 'deny', topic: 'Using a rule about animal groups to decide what follows' },
    mounted: '[data-deduction-object="rule"]',
    probes: { reward: { selector: '[data-deduction-credited]', kind: 'count' } },
  },
});
