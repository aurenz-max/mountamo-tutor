/**
 * periodicTableScript — HAND-AUTHORED judged-loop script for periodic-table
 * (first CHEMISTRY DI port; qa/di/BACKLOG.md). The exact wording IS the
 * pedagogy; these lines are authored per pack, never generated.
 *
 * ── WHY THIS PORT EXISTS ────────────────────────────────────────────────────
 * The catalog declared three eval modes (explore / identify / trend) with
 * `supportsEvaluation: true` — and they were FICTION. The generator emitted no
 * challenges and the component rendered none: every lesson slot that pinned an
 * eval mode got a free-exploration surface and no measurement at all. This
 * port builds the judged item stream for the first time, so there was no
 * click-loop to delete — the deletions census will find nothing, and that is
 * correct.
 *
 * ── CONTENT IS CODE, NOT GEMINI ─────────────────────────────────────────────
 * All 118 elements live in `./constants` with name, symbol, group, period,
 * category and shells. Every answer key here is COMPUTED from that table —
 * no LLM ever writes an answer, so the flash-lite failure family (babble
 * fields, truncated schemas, false keys like x→"box") is structurally absent.
 * What remains gate-worthy is the CHEMISTRY: a spoken ask audits the content
 * (add-di-loop defect 8), and three of this file's gates exist because the
 * honest answer and the taught heuristic can disagree (see the valence gate).
 *
 * ── THE SPLIT (standing gate 1 arithmetic, not a preference) ────────────────
 *
 *   find     the answer is a POSITION  → GESTURE `manipulation`   ('explore')
 *   name     the answer is a NAME      → VOICE `short_spoken_word` ('identify')
 *   compare  the answer is 1 of 2      → VOICE `closed_set_choice` ('trend')
 *   valence  the answer is a COUNT     → VOICE `number_word_to_20` ('trend')
 *
 * The table picture (user ruling 2026-08-13): a teacher and one student with a
 * printed periodic table between them. "Point to calcium" is answered by
 * POINTING — the screen is that paper, so `find` taps, and one tap is one
 * commit (counting-board's structural close; no stillness window needed).
 * Everything else the student would say across the table, so it is said:
 * an element's name, one name of two, a count of outer electrons.
 *
 * The table stays FULLY LABELED during voice items and that is deliberate:
 * `identify`'s skill IS using the table — navigate by group/period/number/
 * symbol, then read the name off the box. What the judged surface deletes is
 * the apparatus the table doesn't have: the search bar (types "gold", gets Au
 * — the whole ask answered), the category filter chips, and the tap-to-open
 * element modal (shells and valence on screen during a trend item is the leak
 * in PIXELS). The element card returns as the REVEAL, behind `revealHeld`.
 *
 * ── REVEAL POLICIES ─────────────────────────────────────────────────────────
 *   find by name/symbol/number  the element is the STIMULUS → the ask NAMES it
 *             (a hunt with an unnamed target is broken, not harder). What
 *             stays unsaid is WHERE it is.
 *   find by position  the POSITION is given, the element is the reveal — the
 *             ask never names it (a child could hunt the name label instead of
 *             navigating, which deletes the skill).
 *   name      the name is the ANSWER → no cue says it; corrections re-model
 *             the ROUTE (count across, count down, read the box) and
 *             `moveOnCue` closes the link at the cap.
 *   compare   the two names ARE the ask (the mats rule: a choice whose options
 *             are unknowable is broken, so the menu lives in the question by
 *             construction and is leak-exempt). The WINNER is never said.
 *   valence   the count is the ANSWER → corrections re-model the tall-column
 *             counting rule and never land it.
 *
 * ── SENTINELS ───────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"). Element names are code-owned and none
 * opens with a sentinel token, but `itemFromChallenge` scans them anyway —
 * belt and braces costs one call.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../hooks/judgedScriptContract';
import { ELEMENTS } from './constants';

export { opensWithSentinel };

export type PeriodicChallengeType = 'explore' | 'identify' | 'trend';
export type PeriodicKind = 'find' | 'name' | 'compare' | 'valence';
export type PeriodicFindBy = 'name' | 'symbol' | 'number' | 'position';
export type PeriodicClueBy = 'position' | 'number' | 'symbol';
export type PeriodicCompareAxis = 'size' | 'reactivity';
export type PeriodicTier = 'easy' | 'medium' | 'hard';

/** The slice of an element an item carries — everything a cue or a reveal
 *  card needs, nothing more. Always built from `ELEMENTS`, never generated. */
export interface ElementFacts {
  number: number;
  name: string;
  symbol: string;
  group: number | null;
  period: number;
  category: string;
  /** Electrons in the outermost shell — the honest key for `valence`. */
  outerElectrons: number;
}

export interface PeriodicTableItem extends JudgedScriptItem {
  challengeType: PeriodicChallengeType;
  kind: PeriodicKind;
  tier: PeriodicTier;
  /** find / name / valence: the target. */
  element?: ElementFacts;
  findBy?: PeriodicFindBy;
  clueBy?: PeriodicClueBy;
  /** compare: the two elements ON OFFER, in ask order. */
  pair?: [ElementFacts, ElementFacts];
  axis?: PeriodicCompareAxis;
  /** name / compare: the spoken answer. Never said before a verdict. */
  answerName?: string;
  /** valence: outer-shell electrons, 1..8 by the build gate. */
  answerCount?: number;
}

/** find answers with a TAP (the answer is a position on the page — the first
 *  unsayable shape); everything else is said across the table. */
export const answerKindFor = (kind: PeriodicKind): 'voice' | 'gesture' =>
  kind === 'find' ? 'gesture' : 'voice';

export const responseClassFor = (kind: PeriodicKind): ResponseClassId => {
  switch (kind) {
    case 'find': return 'manipulation';
    case 'name': return 'short_spoken_word';
    case 'compare': return 'closed_set_choice';
    case 'valence': return 'number_word_to_20';
  }
};

// ── Small speakable helpers ─────────────────────────────────────────────────

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;
export const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/** A symbol as the tutor SPELLS it — letter names, comma-paced ("C, a").
 *  Never the symbol read as a word: "He" said as a word is an English word,
 *  and the whole point of a symbol item is the letters. */
export const spellSymbol = (symbol: string): string => symbol.split('').join(', ');

// ── Element lookups (code-owned) ────────────────────────────────────────────

const byNumber = new Map(ELEMENTS.map((e) => [e.number, e]));

export const elementFactsOf = (atomicNumber: number): ElementFacts | null => {
  const e = byNumber.get(atomicNumber);
  if (!e) return null;
  return {
    number: e.number,
    name: e.name,
    symbol: e.symbol,
    // The dataset stamps `group: xpos` on EVERY row — which hands the detached
    // lanthanide/actinide rows a fake group (their column inside the detached
    // block). Honest group = the 18-column position, and only for the main
    // body; a spoken "group 4, period 6" built from a detached row would name
    // hafnium's box while meaning cerium's (defect 8: the ask audits the data).
    group: e.ypos > 7 ? null : e.xpos,
    period: e.period,
    category: e.category,
    outerElectrons: e.electron_shells[e.electron_shells.length - 1] ?? 0,
  };
};

// ── Content pools — ONE address for both sides of the wire ──────────────────
// The generator draws FROM these and the build gates below re-check every
// draw, so a hand-authored or cached payload passes the same chemistry.

/** Elements a middle-schooler is taught by name — the find/name/valence draw
 *  pool. Names outside it (praseodymium…) never reach a spoken ask. */
export const FAMILIAR_ELEMENT_NUMBERS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  26, 28, 29, 30, 35, 36, 47, 50, 53, 54, 56, 78, 79, 80, 82,
];

/** Same-group pools for size comparisons — main-group columns where "lower
 *  down = more shells = bigger" is defensible for every drawable pair. */
export const SIZE_COMPARE_GROUPS: Readonly<Record<number, readonly number[]>> = {
  1: [3, 11, 19, 37, 55],
  2: [4, 12, 20, 38, 56],
  13: [5, 13, 31, 49],
  14: [6, 14, 32, 50, 82],
  15: [7, 15, 33, 51],
  16: [8, 16, 34, 52],
  17: [9, 17, 35, 53],
  18: [2, 10, 18, 36, 54],
};

/** Reactivity comparisons live ONLY where the direction is a taught fact:
 *  alkali metals (down = more reactive) and the four common halogens (up =
 *  more reactive). Hydrogen is group 1 and NOT an alkali metal — the build
 *  gate excludes it by category, because "reactivity grows down this family"
 *  spoken over a pair containing hydrogen is false chemistry (defect 8). */
export const REACTIVITY_COMPARE_GROUPS: Readonly<Record<number, readonly number[]>> = {
  1: [3, 11, 19, 37, 55],
  17: [9, 17, 35, 53],
};

/**
 * Ear-separability blocklist for compare pairs (the closed_set_choice class
 * rule): both names are the menu, so a pair a child's utterance could fit
 * BOTH of is dropped, never judged leniently. Checked per same-group pool:
 * fluorine/chlorine differ in one onset cluster, beryllium/barium share the
 * stressed open, selenium/tellurium share everything past the onset.
 */
export const CONFUSABLE_NAME_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['fluorine', 'chlorine'],
  ['beryllium', 'barium'],
  ['selenium', 'tellurium'],
];

const isConfusablePair = (a: string, b: string): boolean => {
  const lowA = a.toLowerCase();
  const lowB = b.toLowerCase();
  return CONFUSABLE_NAME_PAIRS.some(
    ([x, y]) => (x === lowA && y === lowB) || (x === lowB && y === lowA),
  );
};

// ── Build gates — DROP an unaskable item, never repair it into one ──────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface PeriodicChallengeLike {
  id: string;
  challengeType: string;
  findBy?: string;
  clueBy?: string;
  axis?: string;
  targetNumber?: number;
  pairNumbers?: number[];
}

const FIND_BYS: readonly PeriodicFindBy[] = ['name', 'symbol', 'number', 'position'];
const CLUE_BYS: readonly PeriodicClueBy[] = ['position', 'number', 'symbol'];

/** Position language ("group 2, period 4") is only honest for boxes that SIT
 *  at a group — lanthanides/actinides render detached and carry group null. */
const hasHonestPosition = (e: ElementFacts): e is ElementFacts & { group: number } =>
  e.group != null;

/**
 * One judged item, or null when the challenge cannot be ASKED. The gates and
 * what each protects:
 *  - every referenced atomic number must resolve — no placeholder elements.
 *  - position asks (find-by-position, name-by-position) need a real group.
 *  - compare pairs: same group, distinct periods, ear-separable names; the
 *    reactivity axis additionally demands a family whose direction is a taught
 *    fact (alkali metals by category — excludes hydrogen — or F/Cl/Br/I).
 *  - valence: main group only, AND the tall-column counting rule the
 *    correction teaches must agree with the element's actual outer shell
 *    (group ≤2 → group; group ≥13 → group−10). Helium fails it (rule says 8,
 *    shells say 2) and is dropped — the gate that keeps the taught heuristic
 *    and the honest key from ever disagreeing out loud (defect 8).
 *  - nothing speakable may open with a sentinel token (belt and braces —
 *    element names are code-owned).
 */
export const itemFromChallenge = (
  ch: PeriodicChallengeLike,
  tier: PeriodicTier = 'medium',
): PeriodicTableItem | null => {
  if (ch.challengeType === 'explore') {
    const findBy = ch.findBy as PeriodicFindBy;
    if (!FIND_BYS.includes(findBy)) return null;
    const element = ch.targetNumber != null ? elementFactsOf(ch.targetNumber) : null;
    if (!element || opensWithSentinel(element.name)) return null;
    if (findBy === 'position' && !hasHonestPosition(element)) return null;
    return {
      id: ch.id,
      challengeType: 'explore',
      kind: 'find',
      action: 'find',
      answerKind: 'gesture',
      responseClass: 'manipulation',
      tier,
      element,
      findBy,
    };
  }

  if (ch.challengeType === 'identify') {
    const clueBy = ch.clueBy as PeriodicClueBy;
    if (!CLUE_BYS.includes(clueBy)) return null;
    const element = ch.targetNumber != null ? elementFactsOf(ch.targetNumber) : null;
    if (!element || opensWithSentinel(element.name)) return null;
    if (clueBy === 'position' && !hasHonestPosition(element)) return null;
    return {
      id: ch.id,
      challengeType: 'identify',
      kind: 'name',
      action: 'name',
      answerKind: 'voice',
      responseClass: 'short_spoken_word',
      tier,
      element,
      clueBy,
      answerName: element.name,
    };
  }

  if (ch.challengeType !== 'trend') return null;

  if (ch.axis === 'size' || ch.axis === 'reactivity') {
    const [aNum, bNum] = ch.pairNumbers ?? [];
    const a = aNum != null ? elementFactsOf(aNum) : null;
    const b = bNum != null ? elementFactsOf(bNum) : null;
    if (!a || !b || a.number === b.number) return null;
    if (!hasHonestPosition(a) || !hasHonestPosition(b) || a.group !== b.group) return null;
    if (a.period === b.period) return null;
    if (isConfusablePair(a.name, b.name)) return null;
    if (opensWithSentinel(a.name) || opensWithSentinel(b.name)) return null;

    let winner: ElementFacts;
    if (ch.axis === 'size') {
      winner = a.period > b.period ? a : b;
    } else {
      const pool = REACTIVITY_COMPARE_GROUPS[a.group];
      if (!pool || !pool.includes(a.number) || !pool.includes(b.number)) return null;
      if (a.group === 1 && (a.category !== 'alkali metal' || b.category !== 'alkali metal')) return null;
      // Alkali metals: reactivity grows DOWN. Halogens: it grows UP.
      winner = a.group === 1
        ? (a.period > b.period ? a : b)
        : (a.period < b.period ? a : b);
    }
    return {
      id: ch.id,
      challengeType: 'trend',
      kind: 'compare',
      action: 'compare',
      answerKind: 'voice',
      responseClass: 'closed_set_choice',
      tier,
      pair: [a, b],
      axis: ch.axis,
      answerName: winner.name,
    };
  }

  // trend / valence
  const element = ch.targetNumber != null ? elementFactsOf(ch.targetNumber) : null;
  if (!element || !hasHonestPosition(element) || opensWithSentinel(element.name)) return null;
  const group = element.group as number;
  if (group > 2 && group < 13) return null;
  const taughtCount = group <= 2 ? group : group - 10;
  if (taughtCount !== element.outerElectrons) return null;
  if (element.outerElectrons < 1 || element.outerElectrons > 8) return null;
  return {
    id: ch.id,
    challengeType: 'trend',
    kind: 'valence',
    action: 'valence',
    answerKind: 'voice',
    responseClass: 'number_word_to_20',
    tier,
    element,
    answerCount: element.outerElectrons,
  };
};

/**
 * Build the session, dropping what cannot be asked — AND what cannot be asked
 * SECOND (the session invariant, defect class 2, both halves).
 *
 * Every item CLOSES by naming its element aloud (the affirm and the capped
 * move-on both do), and a compare ask NAMES both of its elements as its menu.
 * So one rule, strict and simple: an element may appear in ONE item per
 * session, in any role. Whoever touches it first keeps it; a later item that
 * references a used element — as target, as either half of a pair — is
 * dropped. The pool is 118 wide and a session is ~6 items; the strict rule
 * costs nothing and closes the answered-thing-returns-as-a-wrong-choice leak
 * that merging the two sets opened on port 7.
 */
export const itemsFromChallenges = (
  challenges: PeriodicChallengeLike[],
  tier: PeriodicTier = 'medium',
): PeriodicTableItem[] => {
  const usedNumbers = new Set<number>();
  const items: PeriodicTableItem[] = [];
  for (const ch of challenges) {
    const item = itemFromChallenge(ch, tier);
    if (!item) continue;
    const touched = item.pair
      ? item.pair.map((e) => e.number)
      : item.element ? [item.element.number] : [];
    if (touched.length === 0 || touched.some((n) => usedNumbers.has(n))) continue;
    touched.forEach((n) => usedNumbers.add(n));
    items.push(item);
  }
  return items;
};

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

export const howToPlayFor = (item: PeriodicTableItem): string => {
  switch (item.kind) {
    case 'find':
      return 'I name an element — you hunt for its box on the big table and tap it! ';
    case 'name':
      return 'I tell you where an element lives — you find its box and say its name out loud! ';
    case 'compare':
      return 'I name two elements — you look at where they sit on the table, and answer out loud! ';
    case 'valence':
      return 'I name an element — you find its column and say how many outer electrons it has! ';
  }
};

// ── The DISTAR lead-in, composed from the SUPPORT TIER ──────────────────────
// easy = model + guide, medium = model, hard = nothing — and it speaks ONLY
// where the how-to-play does (the introduction of an action), never per item.
// For compare and valence the model line states the RULE, which is most of
// the answer's route — that is the tier ladder working as designed: the most
// supported tier hears the rule before the first ask, the hard tier derives
// it, and no tier hears it re-recited every round.

const modelLine = (item: PeriodicTableItem): string => {
  switch (item.kind) {
    case 'find':
      return item.findBy === 'position'
        ? 'Groups are the columns, counted across the top; periods are the rows, counted down the side.'
        : 'Sweep one row at a time, all the way across.';
    case 'name':
      return 'Every box shows its element — the number on top, the symbol in big letters, the name underneath.';
    case 'compare':
      if (item.axis === 'reactivity') {
        return item.pair?.[0].group === 1
          ? 'In this family, elements lower down are more reactive.'
          : 'In this family, elements higher up are more reactive.';
      }
      return 'Going down a column, atoms get bigger — each row down adds a whole shell.';
    case 'valence':
      return 'Count the tall columns only, left to right — that count is the outer electrons.';
  }
};

const guideLine = (item: PeriodicTableItem): string => {
  switch (item.kind) {
    case 'find': return 'Take your time and check the whole table.';
    case 'name': return 'Find the box first, then read its name.';
    case 'compare': return 'Find both boxes before you answer.';
    case 'valence': return 'Skip the short middle block when you count.';
  }
};

const leadInFor = (item: PeriodicTableItem): string => {
  switch (item.tier) {
    case 'hard': return '';
    case 'easy': return `${modelLine(item)} ${guideLine(item)} `;
    case 'medium':
    default: return `${modelLine(item)} `;
  }
};

// ── The asks — short, the problem STATED aloud, one defensible answer ───────

const positionOf = (e: ElementFacts): string => `group ${e.group}, period ${e.period}`;

const askFor = (item: PeriodicTableItem): string => {
  switch (item.kind) {
    case 'find': {
      const e = item.element!;
      switch (item.findBy) {
        case 'name': return `Find ${e.name}. Your turn. Tap its box.`;
        case 'symbol': return `Find the element whose symbol is ${spellSymbol(e.symbol)}. Your turn. Tap its box.`;
        case 'number': return `Find element number ${e.number}. Your turn. Tap its box.`;
        case 'position':
        default: return `Find the element in ${positionOf(e)}. Your turn. Tap its box.`;
      }
    }
    case 'name': {
      const e = item.element!;
      switch (item.clueBy) {
        case 'number': return `Find element number ${e.number}. Your turn. Say its name.`;
        case 'symbol': return `Find the element whose symbol is ${spellSymbol(e.symbol)}. Your turn. Say its name.`;
        case 'position':
        default: return `Look at ${positionOf(e)}. Your turn. Say that element's name.`;
      }
    }
    case 'compare': {
      const [a, b] = item.pair!;
      return item.axis === 'reactivity'
        ? `Find ${a.name} and ${b.name} — same family. Your turn. Which one is more reactive — ${a.name}, or ${b.name}?`
        : `Find ${a.name} and ${b.name} — same group. Your turn. Which atom is bigger — ${a.name}, or ${b.name}?`;
    }
    case 'valence': {
      const e = item.element!;
      return `Find ${e.name} on the table. Look at its column. Your turn. Say how many electrons are in its outer shell.`;
    }
  }
};

// ── Corrections — DISTAR re-model then re-elicit (standing gate 3) ──────────
// name and valence re-model the ROUTE and never the answer; find-by-position
// re-models the counting walk and never the element; compare re-states the
// rule and leaves the table to the child; the other finds re-say their
// stimulus, which is perception support, not a reveal.

const correctionFor = (item: PeriodicTableItem): string => {
  switch (item.kind) {
    case 'find': {
      const e = item.element!;
      switch (item.findBy) {
        case 'name':
          return `My turn: sweep one row at a time, left to right, and check each box for ${e.name}. Your turn. Tap the box for ${e.name}.`;
        case 'symbol':
          return `My turn: check the big letters in each box — we want ${spellSymbol(e.symbol)}. Your turn. Tap the box whose symbol is ${spellSymbol(e.symbol)}.`;
        case 'number':
          return `My turn: the little number in each box counts up one at a time — follow it to ${e.number}. Your turn. Tap the box for number ${e.number}.`;
        case 'position':
        default:
          return `My turn: count across the top to group ${e.group}, then down the side to period ${e.period}. Your turn. Tap the box where they meet.`;
      }
    }
    case 'name': {
      const e = item.element!;
      switch (item.clueBy) {
        case 'number':
          return `My turn: follow the little numbers up to ${e.number} — the name is written right in that box. Your turn. Say that element's name.`;
        case 'symbol':
          return `My turn: match the big letters ${spellSymbol(e.symbol)} — the name is written under them. Your turn. Say that element's name.`;
        case 'position':
        default:
          return `My turn: count across to group ${e.group}, then down to period ${e.period} — the name is written right in that box. Your turn. Say that element's name.`;
      }
    }
    case 'compare': {
      const [a, b] = item.pair!;
      if (item.axis === 'reactivity') {
        const rule = a.group === 1
          ? 'the lower an element sits, the more reactive it is'
          : 'the higher an element sits, the more reactive it is';
        return `My turn: in this family, ${rule}. Your turn. Which one is more reactive — ${a.name}, or ${b.name}?`;
      }
      return `My turn: they share one column, and the one that sits lower has more shells — more shells means a bigger atom. Your turn. Which atom is bigger — ${a.name}, or ${b.name}?`;
    }
    case 'valence': {
      const e = item.element!;
      return `My turn: count the tall columns only, left to right, and skip the middle block — the count where ${e.name} stands is its outer electrons. Your turn. Say how many electrons are in ${e.name}'s outer shell.`;
    }
  }
};

const affirmFor = (item: PeriodicTableItem): string => {
  switch (item.kind) {
    case 'find': {
      const e = item.element!;
      if (item.findBy === 'position') return `Yes, ${positionOf(e)} — that box is ${e.name}.`;
      return e.group != null
        ? `Yes, that is ${e.name} — ${positionOf(e)}.`
        : `Yes, that is ${e.name} — element number ${e.number}.`;
    }
    case 'name':
      return `Yes, that element is ${item.element!.name}.`;
    case 'compare':
      return item.axis === 'reactivity'
        ? `Yes, ${item.answerName} is the more reactive one in this family.`
        : `Yes, ${item.answerName} is the bigger atom — it has more shells.`;
    case 'valence': {
      const e = item.element!;
      return `Yes, ${e.name} has ${numberWord(item.answerCount!)} electrons in its outer shell.`;
    }
  }
};

// ── The 18d law and the item-21 tail (family wording, grep-able) ────────────

const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/** Defect class 5 (word-sorter: 11 of 12 affirmations ran on into a fabricated
 *  next ask). Named on every contract AND in the catalog directive. */
const VERDICT_ENDS_THE_TURN =
  `Your reply ends when that quoted line ends — never run on into another question, another element, `
  + `or a next round of your own: the activity sends you every next question itself. `;

const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

// ── The judging contracts (voice items) ─────────────────────────────────────

const judgingContract = (item: PeriodicTableItem): string => {
  const head =
    `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner `
    + `reads the table, and their think time is unbounded. Never say the answer during their turn. `;

  let body = '';
  switch (item.kind) {
    case 'name': {
      const e = item.element!;
      const signature = item.clueBy === 'symbol'
        ? `Reading the letters ${spellSymbol(e.symbol)} back is NOT an answer however clearly they are said — the letters are the question. `
        : `The name of a box BESIDE the right one is the likeliest confident miss — affirm nothing but "${e.name}". `;
      body =
        `The correct answer is the element name "${e.name}". Element names are long words, so a close or `
        + `fumbled try at "${e.name}" still counts, and the name inside a short phrase counts too. `
        + signature
        + `Any other element's name is wrong. `;
      break;
    }
    case 'compare': {
      const [a, b] = item.pair!;
      const loser = item.answerName === a.name ? b.name : a.name;
      body =
        `The learner answers with ONE of the two names on offer: "${a.name}" or "${b.name}". `
        + `The correct answer is "${item.answerName}". The name alone counts, and so does a clear point at it — `
        + `but if what they said does not clearly pick one of the two, it is wrong. "${loser}" is wrong. `;
      break;
    }
    case 'valence': {
      const e = item.element!;
      const count = item.answerCount!;
      const signature = (e.group ?? 0) >= 13
        ? `The column's printed label is the signature miss: "${e.group}" is the group number, not the outer electrons — it is wrong. `
        : '';
      body =
        `The correct answer is ${numberWord(count)}. The word alone, the figure "${count}", or `
        + `"${numberWord(count)} electrons" all count, and counting aloud that LANDS on ${numberWord(count)} counts. `
        + signature
        + `Any other number is wrong. `;
      break;
    }
    default:
      break;
  }

  return (
    head + body + TWO_BRANCH_LAW + VERDICT_ENDS_THE_TURN
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

// ── The silence contract (find — the tap mode) ──────────────────────────────
// Intent only; the ENFORCEMENT is the runner holding the activity bracket for
// the whole item, so no turn is ever handed to the tutor to answer.

const tapContract = (item: PeriodicTableItem): string => {
  const neverSay = item.findBy === 'position'
    ? `Never say which element lives at that spot — not its name, not its symbol; finding the box is the whole task. `
    : `Never say where the box is — no row, no column, no corner, no neighbours, no "warmer" or "colder". `;
  return (
    `The quoted line is the ONLY thing you say on this turn; the learner answers by TAPPING a box `
    + `on the table, not by speaking, so you then stay completely silent. `
    + neverSay
    + `Do not judge anything you hear through the microphone. `
    + `You will be told what the learner tapped and given the exact line to say; only then do you speak. `
    + VERDICT_ENDS_THE_TURN
  );
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface PeriodicCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export const itemCue = (
  item: PeriodicTableItem,
  opts: PeriodicCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Time to explore the periodic table! ' : '';
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  const contract = item.answerKind === 'gesture' ? tapContract(item) : judgingContract(item);
  return `[PT_ITEM] Say exactly: "${spoken}" ${contract} ${NEVER_PERFORM}`;
};

/**
 * The gesture verdict ask — find ONLY. The match is CODE-COMPUTED from the
 * tapped element and the tutor is handed its exact line; it cannot see the
 * screen, so this is the only thing that tells it what happened.
 */
export const cellVerdictCue = (item: PeriodicTableItem, tappedName: string): string => {
  const target = item.element!;
  const matches = tappedName.trim().toLowerCase() === target.name.trim().toLowerCase();
  return (
    `[PT_TAP] The learner tapped the box for ${tappedName}; the answer is ${target.name} — `
    + `that ${matches ? 'MATCHES' : 'does NOT match'}. `
    + (matches ? `Say exactly: "${affirmFor(item)}" ` : `Say exactly: "${correctionFor(item)}" `)
    + `Say nothing else. `
    + NEVER_PERFORM
  );
};

/** Correction cap reached: acknowledge warmly, CLOSE THE LINK by naming what
 *  the corrections could not, and carry the lesson forward. */
const closeLineFor = (item: PeriodicTableItem): string => {
  switch (item.kind) {
    case 'find': {
      const e = item.element!;
      if (item.findBy === 'position') return `That box holds ${e.name}. `;
      return e.group != null
        ? `${e.name} sits in ${positionOf(e)}. `
        : `${e.name} is element number ${e.number}. `;
    }
    case 'name':
      return `That element is ${item.element!.name}. `;
    case 'compare':
      return item.axis === 'reactivity'
        ? `${item.answerName} is the more reactive one. `
        : `${item.answerName} is the bigger atom — it sits lower in the column. `;
    case 'valence': {
      const e = item.element!;
      return `${e.name} carries ${numberWord(item.answerCount!)} outer electrons. `;
    }
  }
};

export const moveOnCue = (
  item: PeriodicTableItem,
  next: PeriodicTableItem | null,
  opts: PeriodicCueOptions = {},
): string => {
  const closeLine = closeLineFor(item);
  if (!next) {
    return (
      `[PT_MOVE] Say exactly: "Good try! ${closeLine}The table takes practice — we will hunt again another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  const contract = next.answerKind === 'gesture' ? tapContract(next) : judgingContract(next);
  return (
    `[PT_MOVE] Say exactly: "Good try! ${closeLine}Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${contract} ${NEVER_PERFORM}`
  );
};

export const completeCue = (): string =>
  `[PT_COMPLETE] Say exactly: "What great work on the periodic table today! You are learning your way around all those boxes. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer. Never withdrawn. */
export const pronounceCue = (item: PeriodicTableItem): string => {
  const line = (() => {
    switch (item.kind) {
      case 'find': {
        const e = item.element!;
        switch (item.findBy) {
          case 'name': return `Find ${e.name}. Tap its box.`;
          case 'symbol': return `Find the element whose symbol is ${spellSymbol(e.symbol)}. Tap its box.`;
          case 'number': return `Find element number ${e.number}. Tap its box.`;
          case 'position':
          default: return `Find the element in ${positionOf(e)}. Tap its box.`;
        }
      }
      case 'name': {
        const e = item.element!;
        switch (item.clueBy) {
          case 'number': return `Find element number ${e.number}. Say its name.`;
          case 'symbol': return `Find the element whose symbol is ${spellSymbol(e.symbol)}. Say its name.`;
          case 'position':
          default: return `Look at ${positionOf(e)}. Say that element's name.`;
        }
      }
      case 'compare': {
        const [a, b] = item.pair!;
        return item.axis === 'reactivity'
          ? `Which one is more reactive — ${a.name}, or ${b.name}?`
          : `Which atom is bigger — ${a.name}, or ${b.name}?`;
      }
      case 'valence':
        return `Say how many electrons are in ${item.element!.name}'s outer shell.`;
    }
  })();
  return (
    `[PT_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY.
 * find by name/symbol/number pushes its target (the target is the stimulus
 * there); find by position and both name/valence push only the CLUE, because
 * the element's identity is the answer. compare pushes both names (they are
 * the menu, spoken in the ask) and never the winner.
 */
export const stimulusFor = (item: PeriodicTableItem): string => {
  switch (item.kind) {
    case 'find': {
      const e = item.element!;
      switch (item.findBy) {
        case 'name': return `the full periodic table — the learner is hunting for ${e.name}'s box`;
        case 'symbol': return `the full periodic table — the learner is hunting for the box lettered ${e.symbol}`;
        case 'number': return `the full periodic table — the learner is hunting for box number ${e.number}`;
        case 'position':
        default: return `the full periodic table — the learner is hunting for the box at ${positionOf(e)}`;
      }
    }
    case 'name': {
      const e = item.element!;
      switch (item.clueBy) {
        case 'number': return `the box numbered ${e.number}, waiting to be named`;
        case 'symbol': return `the box lettered ${e.symbol}, waiting to be named`;
        case 'position':
        default: return `the box at ${positionOf(e)}, waiting to be named`;
      }
    }
    case 'compare': {
      const [a, b] = item.pair!;
      return `${a.name} and ${b.name}, both on the table`;
    }
    case 'valence':
      return `${item.element!.name}'s spot on the table`;
  }
};

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

export const periodicTablePackBase = (
  items: PeriodicTableItem[],
): JudgedCueSurface<PeriodicTableItem> => ({
  primitiveType: 'periodic-table',
  activityLine: 'live direct instruction periodic table practice',
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

// ── Harness answer material — what a right and a wrong child sound like ──────

/** A believable wrong TAP: the box one step away on the table — the adjacency
 *  miss the find contract is written around. */
export const neighborNameOf = (element: ElementFacts): string => {
  const source = byNumber.get(element.number);
  if (!source) return 'carbon';
  const neighbor =
    ELEMENTS.find((e) => e.ypos === source.ypos && e.xpos === source.xpos + 1)
    ?? ELEMENTS.find((e) => e.ypos === source.ypos && e.xpos === source.xpos - 1)
    ?? ELEMENTS.find((e) => e.xpos === source.xpos && e.ypos === source.ypos + 1)
    ?? ELEMENTS.find((e) => e.xpos === source.xpos && e.ypos === source.ypos - 1);
  return neighbor?.name ?? 'carbon';
};

const NAME_DECOYS = ['tin', 'neon', 'iron', 'zinc', 'argon'];

export const periodicTableHarnessAnswers = (item: PeriodicTableItem) => {
  switch (item.kind) {
    case 'find': {
      const e = item.element!;
      const wrongTap = neighborNameOf(e);
      return {
        correct: e.name,
        plainWrong: wrongTap,
        tapped: { correct: e.name, wrong: wrongTap },
        // By name/symbol/number the element is the STIMULUS and the answer is
        // a position the tutor is never told — a structurally unreachable leak
        // class, not an oracle switched off. By POSITION the identity is the
        // reveal, so the ask must never carry the name or the symbol.
        leakTokens: item.findBy === 'position'
          ? [e.name.toLowerCase(), e.symbol.toLowerCase()]
          : [],
      };
    }
    case 'name': {
      const e = item.element!;
      const neighbor = neighborNameOf(e);
      const decoy = NAME_DECOYS.find((d) => d !== e.name.toLowerCase() && d !== neighbor.toLowerCase()) ?? 'cobalt';
      return {
        correct: e.name,
        plainWrong: decoy,
        signatureWrong: item.clueBy === 'symbol'
          ? {
              text: spellSymbol(e.symbol),
              why: 'the symbol letters read straight back — clearly said, confidently wrong: the letters are the question, not the name. The contract names this miss',
            }
          : {
              text: neighbor,
              why: 'the box one step away — off by one group or one period — read fluently off the same table, which is the confident miss the contract names',
            },
        leakTokens: [e.name.toLowerCase()],
      };
    }
    case 'compare': {
      const [a, b] = item.pair!;
      const winner = item.answerName!;
      const loser = winner === a.name ? b.name : a.name;
      return {
        correct: winner,
        plainWrong: loser,
        leakTokens: [winner.toLowerCase()],
        // The menu clauses — the winner's name is a legal part of the ask in
        // both (the mats rule made tier-blind: the pair IS the question). The
        // question core between them stays governed.
        leakExemptSpan: [
          `Find ${a.name} and ${b.name}`,
          `${a.name}, or ${b.name}?`,
        ],
      };
    }
    case 'valence': {
      const count = item.answerCount!;
      const e = item.element!;
      const wrongCount = count >= 8 ? count - 1 : count + 1;
      return {
        correct: numberWord(count),
        plainWrong: numberWord(wrongCount),
        signatureWrong: (e.group ?? 0) >= 13
          ? {
              text: String(e.group),
              why: 'the printed column label — the group number read off the table instead of the outer-electron count, the exact confusion this mode teaches through',
            }
          : undefined,
        leakTokens: [numberWord(count), String(count)],
      };
    }
  }
};
