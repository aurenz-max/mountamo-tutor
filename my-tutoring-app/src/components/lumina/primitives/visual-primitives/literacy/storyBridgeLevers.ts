/**
 * The in-item levers on story-bridge (`/add-support-tiers`, handoff 22 L4). The stories are heard, not printed, so
 * help works on story ONE's material (the anchor) or splits the question; it never marks, pictures or re-reads a
 * story-two candidate, which would turn comprehension into picture matching (handoff 22 draft).
 *
 * - `anchor_action` (help, both; match_character): the anchor friend's own event picture on its card, and the tutor
 *   re-reads that one sentence from story one. Candidates get no event picture.
 * - `setting_focus` (help, both; match_setting): each story picture gets its place label, and the tutor re-reads the
 *   two opening sentences only.
 * - `two_questions` (help, both; venn_place): two empty checks under the detail, one per friend; the tutor asks about
 *   each friend in turn. Code never fills them.
 * - `anchor_timeline` (help, shown; sequence_two): story one's three event pictures in order, the asked one lit.
 *   Story two's order is never drawn.
 *
 * Tap misses come from `storyBridgeMiss`. The spoken modes (say_alike, say_different, main_idea_compare) are open
 * comparisons with no bounded miss, and their only material is the story text, which "Hear both stories again"
 * already re-reads: no lever by decision. No simplify: a new pair of stories spends a later item.
 * Leak rule (`leverLeak`): nothing a lever draws or says names the correct choice.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { choiceLabel, type StoryBridgeItem } from './storyBridgeScript';
import type { StoryBridgeMiss } from './storyBridgeWorkspace';

export const ANCHOR_LEVER = 'anchor_action';
export const SETTING_LEVER = 'setting_focus';
export const TWO_QUESTIONS_LEVER = 'two_questions';
export const TIMELINE_LEVER = 'anchor_timeline';

const PART = ['beginning', 'middle', 'end'];

/** The text a pulled lever puts on screen or asks the tutor to say. */
export function leverText(item: StoryBridgeItem, id: string): string {
  switch (id) {
    case ANCHOR_LEVER: return `${item.anchor.name}'s card shows what ${item.anchor.name} did in ${item.anchorStory.title}. `
      + `Read this one sentence from story one again, and nothing from story two: "${item.anchor.sentence}"`;
    case SETTING_LEVER: return `Each story picture shows its place: ${item.storyA.title}, ${item.storyA.setting}; `
      + `${item.storyB.title}, ${item.storyB.setting}. Read the two opening sentences again, and nothing else: `
      + `"${item.storyA.opening}" "${item.storyB.opening}" Do not say whether the places are the same kind.`;
    case TWO_QUESTIONS_LEVER: return `Two empty checks under the detail, one for ${item.anchor.name} and one for `
      + `${item.target.name}. Ask about one friend at a time: did this friend ${item.vennDetail}? Do not answer either.`;
    case TIMELINE_LEVER: return `Story one's three events in order, beginning, middle and end, with the ${PART[item.eventIndex]} `
      + 'one lit. Story two\'s pictures stay mixed.';
    default: return '';
  }
}

/**
 * Leak rule: true if a lever's text, less its own "Do not ..." instruction, names the correct choice (a story-two
 * friend, "same kind", "different", "<name> only", "both friends") or quotes the target's sentence.
 */
export function leverLeak(item: StoryBridgeItem, id: string): boolean {
  const text = leverText(item, id).replace(/Do not [^.]*\./g, '').toLowerCase();
  return text.includes(choiceLabel(item, item.correctChoiceId).toLowerCase())
    || (item.anchor.id !== item.target.id && text.includes(item.target.sentence.toLowerCase()));
}

const LEVERS: Partial<Record<StoryBridgeItem['mode'], { id: string; carrier: WorkspaceLever['carrier']; answers: StoryBridgeMiss[]; when: string; does: string }>> = {
  match_character: { id: ANCHOR_LEVER, carrier: 'both', answers: ['same_look', 'other_character'],
    when: 'The learner taps a friend who only looks alike, or another friend.',
    does: 'Shows what the first friend did, on that friend\'s card only. Re-read that one sentence; nothing from story two.' },
  match_setting: { id: SETTING_LEVER, carrier: 'both', answers: ['same_for_different', 'different_for_same'],
    when: 'The learner calls the places the same kind when they differ, or the other way round.',
    does: 'Labels each story picture with its place. Re-read the two opening sentences only.' },
  venn_place: { id: TWO_QUESTIONS_LEVER, carrier: 'both', answers: ['both_for_one', 'one_for_both', 'other_side'],
    when: 'The learner puts the detail in the wrong circle.',
    does: 'Puts two empty checks under the detail, one per friend. Ask about each friend in turn; never answer.' },
  sequence_two: { id: TIMELINE_LEVER, carrier: 'shown', answers: ['earlier_event', 'later_event'],
    when: 'The learner taps an earlier or later event from story two.',
    does: 'Shows story one\'s events in order with the asked one lit. Story two stays mixed.' },
};

/** What the pulled lever put on screen, for the tutor. */
export const leversOnScreen = (item: StoryBridgeItem, pulled: readonly string[]): string | null =>
  pulled.length ? pulled.map(id => leverText(item, id)).filter(Boolean).join(' ') || null : null;

/** The levers this item declares, with their state. Only tap modes have one. */
export function storyBridgeLevers(item: StoryBridgeItem | null, pulled: readonly string[]): WorkspaceLever[] {
  const spec = item && item.answerKind === 'gesture' ? LEVERS[item.mode] : undefined;
  if (!item || !spec || leverLeak(item, spec.id)) return [];
  return [{ id: spec.id, kind: 'help', carrier: spec.carrier, pulled: pulled.includes(spec.id), answers: spec.answers,
    when: spec.when, does: spec.does }];
}
