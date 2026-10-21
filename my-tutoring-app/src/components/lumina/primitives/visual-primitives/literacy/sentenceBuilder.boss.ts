/**
 * sentence-builder's boss (`components/live-activity/boss.ts`), bespoke because every item is built and the activity
 * checks it: the card is `sentenceBuilder.card.ts`; this file validates a lesson, lists its items (tile orders, or
 * sentences to make from word tiles), asks one, carries the lever set and plays the harness.
 */
import type { SentenceBuilderData } from './SentenceBuilder';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { sentenceBuilderCard, type OrderMiss, type SentenceMiss } from './sentenceBuilder.card';
import { SENTENCE_LEVERS, isBuildItem, type SentenceBuilderItem } from './sentenceBuilderLevers';
import { ORDER_ASK, ORDER_MODE, ordersFrom, shorterFor, shorterParent } from './sentenceOrder';
import { fewerParent, fewerTilesFor, sentenceAsk, sentencesFrom } from './sentenceBuild';

/** Every item must pass its surface's gate: the word-tile build, or the tile-order challenges. */
export function validateSentenceBuilderData(value: unknown): SentenceBuilderData {
  const d = value as SentenceBuilderData;
  if (!d || typeof d.title !== 'string') throw new Error('Generated sentence builder has invalid lesson content.');
  if (d.task === 'sentence_build') {
    if (!Array.isArray(d.sentences) || !d.sentences.length || d.sentences.length > 10
        || sentencesFrom(d.sentences, d.supportTier).length !== d.sentences.length)
      throw new Error('A sentence build item cannot be asked.');
    return d;
  }
  if (!Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 10
      || ordersFrom(d.challenges).length !== d.challenges.length)
    throw new Error('A sentence builder challenge cannot be asked.');
  return d;
}

/** The lesson's items: its sentences to make, or its tile orders, each stamped with its mode and support tier. */
export function sentenceBuilderItems(d: SentenceBuilderData): SentenceBuilderItem[] {
  const tier = d.supportTier ? { supportTier: d.supportTier } : {};
  if (d.task === 'sentence_build') return sentencesFrom(d.sentences ?? [], d.supportTier).map(i => ({ ...i, ...tier }));
  const mode = ORDER_MODE[d.sentenceType] ?? 'simple';
  return ordersFrom(d.challenges ?? []).map(i => ({ ...i, mode, ...tier }));
}

const askOf = (item: SentenceBuilderItem) => (isBuildItem(item) ? sentenceAsk(item) : ORDER_ASK);
const choose = (label: string): DriverInput => ({ type: 'choose', label });

export const sentenceBuilderBoss = defineBoss<SentenceBuilderData, SentenceBuilderItem, OrderMiss | SentenceMiss>({
  card: sentenceBuilderCard,
  validate: validateSentenceBuilderData,
  items: sentenceBuilderItems,
  ask: askOf,
  // Built sentences the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, askOf(item), null),
  levers: SENTENCE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/literacy/SentenceBuilder.tsx',
    instanceId: 'sentences',
    defaults: { grade: 'Grade 1', mode: 'build_sentence', topic: 'Questions and telling sentences about pets' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the practice item a simplify lever opened (`~shorter`, `~fewer`), rebuilt from its parent.
    current: ctx => {
      const id = String(ctx.itemId ?? ''), parentId = fewerParent(shorterParent(id));
      const parent = sentenceBuilderItems(ctx.data as SentenceBuilderData).find(i => i.id === parentId);
      if (!parent || parentId === id) return parent;
      return (isBuildItem(parent) ? fewerTilesFor(parent) : shorterFor(parent)) ?? undefined;
    },
    // The tile modes through their real tiles: a listed order passes in code; wrong is the reverse order (the end mark
    // first). Try again keeps the row, so a later try clears it first. build_sentence is checked by the shared sentence
    // judge (a model), so the dry journey cannot commit it; SentenceBuild.workspace.test.tsx drives it with a stubbed
    // judge (journey-sweep baseline: J1-drivable, by design).
    play: (right, item, ctx) => {
      if (isBuildItem(item)) throw new Error('sentence-builder build_sentence is judged by the sentence judge, not driven at W1');
      const order = right ? item.validArrangements[0] : [...item.validArrangements[0]].reverse();
      const text = (id: string) => item.tiles.find(t => t.id === id)!.text;
      const placed = Number(ctx.demand?.tilesPlaced ?? 0) > 0;
      return [...(placed ? [choose('Clear')] : []), ...order.map(id => choose(`tile ${text(id)}`)), choose("I'm done!")];
    },
  },
});
