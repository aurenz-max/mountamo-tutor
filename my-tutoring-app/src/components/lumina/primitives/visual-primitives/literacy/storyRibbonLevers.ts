/**
 * The in-item levers on story-ribbon (`/add-support-tiers`, handoff 22 L4), as one lever set (`bossLevers.ts`). The
 * answer is a spoken account; the picture cards are a planning board the learner arranges and are never graded.
 *
 * - `sequence_labels` (retell modes): First / Next / Last on the three SLOTS. Answers an account that leaves an event
 *   out: three named places, one event each.
 * - `flow_arrows` (retell modes): arrows between the slots. Answers picture names said as a list: the board reads as
 *   one story running left to right.
 * - `connection_frame` (story_to_experience): story moment → another experience → what is alike.
 *
 * Leak rule: a mark belongs to a slot, never to a card, so it stays put when cards are swapped and never tells which
 * picture comes first (mounted test: labels by slot before and after a swap). Nothing answers `out_of_order` (any
 * order cue is the answer) or `tense_drift` (a time model would be new capability); both are unanswered by decision.
 * The tier's live order self-check is NOT a lever: it turns green on the story order, so pulling it would give the
 * order away. The tier is the starting position: a lever is offered only where the tier withdrew the aid.
 * No simplify: graded items keep three events (catalog), and a shorter story would spend a later item.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { storyRibbonCard } from './storyRibbon.card';
import type { StoryRibbonItem } from './storyRibbonDomain';
import { normalizeSupportTier, resolveSupportStructure, type StoryRibbonSupportOptions } from './storyRibbonSupport';

export const LABELS_LEVER = 'sequence_labels';
export const ARROWS_LEVER = 'flow_arrows';
export const FRAME_LEVER = 'connection_frame';

export const tierSupport = (item: StoryRibbonItem): StoryRibbonSupportOptions =>
  item.challenge.support ?? resolveSupportStructure(item.mode, normalizeSupportTier(item.challenge.supportTier));

/** The tier's aids plus the pulled levers. */
export function supportOnScreen(item: StoryRibbonItem, pulled: readonly string[]): StoryRibbonSupportOptions {
  const tier = tierSupport(item);
  return { ...tier,
    showSequenceLabels: tier.showSequenceLabels || pulled.includes(LABELS_LEVER),
    showFlowArrows: tier.showFlowArrows || pulled.includes(ARROWS_LEVER),
    showConnectionFrame: tier.showConnectionFrame || pulled.includes(FRAME_LEVER) };
}

const RETELL = ['tell_connected_account', 'tell_present_account', 'tell_future_account', 'tell_past_account'];

export const STORY_RIBBON_LEVERS = leverSet<StoryRibbonItem, void>({
  modeOf: item => item.mode,
  missesOf: mode => storyRibbonCard.modes[mode].misses,
  specs: [
    { id: LABELS_LEVER, type: 'marks', modes: RETELL, answers: ['events_missing'],
      when: 'The learner leaves an event out of the story.',
      does: 'Puts First, Next and Last under the three places on the ribbon. The pictures do not move.',
      offer: item => !tierSupport(item).showSequenceLabels,
      fact: 'First, Next and Last under the three places on the ribbon (the places, not the pictures)' },
    { id: ARROWS_LEVER, type: 'marks', modes: RETELL, answers: ['labels_listed'],
      when: 'The learner names the pictures as a list instead of telling a story.',
      does: 'Draws arrows between the three places so the ribbon reads as one story. The pictures do not move.',
      offer: item => !tierSupport(item).showFlowArrows,
      fact: 'arrows between the three places, left to right' },
    { id: FRAME_LEVER, type: 'custom', modes: ['story_to_experience'], carrier: 'shown', answers: ['event_only', 'no_connection'],
      why: 'Adds a three-step outline of the answer\'s parts beside the board, which no stock type does.',
      when: 'The learner tells the story moment only, or never says how it is like another experience.',
      does: 'Shows a three-step frame: story moment, another experience, what is alike. Names no experience.',
      offer: item => !tierSupport(item).showConnectionFrame,
      fact: 'a three-step frame: story moment, another experience, what is alike' },
  ],
});
