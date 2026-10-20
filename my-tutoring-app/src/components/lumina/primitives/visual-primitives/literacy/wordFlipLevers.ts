/**
 * The in-item levers on word-flip, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 22 L2). The answer
 * is the changed word, said aloud; the frame shows the source word and a blank, and the changed word appears only on
 * credit (contract R2).
 *
 * Spoken items:
 * - `rule_model_cards` (model; regular changes): a before/after card pair on a word the session never uses, same rule
 *   (one bug, two bugs; today I jump, yesterday I jumped). A rule shown on another word is taught, not given.
 * - `irregular_model` (model; irregular changes): a before/after pair of ANOTHER pattern (child, children for a foot
 *   item). Its own pattern would hand the answer over (tooth, teeth for foot).
 * - `familiar_noun` / `common_irregular` (easier): an ungraded item of the same rule on a common word the session never
 *   uses, and not the model's word.
 * Build items (build_inflect, the word-part build's helpers in `inflectBuild.ts`):
 * - `word_frame` (clue): two empty spaces, word + ending, naming the kind of word when the ask names one.
 * - `ending_chart` (legend): one solved word per ending (s, es, ies, ed), none of them on this board.
 * - `fewer_endings` (easier): the same ask on a smaller board, one word, two endings.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { IRREGULAR_FLIP_MODES, REGULAR_FLIP_MODES, wordFlipCard } from './wordFlip.card';
import {
  MODEL_PAIRS, asFlipBuild, asFlipWord, isFlipBuild, isPluralFlip, type FlipBuild, type FlipModelPair, type FlipWord,
  type WordFlipItem,
} from './wordFlipDomain';
import { endingChartFor, fewerEndingsFor, type InflectBuildItem } from './inflectBuild';
import { joined, type AffixBuildItem, type BuildPart } from './affixBuild';
import type { WordFlipChallenge, WordFlipChallengeType } from './WordFlip';

export const RULE_LEVER = 'rule_model_cards';
export const IRREGULAR_LEVER = 'irregular_model';
export const FAMILIAR_LEVER = 'familiar_noun';
export const COMMON_IRREGULAR_LEVER = 'common_irregular';
export const FRAME_LEVER = 'word_frame';
export const CHART_LEVER = 'ending_chart';
export const FEWER_ENDINGS_LEVER = 'fewer_endings';

/** Pictures for the model and practice words. */
export const FLIP_EMOJI: Record<string, string> = {
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
  return MODEL_PAIRS[item.type].filter(p => !used.has(p.singular) && !used.has(p.plural) && FLIP_EMOJI[p.singular]
    && (!irregular(item.type) || changePattern(p.singular, p.plural) !== pattern));
}

/** The help model for an item, or null when every pair is the session's. */
export const flipModelFor = (item: WordFlipChallenge, challenges: readonly WordFlipChallenge[]) =>
  freePairs(item, challenges)[0] ?? null;

/** The practice item: the same rule on a common word, not the session's and not the help model's. */
export function practiceItemFor(item: WordFlipChallenge, challenges: readonly WordFlipChallenge[]): WordFlipChallenge | null {
  const pair = freePairs(item, challenges)[1];
  if (!pair) return null;
  return { id: `${item.id}~simpler`, type: item.type, sourceWord: pair.singular, answer: pair.plural, emoji: FLIP_EMOJI[pair.singular],
    ...(isPluralFlip(item.type) ? { count: 2 } : {}) };
}

/** Leak rule for a practice item: true if it changes the rule or uses a session word. */
export const practiceLeak = (practice: WordFlipChallenge, item: WordFlipChallenge, challenges: readonly WordFlipChallenge[]) => {
  const used = flipSessionWords(challenges);
  return practice.type !== item.type || used.has(low(practice.sourceWord)) || used.has(low(practice.answer));
};

// ── the lever set ────────────────────────────────────────────────────────────

/** What the set reads beyond the item: the session's challenges (leak rules) and the build's board. */
export interface FlipLeverContext { challenges: readonly WordFlipChallenge[]; board: readonly BuildPart[] }

const BUILD = ['build_inflect'] as const;
const word = (item: WordFlipItem): FlipWord | null => (isFlipBuild(item) ? null : item);
const build = (item: WordFlipItem): FlipBuild | null => (isFlipBuild(item) ? item : null);
const JUDGED = ['wrong_ending', 'missed_y_change', 'wrong_ending_kind', 'not_a_word', 'wrong_meaning'];

const modelFact = (m: FlipModelPair, item: WordFlipItem) => (!isFlipBuild(item) && isPluralFlip(item.type)
  ? `A card pair on another word: one ${m.singular}, two ${m.plural}. Say it; it is not this item's word.`
  : `A card pair on another word: today I ${m.singular}, yesterday I ${m.plural}. Say it; it is not this item's word.`);

export const FLIP_LEVERS = leverSet<WordFlipItem, FlipLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => wordFlipCard.modes[mode].misses,
  answersOf: (item, ctx) => (isFlipBuild(item)
    ? item.examples.map(ids => joined(ids.flatMap(id => (item.board ?? ctx.board).filter(p => p.id === id)))).filter(Boolean)
    : [item.answer]),
  // Both models show a different word changed; the lesson's tier says when (items carry it, default medium).
  support: { tier: item => item.supportTier,
    different: 'a before-and-after card pair on another word', own: 'this word\'s changed form' },
  specs: [
    { id: RULE_LEVER, type: 'model', modes: REGULAR_FLIP_MODES, answers: ['unchanged', 'wrong_ending', 'double_ending'],
      when: 'The learner says the word unchanged or with the wrong ending.',
      does: 'Shows a before-and-after card pair on another word with the same change. Say it; not this item\'s word.',
      content: (item, ctx) => { const w = word(item); return w ? flipModelFor(w, ctx.challenges) : null; },
      fact: (m: FlipModelPair, item) => modelFact(m, item) },
    { id: IRREGULAR_LEVER, type: 'model', modes: IRREGULAR_FLIP_MODES, answers: ['regularized', 'unchanged'],
      when: 'The learner adds a regular ending to a word that changes its own way.',
      does: 'Shows a before-and-after card pair on another word that changes its own way. Say it; not this item\'s word.',
      content: (item, ctx) => { const w = word(item); return w ? flipModelFor(w, ctx.challenges) : null; },
      fact: (m: FlipModelPair, item) => modelFact(m, item) },
    { id: FAMILIAR_LEVER, type: 'easier', modes: REGULAR_FLIP_MODES, carrier: 'shown', answers: 'all',
      when: 'The learner still cannot say the changed word after help.',
      does: 'Opens an easier practice item first: the same change on a very common word. Not graded; the full item comes back after it.',
      content: (item, ctx) => { const w = word(item); const p = w && practiceItemFor(w, ctx.challenges); return w && p ? asFlipWord(p, w.supportTier) : null; } },
    { id: COMMON_IRREGULAR_LEVER, type: 'easier', modes: IRREGULAR_FLIP_MODES, carrier: 'shown', answers: 'all',
      when: 'The learner still cannot say the changed word after help.',
      does: 'Opens an easier practice item first: the same change on a very common word. Not graded; the full item comes back after it.',
      content: (item, ctx) => { const w = word(item); const p = w && practiceItemFor(w, ctx.challenges); return w && p ? asFlipWord(p, w.supportTier) : null; } },
    { id: FRAME_LEVER, type: 'clue', modes: BUILD, carrier: 'shown',
      answers: ['base_only', 'ending_only', 'parts_out_of_order', 'double_ending', 'other_base'],
      when: 'The learner puts down a word with no ending, an ending alone, two endings, the ending first, or a word the ask did not name.',
      does: 'Shows two empty spaces above the row, labelled word + ending (naming the kind of word when the ask names one). No card is filled in.',
      content: item => { const b = build(item); return b ? (b.baseHint ?? 'word') : null; },
      // Never "boxes": it is a word the build can make. The fact is leak-checked against the item's words.
      fact: (hint: string) => `Two empty spaces above the row show a word shape: ${hint} + ending.` },
    { id: CHART_LEVER, type: 'legend', modes: BUILD, answers: JUDGED,
      when: 'The learner picks an ending that does not fit the word or the ask, or misses that a word ending in y changes.',
      does: 'Shows a chart of solved words that are NOT on this board, one for each ending (s, es, ies, ed), so the learner sees '
        + 'which ending each kind of word takes. It shares no word with this item.',
      content: (_item, ctx) => { const rows = endingChartFor(ctx.board); return rows.length ? rows : null; },
      fact: (rows: [string, string][]) => `A chart of other words with their endings is shown: ${rows.map(([p, w]) => `${p} = ${w}`).join('; ')}.` },
    { id: FEWER_ENDINGS_LEVER, type: 'easier', modes: BUILD, carrier: 'shown', answers: JUDGED,
      when: 'The learner keeps picking endings that do not fit, or cannot start on the full board.',
      does: 'Opens the same ask first on a smaller board: a few words and only two endings, one word to make. It is not graded; '
        + 'the full item comes back after it.',
      content: (item, ctx) => { const b = build(item); const small = b && fewerEndingsFor(b, ctx.board); return b && small ? asFlipBuild(small, b.supportTier) : null; } },
  ],
});

/** The build levers bound for the shared word-part surface: its items carry no mode or tier, so they are stamped. */
export function buildLevers(ctx: FlipLeverContext, supportTier: FlipBuild['supportTier']) {
  const bound = FLIP_LEVERS.bind(ctx);
  const stamp = (item: AffixBuildItem) => asFlipBuild(item as InflectBuildItem, supportTier);
  return {
    declare: (item: AffixBuildItem, pulled: readonly string[]) => bound.declare(stamp(item), pulled),
    onScreen: (item: AffixBuildItem, pulled: readonly string[]) => bound.onScreen(stamp(item), pulled),
    simpler: (item: AffixBuildItem, lever: string) => bound.simpler(stamp(item), lever) as FlipBuild | null,
    support: (item: AffixBuildItem) => bound.support(stamp(item)),
  };
}
