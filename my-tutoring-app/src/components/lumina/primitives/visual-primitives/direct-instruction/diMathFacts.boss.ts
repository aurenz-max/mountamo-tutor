/**
 * Math facts' boss, on the spoken preset (`components/live-activity/boss.ts`): the card is `diMathFacts.card.ts`;
 * this file is what the preset cannot know — the content check, the key, the known misses, the levers and the
 * harness's answers. The live adapter and the journey row are built from it.
 */
import type { DiMathFactsData } from './DiMathFacts';
import { spokenBoss } from '../../../components/live-activity/boss';
import { diMathFactsCard } from './diMathFacts.card';
import { askFor, buildMathFactItems, mathFactChallengeValid, mathFactSpokenMisses, mathFactsHarnessAnswers,
  type MathFactItem, type SpokenFactMiss } from './diMathFactsDomain';
import { MATH_FACT_LEVERS } from './diMathFactsLevers';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old: a desynced answer word, or a
 *  stimulus carrying its own solution. */
export function validateDiMathFactsData(value: unknown): DiMathFactsData {
  const d = value as DiMathFactsData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated math facts have invalid lesson content.');
  if (!d.challenges.every(mathFactChallengeValid)) throw new Error('A math-fact item cannot run in the teaching workspace.');
  return d;
}

export const diMathFactsBoss = spokenBoss<DiMathFactsData, MathFactItem, SpokenFactMiss>({
  card: diMathFactsCard,
  validate: validateDiMathFactsData,
  items: data => buildMathFactItems(data.challenges),
  levers: MATH_FACT_LEVERS,
  speech: {
    ask: askFor,
    key: item => item.assignment,
    misses: mathFactSpokenMisses,
    // A plainly different quantity: the off-by-one this pack exists to correct belongs in the JEV probe.
    say: mathFactsHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/direct-instruction/DiMathFacts.tsx',
    instanceId: 'facts',
    defaults: { grade: 'Kindergarten', mode: 'answer_fact', topic: 'Adding within five and saying the answer out loud' },
    mounted: '[data-fact-object="problem"]',
    probes: { demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The completed-equation reveal: counts 0 until the observer has credited a fact.
      reward: { selector: '[data-fact-solved]', kind: 'count' } },
  },
});
