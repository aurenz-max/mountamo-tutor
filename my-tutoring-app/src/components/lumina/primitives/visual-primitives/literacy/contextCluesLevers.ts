/**
 * context-clues-detective's in-item levers (/add-support-tiers; report qa/eval-reports/context-clues-detective-levers-2026-10-09.md),
 * declared once as a lever set (`CLUE_LEVERS`, `bossLevers.ts`). The misses are what `clueMiss` observes; no
 * real-learner evidence. Every lever is help: the screen shows more, the word, its passage and its answer stay the
 * same. Each lever is offered on its own step only.
 *
 * find (tap the clue sentence):
 * - `sentence_list` (layout): the passage one sentence per line, numbered, the word's own sentence tagged "has the word". Every
 *   sentence is drawn the same way; nothing marks a clue. The easy and medium tiers start with it on.
 * - `cross_out` (marks): greys out the sentences an earlier check found hold no clue (taps from a `no_clue` or
 *   `target_sentence_only` check, never a clue sentence). Offered once there is one.
 * A tier's starting position (the list, the descriptions, the strategy) reads as pulled (`tierShown`); it is never
 * recorded as help.
 * classify (name the clue type):
 * - `type_descriptions` (legend): each type button's one-line description. The easy tier starts with it on.
 * - `signal_words` (marks): underlines the signal words ("means", "or", "unlike", "such as" ...) inside the clue sentences,
 *   which the find step already shaded green. Never a type's name. Offered only where a clue sentence has one.
 * define (tap the meaning):
 * - `strategy` (clue): prints the reading strategy for the word's clue type (named in the classify step, or the only one). The easy tier
 *   starts with it on.
 * - `try_in_place` (custom): under the meanings, the word's sentence printed with the learner's picked meaning in the word's
 *   place (a blank until they pick). Only the learner's own pick fills it; nothing marks which one reads right.
 *
 * No simplify lever (decision): an easier ask on this word (a shorter passage, fewer types or fewer meanings) hands
 * back its answer when the full item returns, and in a pinned mode every word has the same clue type, so an easier
 * type item shows the classify answer. The session has no spare word to practise on.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { ContextClueChallenge } from './ContextCluesDetective';
import { CONTEXT_CLUE_MISSES_BY_MODE, type ContextClueMiss } from './contextClues.card';
import type { CluePhase, ClueStep, ClueType } from './contextCluesWorkspace';

export const SENTENCE_LIST_LEVER = 'sentence_list';
export const CROSS_OUT_LEVER = 'cross_out';
export const TYPE_DESCRIPTIONS_LEVER = 'type_descriptions';
export const SIGNAL_WORDS_LEVER = 'signal_words';
export const STRATEGY_LEVER = 'strategy';
export const TRY_IN_PLACE_LEVER = 'try_in_place';

/** The reading strategy per clue type (the define step; the type is credited by then). Never states a meaning. */
export const STRATEGY_BY_TYPE: Record<ClueType, string> = {
  definition: 'Strategy: find the sentence that explains the word in plain words right where it appears.',
  synonym: 'Strategy: look for a familiar word nearby that means about the same thing.',
  antonym: 'Strategy: find the opposite word (look for "unlike", "but", "however") and flip it.',
  example: 'Strategy: read the examples ("such as", "like") and ask what they have in common.',
  inference: 'Strategy: gather hints across the sentences and reason out what fits.',
};

/** Words and phrases that signal a stated clue. Longest first, so "for example" wins over "example". */
export const SIGNAL_WORDS = ['for example', 'such as', 'in other words', 'which means', 'is called', 'also called',
  'that is', 'which is', 'the same as', 'similar to', 'on the other hand', 'instead of', 'unlike', 'however', 'but',
  'means', 'meaning', 'or', 'like', 'including', 'not', 'although'];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SIGNAL_RE = new RegExp(`\\b(${SIGNAL_WORDS.map(escape).join('|')})\\b`, 'gi');

/** The signal words in a text, lower-case, in order, each once. */
export function signalWordsIn(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(SIGNAL_RE), m => m[1].toLowerCase())));
}

/** The signal words inside the item's clue sentences. */
export function clueSignalWords(c: ContextClueChallenge): string[] {
  return Array.from(new Set(c.passage.sentences.filter(s => c.clueSentenceIds.includes(s.id)).flatMap(s => signalWordsIn(s.text))));
}

/** Leak rule for `cross_out`: it greys only sentences that hold no clue at all. */
export const crossOutLeaks = (c: ContextClueChallenge, ids: readonly string[]) => ids.some(id => c.clueSentenceIds.includes(id));

/** The sentences a wrong find shows hold no clue: its taps, when the check named no clue among them. */
export function ruledOutBy(c: ContextClueChallenge, picked: readonly string[], miss: ContextClueMiss | undefined): string[] {
  if (miss !== 'no_clue' && miss !== 'target_sentence_only') return [];
  return picked.filter(id => !c.clueSentenceIds.includes(id));
}

/** The word's sentence with `meaning` in the word's place (a blank when nothing is picked); null when the sentence
 *  does not hold the word as written. */
export function tryInPlace(c: ContextClueChallenge, meaning: string): string | null {
  const sentence = c.passage.sentences.find(s => s.id === c.targetWordSentenceId)?.text ?? '';
  const word = new RegExp(`\\b${escape(c.targetWord.trim())}\\b`, 'i');
  if (!c.targetWord.trim() || !word.test(sentence)) return null;
  return sentence.replace(word, meaning.trim() ? `[${meaning.trim()}]` : '___');
}

/** What an earlier check ruled out on this step, and the learner's current meaning (the try-it sentence). */
export interface ClueLeverContext {
  ruledOut: readonly string[];
  meaning: string;
}

/** The levers the item's support tier starts on: they read as pulled and are never recorded as help. */
export function tierShown(step: ClueStep | null): string[] {
  if (!step) return [];
  const c = step.challenge;
  return [
    ...(step.phase === 'find' && c.showClueHints ? [SENTENCE_LIST_LEVER] : []),
    ...(step.phase === 'classify' && c.showClueTypeDescriptions !== false ? [TYPE_DESCRIPTIONS_LEVER] : []),
    ...(step.phase === 'define' && c.strategyHint ? [STRATEGY_LEVER] : []),
  ];
}

const at = (...phases: CluePhase[]) => (step: ClueStep) => phases.includes(step.phase);
const sentenceNo = (c: ContextClueChallenge, id: string) => c.passage.sentences.findIndex(s => s.id === id) + 1;
const ALL_MISSES = Array.from(new Set(Object.values(CONTEXT_CLUE_MISSES_BY_MODE).flat()));
const TYPE_MISSES: readonly ContextClueMiss[] = ['similar_opposite', 'definition_synonym', 'said_inference', 'other_type'];

/**
 * The card mode a step belongs to: a session that builds the classify step is synonym_antonym (the only mode with
 * one); otherwise the word's clue type names it (a synonym or antonym word is synonym_antonym).
 */
export const clueMode = (step: ClueStep): string => (step.phases.includes('classify') ? 'synonym_antonym'
  : step.challenge.clueType === 'synonym' || step.challenge.clueType === 'antonym' ? 'synonym_antonym' : step.challenge.clueType);

/**
 * The levers, declared once (`bossLevers.ts`); the context is what a check ruled out and the learner's meaning. Pass
 * `[...tierShown(step), ...pulled]` as pulled: a tier's starting position is on screen and its fact is published, but
 * only a pull is recorded as help.
 */
export const CLUE_LEVERS = leverSet<ClueStep, ClueLeverContext>({
  modeOf: clueMode,
  missesOf: () => ALL_MISSES,
  // The strategy must never name the meaning; the other worded facts sit on steps whose key is not a meaning.
  answersOf: step => (step.phase === 'define'
    ? [step.challenge.correctMeaning, ...(step.challenge.acceptableMeanings ?? [])].filter(m => m.trim()) : []),
  specs: [
    { id: SENTENCE_LIST_LEVER, type: 'layout', answers: ['no_clue', 'extra_sentence', 'target_sentence_only'],
      when: 'The learner taps sentences that do not tell about the word, or loses track of the sentences.',
      does: 'Lists the passage one sentence per line, numbered, and tags the word\'s own sentence "has the word". Every '
        + 'sentence looks the same otherwise; no clue is marked.',
      offer: at('find'),
      fact: 'The passage is listed one sentence per line, numbered; the word\'s own sentence is tagged "has the word".' },
    // Offered once a check ruled a sentence out, and never when one of them is a clue (`crossOutLeaks`).
    { id: CROSS_OUT_LEVER, type: 'marks', answers: ['no_clue', 'target_sentence_only'],
      when: 'After a check found no clue in the sentences the learner tapped.',
      does: 'Greys out the sentences an earlier check found hold no clue, so the learner searches the rest. It never greys a '
        + 'clue sentence.',
      offer: (step, ctx) => step.phase === 'find' && !crossOutLeaks(step.challenge, ctx.ruledOut),
      content: (_step, ctx) => (ctx.ruledOut.length ? ctx.ruledOut : null),
      fact: (ids: readonly string[], step) => `Greyed out as checked, no clue there: sentence${ids.length > 1 ? 's' : ''} `
        + `${ids.map(id => sentenceNo(step.challenge, id)).sort((a, b) => a - b).join(', ')}.` },
    { id: TYPE_DESCRIPTIONS_LEVER, type: 'legend', modes: ['synonym_antonym'], answers: TYPE_MISSES,
      when: 'The learner does not know what each clue type means, or mixes two of them up.',
      does: 'Prints under each clue-type button its one-line description (what that kind of clue does). The same five '
        + 'descriptions on every word.',
      offer: at('classify'),
      fact: 'Each clue-type button shows its one-line description.' },
    { id: SIGNAL_WORDS_LEVER, type: 'marks', modes: ['synonym_antonym'], answers: TYPE_MISSES,
      when: 'The learner names a type without looking at how the clue sentence connects to the word.',
      does: 'Underlines the signal words (such as "means", "or", "unlike", "such as") in the green clue sentence. It never '
        + 'names a type.',
      offer: at('classify'),
      content: step => { const words = clueSignalWords(step.challenge); return words.length ? words : null; },
      fact: (words: string[]) => `Underlined in the green clue sentence: ${words.map(w => `"${w}"`).join(', ')}.` },
    { id: STRATEGY_LEVER, type: 'clue', answers: ['other_meaning'],
      when: 'The learner picks a meaning without using the clue.',
      does: 'Prints under the question how to read this kind of clue (the clue type of this word, already named or the only '
        + 'one in the lesson). It never states a meaning.',
      offer: at('define'),
      fact: (_c, step) => `Printed under the question: "${step.challenge.strategyHint ?? STRATEGY_BY_TYPE[step.challenge.clueType]}"` },
    { id: TRY_IN_PLACE_LEVER, type: 'custom', carrier: 'shown', answers: ['other_meaning'],
      why: 'It prints the learner\'s own pick in the word\'s place in its sentence: no stock type shows the learner\'s '
        + 'answer in context, and no other choice is drawn, so none is marked.',
      when: 'The learner cannot tell which meaning fits the sentence.',
      does: 'Prints the word\'s sentence under the meanings with the learner\'s picked meaning in the word\'s place, so they '
        + 'can read whether it makes sense. Nothing marks which meaning is right.',
      offer: at('define'),
      content: step => (tryInPlace(step.challenge, '') !== null ? true : null),
      fact: (_c, step, ctx) => (ctx.meaning.trim()
        ? `Under the meanings, the word's sentence with the learner's pick in its place: "${tryInPlace(step.challenge, ctx.meaning)}"`
        : 'Under the meanings, the word\'s sentence with a blank in the word\'s place; it fills with the meaning the learner taps.') },
  ],
});
