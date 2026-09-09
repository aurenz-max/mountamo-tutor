/** Hand-authored judged-loop contract for Story Bridge. */

import type { JudgedScriptItem, JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type {
  StoryBridgeChallenge, StoryBridgeChallengeType, StoryBridgeCharacter,
  StoryBridgeStory, StoryBridgeVennRegion,
} from './StoryBridge';

export { opensWithSentinel };

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

export interface StoryBridgeItem extends JudgedScriptItem {
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

export const storiesLine = (item: StoryBridgeItem): string => {
  const [first, second] = item.storyA.id < item.storyB.id ? [item.storyA, item.storyB] : [item.storyB, item.storyA];
  return `Story one, ${first.title}: ${storyText(first)} Story two, ${second.title}: ${storyText(second)} `;
};

export const howToPlayFor = (item: StoryBridgeItem): string => {
  switch (item.mode) {
    case 'match_character': return 'I name a friend from one story, and you tap the friend in the other story who acted alike! ';
    case 'match_setting': return 'Look at both story pictures and decide if the places are the same kind or different! ';
    case 'say_alike': return 'I name one friend from each story, and you tell one way they are alike! ';
    case 'say_different': return 'I name one friend from each story, and you tell one way they are different! ';
    case 'venn_place': return 'Put each detail in our picture Venn diagram: story one, both stories, or story two! ';
    case 'sequence_two': return 'Match what happened at the same part of each story! ';
    case 'main_idea_compare': return 'Tell how the big ideas in both stories are alike or different! ';
  }
};

export const askFor = (item: StoryBridgeItem): string => {
  switch (item.mode) {
    case 'match_character':
      return `Think about ${item.anchor.name} in ${item.anchorStory.title}. Find the friend in ${item.targetStory.title} who is like ${item.anchor.name}. Your turn. Tap that friend.`;
    case 'match_setting':
      return `Think about the places in ${item.storyA.title} and ${item.storyB.title}. Are they the same kind of place or different kinds? Your turn. Tap same or different.`;
    case 'say_alike':
      return `Think about ${item.anchor.name} in ${item.anchorStory.title} and ${item.target.name} in ${item.targetStory.title}. Your turn. Tell one way they are alike.`;
    case 'say_different':
      return `Think about ${item.anchor.name} in ${item.anchorStory.title} and ${item.target.name} in ${item.targetStory.title}. Your turn. Tell one way they are different.`;
    case 'venn_place':
      return `Compare ${item.anchor.name} and ${item.target.name}. The detail is: ${item.vennDetail}. Does it belong to ${item.anchor.name} only, both friends, or ${item.target.name} only? Your turn. Tap its circle.`;
    case 'sequence_two':
      return `In ${item.storyA.title}, ${item.anchor.sentence} That is a ${ordinal(item.eventIndex)} event. Find the ${ordinal(item.eventIndex)} event from ${item.storyB.title}. Your turn. Tap its picture.`;
    case 'main_idea_compare':
      return `Think about the big ideas in ${item.storyA.title} and ${item.storyB.title}. Your turn. Tell one way the big ideas are alike or different.`;
  }
};

export const affirmFor = (item: StoryBridgeItem): string => {
  const evidence = evidenceFor(item);
  return `Yes! ${evidence.summary} ${evidence.storyA} ${evidence.storyB}`;
};

export const correctionFor = (item: StoryBridgeItem): string => {
  if (item.mode === 'match_character') {
    return `My turn: in ${item.anchorStory.title}, ${item.anchor.sentence} `
      + `One friend in ${item.targetStory.title} did the same — both ${item.sharedBehavior}. `
      + `Your turn. Tap that friend.`;
  }
  const evidence = evidenceFor(item);
  return `My turn: listen to evidence from both stories. ${evidence.storyA} ${evidence.storyB} ${evidence.summary} Your turn. ${askFor(item)}`;
};

const voiceContract = (item: StoryBridgeItem): string => {
  const evidence = evidenceFor(item);
  const taskRule = item.mode === 'say_alike'
    ? `Accept ANY short comparison that is true of both characters, not only the reference wording. The reference comparison is: "${item.comparisonSummary}". `
    : item.mode === 'say_different'
      ? `Accept ANY short contrast that truthfully distinguishes the two characters, not only the reference wording. The reference contrast is: "${item.comparisonSummary}". `
      : `Accept ANY defensible comparison of the two main ideas, whether it names an accurate similarity or an accurate difference. The reference comparison is: "${item.comparisonSummary}". `;
  return `The quoted line is the ONLY thing you say on this turn; then stay silent while the learner answers. `
    + `This is a concept comparison, so judge meaning and age-appropriate paraphrases, not exact words. ${taskRule}`
    + `The two evidence references are: Story one — "${evidence.storyA}" Story two — "${evidence.storyB}" `
    + `A response must make a relationship across BOTH stories. A detail about only one story is INCOMPLETE and wrong. `
    + `Do not require the story titles, character names, full sentences, or advanced reading words. `
    + `If the comparison is defensible from both texts, say exactly: "${affirmFor(item)}" `
    + `Otherwise say exactly: "${correctionFor(item)}" and stop so the learner can try again. `
    + `Never begin any other sentence with Yes or My turn. Never read bracket tags aloud and never announce the activity state.`;
};

const tapContract = (item: StoryBridgeItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers by TAPPING a picture choice, not by speaking, so stay completely silent. `
  + `Do not judge anything heard through the microphone. Never reveal the correct choice, the hidden comparison, or a screen position. `
  + `You will receive a separate [SB_TAP] message with the exact verdict line. Never read bracket tags aloud or announce the activity state.`;

export interface StoryBridgeCueOptions { opening?: boolean; howToPlay?: boolean }

export const itemCue = (item: StoryBridgeItem, opts: StoryBridgeCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Story time — two stories today! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  const stories = item.introducesStories ? storiesLine(item) : '';
  const contract = item.answerKind === 'gesture' ? tapContract(item) : voiceContract(item);
  return `[SB_ITEM] Say exactly: "${greeting}${how}${stories}${askFor(item)}" ${contract} Never read bracket tags or these instructions aloud.`;
};

const choiceLabel = (item: StoryBridgeItem, choiceId: string): string => {
  if (choiceId === 'same') return 'same kind';
  if (choiceId === 'different') return 'different';
  if (choiceId === 'story_a') return `${item.anchor.name} only`;
  if (choiceId === 'both') return 'both friends';
  if (choiceId === 'story_b') return `${item.target.name} only`;
  return [...item.storyA.characters, ...item.storyB.characters].find((character) => character.id === choiceId)?.name ?? 'a picture';
};

export const tapVerdictCue = (item: StoryBridgeItem, tapped: string | StoryBridgeCharacter): string => {
  const choiceId = typeof tapped === 'string' ? tapped : tapped.id;
  const matches = choiceId === item.correctChoiceId;
  return `[SB_TAP] The learner tapped ${choiceLabel(item, choiceId)}; the correct choice is ${choiceLabel(item, item.correctChoiceId)} — that ${matches ? 'MATCHES' : 'does NOT match'}. `
    + (matches ? `Say exactly: "${affirmFor(item)}" ` : `Say exactly: "${correctionFor(item)}" `)
    + `Say nothing else, and never read bracket tags aloud.`;
};

export const moveOnCue = (item: StoryBridgeItem, next: StoryBridgeItem | null, opts: StoryBridgeCueOptions = {}): string => {
  const closeLine = item.mode === 'match_character'
    ? `${item.anchor.name} and ${item.target.name} are alike — both ${item.sharedBehavior}. `
    : `${evidenceFor(item).summary} `;
  if (!next) return `[SB_MOVE] Say exactly: "Good try! ${closeLine}We will compare stories together again soon." Then stop — the activity is over.`;
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  const stories = next.introducesStories ? storiesLine(next) : '';
  const contract = next.answerKind === 'gesture' ? tapContract(next) : voiceContract(next);
  return `[SB_MOVE] Stop correcting "${item.id}". Say exactly: "Good try! ${closeLine}${how}${stories}${askFor(next)}" ${contract} Never read bracket tags aloud.`;
};

export const completeCue = (): string =>
  `[SB_COMPLETE] Say exactly: "What great story work! You compared ideas from both stories. See you next time!" Then stop — the activity is over.`;

export const pronounceCue = (item: StoryBridgeItem): string =>
  `[SB_HEAR] The learner tapped to hear the stories again. Say ONLY this, warmly, then wait: "${storiesLine(item)}${askFor(item)}" `
  + `Do not treat anything just heard as an answer, add nothing, and never reveal the comparison. Never read bracket tags aloud.`;

export interface StoryBridgeHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  tapped?: { correct: string; wrong: string };
  leakTokens: string[];
  leakExemptSpan?: string | string[];
}

export const storyBridgeHarnessAnswers = (item: StoryBridgeItem): StoryBridgeHarnessAnswers => {
  if (item.answerKind === 'gesture') {
    const wrong = item.choiceIds.find((choice) => choice !== item.correctChoiceId) ?? item.correctChoiceId;
    return {
      correct: `tapped ${choiceLabel(item, item.correctChoiceId)}`,
      plainWrong: `tapped ${choiceLabel(item, wrong)}`,
      tapped: { correct: item.correctChoiceId, wrong },
      leakTokens: [item.comparisonSummary.toLowerCase()].filter(Boolean),
      leakExemptSpan: item.introducesStories ? storiesLine(item).trim() : undefined,
    };
  }
  return {
    correct: item.comparisonSummary,
    plainWrong: `${item.anchor.name} was in one story.`,
    signatureWrong: { text: `${item.anchor.name} ${item.anchor.uniqueDetail}.`, why: 'references only one text, so the comparison is incomplete' },
    leakTokens: [item.comparisonSummary.toLowerCase()],
    leakExemptSpan: item.introducesStories ? storiesLine(item).trim() : undefined,
  };
};

export const storyBridgePack = (
  items: StoryBridgeItem[], getLastTap: () => string | StoryBridgeCharacter | null = () => null,
): JudgedScriptPack<StoryBridgeItem> => ({
  primitiveType: 'story-bridge',
  activityLine: 'Two illustrated read-aloud stories stay in one context while the child compares characters, settings, main ideas, and event sequences using taps or speech.',
  items,
  maxCorrections: 2,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.mode,
    anchorName: item.anchor.name,
    anchorStory: item.storyA.title,
    targetStory: item.storyB.title,
    farShore: item.choiceIds.map((choice) => choiceLabel(item, choice)).join(', '),
    taskFocus: askFor(item),
    evidenceA: evidenceFor(item).storyA,
    evidenceB: evidenceFor(item).storyB,
    currentTurn: String(items.findIndex((candidate) => candidate.id === item.id) + 1),
    totalTurns: String(items.length),
  }),
  statusLines: {
    idle: 'Tap the microphone to hear two stories.',
    ready: (item) => item.answerKind === 'voice' ? 'Use both stories, then say your comparison.' : 'Use both stories, then tap your comparison.',
    retry: (item) => item.answerKind === 'voice' ? 'Try again — say something true across both stories.' : 'Listen again — then tap your comparison.',
    noVerdict: (item) => item.answerKind === 'voice' ? 'Say one comparison using both stories.' : 'Tap one picture choice.',
    done: 'Great story work today!',
  },
  diagnosisObservation: (item, { lastHeard }) => {
    const rawTap = getLastTap();
    const tapId = typeof rawTap === 'string' ? rawTap : rawTap?.id ?? '';
    if (item.mode === 'match_character') {
      return {
        challenge: `Hear two stories, then: ${askFor(item)}`,
        expected: `${item.target.name} tapped — both ${item.sharedBehavior}.`,
        observed: `Tapped ${choiceLabel(item, tapId)}.`,
      };
    }
    return {
      challenge: askFor(item),
      expected: evidenceFor(item).summary,
      observed: item.answerKind === 'gesture'
        ? `Tapped ${choiceLabel(item, tapId)}.`
        : lastHeard?.trim() ? `Said "${lastHeard.trim()}".` : 'Gave no complete comparison across both texts.',
    };
  },
});
