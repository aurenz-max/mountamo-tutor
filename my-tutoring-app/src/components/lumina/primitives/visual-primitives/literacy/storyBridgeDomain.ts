/**
 * Story bridge's domain: the build gates the generator and the session share, the items, the ask, the spoken key,
 * the misses, the scene and the harness answers. Pure: the boss, the component and the generator read it.
 *
 * Two read-aloud stories stay on screen as pictures, titles and friends; the story text is heard, not printed.
 * Match characters, match settings, the picture Venn diagram and event sequences are taps the activity checks; say
 * alike, say different and compare big ideas are spoken comparisons the tutor judges on meaning against the key.
 */
import type { TeachingItem } from '../../../hooks/teachingItemContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { StoryBridgeMiss } from './storyBridge.card';
import type {
  StoryBridgeChallenge, StoryBridgeChallengeType, StoryBridgeCharacter,
  StoryBridgeStory, StoryBridgeVennRegion,
} from './StoryBridge';

export const MAX_TITLE_CHARS = 40;
export const MAX_SENTENCE_CHARS = 140;
export const MAX_STORY_CHARS = 560;
export const MAX_BEHAVIOR_WORDS = 14;
export const MIN_BEHAVIOR_WORDS = 2;
export const MIN_FAR_SHORE = 2;
export const MAX_FAR_SHORE = 4;

const VERDICT_WORDS: ReadonlySet<string> = new Set(['yes', 'yeah', 'no', 'nope']);
const wordsIn = (text: string): number => text.trim() ? text.trim().split(/\s+/).length : 0;
const speakable = (text: string): boolean => text.trim().length > 0 && !/["“”_[\]]/.test(text);
const escapeRe = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWordIn = (text: string, word: string): boolean =>
  new RegExp(`(^|[^A-Za-z])${escapeRe(word)}([^A-Za-z]|$)`, 'i').test(text);

export const isSayableName = (name: string): boolean => {
  const value = name.trim();
  if (!/^[A-Z][a-zA-Z]{1,14}(?: [A-Z][a-zA-Z]{1,14})?$/.test(value)) return false;
  if (VERDICT_WORDS.has(value.toLowerCase())) return false;
  const [first, second] = value.split(' ');
  return !(second && /(?:y|ing|ful|ish)$/i.test(first));
};

export const isSayableTitle = (title: string): boolean =>
  speakable(title) && title.trim().length <= MAX_TITLE_CHARS
  && !/[.!?]$/.test(title.trim()) && !opensWithSentinel(title);

export const isSayableSentence = (sentence: string): boolean =>
  speakable(sentence) && sentence.trim().length <= MAX_SENTENCE_CHARS
  && wordsIn(sentence) >= 3 && /[.!?]$/.test(sentence.trim()) && !opensWithSentinel(sentence);

export const isEvidenceFor = (sentence: string, name: string): boolean =>
  isSayableSentence(sentence) && wholeWordIn(sentence, name);

export const isSharedBehavior = (behavior: string, names: readonly string[]): boolean => {
  const value = behavior.trim();
  if (!speakable(value) || /[.!?,;:]$/.test(value) || !/^[a-z]/.test(value) || /^both\b/i.test(value)) return false;
  const count = wordsIn(value);
  if (count < MIN_BEHAVIOR_WORDS || count > MAX_BEHAVIOR_WORDS || opensWithSentinel(value)) return false;
  return !names.some((name) => name.split(' ').some((part) => wholeWordIn(value, part)));
};

export const isComparisonSummary = (summary: string): boolean =>
  isSayableSentence(summary) && wordsIn(summary) <= 24;

export const storyText = (story: Pick<StoryBridgeStory, 'opening' | 'closing' | 'characters'>): string =>
  [story.opening, ...story.characters.map((character) => character.sentence), story.closing]
    .map((sentence) => sentence.trim()).filter(Boolean).join(' ');

export const titleNamesNoCharacter = (story: Pick<StoryBridgeStory, 'title' | 'characters'>): boolean =>
  !story.characters.some((character) => character.name.split(' ').some((part) => wholeWordIn(story.title, part)));

export const isSayableStory = (story: StoryBridgeStory): boolean =>
  isSayableTitle(story.title) && titleNamesNoCharacter(story)
  && speakable(story.setting) && wordsIn(story.setting) <= 8
  && isSayableSentence(story.opening) && isSayableSentence(story.closing)
  && isComparisonSummary(story.mainIdea)
  && story.characters.length >= MIN_FAR_SHORE && story.characters.length <= MAX_FAR_SHORE
  && story.characters.every((character) =>
    isSayableName(character.name) && character.emoji.trim().length > 0
    && character.eventEmoji.trim().length > 0 && isEvidenceFor(character.sentence, character.name)
    && isSharedBehavior(character.uniqueDetail, story.characters.map((candidate) => candidate.name)))
  && new Set(story.characters.map((character) => character.name.toLowerCase())).size === story.characters.length
  && new Set(story.characters.map((character) => character.emoji)).size === story.characters.length
  && new Set(story.characters.map((character) => character.id)).size === story.characters.length
  && storyText(story).length <= MAX_STORY_CHARS;

export interface StoryBridgeEvidence {
  summary: string;
  storyA: string;
  storyB: string;
}

export interface StoryBridgeItem extends TeachingItem {
  mode: StoryBridgeChallengeType;
  pairId: string;
  storyA: StoryBridgeStory;
  storyB: StoryBridgeStory;
  anchorStory: StoryBridgeStory;
  targetStory: StoryBridgeStory;
  anchor: StoryBridgeCharacter;
  target: StoryBridgeCharacter;
  options: StoryBridgeCharacter[];
  sharedBehavior: string;
  comparisonSummary: string;
  choiceIds: string[];
  correctChoiceId: string;
  vennDetail: string;
  vennRegion: StoryBridgeVennRegion;
  eventIndex: number;
  introducesStories: boolean;
}

const characterPair = (
  challenge: StoryBridgeChallenge,
  storiesById: ReadonlyMap<string, StoryBridgeStory>,
): { anchorStory: StoryBridgeStory; targetStory: StoryBridgeStory; anchor: StoryBridgeCharacter; target: StoryBridgeCharacter } | null => {
  const anchorStory = challenge.anchorStoryId ? storiesById.get(challenge.anchorStoryId) : null;
  const targetStory = challenge.targetStoryId ? storiesById.get(challenge.targetStoryId) : null;
  if (!anchorStory || !targetStory || anchorStory.id === targetStory.id) return null;
  const anchor = anchorStory.characters.find((character) => character.id === challenge.anchorCharacterId);
  const target = targetStory.characters.find((character) => character.id === challenge.targetCharacterId);
  if (!anchor || !target || anchor.name.toLowerCase() === target.name.toLowerCase()) return null;
  return { anchorStory, targetStory, anchor, target };
};

export const itemFromChallenge = (
  challenge: StoryBridgeChallenge,
  storiesById: ReadonlyMap<string, StoryBridgeStory>,
  introducesStories: boolean,
): StoryBridgeItem | null => {
  const storyA = storiesById.get(challenge.storyAId);
  const storyB = storiesById.get(challenge.storyBId);
  if (!storyA || !storyB || storyA.id === storyB.id || !isSayableStory(storyA) || !isSayableStory(storyB)) return null;
  if (storyA.title.trim().toLowerCase() === storyB.title.trim().toLowerCase()) return null;
  const names = [...storyA.characters, ...storyB.characters].map((character) => character.name);
  const fallbackPair = { anchorStory: storyA, targetStory: storyB, anchor: storyA.characters[0], target: storyB.characters[0] };
  const pair = characterPair(challenge, storiesById) ?? fallbackPair;
  const base = {
    id: challenge.id,
    mode: challenge.type,
    action: challenge.type,
    pairId: challenge.pairId,
    storyA,
    storyB,
    anchorStory: pair.anchorStory,
    targetStory: pair.targetStory,
    anchor: pair.anchor,
    target: pair.target,
    options: pair.targetStory.characters,
    sharedBehavior: (challenge.sharedBehavior ?? '').trim(),
    comparisonSummary: (challenge.comparisonSummary ?? '').trim(),
    choiceIds: [] as string[],
    correctChoiceId: '',
    vennDetail: (challenge.vennDetail ?? '').trim(),
    vennRegion: challenge.vennRegion ?? 'both' as StoryBridgeVennRegion,
    eventIndex: challenge.anchorEventIndex ?? 0,
    introducesStories,
  };

  switch (challenge.type) {
    case 'match_character': {
      if (!characterPair(challenge, storiesById) || pair.anchor.emoji === pair.target.emoji) return null;
      if (!isSharedBehavior(base.sharedBehavior, names)) return null;
      return { ...base, answerKind: 'gesture', responseClass: 'manipulation', choiceIds: pair.targetStory.characters.map((character) => character.id), correctChoiceId: pair.target.id };
    }
    case 'match_setting': {
      if ((challenge.relation !== 'same' && challenge.relation !== 'different') || !isComparisonSummary(base.comparisonSummary)) return null;
      return { ...base, answerKind: 'gesture', responseClass: 'manipulation', choiceIds: ['same', 'different'], correctChoiceId: challenge.relation };
    }
    case 'say_alike':
    case 'say_different': {
      if (!characterPair(challenge, storiesById) || !isComparisonSummary(base.comparisonSummary)) return null;
      if (challenge.type === 'say_alike' && !isSharedBehavior(base.sharedBehavior, names)) return null;
      return { ...base, answerKind: 'voice', responseClass: 'concept_statement' };
    }
    case 'venn_place': {
      if (!characterPair(challenge, storiesById) || !['story_a', 'both', 'story_b'].includes(base.vennRegion)) return null;
      if (!isSharedBehavior(base.vennDetail, names) || !isComparisonSummary(base.comparisonSummary)) return null;
      return { ...base, answerKind: 'gesture', responseClass: 'manipulation', choiceIds: ['story_a', 'both', 'story_b'], correctChoiceId: base.vennRegion };
    }
    case 'sequence_two': {
      const aIndex = challenge.anchorEventIndex;
      const bIndex = challenge.targetEventIndex;
      if (!Number.isInteger(aIndex) || !Number.isInteger(bIndex) || aIndex !== bIndex || aIndex! < 0 || aIndex! >= 3) return null;
      const anchor = storyA.characters[aIndex!];
      const target = storyB.characters[bIndex!];
      if (!anchor || !target) return null;
      return {
        ...base, anchorStory: storyA, targetStory: storyB, anchor, target,
        options: storyB.characters, eventIndex: aIndex!, answerKind: 'gesture', responseClass: 'manipulation',
        choiceIds: storyB.characters.map((character) => character.id), correctChoiceId: target.id,
      };
    }
    case 'main_idea_compare': {
      if ((challenge.relation !== 'same' && challenge.relation !== 'different') || !isComparisonSummary(base.comparisonSummary)) return null;
      return { ...base, answerKind: 'voice', responseClass: 'concept_statement' };
    }
  }
};

export const itemsFromChallenges = (
  challenges: readonly StoryBridgeChallenge[], stories: readonly StoryBridgeStory[],
): StoryBridgeItem[] => {
  const byId = new Map(stories.map((story) => [story.id, story]));
  const seenPairs = new Set<string>();
  const items: StoryBridgeItem[] = [];
  for (const challenge of challenges) {
    const item = itemFromChallenge(challenge, byId, !seenPairs.has(challenge.pairId));
    if (!item) continue;
    seenPairs.add(challenge.pairId);
    items.push(item);
  }
  return items;
};

export const challengeAskable = (challenge: StoryBridgeChallenge, stories: readonly StoryBridgeStory[]): boolean =>
  itemFromChallenge(challenge, new Map(stories.map((story) => [story.id, story])), true) !== null;

const ordinal = (index: number): string => ['beginning', 'middle', 'ending'][index] ?? 'same part';

/** The relationship and one sentence from each story, shown side by side after credit. */
export const evidenceFor = (item: StoryBridgeItem): StoryBridgeEvidence => {
  switch (item.mode) {
    case 'match_character':
    case 'say_alike':
    case 'say_different':
    case 'venn_place': {
      const anchorIsA = item.anchorStory.id === item.storyA.id;
      return {
        summary: item.comparisonSummary || `${item.anchor.name} and ${item.target.name} both ${item.sharedBehavior}.`,
        storyA: anchorIsA ? item.anchor.sentence : item.target.sentence,
        storyB: anchorIsA ? item.target.sentence : item.anchor.sentence,
      };
    }
    case 'match_setting':
      return { summary: item.comparisonSummary, storyA: item.storyA.opening, storyB: item.storyB.opening };
    case 'sequence_two':
      return { summary: `These are both ${ordinal(item.eventIndex)} events.`, storyA: item.anchor.sentence, storyB: item.target.sentence };
    case 'main_idea_compare':
      return { summary: item.comparisonSummary, storyA: storyText(item.storyA), storyB: storyText(item.storyB) };
  }
};

/** Both stories, in the order the scene names them (story one, story two). */
export const storiesLine = (item: StoryBridgeItem): string => {
  const [first, second] = item.storyA.id < item.storyB.id ? [item.storyA, item.storyB] : [item.storyB, item.storyA];
  return `Story one, ${first.title}: ${storyText(first)} Story two, ${second.title}: ${storyText(second)} `;
};

/** What the learner is asked on one item. Names the anchor (and on spoken items both friends), never the answer. */
export const askFor = (item: StoryBridgeItem): string => {
  switch (item.mode) {
    case 'match_character':
      return `Think about ${item.anchor.name} in ${item.anchorStory.title}. Find the friend in ${item.targetStory.title} who is like ${item.anchor.name}. Tap that friend.`;
    case 'match_setting':
      return `Think about the places in ${item.storyA.title} and ${item.storyB.title}. Are they the same kind of place or different kinds? Tap same or different.`;
    case 'say_alike':
      return `Think about ${item.anchor.name} in ${item.anchorStory.title} and ${item.target.name} in ${item.targetStory.title}. Tell one way they are alike.`;
    case 'say_different':
      return `Think about ${item.anchor.name} in ${item.anchorStory.title} and ${item.target.name} in ${item.targetStory.title}. Tell one way they are different.`;
    case 'venn_place':
      return `Compare ${item.anchor.name} and ${item.target.name}. The detail is: ${item.vennDetail}. Does it belong to ${item.anchor.name} only, both friends, or ${item.target.name} only? Tap its circle.`;
    case 'sequence_two':
      return `In ${item.storyA.title}, ${item.anchor.sentence} That is a ${ordinal(item.eventIndex)} event. Find the ${ordinal(item.eventIndex)} event from ${item.storyB.title}. Tap its picture.`;
    case 'main_idea_compare':
      return `Think about the big ideas in ${item.storyA.title} and ${item.storyB.title}. Tell one way the big ideas are alike or different.`;
  }
};

export const choiceLabel = (item: StoryBridgeItem, choiceId: string): string => {
  if (choiceId === 'same') return 'same kind';
  if (choiceId === 'different') return 'different';
  if (choiceId === 'story_a') return `${item.anchor.name} only`;
  if (choiceId === 'both') return 'both friends';
  if (choiceId === 'story_b') return `${item.target.name} only`;
  return [...item.storyA.characters, ...item.storyB.characters].find((character) => character.id === choiceId)?.name ?? 'a picture';
};

/**
 * A spoken item's key, judged on meaning: the reference comparison is an example, never the required words, and the
 * two evidence sentences are what makes a comparison true. A tap item has no key: the activity checks the tap.
 */
export function storyBridgeKey(item: StoryBridgeItem): SpokenKey | null {
  if (item.answerKind === 'gesture') return null;
  const { anchor, target } = item;
  const evidence = evidenceFor(item);
  const childWords = 'Accept child grammar and the learner\'s own words; titles, names and full sentences are not required.';
  if (item.mode === 'main_idea_compare') {
    return {
      answer: item.comparisonSummary, alsoAccept: [],
      meaning: {
        idea: `One true way the big ideas of ${item.storyA.title} (${item.storyA.mainIdea}) and ${item.storyB.title} `
          + `(${item.storyB.mainIdea}) are alike or different; a likeness and a difference both count.`,
        notIt: 'a detail or big idea about only one story with no link to the other',
      },
      acceptRule: childWords,
    };
  }
  const told = `Story one says: "${evidence.storyA}" Story two says: "${evidence.storyB}"`;
  if (item.mode === 'say_alike') {
    return {
      answer: item.comparisonSummary, alsoAccept: [],
      meaning: {
        idea: `One way ${anchor.name} and ${target.name} are alike: something true of both friends in their stories.`,
        notIt: 'a detail about only one of the two friends, or a way they are different',
      },
      acceptRule: `${childWords} Any true likeness counts, not only the reference. ${told}`,
    };
  }
  return {
    answer: item.comparisonSummary, alsoAccept: [],
    meaning: {
      idea: `One way ${anchor.name} and ${target.name} are different: something true of one friend and not the other.`,
      notIt: 'a detail about only one friend with no link to the other, or something both friends did',
    },
    acceptRule: `${childWords} Any true difference counts, not only the reference. ${told}`,
  };
}

/** The spoken modes' known wrong answers on this item, in precedence order. Never sent to the tutor. */
export function storyBridgeSpokenMisses(item: StoryBridgeItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const { anchor, target } = item;
  if (item.mode === 'main_idea_compare') {
    return [{ id: 'one_story_only',
      pattern: `The learner tells about only one story, ${item.storyA.title} or ${item.storyB.title}, and makes no link to the other story.`,
      examples: [item.storyA.mainIdea, item.storyB.mainIdea] }];
  }
  const oneFriend: KnownMiss = { id: 'one_friend_only',
    pattern: `The learner tells something about only one friend, ${anchor.name} or ${target.name}, and makes no link to the other friend.`,
    examples: [`${anchor.name} ${anchor.uniqueDetail}.`, `${target.name} ${target.uniqueDetail}.`, `${anchor.name} was in one story.`] };
  if (item.mode === 'say_alike') {
    return [oneFriend, { id: 'told_difference',
      pattern: `Asked how ${anchor.name} and ${target.name} are alike, the learner tells only a way the two friends are different, and no way they are alike.`,
      examples: [`${anchor.name} ${anchor.uniqueDetail} and ${target.name} ${target.uniqueDetail}.`] }];
  }
  if (item.mode === 'say_different') {
    return [oneFriend, { id: 'told_likeness',
      pattern: `Asked how ${anchor.name} and ${target.name} are different, the learner tells only something both friends did or have, and no way they differ.`,
      ...(item.sharedBehavior ? { examples: [`They both ${item.sharedBehavior}.`] } : {}) }];
  }
  return [];
}

/** One story as the tutor reads it, split under the observer's fact cap. */
const storyFacts = (key: string, story: StoryBridgeStory) => textFacts(key, `${story.title}: ${storyText(story)}`);

export function storyBridgeScene(item: StoryBridgeItem): SceneOf {
  // Story one and two in the order the tutor reads them (`storiesLine`).
  const [first, second] = item.storyA.id < item.storyB.id ? [item.storyA, item.storyB] : [item.storyB, item.storyA];
  const facts: Record<string, string> = {
    ...storyFacts('storyOne', first),
    ...storyFacts('storyTwo', second),
    shown: 'Both story pictures with their titles'
      + (['match_character', 'say_alike', 'say_different', 'venn_place'].includes(item.mode) ? ', and each story\'s friends' : '')
      + (item.mode === 'venn_place' ? `, and the detail "${item.vennDetail}"` : '')
      + (item.mode === 'sequence_two' ? ', and the story one event picture' : '') + '.',
    constraints: 'The story text is heard, not printed: read both stories before the first question. The evidence '
      + 'sentences from both stories appear only after credit.',
  };
  if (item.answerKind === 'gesture') facts.choices = item.choiceIds.map(id => choiceLabel(item, id)).join(', ');
  return { objects: [], facts };
}

/** What a checked wrong tap shows (the card's `STORY_BRIDGE_MISSES`). */
export function storyBridgeMiss(item: StoryBridgeItem, choiceId: string): StoryBridgeMiss | undefined {
  if (item.answerKind !== 'gesture' || !choiceId || choiceId === item.correctChoiceId) return undefined;
  switch (item.mode) {
    case 'match_character':
      return item.targetStory.characters.find(c => c.id === choiceId)?.emoji === item.anchor.emoji ? 'same_look' : 'other_character';
    case 'match_setting': return choiceId === 'same' ? 'same_for_different' : 'different_for_same';
    case 'venn_place': return choiceId === 'both' ? 'both_for_one' : item.correctChoiceId === 'both' ? 'one_for_both' : 'other_side';
    case 'sequence_two': {
      const at = item.choiceIds.indexOf(choiceId);
      return at < 0 ? undefined : at < item.choiceIds.indexOf(item.correctChoiceId) ? 'earlier_event' : 'later_event';
    }
    default: return undefined;
  }
}

/** How a tap reads to the tutor and the observer: the choice tapped, never the key. */
export const describeStoryBridgeTap = (item: StoryBridgeItem, choiceId: string) => `Tapped ${choiceLabel(item, choiceId)}.`;

/** What the replay button asks the tutor to say: both stories and the question, never the answer. */
export const hearStoriesRequest = (item: StoryBridgeItem) =>
  `The learner asked to hear both stories again. Read them aloud, then ask again: "${storiesLine(item)}${askFor(item)}" `
  + 'Never say the comparison or which choice is right.';

/** The journey's spoken answers: the reference comparison, or a fact about one friend's story alone. */
export const storyBridgeHarnessAnswers = (item: StoryBridgeItem): { correct: string; plainWrong: string } => ({
  correct: item.comparisonSummary,
  plainWrong: `${item.anchor.name} was in one story.`,
});

/** The journey's taps: the right choice, or another one. */
export const storyBridgeTargets = (item: StoryBridgeItem): { correct: string; wrong: string } => ({
  correct: `choice-${item.correctChoiceId}`,
  wrong: `choice-${item.choiceIds.find(choice => choice !== item.correctChoiceId) ?? item.correctChoiceId}`,
});
