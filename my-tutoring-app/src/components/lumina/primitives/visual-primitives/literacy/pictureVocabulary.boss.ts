/**
 * picture-vocabulary's boss, on the spoken preset (`components/live-activity/boss.ts`): a spoken word is judged by the
 * tutor against the key; a receptive_match tap and a pair_build board have no key (the activity checks them, and the
 * tutor is never told the key), so they play through `show`. The card is `pictureVocabulary.card.ts`; this file holds
 * the content check, the items, the ask and key, the levers and the harness play.
 */
import type { PictureVocabularyData } from './PictureVocabulary';
import { spokenBoss } from '../../../components/live-activity/boss';
import { pictureVocabularyCard, type PictureVocabularyMiss } from './pictureVocabulary.card';
import { PICTURE_VOCAB_LEVERS, practiceItemFor } from './pictureVocabularyLevers';
import { picturePairSmallBoard } from './picturePairBuild';
import {
  askFor, asPictureBoard, isPictureBoard, pictureBoardMoves, pictureVocabHarnessAnswers, pictureVocabKey,
  pictureVocabSpokenMisses, pictureVocabularyItems, receptiveTap, validatePictureVocabularyData,
  type PictureVocabItem, type PictureVocabularyItem,
} from './pictureVocabularyDomain';

export const pictureVocabularyBoss = spokenBoss<PictureVocabularyData, PictureVocabularyItem, PictureVocabularyMiss>({
  card: pictureVocabularyCard,
  validate: validatePictureVocabularyData,
  items: pictureVocabularyItems,
  levers: PICTURE_VOCAB_LEVERS,
  speech: {
    ask: askFor,
    // A tap or a board has no key: the activity checks it.
    key: pictureVocabKey,
    misses: pictureVocabSpokenMisses,
    say: item => {
      if (isPictureBoard(item)) throw new Error('picture-vocabulary: a board is shown, not said');
      return pictureVocabHarnessAnswers(item);
    },
    // A card tap by its word, or the board through its real pictures and "I'm done!".
    show: (right, item, ctx) => (isPictureBoard(item) ? pictureBoardMoves(right, item, ctx.demand) : receptiveTap(right, item)),
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/PictureVocabulary.tsx',
    instanceId: 'vocab',
    defaults: { grade: 'Kindergarten', mode: 'naming', topic: 'Naming everyday things at home' },
    // The stimulus card, the tap cards, or the board's tray.
    mounted: '[data-pip-object="stimulus"], [data-pip-object="cards"], [data-testid="rp-tray"]',
    // The session item, or a practice item (`~simpler` cards, `~small` board) rebuilt from its parent.
    current: ctx => {
      const items = pictureVocabularyItems(ctx.data as PictureVocabularyData);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = items.find(i => `${i.id}~simpler` === ctx.itemId || `${i.id}~small` === ctx.itemId);
      if (!parent) return undefined;
      if (isPictureBoard(parent)) { const small = picturePairSmallBoard(parent); return small ? asPictureBoard(small, parent.tier) : undefined; }
      const words = items.filter((i): i is PictureVocabItem => !isPictureBoard(i));
      return practiceItemFor(parent, words) ?? undefined;
    },
  },
});
