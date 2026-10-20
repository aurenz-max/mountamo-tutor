/**
 * sound-swap's boss, on the spoken preset (`components/live-activity/boss.ts`): a spoken item is the new word, said
 * aloud and judged by the tutor against the key; a swap_build item has no key (the shared letter build checks one
 * letter changed and the shape, then the word judge), so it plays through `show`. The card is `soundSwap.card.ts`;
 * this file holds the content check, the items, the ask and key, the levers and the harness play.
 */
import type { SoundSwapData } from './SoundSwap';
import { spokenBoss } from '../../../components/live-activity/boss';
import { soundSwapCard, type SoundSwapMiss } from './soundSwap.card';
import { SWAP_LEVERS, practiceItemFor } from './soundSwapLevers';
import {
  asSwapWord, isSwapBuild, soundSwapItems, swapAsk, swapGiven, swapHarnessAnswers, swapKey, swapSpokenMisses, swapWords,
  validateSoundSwapData, type SoundSwapItem,
} from './soundSwapDomain';

export const soundSwapBoss = spokenBoss<SoundSwapData, SoundSwapItem, SoundSwapMiss>({
  card: soundSwapCard,
  validate: validateSoundSwapData,
  items: soundSwapItems,
  levers: SWAP_LEVERS,
  speech: {
    ask: swapAsk,
    // A build item has no key: the build checks the letters, the word judge the word; the tutor is never told one.
    key: swapKey,
    // The ask's own frame words (is, at, the, to, new) are said by design; never the item's words or sounds.
    given: swapGiven,
    misses: swapSpokenMisses,
    say: item => swapHarnessAnswers(isSwapBuild(item) ? { resultWord: '', originalWord: '' } : item),
    // The build's last check is the shared word judge (a model call), so the dry journey cannot commit it; the
    // stubbed-judge drive is `LetterBuild.workspace.test.tsx` (journey-sweep baseline: J1-drivable, by design).
    show: () => { throw new Error('sound-swap swap_build is judged by the word judge, not driven at W1'); },
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/SoundSwap.tsx',
    instanceId: 'swap',
    defaults: { grade: 'Kindergarten', mode: 'addition', topic: 'Adding one sound to the beginning of a word to make a new word' },
    // The starting word's stage, or the build's boxes.
    mounted: '[data-swap-stage], [data-testid="lb-row"]',
    // The credited word, counted so a transcript inspection can check it never shows before a credit.
    probes: { reward: { selector: '[data-swap-reward]', kind: 'count' } },
    // The session item, or a practice item (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as SoundSwapData;
      const found = soundSwapItems(data).find(i => i.id === ctx.itemId);
      if (found) return found;
      const words = swapWords(data);
      const parent = words.find(w => `${w.id}~simpler` === ctx.itemId);
      const practice = parent && practiceItemFor(parent, data.challenges ?? []);
      return parent && practice ? asSwapWord(practice, parent.supportTier) : undefined;
    },
  },
});
