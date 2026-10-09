/**
 * The in-item levers on story-bridge (`/add-support-tiers`, handoff 22 L4; spoken modes 2026-10-09). The stories are
 * heard, not printed, so help works on story ONE's material (the anchor), on the two named friends' own pictures, or
 * splits the question; it never marks, pictures or re-reads a story-two candidate, which would turn comprehension
 * into picture matching (handoff 22 draft).
 *
 * - `anchor_action` (help, both; match_character): the anchor friend's own event picture on its card, and the tutor
 *   re-reads that one sentence from story one. Candidates get no event picture.
 * - `setting_focus` (help, both; match_setting): each story picture gets its place label, and the tutor re-reads the
 *   two opening sentences only.
 * - `two_questions` (help, both; venn_place): two empty checks under the detail, one per friend; the tutor asks about
 *   each friend in turn. Code never fills them.
 * - `anchor_timeline` (help, shown; sequence_two): story one's three event pictures in order, the asked one lit.
 *   Story two's order is never drawn.
 * - `friend_events` (help, both; say_alike, say_different): each named friend's card shows the picture of what that
 *   friend did, and the tutor re-reads the two friends' sentences, one from each story. The ask names both friends,
 *   so no choice is marked; the learner still says how they compare.
 * - `ask_sign` (help, both; say_alike, say_different): the two friends' faces in the bridge with the ask's sign
 *   between them (alike or different), and the tutor asks the same question again.
 * - `two_ideas` (help, both; main_idea_compare): an empty "mostly about?" check under each story picture; the tutor
 *   asks about one story at a time. Code never fills them.
 *
 * Misses come from `storyBridgeMiss` (taps) and `storyBridgeSpokenMisses` (spoken). No simplify: a new pair of
 * stories spends a later item, and a spoken comparison turned into a choice is a tap mode.
 * Leak rule (`leverLeak`): nothing a lever draws or says names the correct choice; on a spoken mode, the lever's own
 * words (outside the story sentences it quotes and its "Do not" fence) never contain the reference comparison, the
 * shared behaviour, a friend's unique detail or a story's big idea.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { choiceLabel, type StoryBridgeItem } from './storyBridgeScript';
import type { SpokenStoryBridgeMiss, StoryBridgeMiss } from './storyBridgeWorkspace';

export const ANCHOR_LEVER = 'anchor_action';
export const SETTING_LEVER = 'setting_focus';
export const TWO_QUESTIONS_LEVER = 'two_questions';
export const TIMELINE_LEVER = 'anchor_timeline';
export const FRIENDS_LEVER = 'friend_events';
export const ASK_SIGN_LEVER = 'ask_sign';
export const TWO_IDEAS_LEVER = 'two_ideas';

/** The sign the ask_sign lever draws between the two friends. */
export const askSign = (item: StoryBridgeItem) => item.mode === 'say_different' ? '↔️' : '🟰';

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
    case FRIENDS_LEVER: return `${item.anchor.name}'s card and ${item.target.name}'s card each show a picture of what `
      + `that friend did: ${item.anchor.eventEmoji} and ${item.target.eventEmoji}. Read each friend's one sentence again, `
      + `one from each story, and nothing else: "${item.anchor.sentence}" "${item.target.sentence}" `
      + 'Do not say how the two friends compare.';
    case ASK_SIGN_LEVER: return `Between the two stories, ${item.anchor.name}'s face and ${item.target.name}'s face with `
      + `the ${item.mode === 'say_different' ? 'different' : 'alike'} sign ${askSign(item)} between them. Ask the same `
      + 'question again. Do not give a way.';
    case TWO_IDEAS_LEVER: return 'Under each story picture, an empty check: what is this story mostly about? Ask about '
      + 'one story at a time, then how the two compare. Do not say either story\'s big idea.';
    default: return '';
  }
}

/**
 * Leak rule: true if a lever's text, less its own "Do not ..." instruction, names the correct choice (a story-two
 * friend, "same kind", "different", "<name> only", "both friends") or quotes the target's sentence. On a spoken mode
 * there is no choice: true if the lever's own words (less the story sentences it quotes and its "Do not" fence) carry
 * the reference comparison, the shared behaviour, either friend's unique detail or either story's big idea.
 */
export function leverLeak(item: StoryBridgeItem, id: string): boolean {
  if (item.answerKind !== 'gesture') {
    const own = leverText(item, id).replace(/"[^"]*"/g, ' ').replace(/Do not [^.]*\./g, ' ').toLowerCase();
    return [item.comparisonSummary, item.sharedBehavior, item.anchor.uniqueDetail, item.target.uniqueDetail,
      item.storyA.mainIdea, item.storyB.mainIdea]
      .map(t => t.trim().replace(/[.!?]$/, '').toLowerCase()).some(t => !!t && own.includes(t));
  }
  const text = leverText(item, id).replace(/Do not [^.]*\./g, '').toLowerCase();
  return text.includes(choiceLabel(item, item.correctChoiceId).toLowerCase())
    || (item.anchor.id !== item.target.id && text.includes(item.target.sentence.toLowerCase()));
}

type LeverSpec = { id: string; carrier: WorkspaceLever['carrier']; answers: Array<StoryBridgeMiss | SpokenStoryBridgeMiss>;
  when: string; does: string };

const FRIENDS: LeverSpec = { id: FRIENDS_LEVER, carrier: 'both', answers: ['one_friend_only'],
  when: 'The learner tells about only one of the two friends.',
  does: 'Shows what each friend did, on that friend\'s own card. Re-read the two friends\' sentences, one from each story; never say how they compare.' };
const askSignSpec = (miss: SpokenStoryBridgeMiss, asked: string): LeverSpec => ({ id: ASK_SIGN_LEVER, carrier: 'both', answers: [miss],
  when: `Asked how the friends are ${asked}, the learner tells the other kind of comparison.`,
  does: `Draws the two friends' faces with the ${asked} sign between them. Ask the same question again; never give a way.` });

/** Spoken modes: every spoken miss of the mode has a lever. */
const SPOKEN_LEVERS: Partial<Record<StoryBridgeItem['mode'], LeverSpec[]>> = {
  say_alike: [FRIENDS, askSignSpec('told_difference', 'alike')],
  say_different: [FRIENDS, askSignSpec('told_likeness', 'different')],
  main_idea_compare: [{ id: TWO_IDEAS_LEVER, carrier: 'both', answers: ['one_story_only'],
    when: 'The learner tells about only one story.',
    does: 'Puts an empty "mostly about?" check under each story picture. Ask about one story at a time; never say either big idea.' }],
};
const TAP_LEVERS: Partial<Record<StoryBridgeItem['mode'], LeverSpec>> = {
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

/** The levers this item declares, with their state. A lever that would leak on this item is left out. */
export function storyBridgeLevers(item: StoryBridgeItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const tap = TAP_LEVERS[item.mode];
  const specs = item.answerKind === 'gesture' ? (tap ? [tap] : []) : SPOKEN_LEVERS[item.mode] ?? [];
  return specs.filter(spec => !leverLeak(item, spec.id)).map(spec => ({ id: spec.id, kind: 'help' as const,
    carrier: spec.carrier, pulled: pulled.includes(spec.id), answers: spec.answers, when: spec.when, does: spec.does }));
}
