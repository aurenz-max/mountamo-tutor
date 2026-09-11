/**
 * Code-owned early-decoding scope for WordWorkout's beyond-CVC modes.
 *
 * Gemini may choose among these entries, but it cannot invent the words,
 * decoding chunks, context, or answer key. That makes "Kindergarten scope" a
 * runtime invariant rather than a prompt suggestion.
 */

export type EarlyExtendedWordMode = 'inflected-word' | 'compound-word';

export interface EarlyExtendedWordEntry {
  word: string;
  mode: EarlyExtendedWordMode;
  kind: 'ending-s' | 'ending-ing' | 'ending-ed' | 'compound';
  /** Chunks the tutor models only after the learner's cold attempt. */
  decodingParts: readonly string[];
  /** Short vowels in the decodable base/root words; suffix vowels are excluded. */
  scopeVowels: readonly string[];
  meaningSentence: string;
  meaningQuestion: string;
  meaningAnswer: string;
  acceptedMeaningAnswers: readonly string[];
}

const INFLECTED_WORDS = [
  {
    word: 'cats', mode: 'inflected-word', kind: 'ending-s', decodingParts: ['cat', '/s/'], scopeVowels: ['a'],
    meaningSentence: 'The cats nap.', meaningQuestion: 'What does cats tell you about how many cats there are?',
    meaningAnswer: 'more than one', acceptedMeaningAnswers: ['more than one', 'more', 'many', 'two or more'],
  },
  {
    word: 'dogs', mode: 'inflected-word', kind: 'ending-s', decodingParts: ['dog', '/z/'], scopeVowels: ['o'],
    meaningSentence: 'The dogs run.', meaningQuestion: 'What does dogs tell you about how many dogs there are?',
    meaningAnswer: 'more than one', acceptedMeaningAnswers: ['more than one', 'more', 'many', 'two or more'],
  },
  {
    word: 'hats', mode: 'inflected-word', kind: 'ending-s', decodingParts: ['hat', '/s/'], scopeVowels: ['a'],
    meaningSentence: 'The hats fit.', meaningQuestion: 'What does hats tell you about how many hats there are?',
    meaningAnswer: 'more than one', acceptedMeaningAnswers: ['more than one', 'more', 'many', 'two or more'],
  },
  {
    word: 'cups', mode: 'inflected-word', kind: 'ending-s', decodingParts: ['cup', '/s/'], scopeVowels: ['u'],
    meaningSentence: 'The cups tip.', meaningQuestion: 'What does cups tell you about how many cups there are?',
    meaningAnswer: 'more than one', acceptedMeaningAnswers: ['more than one', 'more', 'many', 'two or more'],
  },
  {
    word: 'mixing', mode: 'inflected-word', kind: 'ending-ing', decodingParts: ['mix', 'ing'], scopeVowels: ['i'],
    meaningSentence: 'Dad is mixing it.', meaningQuestion: 'What does the ending tell you about when it is happening?',
    meaningAnswer: 'now', acceptedMeaningAnswers: ['now', 'right now', 'happening now'],
  },
  {
    word: 'fixing', mode: 'inflected-word', kind: 'ending-ing', decodingParts: ['fix', 'ing'], scopeVowels: ['i'],
    meaningSentence: 'Mom is fixing it.', meaningQuestion: 'What does the ending tell you about when it is happening?',
    meaningAnswer: 'now', acceptedMeaningAnswers: ['now', 'right now', 'happening now'],
  },
  {
    word: 'jumping', mode: 'inflected-word', kind: 'ending-ing', decodingParts: ['jump', 'ing'], scopeVowels: ['u'],
    meaningSentence: 'The pup is jumping.', meaningQuestion: 'What does the ending tell you about when it is happening?',
    meaningAnswer: 'now', acceptedMeaningAnswers: ['now', 'right now', 'happening now'],
  },
  {
    word: 'helping', mode: 'inflected-word', kind: 'ending-ing', decodingParts: ['help', 'ing'], scopeVowels: ['e'],
    meaningSentence: 'Ben is helping Dad.', meaningQuestion: 'What does the ending tell you about when it is happening?',
    meaningAnswer: 'now', acceptedMeaningAnswers: ['now', 'right now', 'happening now'],
  },
  {
    word: 'jumped', mode: 'inflected-word', kind: 'ending-ed', decodingParts: ['jump', '/t/'], scopeVowels: ['u'],
    meaningSentence: 'The pup jumped.', meaningQuestion: 'What does the ending tell you about when the jump happened?',
    meaningAnswer: 'before', acceptedMeaningAnswers: ['before', 'already', 'in the past'],
  },
  {
    word: 'helped', mode: 'inflected-word', kind: 'ending-ed', decodingParts: ['help', '/t/'], scopeVowels: ['e'],
    meaningSentence: 'Ben helped Dad.', meaningQuestion: 'What does the ending tell you about when the help happened?',
    meaningAnswer: 'before', acceptedMeaningAnswers: ['before', 'already', 'in the past'],
  },
  {
    word: 'rested', mode: 'inflected-word', kind: 'ending-ed', decodingParts: ['rest', 'ed'], scopeVowels: ['e'],
    meaningSentence: 'The dog rested.', meaningQuestion: 'What does the ending tell you about when the rest happened?',
    meaningAnswer: 'before', acceptedMeaningAnswers: ['before', 'already', 'in the past'],
  },
  {
    word: 'melted', mode: 'inflected-word', kind: 'ending-ed', decodingParts: ['melt', 'ed'], scopeVowels: ['e'],
    meaningSentence: 'The ice melted.', meaningQuestion: 'What does the ending tell you about when the melting happened?',
    meaningAnswer: 'before', acceptedMeaningAnswers: ['before', 'already', 'in the past'],
  },
] as const satisfies readonly EarlyExtendedWordEntry[];

const COMPOUND_WORDS = [
  {
    word: 'sunset', mode: 'compound-word', kind: 'compound', decodingParts: ['sun', 'set'], scopeVowels: ['u', 'e'],
    meaningSentence: 'We saw the sunset.', meaningQuestion: 'What does sunset name?',
    meaningAnswer: 'a time of day', acceptedMeaningAnswers: ['a time of day', 'time of day', 'when the sun goes down', 'evening'],
  },
  {
    word: 'hotdog', mode: 'compound-word', kind: 'compound', decodingParts: ['hot', 'dog'], scopeVowels: ['o'],
    meaningSentence: 'I had a hotdog.', meaningQuestion: 'What is a hotdog?',
    meaningAnswer: 'food', acceptedMeaningAnswers: ['food', 'a food', 'something to eat'],
  },
  {
    word: 'catnap', mode: 'compound-word', kind: 'compound', decodingParts: ['cat', 'nap'], scopeVowels: ['a'],
    meaningSentence: 'Dad had a catnap.', meaningQuestion: 'What is a catnap?',
    meaningAnswer: 'a short sleep', acceptedMeaningAnswers: ['a short sleep', 'short sleep', 'a nap', 'nap'],
  },
  {
    word: 'bedbug', mode: 'compound-word', kind: 'compound', decodingParts: ['bed', 'bug'], scopeVowels: ['e', 'u'],
    meaningSentence: 'A bedbug is an insect.', meaningQuestion: 'What kind of thing is a bedbug?',
    meaningAnswer: 'an insect', acceptedMeaningAnswers: ['an insect', 'insect', 'a bug', 'bug'],
  },
  {
    word: 'pigpen', mode: 'compound-word', kind: 'compound', decodingParts: ['pig', 'pen'], scopeVowels: ['i', 'e'],
    meaningSentence: 'The pig is in the pigpen.', meaningQuestion: 'What is a pigpen?',
    meaningAnswer: 'a home for pigs', acceptedMeaningAnswers: ['a home for pigs', 'home for pigs', 'a pen for pigs', 'pig home'],
  },
  {
    word: 'cobweb', mode: 'compound-word', kind: 'compound', decodingParts: ['cob', 'web'], scopeVowels: ['o', 'e'],
    meaningSentence: 'The cobweb is in the shed.', meaningQuestion: 'What is a cobweb?',
    meaningAnswer: 'a spider web', acceptedMeaningAnswers: ['a spider web', 'spider web', 'a web', 'web'],
  },
] as const satisfies readonly EarlyExtendedWordEntry[];

export const EARLY_EXTENDED_WORDS: readonly EarlyExtendedWordEntry[] = [
  ...INFLECTED_WORDS,
  ...COMPOUND_WORDS,
];

export interface EarlyContextTrial {
  id: string;
  words: readonly [string, string];
  scopeVowel: string;
  sentence: string;
  answer: string;
}

export const EARLY_CONTEXT_TRIALS: readonly EarlyContextTrial[] = [
  { id: 'cat-cap', words: ['cat', 'cap'], scopeVowel: 'a', sentence: 'The ___ sat on the mat.', answer: 'cat' },
  { id: 'bag-bat', words: ['bag', 'bat'], scopeVowel: 'a', sentence: 'Put the book in the ___.', answer: 'bag' },
  { id: 'hen-pen', words: ['hen', 'pen'], scopeVowel: 'e', sentence: 'The ___ laid an egg.', answer: 'hen' },
  { id: 'pet-pen', words: ['pet', 'pen'], scopeVowel: 'e', sentence: 'The dog is my ___.', answer: 'pet' },
  { id: 'pig-pin', words: ['pig', 'pin'], scopeVowel: 'i', sentence: 'The ___ can dig.', answer: 'pig' },
  { id: 'sit-sip', words: ['sit', 'sip'], scopeVowel: 'i', sentence: 'I can ___ on the rug.', answer: 'sit' },
  { id: 'dog-log', words: ['dog', 'log'], scopeVowel: 'o', sentence: 'The ___ can wag.', answer: 'dog' },
  { id: 'hop-hot', words: ['hop', 'hot'], scopeVowel: 'o', sentence: 'The soup is ___.', answer: 'hot' },
  { id: 'bug-bun', words: ['bug', 'bun'], scopeVowel: 'u', sentence: 'The ant is a ___.', answer: 'bug' },
  { id: 'run-rug', words: ['run', 'rug'], scopeVowel: 'u', sentence: 'I can ___ fast.', answer: 'run' },
];

const WORD_BY_KEY = new Map(EARLY_EXTENDED_WORDS.map((entry) => [entry.word, entry]));
const TRIAL_BY_ID = new Map(EARLY_CONTEXT_TRIALS.map((trial) => [trial.id, trial]));

export const earlyExtendedWordFor = (
  raw: string,
  mode?: EarlyExtendedWordMode,
): EarlyExtendedWordEntry | null => {
  const entry = WORD_BY_KEY.get((raw ?? '').trim().toLowerCase()) ?? null;
  return entry && (!mode || entry.mode === mode) ? entry : null;
};

export const earlyContextTrialFor = (raw: string): EarlyContextTrial | null =>
  TRIAL_BY_ID.get((raw ?? '').trim().toLowerCase()) ?? null;

export const earlyWordMatchesVowelScope = (
  entry: EarlyExtendedWordEntry,
  scopedVowels: readonly string[] | null,
): boolean => !scopedVowels?.length || entry.scopeVowels.every((vowel) => scopedVowels.includes(vowel));

export const earlyContextMatchesVowelScope = (
  trial: EarlyContextTrial,
  scopedVowels: readonly string[] | null,
): boolean => !scopedVowels?.length || scopedVowels.includes(trial.scopeVowel);

/** Only the dedicated comprehension wording adds a second, meaning-scored turn. */
export const objectiveRequiresWordMeaning = (...signals: Array<string | undefined>): boolean =>
  /\b(comprehend|comprehension|meaning|means|understand)\b/i.test(signals.filter(Boolean).join(' '));
