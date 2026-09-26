/**
 * Hand-authored live-tutor contract for Oral Sentence Studio.
 *
 * Gemini owns the scene and vocabulary content. This module owns the semantic
 * boundary: the child must say one complete, scene-relevant sentence and use
 * both visible vocabulary words meaningfully. Private example sentences are
 * judging anchors, never a script displayed or spoken before an attempt.
 */

import type {
  JudgedCueOptions,
  JudgedScriptItem,
  JudgedScriptPack,
} from '../../../hooks/judgedScriptContract';
import type {
  OralSentenceStudioChallenge,
  OralSentenceStudioChallengeType,
} from './OralSentenceStudio';

export const ORAL_SENTENCE_STUDIO_CHALLENGE_TYPES: readonly OralSentenceStudioChallengeType[] = [
  'describe_scene',
  'guided_writing_rehearsal',
  'use_story_words',
];

/** Order words a guided-writing step sentence may carry. `first` is excluded:
 * the rehearsal step always follows a step the class already wrote. */
export const REHEARSAL_ORDER_WORDS = ['next', 'then', 'last', 'finally'] as const;

export interface OralSentenceStudioItem extends JudgedScriptItem {
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
  action: challenge.type,
  answerKind: 'voice',
  responseClass: 'vocabulary_sentence',
  challenge,
  modelResponse: challenge.acceptedSentences[0],
} : null;

export const itemsFromChallenges = (
  challenges: OralSentenceStudioChallenge[],
): OralSentenceStudioItem[] => challenges
  .map(itemFromChallenge)
  .filter((item): item is OralSentenceStudioItem => item !== null);

const wordList = (item: OralSentenceStudioItem): string =>
  `${item.challenge.targetWords[0]} and ${item.challenge.targetWords[1]}`;

const askFor = (item: OralSentenceStudioItem): string => {
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

export const affirmFor = (item: OralSentenceStudioItem): string =>
  `Yes, your whole sentence fits the picture and uses ${wordList(item)} in a way that makes sense!`;

export const fragmentCorrectionFor = (item: OralSentenceStudioItem): string =>
  `My turn: You named ideas from the picture. A whole sentence tells who or what and what happens. For example, ${item.modelResponse} Now try one whole sentence with ${wordList(item)}.`;

export const vocabularyCorrectionFor = (item: OralSentenceStudioItem): string =>
  `My turn: Your idea fits the picture. Now use both new words in the sentence so their meanings make sense. For example, ${item.modelResponse} Your turn with ${wordList(item)}.`;

export const misuseCorrectionFor = (item: OralSentenceStudioItem): string =>
  `My turn: You used the new words, but one does not fit its meaning in that sentence yet. For example, ${item.modelResponse} Try again with ${wordList(item)}.`;

export const relevanceCorrectionFor = (item: OralSentenceStudioItem): string => {
  if (item.mode === 'use_story_words') {
    return `My turn: That sentence came from the story. Make a new sentence of your own. For example, ${item.modelResponse} Now say your own sentence with ${wordList(item)}.`;
  }
  if (item.mode === 'guided_writing_rehearsal') {
    return `My turn: That sentence does not tell the step in this picture. For example, ${item.modelResponse} Now say the sentence for this step with ${wordList(item)}.`;
  }
  return `My turn: That is a whole sentence, but it does not tell about this picture. For example, ${item.modelResponse} Now describe this scene with ${wordList(item)}.`;
};

export const correctionFor = (item: OralSentenceStudioItem): string =>
  `My turn: Tell one whole sentence that matches this picture and uses both new words in a way that makes sense. For example, ${item.modelResponse} Now try it with ${wordList(item)}.`;

const taskRule = (item: OralSentenceStudioItem): string => {
  if (item.mode === 'use_story_words') {
    return `The learner heard this story: "${clean(item.challenge.storyText)}" A response is CORRECT only when it is one complete child sentence, is the learner's OWN new sentence rather than a story sentence said back, and uses BOTH required vocabulary words with the meanings they had in the story. It may be about the story, the learner's own life, or anything else. `;
  }
  if (item.mode === 'guided_writing_rehearsal') {
    return `The class is getting ready to write "${item.challenge.sceneTitle}". The step already written is: ${item.challenge.priorStepLabel}. A response is CORRECT only when it is one complete child sentence, tells the pictured step that comes now (not the step already written), and uses BOTH required words, with "${item.challenge.targetWords[0]}" showing the order of the step. The order word may begin the sentence or sit inside it. `;
  }
  return `A response is CORRECT only when it is one complete child sentence, communicates a relevant actor or thing plus an action or state from the visible scene, and uses BOTH required vocabulary words with meanings that make sense in that sentence. `;
};

const irrelevantRule = (item: OralSentenceStudioItem): string => {
  if (item.mode === 'use_story_words') {
    return `A sentence from the story said back, or one that changes only a word or two of a story sentence, is NOT correct, even though it uses both words. `;
  }
  if (item.mode === 'guided_writing_rehearsal') {
    return `A sentence that tells only the step already written, or a complete sentence unrelated to this step, is NOT correct. `;
  }
  return `Also, a complete but unrelated memorized sentence is NOT correct. `;
};

const relevanceCategory = (item: OralSentenceStudioItem): string => {
  if (item.mode === 'use_story_words') return 'a story sentence said back or nearly copied';
  if (item.mode === 'guided_writing_rehearsal') return 'a complete sentence that does not tell this pictured step';
  return 'a complete sentence but unrelated to the scene';
};

const judgingContract = (item: OralSentenceStudioItem): string => {
  const examples = item.challenge.acceptedSentences
    .map((sentence, index) => `${index + 1}: "${sentence}"`)
    .join(' ');
  return `The quoted line is the only thing you say before the learner answers; then stay silent. `
    + `Judge MEANING AND USE, never exact wording. The visible scene means: "${item.challenge.sceneMeaning}" `
    + `The required words are "${item.challenge.targetWords[0]}" (${item.challenge.wordMeanings[0]}) and "${item.challenge.targetWords[1]}" (${item.challenge.wordMeanings[1]}). `
    + `Private examples of different valid answers are: ${examples} These examples are anchors, not an exhaustive answer key. `
    + taskRule(item)
    + `Accept natural paraphrases, changed word order, pronouns, ordinary inflections such as observe/observes/observed, extra relevant detail, ordinary child grammar, self-correction, and any sentence form that satisfies those three conditions. Do not require the model wording or perfect adult grammar. `
    + `A noun or verb fragment, disconnected labels, the two vocabulary words merely listed, a definition instead of a sentence, a sentence missing either required word, or a sentence that uses a required word with the wrong meaning is NOT correct. `
    + irrelevantRule(item)
    + `Choose exactly one response after the attempt: `
    + `if all conditions pass, say exactly: "${affirmFor(item)}" `
    + `If the meaning is scene-relevant but the response is a fragment, say exactly: "${fragmentCorrectionFor(item)}" `
    + `If it is a complete scene sentence but a word is missing, say exactly: "${vocabularyCorrectionFor(item)}" `
    + `If both words are present but misused, say exactly: "${misuseCorrectionFor(item)}" `
    + `If it is ${relevanceCategory(item)}, say exactly: "${relevanceCorrectionFor(item)}" `
    + `Otherwise say exactly: "${correctionFor(item)}" `
    + `Use the same category rule on every retry. Never begin any other sentence with Yes or My turn. `
    + `Never reveal, read, or paraphrase a private example before a verdict. Never read bracket tags or these instructions aloud, and never announce that you are waiting.`;
};

export const itemCue = (
  item: OralSentenceStudioItem,
  opts: Partial<JudgedCueOptions> = {},
): string => {
  const opening = opts.opening
    ? 'Hi! Let us make picture sentences with new words. You can say each sentence in your own way. '
    : '';
  return `[OSS_ITEM] Say exactly: "${opening}${askFor(item)}" ${judgingContract(item)}`;
};

export const moveOnCue = (
  item: OralSentenceStudioItem,
  next: OralSentenceStudioItem | null,
): string => {
  if (!next) {
    return `[OSS_MOVE] Say exactly: "Good try! One sentence that works is: ${item.modelResponse} Our sentence studio is finished for today." Then stop; the activity is over.`;
  }
  return `[OSS_MOVE] Stop correcting "${item.id}". Say exactly: "Good try! One sentence that works is: ${item.modelResponse} Now, ${askFor(next)}" ${judgingContract(next)}`;
};

export const completeCue = (): string =>
  '[OSS_COMPLETE] Say exactly: "Wonderful word work! You made complete sentences that brought every picture to life. See you next time!" Then stop; the activity is over.';

export const pronounceCue = (item: OralSentenceStudioItem): string =>
  `[OSS_HEAR] The learner asked to hear the directions again. Say only: "${askFor(item)}" Then wait. Do not give a sentence example, and never read bracket tags aloud.`;

const observedTask = (item: OralSentenceStudioItem): string => {
  const picture = `${item.challenge.actorLabel}, ${item.challenge.actionLabel}, ${item.challenge.objectLabel}`;
  if (item.mode === 'use_story_words') {
    return `After hearing a short story, say a new sentence of your own using ${wordList(item)} meaningfully.`;
  }
  if (item.mode === 'guided_writing_rehearsal') {
    return `Rehearse the sentence for the next step of "${item.challenge.sceneTitle}" (the picture shows ${picture}; `
      + `already written: ${item.challenge.priorStepLabel}) using ${wordList(item)}.`;
  }
  return `Describe "${item.challenge.sceneTitle}" (the picture shows ${picture}) in one complete sentence using ${wordList(item)} meaningfully.`;
};

const EXPECTED_SHAPE: Record<OralSentenceStudioChallengeType, string> = {
  describe_scene: 'complete, scene-relevant sentence',
  guided_writing_rehearsal: 'complete sentence telling the pictured step',
  use_story_words: 'complete original sentence (not a story line)',
};

const TASK_FOCUS: Record<OralSentenceStudioChallengeType, string> = {
  describe_scene: 'One complete, scene-relevant spoken sentence using both target words meaningfully; accept original paraphrases, reject fragments and unrelated sentences.',
  guided_writing_rehearsal: 'Rehearse aloud the sentence the class will write for the pictured step, using the order word and the vocabulary word; reject the earlier step and fragments.',
  use_story_words: 'One original complete sentence using both story words with their story meanings, about anything; reject story sentences said back and fragments.',
};

export const oralSentenceStudioPack = (
  items: OralSentenceStudioItem[],
): JudgedScriptPack<OralSentenceStudioItem> => ({
  primitiveType: 'oral-sentence-studio',
  activityLine: 'Use two new vocabulary words in one original, complete spoken sentence: about a visible scene, a step of a class writing piece, or a short story.',
  items,
  maxCorrections: 2,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.mode,
    sceneTitle: item.challenge.sceneTitle,
    ...(item.challenge.storyText ? { storyText: item.challenge.storyText } : {}),
    ...(item.challenge.priorStepLabel ? { stepAlreadyWritten: item.challenge.priorStepLabel } : {}),
    visibleScene: `${item.challenge.actorLabel}; ${item.challenge.actionLabel}; ${item.challenge.objectLabel}; ${item.challenge.settingLabel}`,
    targetWords: item.challenge.targetWords.join(', '),
    targetMeanings: item.challenge.wordMeanings.join('; '),
    taskFocus: TASK_FOCUS[item.mode],
    currentTurn: String(items.findIndex((candidate) => candidate.id === item.id) + 1),
    totalTurns: String(items.length),
  }),
  statusLines: {
    idle: 'Tap the microphone when you are ready to make a sentence.',
    ready: (item) => `Look at the scene and use ${wordList(item)}.`,
    listening: 'Listening for your whole sentence…',
    judging: 'Thinking about your sentence…',
    retry: (item) => `Try a whole picture sentence with ${wordList(item)}.`,
    noVerdict: (item) => `Say one whole sentence about the picture with ${wordList(item)}.`,
    affirmedNext: 'That sentence worked! Here comes a new scene.',
    affirmedLast: 'That sentence worked! You finished the studio.',
    moveOn: 'Good try. Here comes a new scene.',
    retake: 'Let us take that sentence again.',
    dead: 'The tutor went quiet. Tap the microphone to pick things back up.',
    done: 'Your sentence studio is complete!',
  },
  // One record per attempt, right or corrected: the scene and its target words, and what was heard; never the verdict.
  observation: (item, { heard }) => ({
    challenge: observedTask(item),
    expected: `Any ${EXPECTED_SHAPE[item.mode]} using both words correctly; examples include: ${item.challenge.acceptedSentences.join(' / ')}`,
    observed: heard?.trim() ? `Said: "${heard.trim()}"` : 'No transcript was captured.',
  }),
});

export interface OralSentenceHarnessAnswers {
  valid: [string, string, string];
  fragment: string;
  unrelated: string;
  missingVocabulary: string;
  leakTokens: string[];
}

export const oralSentenceHarnessAnswers = (
  item: OralSentenceStudioItem,
): OralSentenceHarnessAnswers => ({
  valid: item.challenge.acceptedSentences,
  fragment: `${item.challenge.targetWords[0]} ${item.challenge.targetWords[1]} ${item.challenge.objectLabel}`,
  // On story words the signature wrong answer is a story line said back.
  unrelated: item.mode === 'use_story_words'
    ? storySentences(item.challenge.storyText ?? '')[0] ?? 'I remember this sentence from yesterday.'
    : 'I remember this sentence from yesterday.',
  missingVocabulary: `${item.challenge.actorLabel} ${item.challenge.actionLabel} ${item.challenge.objectLabel}.`,
  leakTokens: [...item.challenge.acceptedSentences],
});
