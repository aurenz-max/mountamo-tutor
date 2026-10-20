/**
 * Interactive book's boss, on the spoken preset (`components/live-activity/boss.ts`): read-focus-word is one spoken
 * word the tutor judges against the key; find-feature has no key (the activity checks the tap on a printed part, and
 * the tutor is never told which text it is), so it plays through `show`. The card is `interactiveBook.card.ts`; this
 * file holds the content check, the items, the ask and key, the levers and the harness play.
 */
import type { InteractiveBookData } from './InteractiveBook';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { interactiveBookCard, type InteractiveBookMiss, type SpokenInteractiveBookMiss } from './interactiveBook.card';
import { INTERACTIVE_BOOK_LEVERS, cvcFocus, practicePage } from './interactiveBookLevers';
import {
  askFor, interactiveBookHarnessAnswers, interactiveBookKey, interactiveBookSpokenMisses, interactiveBookTaps,
  itemFromChallenge, itemsFromChallenges, type InteractiveBookItem,
} from './interactiveBookDomain';

/** The session's items, built through the family's own gates, each stamped with the lesson's support tier. */
export const interactiveBookItems = (data: Pick<InteractiveBookData, 'challenges' | 'supportTier'>): InteractiveBookItem[] =>
  itemsFromChallenges(data.challenges ?? [], data.supportTier ?? 'medium');

/** Reject a book the session would not ask: no book, or a challenge its build gates drop (a lead the tutor cannot
 *  say, a glowing word not printed once, a feature text that is not one of its view's printed parts). */
export function validateInteractiveBookData(value: unknown): InteractiveBookData {
  const d = value as InteractiveBookData;
  if (!d || !Array.isArray(d.books) || !d.books[0]) throw new Error('Generated interactive book has no book.');
  return validateChallengePool<InteractiveBookData>(value, c => !!c && itemFromChallenge(c) !== null,
    { pool: 'Generated interactive book has invalid lesson content.', item: 'An interactive book item cannot be asked.' });
}

export const interactiveBookBoss = spokenBoss<InteractiveBookData, InteractiveBookItem, InteractiveBookMiss | SpokenInteractiveBookMiss>({
  card: interactiveBookCard,
  validate: validateInteractiveBookData,
  items: interactiveBookItems,
  levers: INTERACTIVE_BOOK_LEVERS,
  speech: {
    ask: askFor,
    // find-feature has no key: the activity checks the tap.
    key: interactiveBookKey,
    misses: interactiveBookSpokenMisses,
    say: interactiveBookHarnessAnswers,
    // A find item taps a printed part by its Pip id: the right one, or another on the same view.
    show: (right, item, ctx) => {
      const taps = interactiveBookTaps(item, (ctx.data as InteractiveBookData).books[0]);
      return [{ type: 'touch', target: right ? taps.correct : taps.wrong }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/literacy/InteractiveBook.tsx',
    instanceId: 'book',
    defaults: { grade: 'Kindergarten', mode: 'find-feature', topic: 'A picture book about a day at the farm' },
    mounted: '[data-pip-object="page"]',
    // The session item, or a practice item (`~simpler`: two_part_page, cvc_focus) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as InteractiveBookData;
      const items = interactiveBookItems(data);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = items.find(i => `${i.id}~simpler` === ctx.itemId);
      if (!parent) return undefined;
      return (parent.mode === 'find-feature' ? practicePage(parent, data.books[0]) : cvcFocus(parent, data.books[0])) ?? undefined;
    },
  },
});
