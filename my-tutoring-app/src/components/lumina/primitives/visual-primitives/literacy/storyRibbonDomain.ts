/**
 * story-ribbon's domain: the items and their gates, the ask, the spoken key, the known misses, the scene and the
 * harness answers. Pure. The boss (`storyRibbon.boss.ts`), the component and the generator read it; the tutor teaches
 * in its own words, so nothing here writes a cue, a correction or a judging contract (those went with the scripted
 * runner, 2026-10-19).
 *
 * Gemini owns the story content. The event sentences are private answer material until a verdict; picture labels stay
 * short, time-neutral nouns so the board supports planning without becoming a script to read back. Arranging the cards
 * is a planning aid and is never graded: only the spoken account is judged.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { StoryRibbonChallenge, StoryRibbonChallengeType, StoryRibbonEvent, StoryRibbonTimeCue } from './StoryRibbon';
import { STORY_RIBBON_MISSES, type SpokenStoryRibbonMiss } from './storyRibbon.card';
import { normalizeSupportTier, resolveSupportStructure, storyRibbonPromptFor, tutorRevealPolicy } from './storyRibbonSupport';

export interface StoryRibbonItem {
  id: string;
  mode: StoryRibbonChallengeType;
  responseClass: 'connected_account' | 'tense_controlled_account' | 'story_experience_connection';
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

export const askFor = (item: StoryRibbonItem): string => {
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

const TENSE: Record<string, string> = {
  tell_present_account: 'present time, as if it is happening today',
  tell_future_account: 'future time, as if it will happen tomorrow',
  tell_past_account: 'past time, as if it happened yesterday',
};

const eventsInOrder = (item: StoryRibbonItem) => {
  const [one, two, three] = item.challenge.events.map(e => ensureStop(e.modelSentence));
  return `1) ${one} 2) ${two} 3) ${three}`;
};

/**
 * The item's key, judged on meaning: the model account (or the model connection) is an example, never the required
 * words. The tense modes add the time; story to experience never judges whether a memory is true.
 */
export function storyRibbonKey(item: StoryRibbonItem): SpokenKey {
  if (item.mode === 'story_to_experience') {
    return {
      answer: item.modelResponse, alsoAccept: [],
      meaning: {
        idea: `One of these story events (${eventsInOrder(item)}), another experience the learner did, saw, heard about `
          + 'or imagined, and how the two connect.',
        notIt: 'an event alone, an experience alone, or a connection with no reason',
      },
      acceptRule: 'Accept any one event, child grammar, and a safe invented example. Never ask for private detail, and '
        + 'never judge whether a memory is true.',
    };
  }
  const time = TENSE[item.mode];
  return {
    answer: item.modelAccount, alsoAccept: [],
    meaning: {
      idea: `These three events told as one story in this order: ${eventsInOrder(item)}`
        + (time ? ` Every event is told in ${time}.` : ''),
      notIt: 'picture labels listed without a story, one or two events, the wrong order, or a different story'
        + (time ? `, or a story that leaves ${time.split(',')[0]}` : ''),
    },
    acceptRule: `Accept child grammar and the learner's own words; "first, next, last" is not required`
      + (time ? '.' : ', and any consistent tense.'),
  };
}

/** An item's known wrong accounts, in precedence order, for the `spoken_miss` observer. Concrete per item. */
export function storyRibbonSpokenMisses(item: StoryRibbonItem): KnownMiss[] {
  const events = item.challenge.events;
  const said = events.map(e => ensureStop(e.modelSentence).replace(/\.$/, ''));
  const labels = events.map(e => e.pictureLabel);
  const pattern: Record<SpokenStoryRibbonMiss, () => KnownMiss> = {
    labels_listed: () => ({ id: 'labels_listed', pattern: `The learner names the pictures (${labels.join(', ')}) as a list, with no story told about them.`,
      examples: [labels.join(', ')] }),
    events_missing: () => ({ id: 'events_missing', pattern: 'The learner tells one or two of the three events and stops, leaving an event out.',
      examples: [`${said[0]}. ${said[1]}.`] }),
    out_of_order: () => ({ id: 'out_of_order', pattern: 'The learner tells all three events, but not in the story\'s order.',
      examples: [`${said[2]}. ${said[0]}. ${said[1]}.`] }),
    tense_drift: () => ({ id: 'tense_drift', pattern: `The learner tells the three events in order, but not all in ${TENSE[item.mode] ?? 'the item\'s time'}.` }),
    event_only: () => ({ id: 'event_only', pattern: 'The learner tells a story moment and gives no other experience.',
      examples: [`${said[0]}.`] }),
    no_connection: () => ({ id: 'no_connection', pattern: 'The learner gives a story moment and another experience, but never says how the two are alike.' }),
  };
  return STORY_RIBBON_MISSES[item.mode].map(id => pattern[id]());
}

export function storyRibbonScene(item: StoryRibbonItem): WorkspaceScene {
  const tier = normalizeSupportTier(item.challenge.supportTier);
  const c = item.challenge;
  return { objects: [], facts: {
    story: `${c.title}: ${c.characterName} ${c.characterEmoji}, ${c.setting}`,
    // Alphabetical, so the list never gives the story order.
    pictures: c.events.map(e => e.pictureLabel).sort((a, b) => a.localeCompare(b)).join('; '),
    ...(c.timeCue ? { timeCue: c.timeCue } : {}),
    revealPolicy: tutorRevealPolicy(item.mode, tier),
    constraints: item.mode === 'story_to_experience'
      ? 'The learner taps one picture to choose a moment, then tells the connection out loud. The tap is not graded.'
      : 'The picture cards start mixed up; the learner may tap two to swap them. Only the spoken story is judged, never the card order.',
  } };
}

/** What "Hear the directions again" asks the tutor to say: the directions only, never an event. */
export const hearDirectionsRequest = (item: StoryRibbonItem) =>
  `The learner asked to hear the directions again. Say only this, once: "${askFor(item)}" Do not name or describe any event.`;

/** The journey's answers: the model account, or one picture label said alone. */
export const storyRibbonHarnessAnswers = (item: StoryRibbonItem): { correct: string; plainWrong: string } => ({
  correct: item.modelResponse,
  plainWrong: item.challenge.events[0].pictureLabel,
});
