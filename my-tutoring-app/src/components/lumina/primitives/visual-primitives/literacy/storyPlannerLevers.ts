/**
 * story-planner's in-item levers, declared once as a lever set (`bossLevers.ts`). The levers follow the item's step
 * (its kind), not its mode: every mode runs the same steps. A plan item has none (every picture passes).
 *
 * write: `model_card` (model): a filled card of the same part from a DIFFERENT story (a lost kite).
 *        `card_starter` (custom): puts a sentence starter with blanks in the learner's box; offered while it is empty.
 * order: `model_card` (model): a DIFFERENT three-step story in order (a seed that grows).
 *        `place_first` (custom): places the first event in the learner's order; offered on three or more events only,
 *        since with two it would place the whole order.
 * The model order is not offered when one of its events is on this board.
 */
import { leverSet, type LeverSpec } from '../../../components/live-activity/bossLevers';
import { storyPlannerCard } from './storyPlanner.card';
import {
  FIRST_LEVER, MODEL_CARD, MODEL_LEVER, MODEL_ORDER, STARTER, STARTER_LEVER, splitPictureOption, type StoryItem,
} from './storySteps';

const low = (s: string) => splitPictureOption(s).label.toLowerCase().replace(/[^a-z ]/g, '').trim();

/** What the model lever shows on this item: a filled card, or a story in order; null on a plan item or a clash. */
export function modelFor(item: StoryItem): string | readonly string[] | null {
  if (item.kind === 'write') return MODEL_CARD[item.part];
  if (item.kind !== 'order') return null;
  const own = new Set(item.events.map(e => low(e.text)));
  return MODEL_ORDER.some(e => own.has(low(e))) ? null : MODEL_ORDER;
}

/** The screen's state a lever offer reads: the starter only goes into an empty box. */
export interface StoryCtx { boxEmpty: boolean }

const specs: LeverSpec<StoryItem, StoryCtx>[] = [
  { id: MODEL_LEVER, type: 'model', answers: ['not_sense', 'wrong_job', 'wrong_order'],
    answersOn: item => (item.kind === 'order' ? ['wrong_order'] : ['not_sense', 'wrong_job']),
    when: item => (item.kind === 'order' ? 'The learner\'s order does not make sense.' : 'The card does not answer its question.'),
    does: item => (item.kind === 'order' ? 'Shows a DIFFERENT three-step story in order, so the learner sees first, next, last.'
      : `Shows a ${item.kind === 'write' ? item.label.toLowerCase() : ''} card from a DIFFERENT story.`),
    content: modelFor,
    fact: (model: string | readonly string[], item) => (item.kind === 'order'
      ? `Another story is shown in order: ${(model as readonly string[]).map(e => splitPictureOption(e).label).join(' Then ')}`
      : `A ${item.kind === 'write' ? item.label.toLowerCase() : ''} card from a different story is shown: "${model as string}"`) },
  { id: STARTER_LEVER, type: 'custom', carrier: 'shown', answers: ['too_short', 'wrong_job'],
    why: 'It edits the learner\'s own answer box (puts a sentence starter with blanks in it to fill), which no stock type '
      + 'does: it is not a clue, a mark, a layout or a different item.',
    when: 'The learner cannot start from a blank box.',
    does: 'Puts a sentence starter with blanks in the box for the learner to fill.',
    content: item => (item.kind === 'write' ? STARTER[item.part] : null),
    offer: (_item, ctx) => ctx.boxEmpty,
    fact: (starter: string) => `A sentence starter was put in the box to fill: "${starter}"` },
  { id: FIRST_LEVER, type: 'custom', carrier: 'shown', answers: ['wrong_order'],
    why: 'It places one event in the learner\'s own order, which no stock type does: it is not a clue, a mark, a layout or '
      + 'a different item.',
    when: 'The learner cannot find where the story starts.',
    does: 'Places the first event, so the learner orders the rest.',
    content: item => (item.kind === 'order' && item.events.length > 2 ? item.events[0] : null),
    fact: 'The first event is placed in the learner\'s order; the learner orders the rest.' },
];

export const STORY_LEVERS = leverSet<StoryItem, StoryCtx>({
  missesOf: mode => storyPlannerCard.modes[mode]?.misses ?? [],
  support: {
    tier: item => item.supportTier ?? 'medium',
    different: item => (item.kind === 'order' ? 'a different story in order' : 'a filled card from a different story'),
    own: item => (item.kind === 'order' ? 'which event comes first' : 'what to write on this card'),
  },
  specs,
});
