/**
 * cvc-speller's boss, on the spoken preset (`components/live-activity/boss.ts`): a middle-sound item is a spoken answer
 * the tutor judges against the key; a spelling has no key (the boxes check it, so it plays through `show` as bank
 * letters pressed into the boxes), and neither has a make_word build (the shared letter build checks it, then the word
 * judge). The card is `cvcSpeller.card.ts`; this file holds the content check, the items, the ask and key, the levers
 * and the harness play.
 */
import type { CvcSpellerData } from './CvcSpeller';
import { spokenBoss } from '../../../components/live-activity/boss';
import { cvcSpellerCard, type CvcSpellerMiss } from './cvcSpeller.card';
import { CVC_LEVERS, practiceWordFor, sessionStimuli } from './cvcSpellerLevers';
import {
  cvcAsk, cvcKey, cvcSay, cvcSpellLetters, cvcSpellerItems, cvcSpokenMisses, cvcWords, isCvcBuild, validateCvcSpellerData,
  type CvcSpellerItem,
} from './cvcSpellerDomain';

export const cvcSpellerBoss = spokenBoss<CvcSpellerData, CvcSpellerItem, CvcSpellerMiss>({
  card: cvcSpellerCard,
  validate: validateCvcSpellerData,
  items: cvcSpellerItems,
  levers: CVC_LEVERS,
  speech: {
    ask: cvcAsk,
    // A spelling and a build have no key: the boxes, or the build and the word judge, check them.
    key: cvcKey,
    misses: cvcSpokenMisses,
    say: item => (isCvcBuild(item) ? { correct: '', plainWrong: '' } : cvcSay(item)),
    // A spelling: bank letters pressed into the boxes still empty, the third is the commit. A make_word build's last
    // check is the shared word judge (a model call), so the dry journey cannot commit it; the stubbed-judge drive is
    // `LetterBuild.workspace.test.tsx` (journey-sweep baseline: J1-drivable, by design).
    show: (right, item, ctx) => {
      if (isCvcBuild(item)) throw new Error('cvc-speller make_word is judged by the word judge, not driven at W1');
      const letters = cvcSpellLetters(item, ctx.demand?.boxes as string | undefined)[right ? 'correct' : 'plainWrong'];
      return letters.map(l => ({ type: 'choose' as const, label: `letter ${l}` }));
    },
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/CvcSpeller.tsx',
    instanceId: 'cvc',
    defaults: { grade: 'Kindergarten', mode: 'spell_word', topic: 'Spelling short-vowel CVC words by putting a letter in each sound box' },
    // Hear It on a word item, or the build's boxes.
    mounted: '[aria-label="hear the word"], [data-testid="lb-row"]',
    // The credited middle letter, counted so a transcript inspection can check it never shows before a credit.
    probes: { reward: { selector: '[data-cvc-reward]', kind: 'count' } },
    // The session item, or a small_word practice word (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as CvcSpellerData;
      const found = cvcSpellerItems(data).find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = cvcWords(data).find(w => `${w.id}~simpler` === ctx.itemId);
      return parent ? practiceWordFor(parent, { letterGroup: data.letterGroup, stimuli: sessionStimuli(data.challenges ?? []),
        bank: [], vowelFocus: data.vowelFocus }) ?? undefined : undefined;
    },
  },
});
