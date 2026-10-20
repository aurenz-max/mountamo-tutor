/**
 * word-flip's boss, on the spoken preset (`components/live-activity/boss.ts`): a spoken item is the changed word, said
 * aloud and judged by the tutor against the key; a build_inflect item has no key (the word-part build checks the
 * ending, then the word judge), so it plays through `show`. The card is `wordFlip.card.ts`; this file holds the
 * content check, the items, the ask and key, the levers and the harness play.
 */
import type { WordFlipData } from './WordFlip';
import { spokenBoss } from '../../../components/live-activity/boss';
import { wordFlipCard, type WordFlipMiss } from './wordFlip.card';
import { FLIP_LEVERS, practiceItemFor } from './wordFlipLevers';
import {
  asFlipWord, flipAsk, flipGiven, flipHarnessAnswers, flipKey, flipSpokenMisses, flipWords, isFlipBuild, validateWordFlipData,
  wordFlipItems, type WordFlipItem,
} from './wordFlipDomain';

export const wordFlipBoss = spokenBoss<WordFlipData, WordFlipItem, WordFlipMiss>({
  card: wordFlipCard,
  validate: validateWordFlipData,
  items: wordFlipItems,
  levers: FLIP_LEVERS,
  speech: {
    ask: flipAsk,
    // A build item has no key: the build checks the cards, the word judge the word; the tutor is never told one.
    key: flipKey,
    // The source word is the stimulus, said in the ask by design.
    given: flipGiven,
    misses: flipSpokenMisses,
    say: item => flipHarnessAnswers(isFlipBuild(item) ? { sourceWord: '', answer: '' } : item),
    // The build's last check is the shared word judge (a model call), so the dry journey cannot commit it; the
    // stubbed-judge drive is `WordFlip.buildInflect.workspace.test.tsx` (journey-sweep baseline: J1-drivable, by design).
    show: () => { throw new Error('word-flip build_inflect is judged by the word judge, not driven at W1'); },
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/WordFlip.tsx',
    instanceId: 'flip',
    defaults: { grade: 'Kindergarten', mode: 'plural_s', topic: 'Saying the plural of a noun when there is more than one' },
    // The before/after frame, or the build's row.
    mounted: '[data-flip-frame], [data-testid="wb-row"]',
    // The credited word, counted so a transcript inspection can check it never shows before a credit.
    probes: { reward: { selector: '[data-flip-reward]', kind: 'count' } },
    // The session item, or a practice item (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as WordFlipData;
      const found = wordFlipItems(data).find(i => i.id === ctx.itemId);
      if (found) return found;
      const words = flipWords(data);
      const parent = words.find(w => `${w.id}~simpler` === ctx.itemId);
      const practice = parent && practiceItemFor(parent, data.challenges ?? []);
      return parent && practice ? asFlipWord(practice, parent.supportTier) : undefined;
    },
  },
});
