/**
 * context-clues-detective's in-item levers (/add-support-tiers; report qa/eval-reports/context-clues-detective-levers-2026-10-09.md).
 * The misses are what `clueMiss` observes; no real-learner evidence. Every lever is help: the screen shows more, the
 * word, its passage and its answer stay the same. All three steps exist in every mode, so every mode has every lever.
 *
 * find (tap the clue sentence):
 * - `sentence_list`: the passage one sentence per line, numbered, the word's own sentence tagged "has the word". Every
 *   sentence is drawn the same way; nothing marks a clue. The easy and medium tiers start with it on.
 * - `cross_out`: greys out the sentences an earlier check found hold no clue (taps from a `no_clue` or
 *   `target_sentence_only` check, never a clue sentence). Offered once there is one.
 * A tier's starting position (the list, the descriptions, the strategy) reads as pulled; it is never recorded as help.
 * classify (name the clue type):
 * - `type_descriptions`: each type button's one-line description. The easy tier starts with it on.
 * - `signal_words`: underlines the signal words ("means", "or", "unlike", "such as" ...) inside the clue sentences,
 *   which the find step already shaded green. Never a type's name. Offered only where a clue sentence has one.
 * define (tap the meaning):
 * - `strategy`: prints the reading strategy for the clue type the learner named in the classify step. The easy tier
 *   starts with it on.
 * - `try_in_place`: under the meanings, the word's sentence printed with the learner's picked meaning in the word's
 *   place (a blank until they pick). Only the learner's own pick fills it; nothing marks which one reads right.
 *
 * No simplify lever (decision): an easier ask on this word (a shorter passage, fewer types or fewer meanings) hands
 * back its answer when the full item returns, and in a pinned mode every word has the same clue type, so an easier
 * type item shows the classify answer. The session has no spare word to practise on.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { ContextClueChallenge } from './ContextCluesDetective';
import type { ClueStep, ClueType, ContextClueMiss } from './contextCluesWorkspace';

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

/** What the session already shows on this item (tier starting positions) and what an earlier check ruled out. */
export interface ClueLeverContext {
  listShown: boolean;
  descriptionsShown: boolean;
  strategyShown: boolean;
  ruledOut: readonly string[];
}

export function clueLevers(step: ClueStep | null, pulled: readonly string[], ctx: ClueLeverContext): WorkspaceLever[] {
  if (!step) return [];
  const c = step.challenge;
  // A tier's starting position reads as pulled (its change is already on screen) but is never recorded as help.
  const lever = (id: string, answers: readonly ContextClueMiss[], when: string, does: string, shown = false): WorkspaceLever =>
    ({ id, kind: 'help', carrier: 'shown', pulled: shown || pulled.includes(id), answers, when, does });
  switch (step.phase) {
    case 'find': return [
      lever(SENTENCE_LIST_LEVER, ['no_clue', 'extra_sentence', 'target_sentence_only'],
        'The learner taps sentences that do not tell about the word, or loses track of the sentences.',
        'Lists the passage one sentence per line, numbered, and tags the word\'s own sentence "has the word". Every sentence looks the same otherwise; no clue is marked.',
        ctx.listShown),
      ...(ctx.ruledOut.length ? [lever(CROSS_OUT_LEVER, ['no_clue', 'target_sentence_only'],
        'After a check found no clue in the sentences the learner tapped.',
        'Greys out the sentences an earlier check found hold no clue, so the learner searches the rest. It never greys a clue sentence.')] : []),
    ];
    case 'classify': return [
      lever(TYPE_DESCRIPTIONS_LEVER,
        ['similar_opposite', 'definition_synonym', 'said_inference', 'stated_for_inference', 'other_type'],
        'The learner does not know what each clue type means, or mixes two of them up.',
        'Prints under each clue-type button its one-line description (what that kind of clue does). The same five descriptions on every word.',
        ctx.descriptionsShown),
      ...(clueSignalWords(c).length ? [lever(SIGNAL_WORDS_LEVER, ['similar_opposite', 'definition_synonym', 'said_inference', 'other_type'],
        'The learner names a type without looking at how the clue sentence connects to the word.',
        'Underlines the signal words (such as "means", "or", "unlike", "such as") in the green clue sentence. It never names a type.')] : []),
    ];
    case 'define': return [
      lever(STRATEGY_LEVER, ['other_meaning'],
        'The learner picks a meaning without using the clue.',
        'Prints under the question how to read this kind of clue (the clue type of this word, already named or the only one in the lesson). It never states a meaning.',
        ctx.strategyShown),
      ...(tryInPlace(c, '') !== null ? [lever(TRY_IN_PLACE_LEVER, ['other_meaning'],
        'The learner cannot tell which meaning fits the sentence.',
        'Prints the word\'s sentence under the meanings with the learner\'s picked meaning in the word\'s place, so they can read whether it makes sense. Nothing marks which meaning is right.')] : []),
    ];
  }
}

/** What the pulled levers (and the tier's starting positions) put on screen, for the tutor. Never a meaning or a type. */
export function clueLeverFacts(step: ClueStep | null, pulled: readonly string[], ctx: ClueLeverContext & { meaning: string }): string {
  if (!step) return '';
  const c = step.challenge;
  const n = (id: string) => c.passage.sentences.findIndex(s => s.id === id) + 1;
  const on = (id: string) => pulled.includes(id);
  switch (step.phase) {
    case 'find': return [
      (ctx.listShown || on(SENTENCE_LIST_LEVER)) && 'The passage is listed one sentence per line, numbered; the word\'s own sentence is tagged "has the word".',
      on(CROSS_OUT_LEVER) && ctx.ruledOut.length
        && `Greyed out as checked, no clue there: sentence${ctx.ruledOut.length > 1 ? 's' : ''} ${ctx.ruledOut.map(n).sort((a, b) => a - b).join(', ')}.`,
    ].filter((s): s is string => !!s).join(' ');
    case 'classify': return [
      on(TYPE_DESCRIPTIONS_LEVER) && 'Each clue-type button now shows its one-line description.',
      on(SIGNAL_WORDS_LEVER) && `Underlined in the green clue sentence: ${clueSignalWords(c).map(w => `"${w}"`).join(', ')}.`,
    ].filter((s): s is string => !!s).join(' ');
    case 'define': return [
      on(STRATEGY_LEVER) && `Printed under the question: "${STRATEGY_BY_TYPE[c.clueType]}"`,
      on(TRY_IN_PLACE_LEVER) && (ctx.meaning.trim()
        ? `Under the meanings, the word's sentence with the learner's pick in its place: "${tryInPlace(c, ctx.meaning)}"`
        : 'Under the meanings, the word\'s sentence with a blank in the word\'s place; it fills with the meaning the learner taps.'),
    ].filter((s): s is string => !!s).join(' ');
  }
}
