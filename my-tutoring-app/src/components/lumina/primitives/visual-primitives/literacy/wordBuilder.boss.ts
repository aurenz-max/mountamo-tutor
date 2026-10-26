/**
 * word-builder's boss, on the spoken preset (`components/live-activity/boss.ts`): a spoken item is the whole word, said
 * aloud and judged by the tutor against the key; a build_affix item has no key (the word-part build checks the row's
 * shape, then the word judge), so it plays through `show`. The card is `wordBuilder.card.ts`; this file holds the
 * content check, the items, the ask and key, the levers and the harness play.
 */
import type { WordBuilderData } from '../../../types';
import { spokenBoss } from '../../../components/live-activity/boss';
import { wordBuilderCard, type WordBuilderMiss } from './wordBuilder.card';
import { WORD_BUILDER_LEVERS } from './wordBuilderLevers';
import { itemFromTarget, itemsFromTargets } from './wordBuilderScript';
import { buildItemsFrom, type BuildPart } from './affixBuild';
import {
  isAffixBuild, wordBuilderAsk, wordBuilderItems, wordBuilderJourneyAnswers, wordBuilderKey, wordBuilderSpokenMisses,
  type WordBuilderBossItem,
} from './wordBuilderWorkspace';

/** Reject a word the pack would drop: parts that do not spell it, a clue that contains it, an unsayable part. */
export function validateWordBuilderData(value: unknown): WordBuilderData {
  const d = value as WordBuilderData;
  if (d?.task === 'build_affix') {
    // The open build: every ask must survive the component's own gate, so the session asks what was generated.
    if (typeof d.title !== 'string' || !Array.isArray(d.availableParts) || !Array.isArray(d.buildItems) || !d.buildItems.length
        || d.buildItems.length > 12) throw new Error('Generated word builder has invalid lesson content.');
    if (buildItemsFrom(d.buildItems, d.availableParts as BuildPart[], d.supportTier).length !== d.buildItems.length)
      throw new Error('A word builder ask cannot be asked.');
    return d;
  }
  const complexity = d?.complexityLevel ?? 'compound_affix';
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.targets) || !d.targets.length || d.targets.length > 12
      || !Array.isArray(d.availableParts))
    throw new Error('Generated word builder has invalid lesson content.');
  if (!d.targets.every(t => !!t && itemFromTarget(t, d.availableParts, complexity) !== null))
    throw new Error('A word builder word cannot be asked.');
  // A word that repeats or sits inside an earlier word or clue would be asked with its answer already said.
  if (itemsFromTargets(d.targets, d.availableParts, complexity).length !== d.targets.length)
    throw new Error('A word builder word repeats an earlier word or clue.');
  return d;
}

export const wordBuilderBoss = spokenBoss<WordBuilderData, WordBuilderBossItem, WordBuilderMiss>({
  card: wordBuilderCard,
  validate: validateWordBuilderData,
  items: wordBuilderItems,
  levers: WORD_BUILDER_LEVERS,
  speech: {
    ask: wordBuilderAsk,
    // An open-build item has no key: the build checks the row, the word judge the word; the tutor is never told one.
    key: wordBuilderKey,
    // The board the word is built from feeds the swapped-part miss.
    misses: item => (isAffixBuild(item) ? [] : wordBuilderSpokenMisses(item, item.board ?? [])),
    say: item => (isAffixBuild(item) ? { correct: '', plainWrong: '' } : wordBuilderJourneyAnswers(item)),
    // build_affix is checked by the shared word judge (a model call), which the dry sweep has none of;
    // WordBuildAffix.workspace.test.tsx drives the commit with a stubbed judge.
    show: () => { throw new Error('word-builder build_affix is judged by the word judge, not driven at W1'); },
  },
  drive: {
    component: 'primitives/WordBuilder.tsx',
    instanceId: 'builder',
    defaults: { grade: 'Grade 4', mode: 'compound_affix', topic: 'Building words from prefixes, roots and suffixes' },
    mounted: '[data-pip-object="stimulus"], [data-testid="wb-row"]',
    leakTokens: ['WB_ITEM', 'WB_MOVE', 'WB_COMPLETE', 'WB_HEAR'],
  },
});
