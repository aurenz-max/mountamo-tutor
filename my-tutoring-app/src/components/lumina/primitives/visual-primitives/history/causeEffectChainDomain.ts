/**
 * Cause & Effect Chain's domain: the items, their build gates, the ask, the spoken key, the known misses, the scene
 * and the board's own check. Pure: the boss (`causeEffectChain.boss.ts`), the levers, the component and the generator
 * read it.
 *
 * Three kinds of item, all built from one emission (an ordered chain plus the generator's named non-causes):
 *
 *   identify_cause     one spoken yes or no PER CARD: did this event help cause the ending?
 *   build_chain        the cards placed in causal order with the hands, checked in code (`chainMatches`)
 *   root_vs_proximate  one spoken pick of a card: the root, or the one right before the ending
 *
 * identify_cause is one ask per card because the reasoning it measures is per card (did this come before the ending,
 * and did the ending need it?), and a run asks as many causes as non-causes, so one word said every time scores at
 * chance. build_chain is a placement: the arrangement IS the answer, so the activity checks the board and the tutor
 * never hears a permutation. root_vs_proximate needs every card to own a content word no other card has
 * (`chainEarSeparable`), or a short spoken answer fits two cards; the generator imports the same gate, so a chain that
 * cannot be asked by ear is never stamped with that mode.
 *
 * The leak gates live here and the generator imports them: `cardSpeakable` (every card is read aloud: a real
 * sentence, no double quote, no verdict opener) and `chainEarSeparable`. The generator's own audits (ordinal words,
 * causal connectives, dates) protect the ORDER and stay in the generator.
 */

import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { containsPhrase, type SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { opensWithSentinel, type JudgedScriptItem, type ResponseClassId } from '../../../hooks/judgedScriptContract';
import type { ChainMiss } from './causeEffectChain.card';

// ============================================================================
// Domain
// ============================================================================

export type ChainKind = 'identify_cause' | 'build_chain' | 'root_vs_proximate';
export type ChainTier = 'easy' | 'medium' | 'hard';
export type ChainAsk = 'root' | 'proximate';
/** What a card IS to the ending. Only `identify_cause` sees non-causes. */
export type ChainCardRole = 'cause' | 'consequence' | 'background';

/** Ladder order: locate → connect → analyze. Also the order items ship in, as runs of one mode. */
export const CHAIN_KINDS: readonly ChainKind[] = ['identify_cause', 'build_chain', 'root_vs_proximate'];

export const isChainKind = (v: unknown): v is ChainKind =>
  typeof v === 'string' && (CHAIN_KINDS as readonly string[]).includes(v);

/** Duck-typed so this module never imports the component or the generator;
 *  both import US. */
export interface ChainNodeLike {
  id: string;
  text: string;
  category?: string;
  icon?: string;
}

export interface ChainChallengeLike {
  id: string;
  type: string;
  ask?: ChainAsk;
  outcome: ChainNodeLike;
  /** Everything on the page, in on-screen order — the generator's shuffle. */
  nodes: ChainNodeLike[];
  /** The causes, earliest first. The outcome is the implicit last link. */
  correctOrder: string[];
  explanation?: string;
}

export interface ChainSessionLike {
  periodLabel: string;
  /** Canonical grade key ('K'|'1'…). K-2 hear every card read in the ask. */
  gradeLevel?: string;
}

/** One card as the stage renders it — id, text, and the two code-owned chrome fields. */
export interface ChainCard {
  id: string;
  text: string;
  category: string;
  icon: string;
}

/** One spoken option on a `root_vs_proximate` item. */
export interface ChainChoice {
  card: ChainCard;
  /** The short form a child actually says — the card's own distinctive words. */
  distinguisher: string;
  /** Other short forms that count. Never shared with another card. */
  alsoCounts: string[];
}

interface ChainItemBase extends JudgedScriptItem {
  kind: ChainKind;
  /** Catalog contextKey. Same value as `kind` — the eval modes ARE the kinds. */
  challengeType: ChainKind;
  tier: ChainTier;
  /** Which generated challenge this item came from — an identify run shares one. */
  challengeId: string;
  outcome: ChainCard;
  /** Every card on the page for this item, in on-screen order. */
  cards: ChainCard[];
  /** K-2: the ask reads the cards aloud; a reader reads the page. */
  emergingReader: boolean;
  /** Post-affirm teaching note. Rendered behind `revealHeld`, never spoken. */
  explanation?: string;
}

export interface IdentifyCauseItem extends ChainItemBase {
  kind: 'identify_cause';
  /** The ONE card this ask is about. */
  card: ChainCard;
  role: ChainCardRole;
  isCause: boolean;
  /** Position of this ask inside its challenge's run, 0-based, and the run size. */
  ordinal: number;
  runSize: number;
}

export interface BuildChainItem extends ChainItemBase {
  kind: 'build_chain';
  correctOrder: string[];
}

export interface RootProximateItem extends ChainItemBase {
  kind: 'root_vs_proximate';
  ask: ChainAsk;
  /** The causes, earliest first — carried so the harness can name the OTHER
   *  end of the chain (the signature wrong) without re-deriving it. */
  correctOrder: string[];
  choices: ChainChoice[];
  correctIndex: number;
}

export type CauseEffectChainItem = IdentifyCauseItem | BuildChainItem | RootProximateItem;

export const correctChoiceOf = (item: RootProximateItem): ChainChoice =>
  item.choices[item.correctIndex];

// ============================================================================
// Word tools — one tokenizer, used by every gate in this file
// ============================================================================

export const toWords = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);

/** Lowercase, punctuation-stripped, lightly de-pluralised — the fold is a lens
 *  for MATCHING and never a source of text handed to the tutor. */
const fold = (w: string): string => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);

/** Function words and the domain's own filler carry no subject matter and
 *  would make every card look equally close to every other. */
const EAR_STOPWORDS = new Set([
  'the', 'and', 'or', 'but', 'for', 'with', 'from', 'into', 'onto', 'over', 'about', 'along',
  'was', 'were', 'are', 'been', 'being', 'its', 'they', 'them', 'their', 'this', 'that',
  'these', 'those', 'there', 'than', 'not', 'out', 'off', 'have', 'has', 'had', 'did',
  'does', 'get', 'got', 'one', 'two', 'all', 'any', 'own', 'you', 'your', 'his', 'her',
  'him', 'she', 'more', 'most', 'some', 'each', 'every', 'other', 'very', 'can', 'will',
  'just', 'only', 'like', 'made', 'make', 'used', 'use', 'new', 'many', 'people', 'town',
  'towns', 'across', 'through', 'begin', 'start', 'build', 'built', 'open', 'opens',
]);

const contentWords = (text: string): string[] =>
  toWords(text).filter((w) => w.length > 2 && !EAR_STOPWORDS.has(w));

// ============================================================================
// The gates — ONE copy, consumed by the generator too
// ============================================================================

/** Nothing spoken may carry a double quote: the key quotes the card, and a
 *  quote inside it would end that span early. */
const hasQuote = (s: string): boolean => /["“”]/.test(s);

/**
 * Can this card be READ ALOUD in an ask? A real sentence, quote-free, and
 * not opening with a verdict sentinel — the outcome and every card are
 * generated and spoken, so all three are live risks, not formalities.
 * Runs generator-side (before the challenge is kept) AND build-side.
 */
export const cardSpeakable = (text: string): boolean => {
  const t = (text ?? '').trim();
  if (toWords(t).length < 3) return false;
  if (hasQuote(t) || opensWithSentinel(t)) return false;
  return true;
};

/**
 * The words UNIQUE to one card among the chain — the accept clause and the
 * ear-separability evidence for `root_vs_proximate`, whose options are free
 * prose. Compared on the folded form, returned as the SURFACE form (the
 * era-explorer lesson: a folded "factorie" was once handed to the judge).
 */
export const uniqueCardWords = (texts: string[]): string[][] => {
  const surfaces = texts.map((t) => toWords(t).filter((w) => w.length > 2 && !EAR_STOPWORDS.has(w)));
  const bags = texts.map((t) => new Set(contentWords(t).map(fold)));
  return surfaces.map((mine, i) =>
    mine.filter((word) => {
      const key = fold(word);
      return bags.every((other, j) => j === i || !other.has(key));
    }),
  );
};

/**
 * What `closed_set_choice` owes: every card must own at least one content
 * word that appears in no other card, or a child's short answer fits two of
 * them and the verdict is a coin toss. The fix is never lenient judging — the
 * chain simply cannot be asked this way, and the generator stamps another rung.
 */
export const chainEarSeparable = (texts: string[]): boolean =>
  texts.length >= 2 && uniqueCardWords(texts).every((words) => words.length > 0);

/** The two non-cause roles, by the id the generator stamps (`-d1` = the
 *  consequence of the outcome, `-d2` = inert background). Anything else that
 *  is not in `correctOrder` is treated as background — the safer teaching line. */
export const roleOfCard = (id: string, correctOrder: readonly string[]): ChainCardRole => {
  if (correctOrder.includes(id)) return 'cause';
  return id.endsWith('-d1') ? 'consequence' : 'background';
};

// ============================================================================
// The split (standing gate 1 arithmetic, not a preference)
// ============================================================================

export const answerKindFor = (kind: ChainKind): 'voice' | 'gesture' =>
  (kind === 'build_chain' ? 'gesture' : 'voice');

export const responseClassFor = (kind: ChainKind): ResponseClassId => {
  switch (kind) {
    case 'identify_cause': return 'yes_no';
    case 'build_chain': return 'manipulation';
    case 'root_vs_proximate': return 'closed_set_choice';
  }
};

// ============================================================================
// Items
// ============================================================================

const endWithStop = (s: string): string => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

const ORDINALS = ['the first one', 'the second one', 'the third one', 'the fourth one', 'the fifth one', 'the sixth one'];

const isEmergingReader = (gradeLevel?: string): boolean =>
  gradeLevel === 'K' || gradeLevel === '1' || gradeLevel === '2';

const toCard = (n: ChainNodeLike): ChainCard => ({
  id: n.id,
  text: endWithStop(n.text),
  category: n.category ?? 'social',
  icon: n.icon ?? '📜',
});

/**
 * The items one challenge can be ASKED as, or an empty list when it cannot.
 * Keep-or-drop, never backfill: a placeholder in a judged loop becomes a
 * spoken ask the tutor must judge, and there is no honest verdict behind it.
 *
 * The gates and what each protects:
 *  - the type must be one of the three eval modes;
 *  - the outcome and EVERY card must be speakable (`cardSpeakable`) — each is
 *    read aloud on some ask, and one bad card poisons the whole page;
 *  - `correctOrder` must name real cards, at least two of them;
 *  - identify_cause needs at least one non-cause on the page (the rung IS the
 *    non-causes) and never asks the same card twice;
 *  - build_chain / root_vs_proximate need a page that is ALL causes — a
 *    stray non-cause would make the permutation, or the pick, unanswerable;
 *  - root_vs_proximate needs three or more cards (two is a coin flip) that
 *    are separable by ear (`chainEarSeparable`).
 */
export const itemsFromChallenge = (
  ch: ChainChallengeLike,
  session: ChainSessionLike,
  opts: { tier?: ChainTier } = {},
): CauseEffectChainItem[] => {
  if (!isChainKind(ch.type)) return [];
  const kind = ch.type;

  const outcomeText = (ch.outcome?.text ?? '').trim();
  if (!cardSpeakable(outcomeText)) return [];
  const nodes = ch.nodes ?? [];
  if (nodes.some((n) => !cardSpeakable(n.text ?? ''))) return [];

  const ids = new Set(nodes.map((n) => n.id));
  const correctOrder = (ch.correctOrder ?? []).filter((id) => ids.has(id));
  if (correctOrder.length < 2 || correctOrder.length !== (ch.correctOrder ?? []).length) return [];

  const cards = nodes.map(toCard);
  const base = {
    action: kind,
    answerKind: answerKindFor(kind),
    responseClass: responseClassFor(kind),
    challengeType: kind,
    tier: opts.tier ?? ('medium' as ChainTier),
    challengeId: ch.id,
    outcome: toCard(ch.outcome),
    cards,
    emergingReader: isEmergingReader(session.gradeLevel),
    explanation: ch.explanation,
  };

  if (kind === 'identify_cause') {
    const nonCauses = cards.filter((c) => !correctOrder.includes(c.id));
    const causes = cards.filter((c) => correctOrder.includes(c.id));
    if (nonCauses.length === 0 || causes.length === 0) return [];
    // As many causes as non-causes, so one word said every time scores at
    // chance; on-screen order, so the run reads the page top to bottom.
    const chosen = new Set([...nonCauses, ...causes.slice(0, nonCauses.length)].map((c) => c.id));
    const asked = cards.filter((c) => chosen.has(c.id));
    return asked.map((card, ordinal): IdentifyCauseItem => {
      const role = roleOfCard(card.id, correctOrder);
      return {
        ...base,
        kind: 'identify_cause',
        id: `${ch.id}:${card.id}`,
        card,
        role,
        isCause: role === 'cause',
        ordinal,
        runSize: asked.length,
      };
    });
  }

  // The chain rungs: every card on the page is a cause.
  if (cards.length !== correctOrder.length) return [];

  if (kind === 'build_chain') {
    return [{ ...base, kind: 'build_chain', id: ch.id, correctOrder }];
  }

  if (cards.length < 3) return [];
  const texts = cards.map((c) => c.text);
  if (!chainEarSeparable(texts)) return [];
  const unique = uniqueCardWords(texts);
  const ask: ChainAsk = ch.ask === 'proximate' ? 'proximate' : 'root';
  const answerId = ask === 'proximate' ? correctOrder[correctOrder.length - 1] : correctOrder[0];
  const correctIndex = cards.findIndex((c) => c.id === answerId);
  if (correctIndex < 0) return [];
  return [{
    ...base,
    kind: 'root_vs_proximate',
    id: ch.id,
    ask,
    correctOrder,
    // ONE word each: a card is a whole sentence, so its first unique content
    // word (almost always the subject — "metalworkers", "farmers") is what a
    // child actually says; the next few unique words count on their own too.
    // The first live draw joined two into a non-phrase ("craftsmen affordable").
    choices: cards.map((card, i) => ({
      card,
      distinguisher: unique[i][0],
      alsoCounts: unique[i].slice(1, 5),
    })),
    correctIndex,
  }];
};

/**
 * Build the session.
 *
 * Three rules, all about the SESSION rather than one item:
 *  - the modes ship as RUNS in `CHAIN_KINDS` order, which is also the
 *    ladder: locate → connect → analyze.
 *  - an identify run is a UNIT: its yes/no items belong to one ending and are
 *    asked together, top of the page to bottom.
 *  - the cap SELECTS rather than truncates: every mode present gets its first
 *    unit before any mode gets a second, and an identify unit that does not
 *    fit whole ships as balanced pairs (one cause, one non-cause) or not at all.
 */
export const itemsFromChallenges = (
  challenges: ChainChallengeLike[],
  session: ChainSessionLike,
  opts: { tier?: ChainTier; maxItems?: number } = {},
): CauseEffectChainItem[] => {
  const cap = opts.maxItems ?? 10;
  const units = new Map<ChainKind, CauseEffectChainItem[][]>(CHAIN_KINDS.map((k) => [k, []]));
  for (const ch of challenges) {
    const built = itemsFromChallenge(ch, session, opts);
    if (built.length === 0) continue;
    units.get(built[0].kind)!.push(built);
  }

  const selected = new Map<ChainKind, CauseEffectChainItem[]>(CHAIN_KINDS.map((k) => [k, []]));
  let used = 0;

  /** Take a unit whole, or — for an identify run — as balanced pairs. */
  const take = (unit: CauseEffectChainItem[], room: number): boolean => {
    if (room <= 0) return false;
    let picked = unit;
    if (unit.length > room) {
      if (unit[0].kind !== 'identify_cause' || room < 2) return false;
      const yes = unit.filter((i) => i.kind === 'identify_cause' && i.isCause);
      const no = unit.filter((i) => i.kind === 'identify_cause' && !i.isCause);
      const pairs = Math.min(Math.floor(room / 2), yes.length, no.length);
      if (pairs === 0) return false;
      const keep = new Set([...yes.slice(0, pairs), ...no.slice(0, pairs)].map((i) => i.id));
      picked = unit
        .filter((i) => keep.has(i.id))
        .map((i, ordinal) => (i.kind === 'identify_cause' ? { ...i, ordinal, runSize: pairs * 2 } : i));
    }
    selected.get(picked[0].kind)!.push(...picked);
    used += picked.length;
    return true;
  };

  /** Room for THIS mode's next unit, with one slot held back for every other
   *  mode that has not shipped anything yet — coverage before depth, so an
   *  identify run cannot eat the cap before the chain and the pick have been
   *  asked once. */
  const roomFor = (kind: ChainKind): number => {
    const unserved = CHAIN_KINDS.filter(
      (k) => k !== kind && units.get(k)!.length > 0 && selected.get(k)!.length === 0,
    ).length;
    return cap - used - unserved;
  };

  // Rounds until nothing more fits. Each round serves the mode with the FEWEST
  // items so far first (ties in ladder order), so depth is shared: a second
  // chain and a second pick ship before a second identify run.
  let progressed = true;
  while (progressed) {
    progressed = false;
    const order = [...CHAIN_KINDS].sort(
      (a, b) => selected.get(a)!.length - selected.get(b)!.length
        || CHAIN_KINDS.indexOf(a) - CHAIN_KINDS.indexOf(b),
    );
    for (const kind of order) {
      const pool = units.get(kind)!;
      if (pool.length === 0) continue;
      if (take(pool[0], roomFor(kind))) {
        pool.shift();
        progressed = true;
      } else {
        pool.length = 0; // nothing of this mode fits any more; room only shrinks
      }
    }
  }

  return CHAIN_KINDS.flatMap((kind) => selected.get(kind)!);
};

/** The items a payload asks, built by the gates: shared by the boss, the component, the levers and the tests. */
export const causeEffectItems = (data: { challenges?: ChainChallengeLike[]; periodLabel?: string; gradeLevel?: string;
  supportTier?: ChainTier }): CauseEffectChainItem[] =>
  itemsFromChallenges(data.challenges ?? [], { periodLabel: data.periodLabel ?? '', gradeLevel: data.gradeLevel },
    { tier: data.supportTier });

// ============================================================================
// The ask
// ============================================================================

/** "In the end: A busy town grows up where the tracks cross the river." The ending is the one thing every ask names. */
const outcomeLine = (item: CauseEffectChainItem): string => `In the end: ${item.outcome.text}`;

/** The cards, read in on-screen order: the generator's shuffle, never the causal order. */
const cardsLine = (cards: readonly ChainCard[]): string => `Here are the events: ${cards.map((c) => c.text).join(' ')}`;

/** Read aloud for a learner who cannot read them (K-2); left on the page for one who can. */
const cardsClause = (item: CauseEffectChainItem): string =>
  (item.emergingReader ? cardsLine(item.cards) : 'The events are on the cards.');

/** The part of the ask that names the move. */
export const elicitFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause':
      return 'Did this event help cause the ending, yes or no?';
    case 'build_chain':
      return 'Put the cards in the order they happened, so each one leads to the next.';
    case 'root_vs_proximate':
      return item.ask === 'proximate'
        ? 'Say which event came right before the ending, the final step before it.'
        : 'Say which event is the root, the one that had to happen before any of the others could.';
  }
};

/** An identify ask: the ending in full on the first card of a run and briefly on the rest, then the ONE card. */
const identifyStimulus = (item: IdentifyCauseItem): string => (
  item.ordinal === 0
    ? `${outcomeLine(item)} Here is one event: ${item.card.text}`
    : `Same ending: ${item.outcome.text} Here is another event: ${item.card.text}`
);

/** What the learner is asked on one item. Never the answer: a root pick's key is checked against it (`askLeaks`). */
export const askFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause':
      return `${identifyStimulus(item)} ${elicitFor(item)}`;
    case 'build_chain':
    case 'root_vs_proximate':
      return `${outcomeLine(item)} ${cardsClause(item)} ${elicitFor(item)}`;
  }
};

/** What the ask says by design: the cards it reads aloud to a learner who cannot read them (the menu is the cards). */
export const askGiven = (item: CauseEffectChainItem): string[] =>
  (item.kind === 'root_vs_proximate' && item.emergingReader ? item.cards.map((c) => c.text) : []);

// ============================================================================
// The spoken key
// ============================================================================

const plain = (t: string) => t.replace(/[.!?]+$/, '');
const PLACES = ['the first one', 'the second one', 'the third one', 'the fourth one', 'the fifth one', 'the sixth one'];
const quoted = (words: readonly string[]) => words.map((w) => `"${w}"`).join(', ');

/**
 * The key a spoken item is judged against; null on a chain, which the board checks. identify_cause is a yes/no menu
 * the ask says in full. root_vs_proximate is the card, with its own distinctive words and its place on screen as short
 * forms; a short form the ask itself says (a word of the ending, "before") is dropped, since saying it picks no card.
 */
export function causeEffectKey(item: CauseEffectChainItem): SpokenKey | null {
  if (item.kind === 'build_chain') return null;
  if (item.kind === 'identify_cause') {
    const right = item.isCause ? 'yes' : 'no';
    const why = item.role === 'cause' ? 'it came before the ending and the ending needed it'
      : item.role === 'consequence' ? 'it could only happen once the ending had already happened'
        : 'it was true at the time but pushed nothing along';
    return {
      answer: right,
      alsoAccept: item.isCause ? ['yeah', 'it did', 'it helped'] : ['nope', 'it did not', 'it didn\'t'],
      menu: ['yes', 'no'],
      acceptRule: `"${plain(item.card.text)}" ${item.isCause ? 'helped' : 'did not help'} cause the ending, because ${why}. `
        + `Any natural form of ${right} counts, alone or in a sentence.`,
      signatureError: 'Saying the event back, "maybe" or "sort of" gives no verdict. '
        + (item.role === 'consequence' ? 'Being about the same people or things is not being a cause.'
          : item.role === 'background' ? 'Being true at the time is not being a cause.'
            : 'A cause does not have to be the last or the biggest event.'),
    };
  }
  const c = correctChoiceOf(item);
  // The ask as a reader hears it: the ending and the move, without the cards a pre-reader also hears.
  const frame = askFor({ ...item, emergingReader: false });
  const others = item.choices.filter((_, i) => i !== item.correctIndex).map((o) => plain(o.card.text));
  return {
    answer: plain(c.card.text),
    alsoAccept: [c.distinguisher, ...c.alsoCounts, PLACES[item.correctIndex]].filter((w) => w && !containsPhrase(frame, w)),
    acceptRule: `It is the ${item.ask === 'proximate' ? 'event right before the ending' : 'root, the event none of the others '
      + 'could happen without'}, and it is ${PLACES[item.correctIndex].replace(' one', ' card')} on screen. `
      + 'A short form counts on its own or inside a sentence.',
    signatureError: `Any other event is wrong (${quoted(others)}), and so is an answer that does not pick exactly one event. `
      + (item.ask === 'proximate'
        ? 'Naming the earliest event, the root, because it sounds most important is the usual mistake.'
        : 'Naming the event right before the ending, because it is closest to it, is the usual mistake.'),
  };
}

// ============================================================================
// Known misses
// ============================================================================

/**
 * identify_cause's known wrong answer, stated from the event's role: a real cause said not to help, an event that
 * came after the ending said to cause it, or a background fact said to cause it. root_vs_proximate: the event at the
 * other end of the chain (`other_end`, the signature miss), or one from its middle (`middle_event`).
 */
export function causeEffectSpokenMisses(item: CauseEffectChainItem): KnownMiss[] {
  if (item.kind === 'root_vs_proximate') return endMisses(item);
  if (item.kind !== 'identify_cause') return [];
  const event = plain(item.card.text), ending = plain(item.outcome.text);
  if (item.isCause) return [{ id: 'cause_denied', pattern: `The right answer is "yes": "${event}" came before "${ending}" and helped cause it. The learner gives the opposite answer, "no" (or "nope", "it did not").`,
    examples: ['no', 'it did not'] }];
  return [item.role === 'consequence'
    ? { id: 'consequence_as_cause', pattern: `The right answer is "no": "${event}" could only happen after "${ending}" had already happened. The learner gives the opposite answer, "yes" (or "yeah", "it helped").`, examples: ['yes', 'it helped'] }
    : { id: 'background_as_cause', pattern: `The right answer is "no": "${event}" was only true at the time and pushed nothing along toward "${ending}". The learner gives the opposite answer, "yes" (or "yeah", "it helped").`, examples: ['yes', 'it helped'] }];
}

/** root_vs_proximate's known wrong answers, by where the named card sits in the chain. */
function endMisses(item: RootProximateItem): KnownMiss[] {
  const right = correctChoiceOf(item);
  const otherId = item.ask === 'proximate' ? item.correctOrder[0] : item.correctOrder[item.correctOrder.length - 1];
  const other = item.choices.find((c) => c.card.id === otherId);
  const middle = item.choices.filter((c) => c !== right && c !== other);
  const asked = item.ask === 'proximate' ? 'the event right before the ending' : 'the root';
  const misses: KnownMiss[] = [];
  if (other) misses.push({ id: 'other_end', pattern: `The right answer is "${plain(right.card.text)}", ${asked}. The learner names `
    + `"${plain(other.card.text)}" instead, the event at the other end of the chain.`, examples: [other.distinguisher] });
  if (middle.length) misses.push({ id: 'middle_event', pattern: `The right answer is "${plain(right.card.text)}", ${asked}. The learner `
    + `names an event from the middle of the chain: ${middle.map((c) => `"${plain(c.card.text)}"`).join(' or ')}.`,
    examples: middle.map((c) => c.distinguisher).slice(0, 6) });
  return misses;
}

// ============================================================================
// The scene and the board
// ============================================================================

/** The cards in on-screen order, numbered: the page's own shuffle, never the causal order. */
const cardList = (item: CauseEffectChainItem) => item.cards.map((c, i) => `${i + 1}. ${c.text}`).join(' ');

/** Never-say rules that are this primitive's own: the cards are the answer in pieces, shuffled on purpose. */
const neverOrder = (extra = '') => `Never say which event comes first, next or last${extra}, and never single out one card as a hint.`;

/** The scene the tutor reads. `practice`: the item is an easier practice item a simplify lever opened. */
export function causeEffectScene(item: CauseEffectChainItem, context: string, placed: readonly (string | null)[],
  practice = false): SceneOf {
  const facts: Record<string, string> = {
    ...(context ? textFacts('background', context) : {}),
    ending: item.outcome.text,
    // root_vs_proximate's practice item is drawn in causal order (`ordered_chain`).
    ...(practice ? { practice: `An easier practice item, ungraded. The full item comes back after it.${item.kind === 'root_vs_proximate'
      ? ' Its cards are drawn in order, earliest at the top, each leading to the next and the ending last.' : ''}` } : {}),
  };
  if (item.kind === 'identify_cause') {
    facts.event = `The one event on screen: ${item.card.text}`;
    facts.constraints = 'Nothing marks the event as a cause until the answer is credited. '
      + 'Never say whether another event of the story is a cause, or how many of the events are causes.';
  } else if (item.kind === 'root_vs_proximate') {
    facts.events = `Event cards on screen, numbered in the order they sit: ${cardList(item)}`;
    facts.constraints = `Nothing marks the answer until it is credited. ${neverOrder()}`;
  } else {
    facts.events = `Event cards on screen, in shuffled order: ${cardList(item)}`;
    facts.board = describeChain(item, placed);
    facts.constraints = neverOrder(' or where a card belongs');
  }
  if (item.emergingReader) facts.constraints += ' The learner does not read yet: read the ending and the events aloud '
    + 'when the ask carries them, in the order given.';
  return { objects: [], facts } as SceneOf;
}

/** Whether the full board is the chain the ending needed. */
export function chainMatches(item: BuildChainItem, placed: readonly (string | null)[]): boolean {
  return placed.length === item.correctOrder.length && placed.every((id, i) => id === item.correctOrder[i]);
}

/**
 * What a checked wrong chain shows (handoff 20): `reversed` (the order run backwards), `two_swapped` (only two cards
 * out of place), `other_order`.
 */
export function chainMiss(item: BuildChainItem, placed: readonly (string | null)[]): ChainMiss | undefined {
  if (chainMatches(item, placed) || placed.length !== item.correctOrder.length) return undefined;
  if (placed.every((id, i) => id === item.correctOrder[item.correctOrder.length - 1 - i])) return 'reversed';
  return placed.filter((id, i) => id !== item.correctOrder[i]).length === 2 ? 'two_swapped' : 'other_order';
}

/** The learner's board in words, slot by slot. Never the key. */
export function describeChain(item: BuildChainItem, placed: readonly (string | null)[]): string {
  const text = (id: string | null) => (id ? item.cards.find((c) => c.id === id)?.text ?? id : 'empty');
  if (!placed.length) return 'The chain slots are empty.';
  return `The chain, earliest first: ${placed.map((id, i) => `slot ${i + 1}: ${text(id)}`).join('; ')}.`;
}

/** What the background's read-aloud asks the tutor: the paragraph, word for word. It never says what caused what. */
export const hearBackgroundRequest = (context: string) =>
  `The learner tapped to hear the background. Read it aloud once, word for word, and nothing else: "${context}"`;

// ============================================================================
// The harness
// ============================================================================

/** The journey's spoken answers: the key's own short form, or another card's (a middle card, else the other end). */
export function causeEffectHarnessAnswers(item: CauseEffectChainItem): { correct: string; plainWrong: string } {
  if (item.kind === 'identify_cause') return { correct: item.isCause ? 'yes' : 'no', plainWrong: item.isCause ? 'no' : 'yes' };
  if (item.kind === 'build_chain') throw new Error(`cause-effect-chain: item ${item.id} is built, not said`);
  const c = correctChoiceOf(item);
  const otherEndId = item.ask === 'proximate' ? item.correctOrder[0] : item.correctOrder[item.correctOrder.length - 1];
  const wrong = item.choices.find((ch, i) => i !== item.correctIndex && ch.card.id !== otherEndId)
    ?? item.choices.find((_, i) => i !== item.correctIndex)!;
  return { correct: causeEffectKey(item)!.alsoAccept[0] ?? plain(c.card.text), plainWrong: wrong.distinguisher };
}

/** The journey's chain: the cards in causal order, or reversed (the ordering mode's own signature error). */
export const chainOrderFor = (item: BuildChainItem, right: boolean): string[] =>
  (right ? [...item.correctOrder] : [...item.correctOrder].reverse());

/** The bank chip's label for a card, as the component prints it (the harness taps by it). */
export const placeLabel = (card: ChainCard) => `Place "${card.text}"`;
