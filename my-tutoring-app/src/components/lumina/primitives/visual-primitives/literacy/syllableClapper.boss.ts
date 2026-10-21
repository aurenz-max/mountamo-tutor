/**
 * syllable-clapper's boss, on the spoken preset (`components/live-activity/boss.ts`): a spoken item is the whole word,
 * the number of parts or the word left, said aloud and judged by the tutor against the key; a build_parts item has no
 * key (the shared letter build counts the parts, then the word judge checks the word), so it plays through `show`.
 * The card is `syllableClapper.card.ts`; this file holds the content check, the items, the ask and key, the levers and
 * the harness play.
 */
import type { SyllableClapperData } from './SyllableClapper';
import { spokenBoss } from '../../../components/live-activity/boss';
import { syllableClapperCard, type SyllableClapperMiss } from './syllableClapper.card';
import { SYLLABLE_LEVERS, practiceItemFor } from './syllableClapperLevers';
import {
  isSyllableBuild, syllableAsk, syllableClapperItems, syllableHarnessAnswers, syllableKey, syllableSpokenMisses,
  syllableWords, validateSyllableClapperData, type SyllableClapperBossItem,
} from './syllableClapperDomain';

export const syllableClapperBoss = spokenBoss<SyllableClapperData, SyllableClapperBossItem, SyllableClapperMiss>({
  card: syllableClapperCard,
  validate: validateSyllableClapperData,
  items: syllableClapperItems,
  levers: SYLLABLE_LEVERS,
  speech: {
    ask: syllableAsk,
    // A build item has no key: code counts the parts, the word judge checks the word; the tutor is never told one.
    key: syllableKey,
    misses: syllableSpokenMisses,
    say: item => (isSyllableBuild(item) ? { correct: '', plainWrong: '' } : syllableHarnessAnswers(item)),
    // The build's last check is the shared word judge (a model call), so the dry journey cannot commit it; the
    // stubbed-judge drive is `SyllableBuild.workspace.test.tsx` (journey-sweep baseline: J1-drivable, by design).
    show: () => { throw new Error('syllable-clapper build_parts is judged by the word judge, not driven at W1'); },
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/SyllableClapper.tsx',
    instanceId: 'syllables',
    defaults: { grade: 'Kindergarten', mode: 'count_parts', topic: 'Counting the syllables in familiar animal words' },
    // The hear-again speaker, or the build's row.
    mounted: '[data-testid="hear-word"], [data-testid="lb-row"]',
    // The reveal, counted so a transcript inspection can check it never shows before a credit.
    probes: { reward: { selector: '[data-testid="reveal"]', kind: 'count' } },
    // The session item, or a practice item (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const words = syllableWords(ctx.data as SyllableClapperData);
      const found = words.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = words.find(w => `${w.id}~simpler` === ctx.itemId);
      return (parent && practiceItemFor(parent, words)) ?? undefined;
    },
  },
});
