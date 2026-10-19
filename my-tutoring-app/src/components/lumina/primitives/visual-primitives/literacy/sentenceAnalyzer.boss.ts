/**
 * sentence-analyzer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one grammar label
 * the tutor judges against its key. The card is `sentenceAnalyzer.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play. No `given`: the label is never in the ask (a sentence with
 * grammar vocabulary drops), and the side question is a menu key whose ask says both sides.
 */
import type { SentenceAnalyzerData } from './SentenceAnalyzer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { sentenceAnalyzerCard } from './sentenceAnalyzer.card';
import { practiceFor, practiceParent, SENTENCE_LEVERS, sentenceSession } from './sentenceAnalyzerLevers';
import {
  askFor, itemsFromPayload, sentenceAnalyzerHarnessAnswers, sentenceKey, sentenceSpokenMisses,
  type SentenceAnalyzerItem, type SpokenSentenceMiss,
} from './sentenceAnalyzerDomain';

/** The session's items, built exactly as the component builds them (the build gates drop what cannot be asked). */
export const sentenceItems = (data: SentenceAnalyzerData): SentenceAnalyzerItem[] => itemsFromPayload(data).items;

/** Reject a lesson with nothing askable: the build gates drop a label outside the grade's wall, a word with no clean
 *  role, a side item with no subject boundary. */
export function validateSentenceAnalyzerData(value: unknown): SentenceAnalyzerData {
  const d = value as SentenceAnalyzerData;
  if (!d || !Array.isArray(d.challenges)) throw new Error('Generated sentence analyzer has invalid lesson content.');
  if (!sentenceItems(d).length) throw new Error('No sentence analyzer question can be asked.');
  return d;
}

export const sentenceAnalyzerBoss = spokenBoss<SentenceAnalyzerData, SentenceAnalyzerItem, SpokenSentenceMiss>({
  card: sentenceAnalyzerCard,
  validate: validateSentenceAnalyzerData,
  items: sentenceItems,
  levers: SENTENCE_LEVERS,
  speech: {
    ask: askFor,
    key: sentenceKey,
    misses: sentenceSpokenMisses,
    say: sentenceAnalyzerHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/SentenceAnalyzer.tsx',
    instanceId: 'sentence-analyzer',
    defaults: { grade: 'Grade 3', mode: 'identify_pos', topic: 'Nouns, verbs and adjectives' },
    mounted: '[data-pip-object="stimulus"]',
    // The session item, or a practice item (`~simpler`, sentenceAnalyzerLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as SentenceAnalyzerData;
      const all = sentenceItems(data);
      const parent = ctx.itemId ? practiceParent(ctx.itemId, all) : null;
      return parent ? practiceFor(parent, sentenceSession(data)) ?? undefined : all.find(i => i.id === ctx.itemId);
    },
  },
});
