/**
 * The in-item levers on word-flip (`/add-support-tiers`, handoff 22 L2). The answer is the changed word, said
 * aloud; the frame shows the source word and a blank, and the changed word appears only on credit (contract R2).
 *
 * - `rule_model_cards` (help, both; regular changes): a before/after card pair on a word the session never uses,
 *   same rule (one bug, two bugs; today I jump, yesterday I jumped). A rule shown on another word is taught, not
 *   given (the retired runner's opening line made the same move in words).
 * - `irregular_model` (help, both; irregular changes): a before/after pair of ANOTHER pattern (child, children
 *   for a foot item). Its own pattern would hand the answer over (tooth, teeth for foot).
 * - `familiar_noun` / `common_irregular` (simplify): an ungraded item of the same rule on a common word the
 *   session never uses, and not the help model's word.
 *
 * Misses are spoken and not emitted yet (handoff 20 Part B): declared here, unanswered for J9.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { MODEL_PAIRS, type FlipModelPair } from './wordFlipScript';
import { isPluralFlip } from './wordFlipWorkspace';
import type { WordFlipChallenge, WordFlipChallengeType } from './WordFlip';

export const RULE_LEVER = 'rule_model_cards';
export const IRREGULAR_LEVER = 'irregular_model';
export const FAMILIAR_LEVER = 'familiar_noun';
export const COMMON_IRREGULAR_LEVER = 'common_irregular';

const REGULAR_MISSES = ['unchanged', 'wrong_ending', 'double_ending'] as const;
const IRREGULAR_MISSES = ['regularized', 'unchanged'] as const;
export const FLIP_MISSES: Record<WordFlipChallengeType, readonly FlipMiss[]> = {
  plural_s: REGULAR_MISSES, plural_es: REGULAR_MISSES, plural_y: REGULAR_MISSES, past_ed: REGULAR_MISSES,
  irregulars: IRREGULAR_MISSES, past_irregular: IRREGULAR_MISSES,
};
export type FlipMiss = typeof REGULAR_MISSES[number] | typeof IRREGULAR_MISSES[number];

/** Pictures for the model and practice words. */
const EMOJI: Record<string, string> = {
  hat: '🎩', cup: '☕', bug: '🐛', pen: '🖊️', mug: '☕', bed: '🛏️', van: '🚐', rug: '🧶',
  bus: '🚌', box: '📦', dish: '🍽️', brush: '🪥', watch: '⌚', peach: '🍑',
  baby: '👶', puppy: '🐶', bunny: '🐰', pony: '🐴', cherry: '🍒', fly: '🪰',
  mouse: '🐭', child: '🧒', foot: '🦶', tooth: '🦷', goose: '🪿', person: '🧑',
  jump: '🦘', walk: '🚶', play: '🧸', help: '🤝', look: '👀', wash: '🧼',
  go: '🚗', run: '🏃', eat: '🍎', see: '👀', come: '👋', sit: '🪑',
};

const irregular = (type: WordFlipChallengeType) => type === 'irregulars' || type === 'past_irregular';
const low = (w: string | undefined) => (w ?? '').trim().toLowerCase();

/** How a word changes, as a pattern: one letter for another (sit, sat: "i-a"), oo to ee, or the answer itself. */
export function changePattern(from: string, to: string): string {
  const [a, b] = [low(from), low(to)];
  if (a.includes('oo') && b === a.replace('oo', 'ee')) return 'oo-ee';
  if (a.length === b.length) {
    const diff = a.split('').map((ch, i) => ch !== b[i] ? i : -1).filter(i => i >= 0);
    if (diff.length === 1) return `${a[diff[0]]}-${b[diff[0]]}`;
  }
  return `other:${b}`;
}

/** Every source word and answer in the session. A model or practice word may be none of them. */
export const flipSessionWords = (challenges: readonly WordFlipChallenge[]) =>
  new Set(challenges.flatMap(c => [c.sourceWord, c.answer]).map(low).filter(Boolean));

/** The pairs of this item's rule that the session never uses, and (irregular) that change by another pattern. */
function freePairs(item: WordFlipChallenge, challenges: readonly WordFlipChallenge[]): FlipModelPair[] {
  const used = flipSessionWords(challenges);
  const pattern = changePattern(item.sourceWord, item.answer);
  return MODEL_PAIRS[item.type].filter(p => !used.has(p.singular) && !used.has(p.plural) && EMOJI[p.singular]
    && (!irregular(item.type) || changePattern(p.singular, p.plural) !== pattern));
}

/** The help model for an item, or null when every pair is the session's. */
export const flipModelFor = (item: WordFlipChallenge, challenges: readonly WordFlipChallenge[]) =>
  freePairs(item, challenges)[0] ?? null;

/** The practice item: the same rule on a common word, not the session's and not the help model's. */
export function practiceItemFor(item: WordFlipChallenge, challenges: readonly WordFlipChallenge[]): WordFlipChallenge | null {
  const pair = freePairs(item, challenges)[1];
  if (!pair) return null;
  return { id: `${item.id}~simpler`, type: item.type, sourceWord: pair.singular, answer: pair.plural, emoji: EMOJI[pair.singular],
    ...(isPluralFlip(item.type) ? { count: 2 } : {}) };
}

/** Leak rule for a practice item: true if it changes the rule or uses a session word. */
export const practiceLeak = (practice: WordFlipChallenge, item: WordFlipChallenge, challenges: readonly WordFlipChallenge[]) => {
  const used = flipSessionWords(challenges);
  return practice.type !== item.type || used.has(low(practice.sourceWord)) || used.has(low(practice.answer));
};

/** What the pulled help lever put on screen, for the tutor. Never the item's answer. */
export function leversOnScreen(item: WordFlipChallenge, pulled: readonly string[], challenges: readonly WordFlipChallenge[]): string | null {
  const model = pulled.some(id => id === RULE_LEVER || id === IRREGULAR_LEVER) ? flipModelFor(item, challenges) : null;
  if (!model) return null;
  return isPluralFlip(item.type)
    ? `a card pair on another word: one ${model.singular}, two ${model.plural}. Say it; it is not this item's word`
    : `a card pair on another word: today I ${model.singular}, yesterday I ${model.plural}. Say it; it is not this item's word`;
}

/** The levers this item declares, with their state. */
export function wordFlipLevers(item: WordFlipChallenge | null, pulled: readonly string[], challenges: readonly WordFlipChallenge[]): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  const odd = irregular(item.type);
  if (flipModelFor(item, challenges)) levers.push({ id: odd ? IRREGULAR_LEVER : RULE_LEVER, kind: 'help', carrier: 'both',
    pulled: pulled.includes(odd ? IRREGULAR_LEVER : RULE_LEVER), answers: odd ? ['regularized', 'unchanged'] : ['unchanged', 'wrong_ending', 'double_ending'],
    when: odd ? 'The learner adds a regular ending to a word that changes its own way.' : 'The learner says the word unchanged or with the wrong ending.',
    does: odd ? 'Shows a before-and-after card pair on another word that changes its own way. Say it; not this item\'s word.'
      : 'Shows a before-and-after card pair on another word with the same change. Say it; not this item\'s word.' });
  if (practiceItemFor(item, challenges)) levers.push({ id: odd ? COMMON_IRREGULAR_LEVER : FAMILIAR_LEVER, kind: 'simplify', carrier: 'shown',
    pulled: pulled.includes(odd ? COMMON_IRREGULAR_LEVER : FAMILIAR_LEVER), answers: FLIP_MISSES[item.type],
    when: 'The learner still cannot say the changed word after help.',
    does: 'Opens an easier practice item first: the same change on a very common word. Not graded; the full item comes back after it.' });
  return levers;
}

export { EMOJI as FLIP_EMOJI };
