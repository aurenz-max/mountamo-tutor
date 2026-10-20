/**
 * rhyme-studio's boss, on the spoken preset (`components/live-activity/boss.ts`): a word item is one spoken answer the
 * tutor judges against the key; a pair_build board has no key (the board checks that the two names rhyme), so it plays
 * through `show`. The card is `rhymeStudio.card.ts`; this file holds the content check, the items, the ask and key,
 * the levers and the harness play.
 */
import type { RhymeStudioData } from './RhymeStudio';
import { spokenBoss } from '../../../components/live-activity/boss';
import { rhymeStudioCard, type RhymeStudioMiss } from './rhymeStudio.card';
import { RHYME_LEVERS, practiceItemFor } from './rhymeStudioLevers';
import { smallBoardFor } from './rhymePairBuild';
import {
  asRhymeBoard, isRhymeBoard, rhymeAsk, rhymeBoardMoves, rhymeGiven, rhymeHarnessAnswers, rhymeKey, rhymeSpokenMisses,
  rhymeStudioItems, validateRhymeStudioData, type RhymeItem, type RhymeStudioItem,
} from './rhymeStudioDomain';

export const rhymeStudioBoss = spokenBoss<RhymeStudioData, RhymeStudioItem, RhymeStudioMiss>({
  card: rhymeStudioCard,
  validate: validateRhymeStudioData,
  items: rhymeStudioItems,
  levers: RHYME_LEVERS,
  speech: {
    ask: rhymeAsk,
    // A board has no key: code checks the pair from the pictures' rimes; the tutor is never told one.
    key: rhymeKey,
    // Recognition's "say yes or no" is the question; never the item's words.
    given: rhymeGiven,
    misses: rhymeSpokenMisses,
    say: item => { if (isRhymeBoard(item)) throw new Error('rhyme-studio: a board is shown, not said'); return rhymeHarnessAnswers(item); },
    // The board through its real pictures and "I'm done!".
    show: (right, item, ctx) => {
      if (!isRhymeBoard(item)) throw new Error(`rhyme-studio ${item.mode}: a spoken item is said, not shown`);
      return rhymeBoardMoves(right, item, ctx.demand);
    },
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/RhymeStudio.tsx',
    instanceId: 'rhymes',
    defaults: { grade: 'Kindergarten', mode: 'recognition', topic: 'Hearing whether two short words rhyme' },
    // A word item's card, or the board's tray.
    mounted: '[data-rhyme-stage], [data-testid="rp-tray"]',
    // The session item, or a practice item (`~simpler` word, `~small` board) rebuilt from its parent.
    current: ctx => {
      const items = rhymeStudioItems(ctx.data as RhymeStudioData);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = items.find(i => `${i.id}~simpler` === ctx.itemId || `${i.id}~small` === ctx.itemId);
      if (!parent) return undefined;
      if (isRhymeBoard(parent)) { const small = smallBoardFor(parent); return small ? asRhymeBoard(small, parent.tier) : undefined; }
      const words = items.filter((i): i is RhymeItem => !isRhymeBoard(i));
      return practiceItemFor(parent, words) ?? undefined;
    },
  },
});
