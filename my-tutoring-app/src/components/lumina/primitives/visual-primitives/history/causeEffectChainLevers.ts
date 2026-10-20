/**
 * The in-item levers on cause-effect-chain, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/cause-effect-chain-levers-2026-10-08.md). No real-learner evidence: the misses are what `chainMiss`
 * (build_chain) and `causeEffectSpokenMisses` (identify_cause, root_vs_proximate) name.
 *
 * The cards ARE the answer in pieces, so no lever marks, moves or orders a learner's card. Help is either two empty
 * checks under the item's own card (`two_tests`, nothing ticked) or a model chain from everyday life beside the item
 * (`causeEffectModels.ts`, `modelLeaks`). Simplify opens a practice item `<item>~simpler` built from a model chain the
 * help did not show:
 *
 * - identify_cause: `two_tests` (marks) two empty checks under the card; `role_model` (model) an everyday ending with
 *   three cards tagged by role. No simplify: one card and a yes or no is already the plainest shape.
 * - build_chain: `model_chain` (model) an everyday chain drawn in order; `shorter_chain` (easier) an everyday chain one
 *   card shorter to build, never below two cards.
 * - root_vs_proximate: `ends_model` (model) an everyday chain drawn in order with its two ends tagged; `ordered_chain`
 *   (easier) the same ask on an everyday chain drawn in order, so only the end is left to pick.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { causeEffectChainCard } from './causeEffectChain.card';
import {
  itemsFromChallenge, toWords, type CauseEffectChainItem, type ChainChallengeLike, type ChainTier,
} from './causeEffectChainDomain';
import { MODEL_CHAINS, type ModelChain } from './causeEffectModels';

export const TWO_TESTS_LEVER = 'two_tests';
export const ROLE_MODEL_LEVER = 'role_model';
export const MODEL_CHAIN_LEVER = 'model_chain';
export const SHORTER_LEVER = 'shorter_chain';
export const ENDS_MODEL_LEVER = 'ends_model';
export const ORDERED_LEVER = 'ordered_chain';
export const PRACTICE_SUFFIX = '~simpler';

/** What a lever reads beyond the item: every item of the lesson (no model card may read as one of their cards). */
export interface ChainSession { items: readonly CauseEffectChainItem[]; gradeLevel?: string; tier?: ChainTier }

const seedOf = (id: string) => Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const fold = (w: string) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);
const STOP = new Set(['with', 'from', 'into', 'onto', 'over', 'their', 'they', 'them', 'this', 'that', 'there', 'then',
  'while', 'when', 'have', 'each', 'every', 'only', 'just', 'some', 'more', 'most', 'other', 'right', 'before', 'after']);
const words = (text: string) => toWords(text).filter(w => w.length >= 4 && !STOP.has(w)).map(fold);
const modelTexts = (m: ModelChain) => [m.outcome, ...m.causes, m.after, m.background];

/** Every card and ending of the lesson, each as its set of words. */
const sessionTexts = (s: ChainSession) =>
  s.items.flatMap(i => [i.outcome.text, ...i.cards.map(c => c.text)]).map(t => new Set(words(t)));

/** Two texts read as the same event when they share two words or more ("lay steel tracks", "steel tracks laid"). */
const readsAs = (text: string, session: readonly Set<string>[]) => {
  const mine = Array.from(new Set(words(text)));
  return session.some(other => mine.filter(w => other.has(w)).length >= 2);
};

/** Leak rule for a model chain: a card or ending of it that reads as one of the lesson's cards or endings. */
export const modelLeaks = (m: ModelChain, s: ChainSession) => {
  const session = sessionTexts(s);
  return modelTexts(m).some(t => readsAs(t, session));
};

/** The model chains none of whose cards reads as a lesson card, in an order seeded by the item's challenge. */
export function freeModels(item: CauseEffectChainItem, s: ChainSession): ModelChain[] {
  const ok = MODEL_CHAINS.filter(m => !modelLeaks(m, s));
  const at = ok.length ? seedOf(item.challengeId) % ok.length : 0;
  return [...ok.slice(at), ...ok.slice(0, at)];
}

/** build_chain and root_vs_proximate: the model chain the help draws, as many causes as the item has cards. */
export function chainModelFor(item: CauseEffectChainItem, s: ChainSession): { chain: ModelChain; causes: string[] } | null {
  if (item.kind === 'identify_cause') return null;
  const chain = freeModels(item, s)[0];
  return chain ? { chain, causes: chain.causes.slice(-item.cards.length) } : null;
}

/** identify_cause: a model ending with one cause, the after-event and the background, in a seeded order. */
export interface RoleCard { text: string; role: 'cause' | 'after' | 'background' }
export function roleModelFor(item: CauseEffectChainItem, s: ChainSession): { chain: ModelChain; cards: RoleCard[] } | null {
  if (item.kind !== 'identify_cause') return null;
  const chain = freeModels(item, s)[0];
  if (!chain) return null;
  const cards: RoleCard[] = [{ text: chain.causes[2], role: 'cause' }, { text: chain.after, role: 'after' },
    { text: chain.background, role: 'background' }];
  const at = seedOf(item.challengeId) % 3;
  return { chain, cards: [...cards.slice(at), ...cards.slice(0, at)] };
}

export const ROLE_TAG: Record<RoleCard['role'], string> = {
  cause: 'came before, and the ending needed it',
  after: 'happened after the ending',
  background: 'true at the time, pushed nothing along',
};

// ── simpler items ──────────────────────────────────────────────────────────

/** The practice item for `item`, from a model chain the help does not draw; null where none can be built. */
export function practiceItem(item: CauseEffectChainItem, s: ChainSession): CauseEffectChainItem | null {
  if (item.kind === 'identify_cause') return null;
  const chain = freeModels(item, s)[1];
  if (!chain) return null;
  const n = item.kind === 'build_chain' ? item.correctOrder.length - 1 : item.cards.length;
  if (n < (item.kind === 'build_chain' ? 2 : 3)) return null;
  const causes = chain.causes.slice(-n).map((text, i) => ({ id: `${chain.id}-${i + 1}`, text, category: 'social', icon: chain.icon }));
  // build_chain: rotated by one, never the causal order. root_vs_proximate: drawn in causal order (`orderedPractice`).
  const nodes = item.kind === 'build_chain' ? [...causes.slice(1), causes[0]] : causes;
  const ch: ChainChallengeLike = {
    id: `${item.id}${PRACTICE_SUFFIX}`, type: item.kind, ...(item.kind === 'root_vs_proximate' ? { ask: item.ask } : {}),
    outcome: { id: `${chain.id}-outcome`, text: chain.outcome, category: 'social', icon: chain.icon },
    nodes, correctOrder: causes.map(c => c.id),
  };
  // The practice item keeps its parent's tier: the model it follows is the parent's.
  const built = itemsFromChallenge(ch, { periodLabel: '', gradeLevel: s.gradeLevel }, { tier: item.tier })[0] ?? null;
  return built && !practiceLeaks(built, item, s) ? built : null;
}

/** A practice item drawn in causal order (root_vs_proximate's simplify): the board shows it as a built chain. */
export const orderedPractice = (item: CauseEffectChainItem | null) =>
  !!item && item.kind === 'root_vs_proximate' && item.id.endsWith(PRACTICE_SUFFIX);

/** The session item a practice id stands in for. */
export const practiceParent = (id: string, items: readonly CauseEffectChainItem[]) =>
  items.find(i => `${i.id}${PRACTICE_SUFFIX}` === id) ?? null;

/**
 * Leak rule for a practice item: never the item's id or kind changed, never a word of the lesson's cards, and one
 * step simpler within the mode floor: build_chain one card fewer (at least two), root_vs_proximate the same count
 * (at least three) drawn in causal order.
 */
export function practiceLeaks(practice: CauseEffectChainItem, item: CauseEffectChainItem, s: ChainSession): boolean {
  if (practice.id === item.id || practice.kind !== item.kind) return true;
  const session = sessionTexts(s);
  if ([practice.outcome.text, ...practice.cards.map(c => c.text)].some(t => readsAs(t, session))) return true;
  if (practice.kind === 'build_chain') {
    return practice.cards.length !== item.cards.length - 1 || practice.cards.length < 2
      || practice.cards.every((c, i) => c.id === practice.correctOrder[i]);
  }
  if (practice.kind === 'root_vs_proximate' && item.kind === 'root_vs_proximate') {
    return practice.ask !== item.ask || practice.cards.length !== item.cards.length
      || practice.cards.some((c, i) => c.id !== practice.correctOrder[i]);
  }
  return true;
}

// ── the tier's starting levers ─────────────────────────────────────────────

/** Easy starts identify_cause with the two empty checks on screen: drawn from the first render, never offered. */
export const startingLevers = (tier: string | undefined, item: CauseEffectChainItem | null) =>
  tier === 'easy' && item?.kind === 'identify_cause' ? [TWO_TESTS_LEVER] : [];

const notStarting = (id: string) => (item: CauseEffectChainItem) => !startingLevers(item.tier, item).includes(id);

// ── the lever set ──────────────────────────────────────────────────────────

const plain = (t: string) => t.replace(/[.!?]+$/, '');
const FENCE = 'Read the model cards if you like; never say which of the learner\'s cards is like a model card.';
type Mode = keyof typeof causeEffectChainCard.modes;
const chainFact = (tagged: boolean) => (m: { chain: ModelChain; causes: string[] }) =>
  'Beside the item, a model chain from everyday life, not this item, drawn in order, each card leading to the next: '
  + `${m.causes.map(plain).join(' -> ')} -> ending: ${plain(m.chain.outcome)}.`
  + (tagged ? ' Its first card is tagged "root" and its last card "right before the ending".' : '')
  + ' Nothing on the learner\'s cards is marked or moved.';

/** Every lever of the family, in the order the tutor sees them. */
export const CHAIN_LEVERS = leverSet<CauseEffectChainItem, ChainSession>({
  modeOf: item => item.kind,
  missesOf: mode => causeEffectChainCard.modes[mode as Mode]?.misses ?? [],
  support: {
    tier: item => item.tier,
    different: 'an everyday chain from outside the lesson',
    own: item => (item.kind === 'identify_cause' ? 'whether this event is a cause'
      : item.kind === 'build_chain' ? 'this chain\'s order' : 'which event this one is'),
  },
  specs: [
    { id: TWO_TESTS_LEVER, type: 'marks', carrier: 'both', modes: ['identify_cause'], answers: 'all',
      offer: notStarting(TWO_TESTS_LEVER),
      when: 'The learner says yes to an event because it is about the same story, or no to one that is not the last or biggest.',
      does: 'Puts two empty checks under the event card: "Did it happen before the ending?" and "Did the ending need it?". '
        + 'Read them and let the learner answer each. Never tick one or answer either.',
      fact: 'Under the event card, two empty checks: "Did it happen before the ending?" and "Did the ending need it?". '
        + 'Neither is ticked.' },
    { id: ROLE_MODEL_LEVER, type: 'model', modes: ['identify_cause'], answers: 'all',
      when: 'The learner still mixes up a cause with an event that came after, or one only true at the time.',
      does: 'Shows a model beside the item: an everyday ending and three cards, each tagged as came before and needed, '
        + `happened after, or only true at the time. ${FENCE}`,
      content: roleModelFor,
      fact: (m: { chain: ModelChain; cards: RoleCard[] }) => `Beside the item, a model from everyday life, not this item. Its ending: `
        + `${plain(m.chain.outcome)}. Three cards, each tagged: ${m.cards.map(c => `"${plain(c.text)}" (${ROLE_TAG[c.role]})`).join('; ')}.` },
    { id: MODEL_CHAIN_LEVER, type: 'model', modes: ['build_chain'], answers: 'all',
      when: 'The learner builds the chain backwards or out of order.',
      does: `Shows a model chain from everyday life beside the board, built in order with an arrow from each card to the next. ${FENCE}`,
      content: chainModelFor,
      fact: chainFact(false) },
    { id: SHORTER_LEVER, type: 'easier', modes: ['build_chain'], answers: 'all',
      when: 'The learner still cannot order the chain after help.',
      does: 'Opens an easier practice chain first: an everyday chain with one card fewer to put in order. Not graded; the '
        + 'full chain comes back after it, empty.',
      content: practiceItem },
    { id: ENDS_MODEL_LEVER, type: 'model', modes: ['root_vs_proximate'], answers: 'all',
      when: 'The learner names the other end of the chain, or an event in the middle.',
      does: 'Shows a model chain from everyday life beside the item, drawn in order, its first card tagged root and its last '
        + `tagged right before the ending. ${FENCE}`,
      content: chainModelFor,
      fact: chainFact(true) },
    { id: ORDERED_LEVER, type: 'easier', modes: ['root_vs_proximate'], answers: 'all',
      when: 'The learner still cannot pick the end after help.',
      does: 'Opens an easier practice item first: the same question on an everyday chain drawn in order, so only the end is '
        + 'left to pick. Not graded; the full item comes back after it.',
      content: practiceItem },
  ],
});
