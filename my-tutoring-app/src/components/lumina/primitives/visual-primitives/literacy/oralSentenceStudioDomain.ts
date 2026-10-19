/**
 * oral-sentence-studio's domain: the items and their gates, the ask, the spoken key, the known misses, the scene and
 * the harness answers. Pure. The boss (`oralSentenceStudio.boss.ts`), the component and the generator read it; the
 * tutor teaches in its own words, so nothing here writes a cue, a correction or a judging contract (those went with
 * the scripted runner, 2026-10-19).
 *
 * Gemini owns the scene and vocabulary content. This module owns the semantic boundary: the child must say one
 * complete, task-relevant sentence and use both visible vocabulary words meaningfully. The three example sentences
 * are judging anchors in the key, never a script displayed or spoken before credit.
 */

import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type {
  OralSentenceStudioChallenge,
  OralSentenceStudioChallengeType,
} from './OralSentenceStudio';
import { ORAL_SENTENCE_MISSES, type SpokenOralSentenceMiss } from './oralSentenceStudio.card';

export const ORAL_SENTENCE_STUDIO_CHALLENGE_TYPES: readonly OralSentenceStudioChallengeType[] = [
  'describe_scene',
  'guided_writing_rehearsal',
  'use_story_words',
];

/** Order words a guided-writing step sentence may carry. `first` is excluded:
 * the rehearsal step always follows a step the class already wrote. */
export const REHEARSAL_ORDER_WORDS = ['next', 'then', 'last', 'finally'] as const;

export interface OralSentenceStudioItem {
  id: string;
  mode: OralSentenceStudioChallengeType;
  challenge: OralSentenceStudioChallenge;
  modelResponse: string;
}

const forbidden = /["\r\n_[\]{}]|\b(?:system|assistant|judge|verdict|correct|incorrect|prompt|placeholder|todo|null|undefined)\b/i;
const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const tokens = (value: string): string[] => value.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? [];
const sentenceCount = (value: string): number =>
  value.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;

export const isStudioLabel = (value: string): boolean => {
  const label = clean(value);
  const count = tokens(label).length;
  return label.length > 0
    && label.length <= 42
    && count >= 1
    && count <= 6
    && !/[.!?]/.test(label)
    && !forbidden.test(label);
};

export const isVocabularyWord = (value: string): boolean =>
  /^[a-z]+(?:-[a-z]+)?$/i.test(clean(value)) && clean(value).length <= 18;

export const isChildSentence = (value: string): boolean => {
  const sentence = clean(value);
  const count = tokens(sentence).length;
  return sentence.length >= 8
    && sentence.length <= 140
    && count >= 3
    && count <= 20
    && sentenceCount(sentence) === 1
    && /[.!?]$/.test(sentence)
    && !forbidden.test(sentence);
};

const containsWord = (sentence: string, word: string): boolean =>
  tokens(sentence).includes(word.toLowerCase());

const sentenceUsesVocabulary = (sentence: string, words: readonly string[]): boolean =>
  words.every((word) => containsWord(sentence, word));

const sceneEventTokensFor = (challenge: OralSentenceStudioChallenge): Set<string> => {
  const raw = [challenge.actorLabel, challenge.actionLabel, challenge.objectLabel].flatMap(tokens);
  const weak = new Set(['a', 'an', 'the', 'in', 'on', 'at', 'to', 'with', 'and', 'is']);
  return new Set(raw.filter((token) => !weak.has(token)));
};

const sentenceNamesScene = (sentence: string, challenge: OralSentenceStudioChallenge): boolean => {
  const seen = new Set(tokens(sentence));
  // A setting-only sentence (for example, a memorized rule about libraries)
  // is not a description of the pictured event. Require at least one concrete
  // actor/action/object anchor; the two required vocabulary words and live
  // tutor then establish full semantic relevance without rejecting pronouns.
  return Array.from(sceneEventTokensFor(challenge)).some((token) => seen.has(token));
};

const storySentences = (story: string): string[] =>
  clean(story).split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);

/** Token overlap ratio used to call a sentence a copy of a story sentence. */
const overlap = (left: string, right: string): number => {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  const union = new Set(Array.from(a).concat(Array.from(b)));
  const shared = Array.from(a).filter((token) => b.has(token)).length;
  return union.size ? shared / union.size : 0;
};

/** A story-words answer must be the child's own sentence, not a story line
 * said back. Shared by generator validation and the harness answers. */
export const copiesStorySentence = (sentence: string, story: string): boolean =>
  storySentences(story).some((line) => overlap(sentence, line) >= 0.7);

const isStoryText = (story: string, words: readonly string[]): boolean => {
  const lines = storySentences(story);
  return lines.length >= 2
    && lines.length <= 3
    && lines.every(isChildSentence)
    && tokens(story).length <= 45
    && words.every((word) => containsWord(story, word));
};

export const challengeAskable = (challenge: OralSentenceStudioChallenge): boolean => {
  if (!challenge?.id || !ORAL_SENTENCE_STUDIO_CHALLENGE_TYPES.includes(challenge.type)) return false;
  if (!isStudioLabel(challenge.sceneTitle)
    || !isStudioLabel(challenge.actorLabel)
    || !isStudioLabel(challenge.actionLabel)
    || !isStudioLabel(challenge.objectLabel)
    || !isStudioLabel(challenge.settingLabel)) return false;
  if (![challenge.actorEmoji, challenge.actionEmoji, challenge.objectEmoji, challenge.settingEmoji]
    .every((value) => clean(value).length > 0 && clean(value).length <= 16 && !forbidden.test(value))) return false;
  if (!Array.isArray(challenge.targetWords)
    || challenge.targetWords.length !== 2
    || !challenge.targetWords.every(isVocabularyWord)
    || new Set(challenge.targetWords.map((word) => word.toLowerCase())).size !== 2) return false;
  if (!Array.isArray(challenge.wordMeanings)
    || challenge.wordMeanings.length !== 2
    || !challenge.wordMeanings.every((meaning) => isStudioLabel(meaning) && tokens(meaning).length >= 2)) return false;
  if (!isChildSentence(challenge.sceneMeaning) || !sentenceNamesScene(challenge.sceneMeaning, challenge)) return false;
  if (!Array.isArray(challenge.acceptedSentences)
    || challenge.acceptedSentences.length !== 3
    || new Set(challenge.acceptedSentences.map((sentence) => sentence.toLowerCase())).size !== 3) return false;
  if (!challenge.acceptedSentences.every((sentence) =>
    isChildSentence(sentence) && sentenceUsesVocabulary(sentence, challenge.targetWords))) return false;

  if (challenge.type === 'use_story_words') {
    // The child may talk about the story or about anything else, so the
    // anchors need not name the picture, but none may be a story line.
    if (challenge.priorStepLabel) return false;
    const story = clean(challenge.storyText);
    return isStoryText(story, challenge.targetWords)
      && challenge.acceptedSentences.every((sentence) => !copiesStorySentence(sentence, story));
  }
  if (challenge.storyText) return false;
  if (!challenge.acceptedSentences.every((sentence) => sentenceNamesScene(sentence, challenge))) return false;
  if (challenge.type === 'guided_writing_rehearsal') {
    return isStudioLabel(clean(challenge.priorStepLabel))
      && (REHEARSAL_ORDER_WORDS as readonly string[]).includes(challenge.targetWords[0].toLowerCase());
  }
  return !challenge.priorStepLabel;
};

export const itemFromChallenge = (
  challenge: OralSentenceStudioChallenge,
): OralSentenceStudioItem | null => challengeAskable(challenge) ? {
  id: challenge.id,
  mode: challenge.type,
  challenge,
  modelResponse: challenge.acceptedSentences[0],
} : null;

export const itemsFromChallenges = (
  challenges: OralSentenceStudioChallenge[],
): OralSentenceStudioItem[] => challenges
  .map(itemFromChallenge)
  .filter((item): item is OralSentenceStudioItem => item !== null);

export const askFor = (item: OralSentenceStudioItem): string => {
  const [first, second] = item.challenge.targetWords;
  const [firstMeaning, secondMeaning] = item.challenge.wordMeanings;
  const words = `${first}, meaning ${firstMeaning}, and ${second}, meaning ${secondMeaning}`;
  if (item.mode === 'use_story_words') {
    return `Listen to this little story. ${clean(item.challenge.storyText)} Now make a new sentence of your own with both story words: ${words}. It can be about the story or about something else. Do not say a sentence from the story.`;
  }
  if (item.mode === 'guided_writing_rehearsal') {
    return `We are getting ready to write ${item.challenge.sceneTitle}. We already wrote about ${item.challenge.priorStepLabel}. Look at the picture of the step that comes now. Say the sentence we will write for this step. Use both words: ${words}.`;
  }
  return `Look closely at the picture. Make one whole sentence about what is happening. Use both new words: ${words}. Say the sentence in your own way.`;
};


const quotedWords = (c: OralSentenceStudioChallenge): string =>
  `"${c.targetWords[0]}" (${c.wordMeanings[0]}) and "${c.targetWords[1]}" (${c.wordMeanings[1]})`;

const NOT_A_SENTENCE = 'a fragment, the two words listed, a definition, or a sentence that leaves out either word or '
  + 'uses one with a meaning it does not have here';

const ACCEPT = 'Accept paraphrase, pronouns, changed word order, word forms such as observe, observes and observed, '
  + 'extra detail and child grammar.';

/**
 * The item's key, judged on meaning: the three generated sentences are examples, never the required words. Each mode
 * says what the sentence must be about; every mode refuses a fragment, a word list and a misused word.
 */
export function oralSentenceKey(item: OralSentenceStudioItem): SpokenKey {
  const c = item.challenge;
  const [answer, ...alsoAccept] = c.acceptedSentences;
  if (item.mode === 'use_story_words') {
    return { answer, alsoAccept,
      meaning: {
        idea: `One whole new sentence of the learner's own, about the story or anything else, that uses ${quotedWords(c)} `
          + 'with the meanings they had in the story.',
        notIt: `${NOT_A_SENTENCE}, or a sentence from the story said back or changed by only a word or two`,
      },
      acceptRule: ACCEPT };
  }
  if (item.mode === 'guided_writing_rehearsal') {
    return { answer, alsoAccept,
      meaning: {
        idea: `One whole sentence the class could write for the pictured step that comes now in "${c.sceneTitle}" `
          + `(${c.sceneMeaning}), using ${quotedWords(c)}, with "${c.targetWords[0]}" showing the order of the step.`,
        notIt: `${NOT_A_SENTENCE}, a sentence about the step already written ("${c.priorStepLabel}"), or one unrelated to this step`,
      },
      acceptRule: `${ACCEPT} The order word may begin the sentence or sit inside it.` };
  }
  return { answer, alsoAccept,
    meaning: {
      idea: `One whole sentence about what is happening in the picture (${c.sceneMeaning}) that uses ${quotedWords(c)} `
        + 'with those meanings.',
      notIt: `${NOT_A_SENTENCE}, or a whole sentence that is not about this picture, such as a memorized one`,
    },
    acceptRule: ACCEPT };
}

/** An item's known wrong answers, in precedence order, for the `spoken_miss` observer. Concrete per item. */
export function oralSentenceSpokenMisses(item: OralSentenceStudioItem): KnownMiss[] {
  const c = item.challenge;
  const [first, second] = c.targetWords;
  const offTask = item.mode === 'use_story_words' ? 'a sentence from the story said back or nearly copied'
    : item.mode === 'guided_writing_rehearsal' ? `a sentence about the step already written ("${c.priorStepLabel}") or unrelated to this step`
      : 'a whole sentence that is not about this picture';
  const pattern: Record<SpokenOralSentenceMiss, KnownMiss> = {
    words_listed: { id: 'words_listed', pattern: `The learner says only the two words, "${first}" and "${second}", as a list, with no sentence.`,
      examples: [`${first} ${second}`] },
    fragment: { id: 'fragment', pattern: `The learner names things from the picture (${c.actorLabel}, ${c.objectLabel}) but says no whole sentence: no one does anything.`,
      examples: [`${c.actorLabel} ${c.objectLabel}`] },
    word_missing: { id: 'word_missing', pattern: `The learner says a whole sentence that leaves out "${first}" or "${second}".`,
      examples: [`${c.actorLabel} ${c.actionLabel} ${c.objectLabel}.`] },
    word_misused: { id: 'word_misused', pattern: `The learner says both words, but one is used with a meaning it does not have here ("${first}" means ${c.wordMeanings[0]}; "${second}" means ${c.wordMeanings[1]}).` },
    off_task: { id: 'off_task', pattern: `The learner says ${offTask}.` },
  };
  return ORAL_SENTENCE_MISSES.map(id => pattern[id]);
}

/** What is on screen for the tutor: the picture, the printed words, and the story or the step already written. */
export function oralSentenceScene(item: OralSentenceStudioItem): SceneOf {
  const c = item.challenge;
  return { objects: [], facts: {
    shown: `A picture of "${c.sceneTitle}": ${c.actorLabel}, ${c.actionLabel}, ${c.objectLabel}, ${c.settingLabel}.`,
    words: `Printed: ${quotedWords(c)}.`,
    ...(item.mode === 'use_story_words' && c.storyText ? { story: `Printed: ${c.storyText}` } : {}),
    ...(item.mode === 'guided_writing_rehearsal' && c.priorStepLabel ? { alreadyWritten: c.priorStepLabel } : {}),
    constraints: 'An example sentence appears on screen only after the sentence is credited.',
  } };
}

/** The journey's answers: the first example sentence, or the signature wrong one (a story line said back on story
 *  words; elsewhere the two words and the object, with no verb). */
export const oralSentenceHarnessAnswers = (item: OralSentenceStudioItem): { correct: string; plainWrong: string } => ({
  correct: item.challenge.acceptedSentences[0],
  plainWrong: item.mode === 'use_story_words'
    ? storySentences(item.challenge.storyText ?? '')[0] ?? 'I remember this sentence from yesterday.'
    : `${item.challenge.targetWords[0]} ${item.challenge.targetWords[1]} ${item.challenge.objectLabel}`,
});
