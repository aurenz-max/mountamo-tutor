/**
 * Word reading's boss, on the spoken preset (`components/live-activity/boss.ts`): the card is
 * `diWordReading.card.ts`; this file is what the preset cannot know — the content check, the key, the known misses,
 * the levers and the harness's answers. The live adapter and the journey row are built from it.
 */
import type { DiWordReadingData } from './DiWordReading';
import { spokenBoss } from '../../../components/live-activity/boss';
import { diWordReadingCard } from './diWordReading.card';
import { askFor, buildWordReadingItems, diWordReadingSpokenMisses, wordReadingChallengeValid, wordReadingHarnessAnswers,
  type SpokenWordReadingMiss, type WordReadingItem } from './diWordReadingDomain';
import { WORD_LEVERS } from './diWordReadingLevers';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old. */
export function validateDiWordReadingData(value: unknown): DiWordReadingData {
  const d = value as DiWordReadingData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated word reading has invalid lesson content.');
  if (!d.challenges.every(wordReadingChallengeValid)) throw new Error('A word-reading item cannot run in the teaching workspace.');
  return d;
}

export const diWordReadingBoss = spokenBoss<DiWordReadingData, WordReadingItem, SpokenWordReadingMiss>({
  card: diWordReadingCard,
  validate: validateDiWordReadingData,
  items: data => buildWordReadingItems(data.challenges),
  levers: WORD_LEVERS,
  speech: {
    ask: askFor,
    key: item => item.assignment,
    misses: diWordReadingSpokenMisses,
    // A plainly different word: the near neighbour this pack exists to correct belongs in the JEV probe.
    say: wordReadingHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/direct-instruction/DiWordReading.tsx',
    instanceId: 'words',
    defaults: { grade: 'Kindergarten', mode: 'cvc_reading', topic: 'Blending and reading short-vowel CVC words in print' },
    mounted: '[data-word-object="printed"]',
    probes: { demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The reward reveal: counts 0 until the observer has credited a read, so no picture appears before it.
      reward: { selector: '[data-word-read]', kind: 'count' } },
  },
});
