/**
 * Sentence reading's boss, on the spoken preset (`components/live-activity/boss.ts`): the card is
 * `diSentenceReading.card.ts`; this file is what the preset cannot know — the content check, the key, the known
 * misses, the levers and the harness's answers. The live adapter and the journey row are built from it.
 */
import type { DiSentenceReadingData } from './DiSentenceReading';
import { spokenBoss } from '../../../components/live-activity/boss';
import { diSentenceReadingCard } from './diSentenceReading.card';
import { askFor, buildSentenceReadingItems, diSentenceSpokenMisses, sentenceReadingChallengeValid,
  sentenceReadingHarnessAnswers, type SentenceReadingItem, type SpokenSentenceMiss } from './diSentenceReadingDomain';
import { SENTENCE_LEVERS } from './diSentenceReadingLevers';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old. */
export function validateDiSentenceReadingData(value: unknown): DiSentenceReadingData {
  const d = value as DiSentenceReadingData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated sentence reading has invalid lesson content.');
  if (!d.challenges.every(sentenceReadingChallengeValid)) throw new Error('A sentence-reading item cannot run in the teaching workspace.');
  return d;
}

export const diSentenceReadingBoss = spokenBoss<DiSentenceReadingData, SentenceReadingItem, SpokenSentenceMiss>({
  card: diSentenceReadingCard,
  validate: validateDiSentenceReadingData,
  items: data => buildSentenceReadingItems(data.challenges),
  levers: SENTENCE_LEVERS,
  speech: {
    ask: () => askFor(),
    key: item => item.key,
    misses: diSentenceSpokenMisses,
    // A plainly different sentence: the near-neighbour misread this pack exists to correct belongs in the JEV probe.
    say: sentenceReadingHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/direct-instruction/DiSentenceReading.tsx',
    instanceId: 'sentences',
    defaults: { grade: 'Kindergarten', mode: 'read_sentence', topic: 'Reading a printed short sentence aloud, every word in order' },
    mounted: '[data-sentence-object="printed"]',
    probes: { demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The reward reveal: counts 0 until the observer has credited a read, so no picture appears before it.
      reward: { selector: '[data-sentence-read]', kind: 'count' } },
  },
});
