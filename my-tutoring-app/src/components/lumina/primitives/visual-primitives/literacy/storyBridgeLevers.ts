/**
 * The in-item levers on story-bridge (`/add-support-tiers`, handoff 22 L4; spoken modes 2026-10-09), as one lever set
 * (`bossLevers.ts`). The stories are heard, not printed, so help works on story ONE's material (the anchor), on the two
 * named friends' own pictures, or splits the question; it never marks, pictures or re-reads a story-two candidate,
 * which would turn comprehension into picture matching (handoff 22 draft).
 *
 * - `anchor_action` (clue; match_character): the anchor friend's own event picture on its card, and the tutor re-reads
 *   that one sentence from story one. Candidates get no event picture.
 * - `setting_focus` (clue; match_setting): each story picture gets its place label, and the tutor re-reads the two
 *   opening sentences only.
 * - `two_questions` (clue; venn_place): two empty checks under the detail, one per friend; the tutor asks about each
 *   friend in turn. Code never fills them.
 * - `anchor_timeline` (legend; sequence_two): story one's three event pictures in order, the asked one lit. Story
 *   two's order is never drawn.
 * - `friend_events` (clue; say_alike, say_different): each named friend's card shows the picture of what that friend
 *   did, and the tutor re-reads the two friends' sentences, one from each story. The learner still says how they compare.
 * - `ask_sign` (clue; say_alike, say_different): the two friends' faces in the bridge with the ask's sign between them
 *   (alike or different), and the tutor asks the same question again.
 * - `two_ideas` (clue; main_idea_compare): an empty "mostly about?" check under each story picture; the tutor asks
 *   about one story at a time. Code never fills them.
 *
 * Leak rule (the clue type, against `answersOf`): no lever's words name the correct choice or quote story two's
 * matching sentence; on a spoken mode they never carry the reference comparison, the shared behaviour, a friend's
 * unique detail or a story's big idea. No simplify: a new pair of stories spends a later item, and a spoken
 * comparison turned into a choice is a tap mode. No model lever, so no support tier fact.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { storyBridgeCard } from './storyBridge.card';
import { choiceLabel, type StoryBridgeItem } from './storyBridgeDomain';

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

/** The answers a clue must never name: the right choice (and story two's matching sentence), or on a spoken item
 *  every wording that would say a comparison for the learner. */
export function storyBridgeAnswers(item: StoryBridgeItem): string[] {
  if (item.answerKind === 'gesture') {
    return [choiceLabel(item, item.correctChoiceId),
      ...(item.anchor.id !== item.target.id ? [item.target.sentence] : [])];
  }
  return [item.comparisonSummary, item.sharedBehavior, item.anchor.uniqueDetail, item.target.uniqueDetail,
    item.storyA.mainIdea, item.storyB.mainIdea].map(t => t.trim()).filter(Boolean);
}

const askSignSpec = (mode: 'say_alike' | 'say_different', miss: 'told_difference' | 'told_likeness', asked: string) => ({
  id: ASK_SIGN_LEVER, type: 'clue' as const, modes: [mode], answers: [miss],
  when: `Asked how the friends are ${asked}, the learner tells the other kind of comparison.`,
  does: `Draws the two friends' faces with the ${asked} sign between them. Ask the same question again; never give a way.`,
  fact: (_: unknown, item: StoryBridgeItem) => `Between the two stories, ${item.anchor.name}'s face and ${item.target.name}'s `
    + `face with the ${asked} sign ${askSign(item)} between them. Ask the same question again.`,
});

export const STORY_BRIDGE_LEVERS = leverSet<StoryBridgeItem, void>({
  modeOf: item => item.mode,
  missesOf: mode => storyBridgeCard.modes[mode].misses,
  answersOf: storyBridgeAnswers,
  specs: [
    { id: ANCHOR_LEVER, type: 'clue', modes: ['match_character'], answers: 'all',
      when: 'The learner taps a friend who only looks alike, or another friend.',
      does: 'Shows what the first friend did, on that friend\'s card only. Re-read that one sentence; nothing from story two.',
      fact: (_, item) => `${item.anchor.name}'s card shows what ${item.anchor.name} did in ${item.anchorStory.title}. `
        + `Read this one sentence from story one again, and nothing from story two: "${item.anchor.sentence}"` },
    { id: SETTING_LEVER, type: 'clue', modes: ['match_setting'], answers: 'all',
      when: 'The learner calls the places the same kind when they differ, or the other way round.',
      does: 'Labels each story picture with its place. Re-read the two opening sentences only; never say whether the places match.',
      fact: (_, item) => `Each story picture shows its place: ${item.storyA.title}, ${item.storyA.setting}; `
        + `${item.storyB.title}, ${item.storyB.setting}. Read the two opening sentences again, and nothing else: `
        + `"${item.storyA.opening}" "${item.storyB.opening}"` },
    { id: TWO_QUESTIONS_LEVER, type: 'clue', modes: ['venn_place'], answers: 'all',
      when: 'The learner puts the detail in the wrong circle.',
      does: 'Puts two empty checks under the detail, one per friend. Ask about each friend in turn; never answer.',
      fact: (_, item) => `Two empty checks under the detail, one for ${item.anchor.name} and one for ${item.target.name}. `
        + `Ask about one friend at a time: did this friend ${item.vennDetail}?` },
    { id: TIMELINE_LEVER, type: 'legend', modes: ['sequence_two'], answers: 'all',
      when: 'The learner taps an earlier or later event from story two.',
      does: 'Shows story one\'s events in order with the asked one lit. Story two stays mixed.',
      fact: (_, item) => `Story one's three events in order, beginning, middle and end, with the ${PART[item.eventIndex]} `
        + 'one lit. Story two\'s pictures stay mixed.' },
    { id: FRIENDS_LEVER, type: 'clue', modes: ['say_alike', 'say_different'], answers: ['one_friend_only'],
      when: 'The learner tells about only one of the two friends.',
      does: 'Shows what each friend did, on that friend\'s own card. Re-read the two friends\' sentences, one from each story; never say how they compare.',
      fact: (_, item) => `${item.anchor.name}'s card and ${item.target.name}'s card each show a picture of what that friend `
        + `did: ${item.anchor.eventEmoji} and ${item.target.eventEmoji}. Read again only the sentence about `
        + `${item.anchor.name} in ${item.anchorStory.title} and the sentence about ${item.target.name} in ${item.targetStory.title}.` },
    askSignSpec('say_alike', 'told_difference', 'alike'),
    askSignSpec('say_different', 'told_likeness', 'different'),
    { id: TWO_IDEAS_LEVER, type: 'clue', modes: ['main_idea_compare'], answers: 'all',
      when: 'The learner tells about only one story.',
      does: 'Puts an empty "mostly about?" check under each story picture. Ask about one story at a time; never say either big idea.',
      fact: 'Under each story picture, an empty check: what is this story mostly about? Ask about one story at a time, '
        + 'then how the two compare.' },
  ],
});
