/**
 * Letter-sound link's boss, on the spoken preset (`components/live-activity/boss.ts`): see_hear and keyword_match are a
 * spoken answer the tutor judges against the key; hear_see has no key, the activity checks the tap, so it plays
 * through `show`. The card is `letterSoundLink.card.ts`; this file holds the content check, the items, the ask and
 * key, the levers and the harness play.
 */
import type { LetterSoundLinkData } from './LetterSoundLink';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { letterSoundLinkCard, type LetterSoundMiss, type SpokenLetterMiss } from './letterSoundLink.card';
import { fartherPair, LETTER_SOUND_LEVERS } from './letterSoundLinkLevers';
import {
  askFor, buildLetterSoundLinkItems, letterSoundChallengeValid, letterSoundKey, letterSoundLinkWorkspaceAnswers,
  letterSoundSpokenMisses, type LetterSoundItem,
} from './letterSoundLinkDomain';

/** The session's items, built through the family's own gates (an unaskable or repeated letter is dropped). */
export const letterSoundLinkItems = (data: Pick<LetterSoundLinkData, 'challenges' | 'supportTier'>): LetterSoundItem[] =>
  buildLetterSoundLinkItems(data.challenges ?? [], data.supportTier ?? 'medium');

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old: an isolated sound a child cannot
 *  produce, a tap with one usable letter, a picture that does not read as its word. */
export const validateLetterSoundLinkData = (value: unknown) =>
  validateChallengePool<LetterSoundLinkData>(value, letterSoundChallengeValid, {
    pool: 'Generated letter-sound link has invalid lesson content.',
    item: 'A letter-sound item cannot run in the teaching workspace.' });

export const letterSoundLinkBoss = spokenBoss<LetterSoundLinkData, LetterSoundItem, LetterSoundMiss | SpokenLetterMiss>({
  card: letterSoundLinkCard,
  validate: validateLetterSoundLinkData,
  items: letterSoundLinkItems,
  levers: LETTER_SOUND_LEVERS,
  speech: {
    ask: askFor,
    // hear_see has no key: the activity checks the tap, and the tutor is never told the letter.
    key: letterSoundKey,
    misses: letterSoundSpokenMisses,
    say: letterSoundLinkWorkspaceAnswers,
    // hear_see taps a letter card by the uppercase letter it prints: the right one, or the other one.
    show: (right, item) => {
      const answers = letterSoundLinkWorkspaceAnswers(item);
      return [{ type: 'choose', label: right ? answers.correct : answers.plainWrong }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/LetterSoundLink.tsx',
    instanceId: 'links',
    defaults: { grade: 'Kindergarten', mode: 'see_hear', topic: 'Saying the sound a printed letter makes' },
    mounted: '[data-letter-stage]',
    probes: { demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' },
      // The keyword anchor, so a transcript inspection can check mechanically that no picture or word appeared
      // before a committed success.
      reward: { selector: '[data-letter-revealed]', kind: 'count' } },
    // The session item, or a far_letter_pair practice item (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as LetterSoundLinkData;
      const items = letterSoundLinkItems(data);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = items.find(i => `${i.id}~simpler` === ctx.itemId);
      return parent ? fartherPair(parent, items, data.letterGroup) ?? undefined : undefined;
    },
  },
});
