/**
 * Letter spotter's boss, on the spoken preset (`components/live-activity/boss.ts`): name_it is a spoken letter the
 * tutor judges against the key; find_it and match_it have no key (the activity checks the tap, and the tutor is never
 * told the answer), so they play through `show`. The card is `letterSpotter.card.ts`; this file holds the content
 * check, the items, the ask and key, the levers and the harness play.
 */
import type { LetterSpotterData } from './LetterSpotter';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { letterSpotterCard, type LetterSpotterMiss, type SpokenLetterSpotterMiss } from './letterSpotter.card';
import { LETTER_SPOTTER_LEVERS, practiceItem } from './letterSpotterLevers';
import {
  askFor, askGiven, itemFromChallenge, itemsFromChallenges, letterSpotterHarnessAnswers, letterSpotterKey,
  letterSpotterSpokenMisses, type LetterSpotterItem,
} from './letterSpotterDomain';

/** The session's items, built through the family's own gates (an unaskable or repeated answer letter is dropped). */
export const letterSpotterItems = (data: Pick<LetterSpotterData, 'challenges' | 'supportTier'>): LetterSpotterItem[] =>
  itemsFromChallenges(data.challenges ?? [], data.supportTier ?? 'medium');

/** Reject an item the session would drop: a grid without exactly one target, options without the answer, a sentence
 *  whose marked word is unsayable or starts with a digraph. */
export const validateLetterSpotterData = (value: unknown) =>
  validateChallengePool<LetterSpotterData>(value, c => !!c && itemFromChallenge(c) !== null, {
    pool: 'Generated letter spotter has invalid lesson content.',
    item: 'A letter spotter item cannot be asked.' });

/** A tap by the drawn target: a grid cell by its index, a little letter by its tile. */
function letterTap(right: boolean, item: LetterSpotterItem): DriverInput[] {
  const { tapped } = letterSpotterHarnessAnswers(item);
  const letter = right ? tapped!.correct : tapped!.wrong;
  if (item.mode === 'match-it') return [{ type: 'touch', target: `option-${letter}` }];
  const cell = (item.letterGrid ?? []).findIndex(l => l.toLowerCase() === letter.toLowerCase());
  if (cell < 0) throw new Error(`letter-spotter find_it: no cell holds ${letter}`);
  return [{ type: 'touch', target: `cell-${cell}` }];
}

export const letterSpotterBoss = spokenBoss<LetterSpotterData, LetterSpotterItem, LetterSpotterMiss | SpokenLetterSpotterMiss>({
  card: letterSpotterCard,
  validate: validateLetterSpotterData,
  items: letterSpotterItems,
  levers: LETTER_SPOTTER_LEVERS,
  speech: {
    ask: askFor,
    // find_it and match_it have no key: the activity checks the tap.
    key: letterSpotterKey,
    given: askGiven,
    misses: letterSpotterSpokenMisses,
    say: letterSpotterHarnessAnswers,
    show: letterTap,
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/LetterSpotter.tsx',
    instanceId: 'spotter',
    defaults: { grade: 'Kindergarten', mode: 'find_it', topic: 'Finding the letters s, a, t, i, p and n' },
    mounted: '[data-pip-object="grid"], [data-pip-object="letter"], [data-pip-object="marker"]',
    // The session item, or a practice item (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as LetterSpotterData;
      const items = letterSpotterItems(data);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = items.find(i => `${i.id}~simpler` === ctx.itemId);
      return parent ? practiceItem(parent, items, data.letterGroup) ?? undefined : undefined;
    },
  },
});
