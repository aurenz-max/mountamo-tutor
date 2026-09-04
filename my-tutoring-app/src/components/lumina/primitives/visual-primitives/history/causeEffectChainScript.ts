/**
 * Cause & Effect Chain — the judged DI script (port 25, second history /
 * social-studies port).
 *
 * ── THE MODALITY ────────────────────────────────────────────────────────────
 * TWO of the three modes are SPOKEN; the third is HONEST PAGE WORK. The click
 * era's surface — tap-to-pick chips, a Check button per rung, a Next button, a
 * hint disclosure, a two-strikes reveal ladder, and every improvised tutor
 * turn — is deleted. What each mode becomes is the answer-material fork, run
 * on the teacher-at-a-table picture (user ruling 2026-08-13):
 *
 *   identify_cause     ONE spoken yes/no PER CARD                  `yes_no`
 *   build_chain        the cards placed in order, with the hands   `manipulation`
 *   root_vs_proximate  say WHICH card the question is after        `closed_set_choice`
 *
 * ── WHY identify_cause IS ONE ASK PER CARD (defect class 1) ─────────────────
 * The click era's "which of these five are causes?" was one screenful graded
 * as a set. A judged item is one ask with one answer, and the reasoning this
 * rung measures is PER CARD: did this come before the ending, and did the
 * ending need it? A teacher at a table holds up one card and asks exactly
 * that. So a challenge expands into a run of yes/no items — every non-cause
 * card the generator wrote, and the same number of causes, so a child who
 * always says one word scores at chance. The set answer never existed out
 * loud; the per-card verdict is what a child can SAY. (word-sorter's rule: a
 * sort is one ask per thing sorted.)
 *
 * ── WHY build_chain IS A GESTURE, AND NOT A HEDGE ───────────────────────────
 * The answer is a PERMUTATION of prose cards. That is the third unsayable
 * shape in the skill's own table — a BUILD / PLACEMENT, where the arrangement
 * IS the answer and naming it is a different task. Picture the table: the
 * teacher lays three cards down and says "put them in the order they
 * happened" — the child moves the cards. The screen plays that page. The
 * judge is never asked to hear a three-sentence sequence; the match is
 * computed in code and the tutor is handed its exact line (`chainVerdictCue`).
 * A hands turn closes on STILLNESS — once every slot is filled and the board
 * stops changing, the chain commits. Completeness-gated, never
 * correctness-gated: a wrong full chain commits exactly as readily as a right
 * one, which is what makes it judgeable at all.
 *
 * ── WHY root_vs_proximate IS `closed_set_choice` ────────────────────────────
 * The answer is one whole proposition out of the 3-4 the cards state, and
 * free production of it is open-set. The menu is ON SCREEN (the cards), so the
 * ask names the move and the CONTRACT names the choices, with the accept clause
 * carrying the short forms a child actually says — a card's own distinctive
 * words, or its position as it sits on the screen. Ear-separability is a
 * build gate (`chainEarSeparable`): every card must own a content word no
 * other card has, or an utterance fits two of them and there is no honest
 * verdict. The generator imports the same gate, so a chain that cannot be
 * asked this way is never STAMPED with this rung.
 *
 * ── THE ANSWER IS ANSWERED ONCE (defect class 2) ────────────────────────────
 * Every challenge serves exactly one rung (the generator stamps it), so no
 * chain is both built and then asked about. Inside an identify run each card
 * is asked once. Nothing an affirmation names comes back as a later question.
 *
 * ── WHAT THE CLICK ERA'S TIER LEVERS BECOME ─────────────────────────────────
 *   showStrategy      → the guide line, spoken at `easy` only, and only where
 *                       the how-to-play is (the introduction of an action)
 *   showHint          → deleted; the scripted correction re-models the RULE
 *                       instead, so the tutor can no longer hand back what the
 *                       tier withdrew — it is no longer improvising
 *   showSlotNumbers   → survives as a PAGE lever on the build_chain board
 *   showCategoryLabels→ survives as a PAGE lever on every card (the icon stays
 *                       at every tier — the emerging reader's channel)
 * The L4 structural axis (link distance, background nearness) is untouched:
 * it shapes the CONTENT, and the content is what every ask reads.
 *
 * ── THE LEAK GATES LIVE HERE, AND THE GENERATOR IMPORTS THEM ────────────────
 * `cardSpeakable` (a card is read ALOUD now: no double quote, which would
 * close the cue's own span; no sentinel opener, which the reducer would read
 * as a verdict) and `chainEarSeparable` run on both sides of the wire from
 * this one definition. The generator's own audits (ordinal words, causal
 * connectives, dates) stay where they are — they protect the ORDER, which is
 * the same answer whether the cards are tapped or heard.
 *
 * ── SENTINELS ───────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"). Outcomes and cards are generated and
 * spoken, so every one is scanned in `itemFromChallenge` and the challenge
 * drops rather than being reworded.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';

export { opensWithSentinel };

// ============================================================================
// Domain
// ============================================================================

export type ChainKind = 'identify_cause' | 'build_chain' | 'root_vs_proximate';
export type ChainTier = 'easy' | 'medium' | 'hard';
export type ChainAsk = 'root' | 'proximate';
/** What a card IS to the ending. Only `identify_cause` sees non-causes. */
export type ChainCardRole = 'cause' | 'consequence' | 'background';

/** Ladder order: locate → connect → analyze. Also the order items ship in,
 *  which is what keeps the how-to-play from being re-recited (defect 13). */
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

/** Nothing spoken may carry a double quote: the cue's own quoted span ends at
 *  the first one, so a quoted card would truncate the tutor's line and strand
 *  the judging contract outside it. */
const hasQuote = (s: string): boolean => /["“”]/.test(s);

/**
 * Can this card be READ ALOUD inside a cue? A real sentence, quote-free, and
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
 *  - defect 13 — the runner re-speaks the how-to-play whenever `action`
 *    changes, so the modes ship as RUNS in `CHAIN_KINDS` order, which is also
 *    the ladder: locate → connect → analyze.
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

// ============================================================================
// Spoken pieces
// ============================================================================

/** "In the end: A busy town grows up where the tracks cross the river." — the
 *  ending is the ONE thing on screen every ask may name freely. */
const outcomeLine = (item: CauseEffectChainItem): string => `In the end: ${item.outcome.text}`;

/** The cards, read in on-screen order. Question-side by construction: the
 *  page order is the generator's shuffle, provably not the answer order. */
const cardsLine = (cards: readonly ChainCard[]): string =>
  `Here are the events: ${cards.map((c) => c.text).join(' ')}`;

/** Where the cards go in the ask: read aloud for a child who cannot read
 *  them, left on the page for one who can (tap-to-hear reads them for anyone). */
const cardsClause = (item: CauseEffectChainItem): string =>
  (item.emergingReader ? cardsLine(item.cards) : 'The events are on the cards.');

export const howToPlayFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause':
      return 'I tell you how something ended, then I read you one event at a time — you say yes if it helped cause the ending, or no if it did not, out loud! ';
    case 'build_chain':
      return 'I tell you how something ended, and the events that led to it are on cards. You build the chain: tap the cards in the order they happened, earliest first, so each one leads to the next. Tap a card in the chain to take it back out, and when your chain is done, hold still and I will look. ';
    case 'root_vs_proximate':
      return 'I tell you how something ended and show you the events — you say which ONE event the question is after, out loud! ';
  }
};

/**
 * The model line states the RULE on no content at all and therefore
 * discloses nothing — the reason it can be spoken, and the line the
 * CORRECTION re-models at every tier.
 */
export const modelLineFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause':
      return 'An event is a cause when the ending could not have happened without it. Something that happened afterwards, or was simply true at the time, is not a cause.';
    case 'build_chain':
      return 'The earliest event is the one that could happen before any of the others, and each event makes the next one possible.';
    case 'root_vs_proximate':
      return 'The root is the event nothing else could have happened without. The one right before the ending is simply the final step before it.';
  }
};

/** The historian's test, named. This is `showStrategy` — the click era's easy
 *  tier printed it under the question; the tier is a spoken lever now. */
export const guideLineFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause': return 'Ask yourself: did this come before the ending, and did the ending need it?';
    case 'build_chain': return 'Ask which event could not have happened until another one had happened first.';
    case 'root_vs_proximate': return 'Ask what the whole chain rests on — take that event away and nothing else could follow.';
  }
};

/** Speaks ONLY where the how-to-play does (the introduction of an action),
 *  never per item — DISTAR fades the model, it does not re-read it. */
export const leadInFor = (item: CauseEffectChainItem): string => {
  switch (item.tier) {
    case 'hard': return '';
    case 'easy': return `${modelLineFor(item)} ${guideLineFor(item)} `;
    case 'medium':
    default: return `${modelLineFor(item)} `;
  }
};

/** The short re-elicit — the part of the ask that names the move. */
export const elicitFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause':
      return 'Did this event help cause the ending — yes or no?';
    case 'build_chain':
      return 'Put the cards in the order they happened, so each one leads to the next.';
    case 'root_vs_proximate':
      return item.ask === 'proximate'
        ? 'Say which event came right before the ending — the final step before it.'
        : 'Say which event is the root — the one that had to happen before any of the others could.';
  }
};

/** The stimulus half of an identify ask: the ending, stated in full on the
 *  first card of a run and briefly on the rest, then the ONE card. */
const identifyStimulus = (item: IdentifyCauseItem): string => (
  item.ordinal === 0
    ? `${outcomeLine(item)} Here is one event: ${item.card.text}`
    : `Same ending: ${item.outcome.text} Here is another event: ${item.card.text}`
);

const askFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause':
      return `Listen. ${identifyStimulus(item)} Your turn. ${elicitFor(item)}`;
    case 'build_chain':
    case 'root_vs_proximate':
      return `Listen. ${outcomeLine(item)} ${cardsClause(item)} Your turn. ${elicitFor(item)}`;
  }
};

// ============================================================================
// Corrections and affirmations — DISTAR re-model then re-elicit
// ============================================================================
// Neither lands the answer: the correction re-models the RULE and hands the
// question back, so the child still earns it. The tier hid the historian's
// test on screen — the tutor may not give it back, and cannot: the correction
// is SCRIPTED, not improvised.

const correctionFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause':
      return `My turn: ${modelLineFor(item)} Your turn. Listen again. ${identifyStimulus(item)} ${elicitFor(item)}`;
    case 'build_chain':
      // The board is cleared by the activity when this line is spoken, so the
      // re-elicit is "build it again", never "move that card".
      return `My turn: ${modelLineFor(item)} Your turn. Build the chain again.`;
    case 'root_vs_proximate':
      return `My turn: ${modelLineFor(item)} Your turn. Listen again. ${outcomeLine(item)} ${cardsClause(item)} ${elicitFor(item)}`;
  }
};

const affirmFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause':
      // "Yes," in the DISTAR sense — *you are right* — even when it affirms a
      // correct NO (the yes_no class notes, proven in the rhyme-studio log).
      switch (item.role) {
        case 'cause': return 'Yes, it helped cause the ending — it came before, and the ending needed it.';
        case 'consequence': return 'Yes, that one is not a cause — it could only happen once the ending had already happened.';
        case 'background': return 'Yes, that one is not a cause — it was true at the time, but it pushed nothing along.';
      }
      break;
    case 'build_chain':
      return 'Yes, that is the order things had to happen in — each one made the next one possible.';
    case 'root_vs_proximate':
      return item.ask === 'proximate'
        ? 'Yes, that one came right before the ending — nothing else happened in between.'
        : 'Yes, that is the root — take that event away and none of the rest could have happened.';
  }
  return 'Yes, that is right.';
};

/** Correction cap reached: CLOSE THE LINK by naming what the corrections could not. */
const closeLineFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause':
      return item.isCause ? 'That one did help cause the ending. ' : 'That one was not a cause. ';
    case 'build_chain': {
      const byId = new Map(item.cards.map((c) => [c.id, c.text.replace(/[.!?]$/, '')]));
      return `The chain went: ${item.correctOrder.map((id) => byId.get(id) ?? '').join(', then ')}. `;
    }
    case 'root_vs_proximate': {
      const answer = correctChoiceOf(item).card.text;
      return item.ask === 'proximate'
        ? `The one right before the ending was: ${answer} `
        : `The root was: ${answer} `;
    }
  }
};

// ============================================================================
// The laws (family wording, grep-able)
// ============================================================================

const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/** Defect class 5 (word-sorter: 11 of 12 affirmations ran on into a fabricated
 *  next ask). Named on every contract AND in the catalog directive. */
const VERDICT_ENDS_THE_TURN =
  `Your reply ends when that quoted line ends — never run on into another question, another event, `
  + `another ending, or a next round of your own: the activity sends you every next question itself. `;

/**
 * Defect class 6, in this primitive's shape. The cards are the answer in
 * pieces, and they are on screen, described to the tutor — so the tail forbids
 * volunteering the cards, the order and the method, not merely a bracket tag.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never read the background or the cards aloud unless a message asks you to, `
  + `never say which event is a cause, which comes first, next or last, or which one the question is after, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

// ============================================================================
// The judging contracts
// ============================================================================

const HEAD =
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks and `
  + `looks at the cards, and their think time is unbounded. Never say the answer during their turn. `;

const identifyContract = (item: IdentifyCauseItem): string => {
  const right = item.isCause ? 'YES' : 'NO';
  const wrong = item.isCause ? 'NO' : 'YES';
  const why = item.role === 'cause'
    ? 'this event came before the ending and helped make it happen'
    : item.role === 'consequence'
      ? 'this event could only happen once the ending had already happened, so it is not a cause'
      : 'this event was true at the time but pushed nothing along, so it is not a cause';
  // `yes_no` carries the VC-length worry as LATITUDE: a child says "yeah",
  // "uh huh", "nope", "it did", "it didn't" at least as often as the bare word.
  const variants = item.isCause
    ? `'yes', 'yeah', 'uh huh', 'it did', 'it helped', or a plain nod of a word`
    : `'no', 'nope', 'uh uh', 'it did not', 'it didn't', or any clear refusal`;
  const signature = item.role === 'cause'
    ? `The signature miss is saying no because this event is not the LAST thing that happened, or not the biggest — a cause does not have to be the closest one or the biggest one; it only has to come before and make the ending possible. `
    : item.role === 'consequence'
      ? `The signature miss is saying yes because this event is about the same people and things — connected is not the same as caused, and this one came AFTER the ending. `
      : `The signature miss is saying yes because this event was true at the time — being true at the time is not the same as pushing the ending along. `;
  return (
    HEAD
    + `The learner answers YES or NO, out loud. The correct answer is ${right}: ${why}. `
    + `Anything that plainly means ${right} counts — ${variants} — and so does any of them inside a longer sentence. `
    + `Judge the MEANING of what you heard, not the exact word. Anything that plainly means ${wrong} is wrong. `
    + `If the learner only says the event back, hedges with 'maybe' or 'sort of', or says something you cannot read as yes or no, that is not an answer — count it wrong and run the correction. `
    + signature
    + TWO_BRANCH_LAW + VERDICT_ENDS_THE_TURN
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

/** The gesture contract is a SILENCE contract (spell_word's pattern): there is
 *  nothing to judge until the placement is described, and the order is banned
 *  from the tutor's mouth for the whole item. */
const silenceContract = (): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS by placing the cards, not with their voice, so you then stay completely silent. `
  + `Never say which card comes first, next or last, never say where a card belongs, and do not narrate what they are doing or fill the pause. `
  + `You will be told what they built and whether it matches; only then do you speak.`;

const rootContract = (item: RootProximateItem): string => {
  const c = correctChoiceOf(item);
  const others = item.choices
    .filter((_, i) => i !== item.correctIndex)
    .map((o) => `'${o.distinguisher}'`)
    .join(' or ');
  const shorts = [c.distinguisher, ...c.alsoCounts, ORDINALS[item.correctIndex]]
    .filter(Boolean)
    .map((w) => `'${w}'`)
    .join(', ');
  const signature = item.ask === 'proximate'
    ? `The signature miss is naming the EARLIEST event — the root — because it sounds like the most important one. The question asks for the last thing to happen, not the biggest. Count it wrong and correct it. `
    : `The signature miss is naming the event that happened LAST — the one right before the ending — because it is the closest to it. Closest is not the root. Count it wrong and correct it. `;
  return (
    HEAD
    + `The learner names ONE of the ${item.choices.length} events on the cards, and the correct one is ${ORDINALS[item.correctIndex]} as the cards sit on the screen: '${c.card.text}' `
    + `A child never says a whole card back: ${shorts} all count on their own, and so does any of them inside a longer sentence. `
    + `Naming ${others} is wrong. `
    + signature
    + `If what they said does not clearly pick one event, it is wrong. `
    + TWO_BRANCH_LAW + VERDICT_ENDS_THE_TURN
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

const contractFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause': return identifyContract(item);
    case 'build_chain': return silenceContract();
    case 'root_vs_proximate': return rootContract(item);
  }
};

// ============================================================================
// Cues
// ============================================================================

export interface ChainCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export const itemCue = (item: CauseEffectChainItem, opts: ChainCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time to be a historian and work out what led to what! ' : '';
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return `[CEC_ITEM] Say exactly: "${spoken}" ${contractFor(item)} ${NEVER_PERFORM}`;
};

/**
 * The gesture verdict ask (`build_chain`): describes what the child committed
 * and hands the tutor its exact line. THE MATCH IS COMPUTED IN CODE — the
 * tutor is never asked to read a permutation. `placed` is the slot order as
 * card ids joined by commas, which is what the stage commits.
 */
export const chainVerdictCue = (item: BuildChainItem, placed: string): string => {
  const order = placed.split(',').map((s) => s.trim()).filter(Boolean);
  const matches = order.length === item.correctOrder.length
    && order.every((id, i) => id === item.correctOrder[i]);
  const head = `[CEC_CHAIN] The learner filled every slot of the chain; the order they built ${matches ? 'MATCHES' : 'does NOT match'} the order the ending needed. `;
  const line = matches
    ? `Say exactly: "${affirmFor(item)}" `
    : `Say exactly: "${correctionFor(item)}" `;
  return `${head}${line}Never read bracket tags aloud, and never say which card belongs where.`;
};

export const moveOnCue = (
  item: CauseEffectChainItem,
  next: CauseEffectChainItem | null,
  opts: ChainCueOptions = {},
): string => {
  const close = closeLineFor(item);
  if (!next) {
    return (
      `[CEC_MOVE] Say exactly: "Good try! ${close}Working out what led to what takes practice — we will trace another story another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  return (
    `[CEC_MOVE] Say exactly: "Good try! ${close}Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${contractFor(next)} ${NEVER_PERFORM}`
  );
};

export const completeCue = (): string =>
  `[CEC_COMPLETE] Say exactly: "What good history today! You worked out what had to happen before what, all by yourself. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION — the ending and the cards in on-screen
 *  order — never the answer and never a hint. */
export const pronounceCue = (item: CauseEffectChainItem): string => {
  const stimulus = item.kind === 'identify_cause'
    ? `${outcomeLine(item)} Here is the event: ${item.card.text}`
    : `${outcomeLine(item)} ${cardsLine(item.cards)}`;
  return (
    `[CEC_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: `
    + `"Listen again. ${stimulus} ${elicitFor(item)}" `
    + `Read the events in exactly the order given. Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * READ THE BACKGROUND ALOUD — the shared "story so far", the pre-reader's
 * channel to the setting, and the one cue in this pack the runner does not own.
 * Question-side by construction: the background sets the period and never
 * states what caused what (the generator's own rule). Returns null for a
 * paragraph that cannot be safely spoken.
 */
export const contextCue = (context: string): string | null => {
  if (!context || opensWithSentinel(context) || hasQuote(context)) return null;
  return (
    `[CEC_CONTEXT] The learner tapped to hear the background and cannot read it themselves. `
    + `Say ONLY this, warmly and slowly, then wait: "${context}" `
    + `Read it word for word. Do not summarise it, do not add a question, do not treat anything you just `
    + `heard as an answer, and never say what caused what. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY, and
 * answer-free by construction: no card text, no order, no count of causes.
 *
 * Defect 12: this string goes LAST in the catalog's `taskDescription`, with
 * the never-read-aloud clause IMMEDIATELY before it.
 */
export const stimulusFor = (item: CauseEffectChainItem): string => {
  switch (item.kind) {
    case 'identify_cause':
      return 'the ending on a card, and beneath it the one event being asked about; '
        + 'this state line is for you alone and is never spoken to the learner';
    case 'build_chain':
      return 'a column of empty chain slots leading down to the ending, and a bank of shuffled event cards the learner is placing with their hands';
    case 'root_vs_proximate':
      return 'the ending on a card, and the event cards laid out in a shuffled row, numbered in the order they sit on the screen';
  }
};

// ============================================================================
// THE WIRE — what the tutor is told, shared with the DI drive harness
// ============================================================================

export const causeEffectChainPackBase = (
  items: CauseEffectChainItem[],
): JudgedCueSurface<CauseEffectChainItem> => ({
  primitiveType: 'cause-effect-chain',
  activityLine: 'live direct instruction historical causation practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.challengeType,
    stimulus: stimulusFor(item),
  }),
});

// ============================================================================
// Harness answer material — what a right and a wrong child sound like
// ============================================================================

export interface ChainHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** Order-committed gesture (build_chain): the slot order as card ids. */
  tapped?: { correct: string; wrong: string };
  leakTokens: string[];
  leakExemptSpan: string[];
}

export const causeEffectChainHarnessAnswers = (item: CauseEffectChainItem): ChainHarnessAnswers => {
  // The model line and the guide line are exempt for the same reasons as on
  // era-explorer: the model is re-spoken by every correction, the guide only
  // where the tier speaks it.
  const exempt = [modelLineFor(item), ...(item.tier === 'easy' ? [guideLineFor(item)] : [])];

  switch (item.kind) {
    case 'identify_cause': {
      const right = item.isCause ? 'yes' : 'no';
      const wrong = item.isCause ? 'no' : 'yes';
      return {
        correct: right,
        plainWrong: wrong,
        signatureWrong: item.role === 'cause'
          ? { text: 'no, that was not the last thing that happened', why: 'a real cause refused because it is not the closest event to the ending' }
          : item.role === 'consequence'
            ? { text: 'yes, it is about the same thing', why: 'a consequence affirmed because it is connected — connected is not caused' }
            : { text: 'yes, that was true back then', why: 'inert background affirmed because it was true at the time' },
        // The answer words are in the question by construction ("yes or no?").
        leakTokens: [],
        leakExemptSpan: exempt,
      };
    }
    case 'build_chain': {
      const reversed = [...item.correctOrder].reverse();
      return {
        correct: 'the cards placed in causal order',
        plainWrong: 'the cards placed in reverse order',
        tapped: { correct: item.correctOrder.join(','), wrong: reversed.join(',') },
        leakTokens: [],
        leakExemptSpan: [cardsLine(item.cards), ...exempt],
      };
    }
    case 'root_vs_proximate': {
      const c = correctChoiceOf(item);
      // The OTHER end of the chain is the signature wrong — the root named when
      // the last event was asked for, or the last event named when the root
      // was — and any middle card is the plain wrong.
      const otherEndId = item.ask === 'proximate'
        ? item.correctOrder[0]
        : item.correctOrder[item.correctOrder.length - 1];
      const otherEnd = item.choices.find((ch) => ch.card.id === otherEndId)
        ?? item.choices.find((_, i) => i !== item.correctIndex)!;
      const plain = item.choices.find((ch, i) => i !== item.correctIndex && ch.card.id !== otherEnd.card.id)
        ?? otherEnd;
      return {
        correct: c.distinguisher,
        plainWrong: plain.distinguisher,
        signatureWrong: {
          text: otherEnd.distinguisher,
          why: item.ask === 'proximate'
            ? 'the ROOT named when the last event was asked for — "the biggest" mistaken for "the last"'
            : 'the LAST event named when the root was asked for — "the closest" mistaken for "the root"',
        },
        leakTokens: [c.distinguisher],
        // The cards are read aloud in the ask at K-2 (the pre-reader's channel)
        // and the answer is among them by construction — the mats rule.
        leakExemptSpan: [cardsLine(item.cards), ...exempt],
      };
    }
  }
};
