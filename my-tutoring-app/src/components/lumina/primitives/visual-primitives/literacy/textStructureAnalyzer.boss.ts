/**
 * text-structure-analyzer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken
 * answer the tutor judges against its key. The card is `textStructureAnalyzer.card.ts`; this file holds the content
 * check, the items, the ask and key, the levers and the harness play. No `given`: no ask says its answer (the passage
 * is never read aloud, and an idea that names its own part drops at build).
 */
import type { TextStructureAnalyzerData } from './TextStructureAnalyzer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { textStructureAnalyzerCard } from './textStructureAnalyzer.card';
import { practiceFor, practiceParent, TSA_LEVERS, tsaSession } from './textStructureAnalyzerLevers';
import {
  askFor, textStructureAnalyzerHarnessAnswers, textStructureItems, textStructureKey, textStructureSpokenMisses,
  type SpokenTextStructureMiss, type TextStructureItem,
} from './textStructureAnalyzerDomain';

/** The session's items, built exactly as the component builds them (the menu in its per-instance order). */
export const tsaItems = (data: TextStructureAnalyzerData): TextStructureItem[] =>
  textStructureItems(data, data.instanceId ?? 'text-structure-analyzer').items;

/** Reject a passage with nothing askable: the build gates drop a signal word the passage does not contain, a menu the
 *  ear cannot separate, an idea that repeats a mat's name. */
export function validateTextStructureAnalyzerData(value: unknown): TextStructureAnalyzerData {
  const d = value as TextStructureAnalyzerData;
  if (!d || typeof d.passage !== 'string' || !Array.isArray(d.structureOptions))
    throw new Error('Generated text structure analyzer has invalid lesson content.');
  if (!tsaItems(d).length) throw new Error('No text structure question can be asked.');
  return d;
}

export const textStructureAnalyzerBoss = spokenBoss<TextStructureAnalyzerData, TextStructureItem, SpokenTextStructureMiss>({
  card: textStructureAnalyzerCard,
  validate: validateTextStructureAnalyzerData,
  items: tsaItems,
  levers: TSA_LEVERS,
  speech: {
    ask: askFor,
    key: textStructureKey,
    misses: textStructureSpokenMisses,
    say: textStructureAnalyzerHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/TextStructureAnalyzer.tsx',
    instanceId: 'text-structure-analyzer',
    defaults: { grade: 'Grade 4', mode: 'cause_effect', topic: 'Why rivers flood' },
    mounted: '[data-pip-object="stimulus"]',
    // The session item, or a practice item (`~simpler`, textStructureAnalyzerLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as TextStructureAnalyzerData;
      const all = tsaItems(data);
      const parent = ctx.itemId ? practiceParent(ctx.itemId, all) : null;
      return parent ? practiceFor(parent, tsaSession(data)) ?? undefined : all.find(i => i.id === ctx.itemId);
    },
  },
});
