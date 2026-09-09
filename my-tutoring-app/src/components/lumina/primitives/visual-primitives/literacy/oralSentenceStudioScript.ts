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
import type { OralSentenceStudioChallenge } from './OralSentenceStudio';

export interface OralSentenceStudioItem extends JudgedScriptItem {
  mode: 'describe_scene';
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

export const challengeAskable = (challenge: OralSentenceStudioChallenge): boolean => {
  if (!challenge?.id || challenge.type !== 'describe_scene') return false;
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
  return challenge.acceptedSentences.every((sentence) =>
    isChildSentence(sentence)
    && sentenceUsesVocabulary(sentence, challenge.targetWords)
    && sentenceNamesScene(sentence, challenge));
};

export const itemFromChallenge = (
  challenge: OralSentenceStudioChallenge,
): OralSentenceStudioItem | null => challengeAskable(challenge) ? {
  id: challenge.id,
  mode: 'describe_scene',
  action: 'describe_scene',
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
  return `Look closely at the picture. Make one whole sentence about what is happening. Use both new words: ${first}, meaning ${firstMeaning}, and ${second}, meaning ${secondMeaning}. Say the sentence in your own way.`;
};

export const affirmFor = (item: OralSentenceStudioItem): string =>
  `Yes, your whole sentence fits the picture and uses ${wordList(item)} in a way that makes sense!`;

export const fragmentCorrectionFor = (item: OralSentenceStudioItem): string =>
  `My turn: You named ideas from the picture. A whole sentence tells who or what and what happens. For example, ${item.modelResponse} Now try one whole sentence with ${wordList(item)}.`;

export const vocabularyCorrectionFor = (item: OralSentenceStudioItem): string =>
  `My turn: Your idea fits the picture. Now use both new words in the sentence so their meanings make sense. For example, ${item.modelResponse} Your turn with ${wordList(item)}.`;

export const misuseCorrectionFor = (item: OralSentenceStudioItem): string =>
  `My turn: You used the new words, but one does not fit its meaning in that sentence yet. For example, ${item.modelResponse} Try again with ${wordList(item)}.`;

export const relevanceCorrectionFor = (item: OralSentenceStudioItem): string =>
  `My turn: That is a whole sentence, but it does not tell about this picture. For example, ${item.modelResponse} Now describe this scene with ${wordList(item)}.`;

export const correctionFor = (item: OralSentenceStudioItem): string =>
  `My turn: Tell one whole sentence that matches this picture and uses both new words in a way that makes sense. For example, ${item.modelResponse} Now try it with ${wordList(item)}.`;

const judgingContract = (item: OralSentenceStudioItem): string => {
  const examples = item.challenge.acceptedSentences
    .map((sentence, index) => `${index + 1}: "${sentence}"`)
    .join(' ');
  return `The quoted line is the only thing you say before the learner answers; then stay silent. `
    + `Judge MEANING AND USE, never exact wording. The visible scene means: "${item.challenge.sceneMeaning}" `
    + `The required words are "${item.challenge.targetWords[0]}" (${item.challenge.wordMeanings[0]}) and "${item.challenge.targetWords[1]}" (${item.challenge.wordMeanings[1]}). `
    + `Private examples of different valid answers are: ${examples} These examples are anchors, not an exhaustive answer key. `
    + `A response is CORRECT only when it is one complete child sentence, communicates a relevant actor or thing plus an action or state from the visible scene, and uses BOTH required vocabulary words with meanings that make sense in that sentence. `
    + `Accept natural paraphrases, changed word order, pronouns, ordinary inflections such as observe/observes/observed, extra relevant detail, ordinary child grammar, self-correction, and any sentence form that satisfies those three conditions. Do not require the model wording or perfect adult grammar. `
    + `A noun or verb fragment, disconnected labels, the two vocabulary words merely listed, a definition instead of a scene sentence, a complete but unrelated memorized sentence, a scene sentence missing either required word, or a sentence that uses a required word with the wrong meaning is NOT correct. `
    + `Choose exactly one response after the attempt: `
    + `if all conditions pass, say exactly: "${affirmFor(item)}" `
    + `If the meaning is scene-relevant but the response is a fragment, say exactly: "${fragmentCorrectionFor(item)}" `
    + `If it is a complete scene sentence but a word is missing, say exactly: "${vocabularyCorrectionFor(item)}" `
    + `If both words are present but misused, say exactly: "${misuseCorrectionFor(item)}" `
    + `If it is a complete sentence but unrelated to the scene, say exactly: "${relevanceCorrectionFor(item)}" `
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

export const oralSentenceStudioPack = (
  items: OralSentenceStudioItem[],
): JudgedScriptPack<OralSentenceStudioItem> => ({
  primitiveType: 'oral-sentence-studio',
  activityLine: 'Use two new vocabulary words in one original, complete spoken sentence that describes a visible scene.',
  items,
  maxCorrections: 2,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.mode,
    sceneTitle: item.challenge.sceneTitle,
    visibleScene: `${item.challenge.actorLabel}; ${item.challenge.actionLabel}; ${item.challenge.objectLabel}; ${item.challenge.settingLabel}`,
    targetWords: item.challenge.targetWords.join(', '),
    targetMeanings: item.challenge.wordMeanings.join('; '),
    taskFocus: 'One complete, scene-relevant spoken sentence using both target words meaningfully; accept original paraphrases, reject fragments and unrelated sentences.',
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
  diagnosisObservation: (item, { lastHeard }) => ({
    challenge: `Describe "${item.challenge.sceneTitle}" in one complete sentence using ${wordList(item)} meaningfully.`,
    expected: `Any complete, scene-relevant sentence using both words correctly; examples include: ${item.challenge.acceptedSentences.join(' / ')}`,
    observed: lastHeard?.trim() ? `Said: "${lastHeard.trim()}"` : 'No usable spoken response was heard.',
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
  unrelated: 'I remember this sentence from yesterday.',
  missingVocabulary: `${item.challenge.actorLabel} ${item.challenge.actionLabel} ${item.challenge.objectLabel}.`,
  leakTokens: [...item.challenge.acceptedSentences],
});
