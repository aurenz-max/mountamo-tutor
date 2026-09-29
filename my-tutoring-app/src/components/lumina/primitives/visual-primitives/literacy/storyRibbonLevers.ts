/**
 * The in-item levers on story-ribbon (`/add-support-tiers`, handoff 22 L4). The answer is a spoken account; the
 * picture cards are a planning board the learner arranges and are never graded.
 *
 * - `sequence_labels` (help, shown; retell modes): First / Next / Last on the three SLOTS. Answers an account that
 *   leaves an event out: three named places, one event each.
 * - `flow_arrows` (help, shown; retell modes): arrows between the slots. Answers picture names said as a list: the
 *   board reads as one story running left to right.
 * - `connection_frame` (help, shown; story_to_experience): story moment → another experience → what is alike.
 *
 * Leak rule: a mark belongs to a slot, never to a card, so it stays put when cards are swapped and never tells
 * which picture comes first (mounted test: labels by slot before and after a swap). Nothing answers `out_of_order` (any order cue is the answer) or
 * `tense_drift` (a time model would be new capability); both are unanswered by decision.
 * The tier's live order self-check is NOT a lever: it turns green on the story order, so pulling it would give the
 * order away. The tier is the starting position: a lever is offered only where the tier withdrew the aid.
 * No simplify: graded items keep three events (catalog), and a shorter story would spend a later item.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { StoryRibbonItem } from './storyRibbonScript';
import { normalizeSupportTier, resolveSupportStructure, type StoryRibbonSupportOptions } from './storyRibbonSupport';
import type { SpokenStoryRibbonMiss } from './storyRibbonWorkspace';

export const LABELS_LEVER = 'sequence_labels';
export const ARROWS_LEVER = 'flow_arrows';
export const FRAME_LEVER = 'connection_frame';

/** Misses no lever answers, by decision (see the header). */
export const STORY_RIBBON_UNANSWERED: readonly SpokenStoryRibbonMiss[] = ['out_of_order', 'tense_drift'];

const experience = (item: StoryRibbonItem) => item.mode === 'story_to_experience';

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

/** What the pulled levers put on screen, for the tutor. Never an event or its place. */
export function leversOnScreen(item: StoryRibbonItem, pulled: readonly string[]): string | null {
  const tier = tierSupport(item);
  const lines = [
    pulled.includes(LABELS_LEVER) && !tier.showSequenceLabels && 'First, Next and Last under the three places on the ribbon (the places, not the pictures)',
    pulled.includes(ARROWS_LEVER) && !tier.showFlowArrows && 'arrows between the three places, left to right',
    pulled.includes(FRAME_LEVER) && !tier.showConnectionFrame && 'a three-step frame: story moment, another experience, what is alike',
  ].filter(Boolean);
  return lines.length ? lines.join('; ') : null;
}

/** The levers this item declares, with their state: only the aids its tier withdrew. */
export function storyRibbonLevers(item: StoryRibbonItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const tier = tierSupport(item);
  const lever = (id: string, answers: SpokenStoryRibbonMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind: 'help', carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  if (experience(item)) return tier.showConnectionFrame ? [] : [lever(FRAME_LEVER, ['event_only', 'no_connection'],
    'The learner tells the story moment only, or never says how it is like another experience.',
    'Shows a three-step frame: story moment, another experience, what is alike. Names no experience.')];
  return [
    ...(tier.showSequenceLabels ? [] : [lever(LABELS_LEVER, ['events_missing'],
      'The learner leaves an event out of the story.',
      'Puts First, Next and Last under the three places on the ribbon. The pictures do not move.')]),
    ...(tier.showFlowArrows ? [] : [lever(ARROWS_LEVER, ['labels_listed'],
      'The learner names the pictures as a list instead of telling a story.',
      'Draws arrows between the three places so the ribbon reads as one story. The pictures do not move.')]),
  ];
}
