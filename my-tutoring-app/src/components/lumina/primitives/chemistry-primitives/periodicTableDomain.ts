/**
 * periodicTableDomain — what periodic-table TEACHES, with no teaching engine attached: which challenges can be asked
 * (the chemistry build gates), the ask, the spoken keys and known misses of Name It and Trends, the checked misses of
 * an Element Hunt tap, the drawn scene, and the harness's answers. The boss (`periodicTable.card.ts` +
 * `periodicTable.boss.ts`) wires these to the live tutor; the generator (`service/chemistry/periodic-table-challenges.ts`)
 * draws from the same pools. The runner-era DISTAR script (cue lines, sentinel verdicts, the tier lead-in ladder) is
 * deleted.
 *
 *   find     the answer is a POSITION  → one tap on a box, checked by the activity   ('explore')
 *   name     the answer is a NAME      → spoken, judged against the key              ('identify')
 *   compare  the answer is 1 of 2      → spoken, a menu key (both names are the ask) ('trend')
 *   valence  the answer is a COUNT     → spoken, judged against the key              ('trend')
 *
 * CONTENT IS CODE: all 118 elements live in `./constants`; every key is computed from that table, so no model writes
 * an answer. The table stays fully labelled during spoken items on purpose: Name It's skill IS reading the table.
 * What the judged surface leaves out is the apparatus that answers the asks (search, family filters, the element
 * modal: shells on screen during a valence item are the answer in pixels).
 *
 * What may be said before a try follows what the answer is: a find by name, symbol or number NAMES its element (a
 * hunt for an unnamed target is broken, not harder) and never says where it is; a find by position gives the position
 * and never names the element; a name item never says the name; a compare says both names (the menu) and never the
 * winner; a valence item never says the count.
 */
import type { TeachingItem } from '../../hooks/teachingItemContract';
import { opensWithSentinel } from '../../hooks/judgedScriptContract';
import { numberMisses, offByMisses, type KnownMiss } from '../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../components/live-activity/spokenKey';
import type { PeriodicMiss } from '../periodicTable.card';
import { ELEMENTS } from './constants';

export type { PeriodicMiss, SpokenPeriodicMiss } from '../periodicTable.card';

export type PeriodicChallengeType = 'explore' | 'identify' | 'trend';
export type PeriodicKind = 'find' | 'name' | 'compare' | 'valence';
export type PeriodicFindBy = 'name' | 'symbol' | 'number' | 'position';
export type PeriodicClueBy = 'position' | 'number' | 'symbol';
export type PeriodicCompareAxis = 'size' | 'reactivity';
export type PeriodicTier = 'easy' | 'medium' | 'hard';

/** The slice of an element an item carries. Always built from `ELEMENTS`, never generated. */
export interface ElementFacts {
  number: number;
  name: string;
  symbol: string;
  group: number | null;
  period: number;
  category: string;
  /** Electrons in the outermost shell: the honest key for `valence`. */
  outerElectrons: number;
}

export interface PeriodicTableItem extends TeachingItem {
  challengeType: PeriodicChallengeType;
  kind: PeriodicKind;
  /** The lesson's support tier: when help starts on screen and when the model lever comes (`supportFact`). */
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

/** The catalog eval mode of an item. */
export const evalModeOf = (item: Pick<PeriodicTableItem, 'challengeType'>): PeriodicChallengeType => item.challengeType;

// ── Small speakable helpers ─────────────────────────────────────────────────

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;
export const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/** A symbol as the tutor SPELLS it, letter names comma-paced ("C, a"): "He" said as a word is an English word. */
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
    // The dataset stamps `group: xpos` on every row, which hands the detached lanthanide/actinide rows a fake group.
    // Honest group = the 18-column position, and only for the main body.
    group: e.ypos > 7 ? null : e.xpos,
    period: e.period,
    category: e.category,
    outerElectrons: e.electron_shells[e.electron_shells.length - 1] ?? 0,
  };
};

// ── Content pools: one address for the generator and the build gates ───────

/** Elements a middle-schooler is taught by name: the find/name/valence draw pool. */
export const FAMILIAR_ELEMENT_NUMBERS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  26, 28, 29, 30, 35, 36, 47, 50, 53, 54, 56, 78, 79, 80, 82,
];

/** Same-group pools for size comparisons: main-group columns where "lower down = more shells = bigger" holds. */
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

/** Reactivity comparisons only where the direction is a taught fact: alkali metals (down = more reactive) and the
 *  four common halogens (up = more reactive). Hydrogen is group 1 and not an alkali metal: the gate drops it. */
export const REACTIVITY_COMPARE_GROUPS: Readonly<Record<number, readonly number[]>> = {
  1: [3, 11, 19, 37, 55],
  17: [9, 17, 35, 53],
};

/** Compare pairs a child's utterance could fit both of: dropped, never judged leniently. */
export const CONFUSABLE_NAME_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['fluorine', 'chlorine'],
  ['beryllium', 'barium'],
  ['selenium', 'tellurium'],
];

const isConfusablePair = (a: string, b: string): boolean => {
  const lowA = a.toLowerCase();
  const lowB = b.toLowerCase();
  return CONFUSABLE_NAME_PAIRS.some(([x, y]) => (x === lowA && y === lowB) || (x === lowB && y === lowA));
};

// ── Build gates: DROP an unaskable item, never repair it into one ───────────

/** Structural challenge shape as the generator emits it (duck-typed so this module never imports the component). */
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

/** Position language ("group 2, period 4") is honest only for boxes that sit at a group. */
const hasHonestPosition = (e: ElementFacts): e is ElementFacts & { group: number } => e.group != null;

/**
 * One item, or null when the challenge cannot be asked:
 *  - every referenced atomic number must resolve;
 *  - position asks need a real group;
 *  - compare pairs: same group, distinct periods, ear-separable names; reactivity also needs a family whose direction
 *    is a taught fact (alkali metals by category, which excludes hydrogen, or F/Cl/Br/I);
 *  - valence: main group only, and the tall-column rule (group ≤2 → group; group ≥13 → group−10) must agree with the
 *    element's real outer shell (helium fails: the rule says 8, its shell holds 2);
 *  - no element name may open with a sentinel token.
 */
export const itemFromChallenge = (ch: PeriodicChallengeLike, tier: PeriodicTier = 'medium'): PeriodicTableItem | null => {
  if (ch.challengeType === 'explore') {
    const findBy = ch.findBy as PeriodicFindBy;
    if (!FIND_BYS.includes(findBy)) return null;
    const element = ch.targetNumber != null ? elementFactsOf(ch.targetNumber) : null;
    if (!element || opensWithSentinel(element.name)) return null;
    if (findBy === 'position' && !hasHonestPosition(element)) return null;
    return { id: ch.id, challengeType: 'explore', kind: 'find', action: 'find', answerKind: 'gesture',
      responseClass: 'manipulation', tier, element, findBy };
  }

  if (ch.challengeType === 'identify') {
    const clueBy = ch.clueBy as PeriodicClueBy;
    if (!CLUE_BYS.includes(clueBy)) return null;
    const element = ch.targetNumber != null ? elementFactsOf(ch.targetNumber) : null;
    if (!element || opensWithSentinel(element.name)) return null;
    if (clueBy === 'position' && !hasHonestPosition(element)) return null;
    return { id: ch.id, challengeType: 'identify', kind: 'name', action: 'name', answerKind: 'voice',
      responseClass: 'short_spoken_word', tier, element, clueBy, answerName: element.name };
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
      winner = a.group === 1 ? (a.period > b.period ? a : b) : (a.period < b.period ? a : b);
    }
    return { id: ch.id, challengeType: 'trend', kind: 'compare', action: 'compare', answerKind: 'voice',
      responseClass: 'closed_set_choice', tier, pair: [a, b], axis: ch.axis, answerName: winner.name };
  }

  // trend / valence
  const element = ch.targetNumber != null ? elementFactsOf(ch.targetNumber) : null;
  if (!element || !hasHonestPosition(element) || opensWithSentinel(element.name)) return null;
  const group = element.group as number;
  if (group > 2 && group < 13) return null;
  const taughtCount = group <= 2 ? group : group - 10;
  if (taughtCount !== element.outerElectrons) return null;
  if (element.outerElectrons < 1 || element.outerElectrons > 8) return null;
  return { id: ch.id, challengeType: 'trend', kind: 'valence', action: 'valence', answerKind: 'voice',
    responseClass: 'number_word_to_20', tier, element, answerCount: element.outerElectrons };
};

/**
 * The session, dropping what cannot be asked AND what cannot be asked second: an element appears in ONE item per
 * session, in any role (a compare names both of its elements, so a later item on either would hand its answer over).
 */
export const itemsFromChallenges = (challenges: PeriodicChallengeLike[], tier: PeriodicTier = 'medium'): PeriodicTableItem[] => {
  const usedNumbers = new Set<number>();
  const items: PeriodicTableItem[] = [];
  for (const ch of challenges) {
    const item = itemFromChallenge(ch, tier);
    if (!item) continue;
    const touched = item.pair ? item.pair.map((e) => e.number) : item.element ? [item.element.number] : [];
    if (touched.length === 0 || touched.some((n) => usedNumbers.has(n))) continue;
    touched.forEach((n) => usedNumbers.add(n));
    items.push(item);
  }
  return items;
};

// ── The ask ──────────────────────────────────────────────────────────────────

const positionOf = (e: ElementFacts): string => `group ${e.group}, period ${e.period}`;

/** The ask: the problem stated aloud, one defensible answer. Never the answer (`askLeaks` on validate). */
export const askFor = (item: PeriodicTableItem): string => {
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
        ? `Find ${a.name} and ${b.name}, same family. Which one is more reactive: ${a.name}, or ${b.name}?`
        : `Find ${a.name} and ${b.name}, same group. Which atom is bigger: ${a.name}, or ${b.name}?`;
    }
    case 'valence':
      return `Find ${item.element!.name} on the table. Look at its column. Say how many electrons are in its outer shell.`;
  }
};

// ── The spoken keys ─────────────────────────────────────────────────────────

/**
 * The key of a spoken item; null on a find (the activity checks the tap, and the tutor is never told the box).
 * name: the element's name, the symbol's letters read back (symbol clue) or a touching box as the signature error.
 * compare: a menu key over the two names the ask says. valence: the count, the group number as the signature error
 * where the column label is not the count (group ≥ 13).
 */
export function periodicKey(item: PeriodicTableItem): SpokenKey | null {
  switch (item.kind) {
    case 'find':
      return null;
    case 'name': {
      const e = item.element!;
      return { answer: e.name, alsoAccept: [],
        acceptRule: 'A close or fumbled try at the name counts, alone or in a short phrase.',
        signatureError: item.clueBy === 'symbol'
          ? `Reading the letters ${spellSymbol(e.symbol)} back is not a name: the letters are the question. Any other element's name is wrong.`
          : 'The name of a box beside it is wrong, and so is any other element\'s name.' };
    }
    case 'compare': {
      const [a, b] = item.pair!;
      const other = item.answerName === a.name ? b.name : a.name;
      return { answer: item.answerName!, alsoAccept: [], menu: [a.name, b.name],
        acceptRule: `The name alone counts: it is the ${item.axis === 'reactivity' ? 'more reactive one' : 'bigger atom'} of the two.`,
        signatureError: `"${other}" is wrong, and so is an answer that does not pick one of the two.` };
    }
    case 'valence': {
      const e = item.element!;
      const n = item.answerCount!;
      return { answer: numberWord(n), alsoAccept: [String(n), `${numberWord(n)} electron${n === 1 ? '' : 's'}`],
        acceptRule: `Counting aloud that lands on ${numberWord(n)} counts.`,
        signatureError: ((e.group ?? 0) >= 13 ? `"${e.group}" is the group number, not the outer electrons, and is wrong. ` : '')
          + 'Any other number is wrong.' };
    }
  }
}

/** The names of the boxes touching an element's box on the drawn table (left, right, above, below). */
export function touchingNames(element: { number: number }): string[] {
  const at = byNumber.get(element.number);
  if (!at) return [];
  return ELEMENTS.filter(e => Math.abs(e.xpos - at.xpos) + Math.abs(e.ypos - at.ypos) === 1).map(e => e.name);
}

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer. Name It: the symbol's letters
 * read back (`said_symbol`), then the name of a box touching the asked one (`next_box`). Trends: the other element of
 * the pair (compare); the group number, then off-by counts of the outer electrons (valence).
 */
export function periodicSpokenMisses(item: PeriodicTableItem): KnownMiss[] {
  if (item.kind === 'name' && item.element) {
    const e = item.element, near = touchingNames(e).filter(n => n.toLowerCase() !== e.name.toLowerCase());
    return [{ id: 'said_symbol', pattern: `The learner says the letters of ${e.name}'s symbol, ${spellSymbol(e.symbol)}, instead of a name.`,
      examples: [spellSymbol(e.symbol), e.symbol] },
    ...(near.length ? [{ id: 'next_box', pattern: `The learner names ${near.join(' or ')}, an element in a box touching ${e.name}'s.`,
      examples: near.slice(0, 4) }] : [])];
  }
  if (item.kind === 'compare' && item.pair) {
    const other = item.answerName === item.pair[0].name ? item.pair[1].name : item.pair[0].name;
    const trait = item.axis === 'reactivity' ? 'more reactive' : 'the bigger atom';
    return [{ id: 'other_of_pair', pattern: `Of ${item.pair[0].name} and ${item.pair[1].name}, ${item.answerName} is ${trait}. The learner's answer is ${other}, the other one.`,
      examples: [other] }];
  }
  if (item.kind === 'valence' && item.element && item.answerCount) {
    const n = item.answerCount, e = item.element;
    return [...numberMisses(n, [{ id: 'group_number', value: (e.group ?? 0) >= 13 ? e.group ?? undefined : undefined,
      pattern: g => `${e.name} is in group ${g} and has ${n} outer electrons. The learner's answer is ${g}, the group number.` }]),
      ...offByMisses(n, `the ${n} outer electrons of ${e.name}`)];
  }
  return [];
}

// ── The tap's own check ─────────────────────────────────────────────────────

/** Whether a tapped box is the asked element. */
export const cellMatches = (item: PeriodicTableItem, atomicNumber: number): boolean =>
  item.kind === 'find' && item.element?.number === atomicNumber;

/** What a checked wrong tap shows on an Element Hunt, by where the tapped box sits against the asked one. */
export function periodicMiss(item: PeriodicTableItem, tappedNumber: number): PeriodicMiss | undefined {
  const want = item.element && byNumber.get(item.element.number), got = byNumber.get(tappedNumber);
  if (item.kind !== 'find' || !want || !got || want.number === got.number) return undefined;
  if (item.findBy === 'symbol' && want.symbol[0] === got.symbol[0]) return 'same_first_letter';
  const dx = got.xpos - want.xpos, dy = got.ypos - want.ypos;
  if (Math.abs(dx) + Math.abs(dy) === 1) return 'next_box';
  return dy === 0 ? 'same_row' : dx === 0 ? 'same_column' : 'other_box';
}

/** How a tap reads to the tutor and the observer: which box, never the key. */
export const describeCellTap = (name: string) => `Tapped ${name}'s box.`;

// ── The scene ───────────────────────────────────────────────────────────────

/** What is drawn, and this item's "never say" rule as `constraints`. */
export function periodicScene(item: PeriodicTableItem, tapped: string | null): SceneOf {
  const facts: Record<string, string> = {
    kind: item.kind,
    table: 'The full periodic table, group numbers across the top and period numbers down the side: every box shows its '
      + 'atomic number, symbol and name. There is no search or filter.',
  };
  if (item.kind === 'find') {
    facts.constraints = item.findBy === 'position' ? 'Never say which element is at that spot.' : 'Never say where the box is.';
    if (tapped) facts.tapped = `The learner tapped ${tapped}'s box.`;
  } else {
    facts.constraints = item.kind === 'compare'
      ? 'Never say which of the two is the answer, or the rule that decides it for this pair, before the learner tries.'
      : 'No box is marked until the answer is credited.';
  }
  return { objects: [], facts };
}

// ── Harness answer material ──────────────────────────────────────────────────

/** A believable wrong tap: the box one step away on the table. */
export const neighborNameOf = (element: ElementFacts): string => {
  const source = byNumber.get(element.number);
  if (!source) return 'Carbon';
  const neighbor =
    ELEMENTS.find((e) => e.ypos === source.ypos && e.xpos === source.xpos + 1)
    ?? ELEMENTS.find((e) => e.ypos === source.ypos && e.xpos === source.xpos - 1)
    ?? ELEMENTS.find((e) => e.xpos === source.xpos && e.ypos === source.ypos + 1)
    ?? ELEMENTS.find((e) => e.xpos === source.xpos && e.ypos === source.ypos - 1);
  return neighbor?.name ?? 'Carbon';
};

const NAME_DECOYS = ['tin', 'neon', 'iron', 'zinc', 'argon'];

/** The journey's answers: the key's own words or a plainly wrong one; a find is the box to tap, by element name. */
export function periodicHarnessAnswers(item: PeriodicTableItem): { correct: string; plainWrong: string; tapped?: { correct: string; wrong: string } } {
  switch (item.kind) {
    case 'find': {
      const e = item.element!;
      const wrong = neighborNameOf(e);
      return { correct: e.name, plainWrong: wrong, tapped: { correct: e.name, wrong } };
    }
    case 'name': {
      const e = item.element!;
      const neighbor = neighborNameOf(e);
      return { correct: e.name,
        plainWrong: NAME_DECOYS.find((d) => d !== e.name.toLowerCase() && d !== neighbor.toLowerCase()) ?? 'cobalt' };
    }
    case 'compare': {
      const [a, b] = item.pair!;
      return { correct: item.answerName!, plainWrong: item.answerName === a.name ? b.name : a.name };
    }
    case 'valence': {
      const count = item.answerCount!;
      return { correct: numberWord(count), plainWrong: numberWord(count >= 8 ? count - 1 : count + 1) };
    }
  }
}
