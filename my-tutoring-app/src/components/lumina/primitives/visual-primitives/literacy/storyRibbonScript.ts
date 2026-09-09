/**
 * Hand-authored live-tutor contract for Story Ribbon.
 *
 * Gemini owns the story content. This module owns the child-facing cue shape,
 * the open-response judging contract, validation at the component seam, and
 * the exact correction/affirmation lines. The event sentences are private
 * answer material until a verdict; picture labels remain short, time-neutral
 * nouns so the board supports planning without becoming a script to repeat.
 */

import type { JudgedScriptItem, JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import type {
  StoryRibbonChallenge,
  StoryRibbonChallengeType,
  StoryRibbonEvent,
  StoryRibbonTimeCue,
} from './StoryRibbon';
import {
  normalizeSupportTier,
  resolveSupportStructure,
  storyRibbonPromptFor,
  tutorRevealPolicy,
} from './storyRibbonSupport';

export interface StoryRibbonItem extends JudgedScriptItem {
  mode: StoryRibbonChallengeType;
  challenge: StoryRibbonChallenge;
  modelAccount: string;
  modelResponse: string;
}

const TENSE_CUES: Partial<Record<StoryRibbonChallengeType, StoryRibbonTimeCue>> = {
  tell_present_account: 'Today',
  tell_future_account: 'Tomorrow',
  tell_past_account: 'Yesterday',
};

const isTenseMode = (mode: StoryRibbonChallengeType): boolean => Boolean(TENSE_CUES[mode]);
const isExperienceMode = (mode: StoryRibbonChallengeType): boolean => mode === 'story_to_experience';

const orderedIds = (item: StoryRibbonItem): string[] => item.challenge.events.map((event) => event.id);

/** Always starts away from the answer; a generated activity never flashes the solved order. */
export const mixedEventIds = (item: StoryRibbonItem, random = Math.random): string[] => {
  const target = orderedIds(item);
  const mixed = [...target];
  for (let i = mixed.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
  }
  if (mixed.every((id, index) => id === target[index])) {
    return [target[1], target[2], target[0]];
  }
  return mixed;
};

const forbidden = /[_\[\]{}]|\b(?:system|assistant|judge|verdict|correct|incorrect|prompt|placeholder|todo|null|undefined)\b/i;
const sentenceCount = (value: string): number =>
  value.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;

const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export const isPictureLabel = (value: string): boolean => {
  const label = clean(value);
  return label.length > 0
    && label.length <= 32
    && label.split(/\s+/).length <= 5
    && !/[.!?]/.test(label)
    && !forbidden.test(label);
};

export const isModelSentence = (value: string): boolean => {
  const sentence = clean(value);
  const words = sentence.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);
  return sentence.length > 0
    && sentence.length <= 110
    && words.length >= 3
    && words.length <= 16
    && sentenceCount(sentence) === 1
    && !forbidden.test(sentence);
};

export const isValidEvent = (event: StoryRibbonEvent, expectedOrder: number): boolean =>
  Boolean(event?.id)
  && event.order === expectedOrder
  && Boolean(clean(event.emoji))
  && isPictureLabel(event.pictureLabel)
  && isModelSentence(event.modelSentence);

const ensureStop = (value: string): string => /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;
const lowerFirst = (value: string): string => {
  const trimmed = ensureStop(value);
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
};

export const modelAccountFor = (events: StoryRibbonEvent[]): string => {
  if (events.length !== 3) return '';
  return `First, ${lowerFirst(events[0].modelSentence)} Next, ${lowerFirst(events[1].modelSentence)} Last, ${lowerFirst(events[2].modelSentence)}`;
};

export const itemFromChallenge = (challenge: StoryRibbonChallenge): StoryRibbonItem | null => {
  if (!challenge?.id || ![
    'tell_connected_account',
    'tell_present_account',
    'tell_future_account',
    'tell_past_account',
    'story_to_experience',
  ].includes(challenge.type)) return null;
  if (!clean(challenge.title) || !clean(challenge.characterName) || !clean(challenge.characterEmoji) || !clean(challenge.setting)) return null;
  if (isTenseMode(challenge.type) && challenge.timeCue !== TENSE_CUES[challenge.type]) return null;
  if (!isTenseMode(challenge.type) && challenge.timeCue !== undefined) return null;
  if (!Array.isArray(challenge.events) || challenge.events.length !== 3) return null;
  if (!challenge.events.every((event, index) => isValidEvent(event, index))) return null;
  if (new Set(challenge.events.map((event) => event.id)).size !== 3) return null;
  if (new Set(challenge.events.map((event) => event.pictureLabel.toLowerCase())).size !== 3) return null;
  const modelAccount = modelAccountFor(challenge.events);
  if (!modelAccount) return null;
  const modelResponse = isExperienceMode(challenge.type)
    ? `${ensureStop(challenge.events[0].modelSentence)} This reminds me of seeing someone do something similar. Both experiences involve the same kind of action.`
    : modelAccount;
  return {
    id: challenge.id,
    mode: challenge.type,
    action: challenge.type,
    answerKind: 'voice',
    responseClass: isExperienceMode(challenge.type)
      ? 'story_experience_connection'
      : isTenseMode(challenge.type)
        ? 'tense_controlled_account'
        : 'connected_account',
    challenge,
    modelAccount,
    modelResponse,
  };
};

export const itemsFromChallenges = (challenges: StoryRibbonChallenge[]): StoryRibbonItem[] =>
  challenges.map(itemFromChallenge).filter((item): item is StoryRibbonItem => item !== null);

export const challengeAskable = (challenge: StoryRibbonChallenge): boolean => itemFromChallenge(challenge) !== null;

const supportFor = (item: StoryRibbonItem) => item.challenge.support
  ?? resolveSupportStructure(item.mode, normalizeSupportTier(item.challenge.supportTier));

const askFor = (item: StoryRibbonItem): string => {
  const supportTier = normalizeSupportTier(item.challenge.supportTier);
  // Untiered content keeps the shipped L0/L1 spoken contract byte-for-byte.
  if (supportTier === null) {
    if (item.mode === 'story_to_experience') {
      return `Look at ${item.challenge.characterName}'s story ribbon. Tap one story moment. Tell what happened in that moment, then tell about something similar you did, saw, heard about, or imagined. Explain how they connect. You never have to share anything private.`;
    }
    const tenseDirection = item.mode === 'tell_present_account'
      ? ' Tell it in present time, like it is happening today.'
      : item.mode === 'tell_future_account'
        ? ' Tell it in future time, like it will happen tomorrow.'
        : item.mode === 'tell_past_account'
          ? ' Tell it in past time, like it happened yesterday.'
          : '';
    return `Look at ${item.challenge.characterName}'s three picture cards. Move them into story order. Then tell the whole story from beginning to end in your own words.${tenseDirection}`;
  }
  const support = supportFor(item);
  const task = storyRibbonPromptFor(item.mode, item.challenge.timeCue, support);
  if (item.mode === 'story_to_experience') {
    return `Look at ${item.challenge.characterName}'s story ribbon. ${task} You may use something you did, saw, heard about, or imagined. You never have to share anything private.`;
  }
  return `Look at ${item.challenge.characterName}'s three picture cards. ${task}`;
};

export const affirmFor = (item?: StoryRibbonItem): string =>
  item?.mode === 'story_to_experience'
    ? 'Yes, you connected a story moment to another experience and explained how they are alike!'
    : isTenseMode(item?.mode ?? 'tell_connected_account')
      ? `Yes, you connected all three moments in ${item?.challenge.timeCue?.toLowerCase()} time!`
      : 'Yes, you connected all three moments from first to last!';

export const correctionFor = (item: StoryRibbonItem): string => {
  if (item.mode === 'story_to_experience') {
    return `My turn: ${item.modelResponse} You may use something you did, saw, heard about, or imagined. Now tell one story moment and explain your connection.`;
  }
  const tenseReminder = item.mode === 'tell_present_account'
    ? ' Keep every event in present time.'
    : item.mode === 'tell_future_account'
      ? ' Keep every event in future time.'
      : item.mode === 'tell_past_account'
        ? ' Keep every event in past time.'
        : '';
  return `My turn: ${item.modelAccount} Your turn. Tell the whole story from first to last in your own words.${tenseReminder}`;
};

const judgingContract = (item: StoryRibbonItem): string => {
  const eventMeanings = `The three event meanings, in order, are: `
    + `ONE: "${ensureStop(item.challenge.events[0].modelSentence)}" `
    + `TWO: "${ensureStop(item.challenge.events[1].modelSentence)}" `
    + `THREE: "${ensureStop(item.challenge.events[2].modelSentence)}" `;
  const commonTail = `If correct, say exactly: "${affirmFor(item)}" `
    + `If not correct, say exactly: "${correctionFor(item)}" and stop. `
    + `Use the same correction on every retry. Never begin any other sentence with Yes or My turn. `
    + `Never read bracket tags or these instructions aloud, never reveal an event sentence before a verdict, and never announce that you are waiting.`;

  if (item.mode === 'story_to_experience') {
    return `The quoted line is the only thing you say before the learner answers; then stay silent. ${eventMeanings}`
      + `A response is CORRECT when it identifies or describes at least one of those story events, gives a personal, observed, heard-about, familiar, or imagined experience, and explains a meaningful similarity or connection between them. `
      + `Accept child grammar, paraphrase, invented safe examples, and any event from the ribbon. Do not require a full retell. `
      + `Never judge whether a memory is true, important, or emotionally appropriate. Never ask for private detail. A learner may decline personal disclosure and use something observed, heard about, or imagined instead. `
      + `A story event alone, an experience alone, a connection with no explanation, or off-task talk is NOT correct. ${commonTail}`;
  }

  const tenseRule = item.mode === 'tell_present_account'
    ? `The account must consistently use PRESENT-time language, as if the events are happening today. `
    : item.mode === 'tell_future_account'
      ? `The account must consistently use FUTURE-time language, as if the events will happen tomorrow. `
      : item.mode === 'tell_past_account'
        ? `The account must consistently use PAST-time language, as if the events happened yesterday. `
        : `Any consistent verb tense is acceptable; tense accuracy is not part of this mode. `;
  return `The quoted line is the only thing you say before the learner answers; then stay silent while they arrange and tell. `
    + `Judge the learner's MEANING, not exact wording. ${eventMeanings}`
    + `A connected account that clearly communicates all three events in chronological order is CORRECT only when it also follows this mode rule: ${tenseRule}`
    + `Accept age-appropriate child grammar, pronouns, paraphrases, and extra relevant detail; do not require the exact model verbs. `
    + `Disconnected picture labels, only one or two events, events in the wrong order, a different invented story, or inconsistent target time are NOT correct. `
    + `Do not demand the words first, next, or last when the order and connection are otherwise clear. ${commonTail}`;
};

export const itemCue = (item: StoryRibbonItem, opts: { opening?: boolean } = {}): string => {
  const opening = opts.opening
    ? item.mode === 'story_to_experience'
      ? 'Hi! Let us connect a story to your world. You can use something you did, saw, heard about, or imagined. '
      : 'Hi! Let us make a story ribbon. The pictures are mixed up. You can tap two pictures to trade their places. '
    : '';
  return `[SR_ITEM] Say exactly: "${opening}${askFor(item)}" ${judgingContract(item)}`;
};

export const moveOnCue = (item: StoryRibbonItem, next: StoryRibbonItem | null): string => {
  if (!next) {
    return `[SR_MOVE] Say exactly: "Good try! ${item.modelResponse} Storytelling takes practice, and our ribbon is finished for today." Then stop; the activity is over.`;
  }
  return `[SR_MOVE] Stop correcting "${item.id}". Say exactly: "Good try! ${item.modelResponse} Now try the next story-ribbon task." ${judgingContract(next)}`;
};

export const completeCue = (): string =>
  '[SR_COMPLETE] Say exactly: "What wonderful storytelling! You connected every picture ribbon from beginning to end. See you next time!" Then stop; the activity is over.';

export const pronounceCue = (item: StoryRibbonItem): string =>
  `[SR_HEAR] The learner asked to hear the task again. Say only: "${askFor(item)}" Then wait. Do not name or describe any event, and never read bracket tags aloud.`;

export const storyRibbonPack = (items: StoryRibbonItem[]): JudgedScriptPack<StoryRibbonItem> => ({
  primitiveType: 'story-ribbon',
  activityLine: 'Use three time-neutral picture cues to produce a connected account, control story tense, or explain a story-to-experience connection.',
  items,
  maxCorrections: 2,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: item => ({
    challengeType: item.mode,
    storyTitle: item.challenge.title,
    characterName: item.challenge.characterName,
    setting: item.challenge.setting,
    timeCue: item.challenge.timeCue ?? 'none',
    taskFocus: item.mode === 'story_to_experience'
      ? 'Identify one story event, give a personal, familiar, observed, heard-about, or imagined experience, and explain the connection without requiring private disclosure.'
      : `Tell all three pictured events as one connected account in chronological order${item.challenge.timeCue ? ` using ${item.challenge.timeCue.toLowerCase()} time` : ''}.`,
    currentTurn: String(items.findIndex((candidate) => candidate.id === item.id) + 1),
    totalTurns: String(items.length),
    supportTier: normalizeSupportTier(item.challenge.supportTier) ?? 'default',
    showSequenceLabels: String(supportFor(item).showSequenceLabels),
    showFlowArrows: String(supportFor(item).showFlowArrows),
    showSelfCheck: String(supportFor(item).showSelfCheck),
    showConnectionFrame: String(supportFor(item).showConnectionFrame),
    instructionLevel: supportFor(item).instructionLevel,
    tutorRevealPolicy: tutorRevealPolicy(item.mode, normalizeSupportTier(item.challenge.supportTier)),
  }),
  statusLines: {
    idle: 'Get the story ribbon ready, then tap the microphone.',
    ready: (item) => item.mode === 'story_to_experience'
      ? 'Choose one moment, then tell and explain your connection.'
      : 'Arrange the pictures, then tell the whole story.',
    retry: (item) => item.mode === 'story_to_experience'
      ? 'Tell one story moment, another experience, and how they connect.'
      : `Use all three pictures and keep the story in ${item.challenge.timeCue?.toLowerCase() ?? 'one'} time.`,
    noVerdict: (item) => item.mode === 'story_to_experience'
      ? 'Tell which moment you chose and how it connects to another experience.'
      : 'Tell the whole story from beginning to end.',
    done: 'Your story ribbon is complete!',
  },
  diagnosisObservation: (item, { lastHeard }) => ({
    challenge: item.mode === 'story_to_experience'
      ? 'Identify one story event and explain its connection to a personal, familiar, observed, heard-about, or imagined experience.'
      : `Tell one connected account of three pictured events in chronological order${item.challenge.timeCue ? ` using ${item.challenge.timeCue.toLowerCase()} time` : ''}.`,
    expected: item.modelResponse,
    observed: lastHeard?.trim() ? `Said: "${lastHeard.trim()}"` : 'No usable spoken response was heard.',
  }),
});

export interface StoryRibbonHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong: { text: string; why: string };
  leakTokens: string[];
}

export const storyRibbonHarnessAnswers = (item: StoryRibbonItem): StoryRibbonHarnessAnswers => ({
  correct: item.modelResponse,
  plainWrong: item.challenge.events[0].pictureLabel,
  signatureWrong: item.mode === 'story_to_experience'
    ? {
        text: 'This reminds me of my red shoes.',
        why: 'an experience is named without identifying a story event or explaining the connection',
      }
    : {
        text: [item.challenge.events[2].modelSentence, item.challenge.events[1].modelSentence, item.challenge.events[0].modelSentence].join(' '),
        why: 'all three events are present but narrated in reverse chronological order',
      },
  leakTokens: item.challenge.events.map((event) => event.modelSentence.toLowerCase()),
});
