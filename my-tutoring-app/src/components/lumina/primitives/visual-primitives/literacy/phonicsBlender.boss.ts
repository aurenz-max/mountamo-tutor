/**
 * phonics-blender's boss, on the spoken preset (`components/live-activity/boss.ts`): a word item is a spoken answer the
 * tutor judges against the key; a build_blend item has no key (the shared letter build checks it, then the word judge),
 * so it plays through `show`. The card is `phonicsBlender.card.ts`; this file holds the content check, the items, the
 * ask and key, the levers and the harness play.
 */
import type { PhonicsBlenderData } from './PhonicsBlender';
import { spokenBoss } from '../../../components/live-activity/boss';
import { phonicsBlenderCard, type PhonicsBlenderMiss } from './phonicsBlender.card';
import { BLEND_LEVERS, shortWordFor } from './phonicsBlenderLevers';
import {
  blendAsk, blendHarnessAnswers, blendKey, blendSpokenMisses, blendWords, isBuild, phonicsBlenderItems,
  validatePhonicsBlenderData, type PhonicsBlenderItem,
} from './phonicsBlenderDomain';

export const phonicsBlenderBoss = spokenBoss<PhonicsBlenderData, PhonicsBlenderItem, PhonicsBlenderMiss>({
  card: phonicsBlenderCard,
  validate: validatePhonicsBlenderData,
  items: phonicsBlenderItems,
  levers: BLEND_LEVERS,
  speech: {
    ask: blendAsk,
    // A build item has no key: the build checks the tiles, the word judge the word; the tutor is never told one.
    key: blendKey,
    misses: blendSpokenMisses,
    say: item => blendHarnessAnswers(isBuild(item) ? { targetWord: '' } : item),
    // The build's last check is the shared word judge (a model call), so the dry journey cannot commit it; the
    // stubbed-judge drive is `LetterBuild.workspace.test.tsx` (journey-sweep baseline: J1-drivable, by design).
    show: () => { throw new Error('phonics-blender build_blend is judged by the word judge, not driven at W1'); },
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/PhonicsBlender.tsx',
    instanceId: 'blend',
    defaults: { grade: 'Kindergarten', mode: 'cvc', topic: 'Blending the sounds of short-vowel CVC words into whole words' },
    // The letter row, or the build's boxes.
    mounted: '[data-blend-stage], [data-testid="lb-row"]',
    // The reward picture, counted so a transcript inspection can check it never shows before a credit.
    probes: { reward: { selector: '[data-blend-reward]', kind: 'count' } },
    // The session word, or a short_word practice word (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as PhonicsBlenderData;
      const items = phonicsBlenderItems(data);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const words = blendWords(data);
      const parent = words.find(w => `${w.id}~simpler` === ctx.itemId);
      return parent ? shortWordFor(parent, words) ?? undefined : undefined;
    },
  },
});
