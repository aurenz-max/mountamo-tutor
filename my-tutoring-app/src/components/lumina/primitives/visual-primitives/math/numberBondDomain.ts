/**
 * number-bond's domain: the item types, the build gates that drop an unaskable challenge, the asks, the equation
 * parser and the code judges (`tenAndOnesFaultOf`, `bondEquationFaultOf`). Pure and React-free: the boss, the
 * component, the levers, the generator and the probes read it. The answer-material fork and the gates are argued in
 * `numberBondScript.ts`, which keeps the retired scripted cues and re-exports this module.
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { numberWordFor } from './countingBoardDomain';

export type NumberBondKind =
  | 'decompose'
  | 'missing-part'
  | 'related-fact'
  | 'ten-and-ones'
  | 'fact-family'
  | 'build-equation';
export type BondBand = 'K' | '1';
export type BondModelAction = 'join' | 'separate-left' | 'separate-right' | 'swap';
export type BondFamilyForm = 'add-left' | 'add-right' | 'subtract-left' | 'subtract-right';
export type NumberBondInteractionPhase =
  | 'missing-infer'
  | 'related-join'
  | 'related-say-addend'
  | 'related-separate'
  | 'related-say-remainder'
  | 'equation-model'
  | 'equation-build'
  | 'family-model'
  | 'family-build';

/**
 * `ten-and-ones` — the bond side of CCSS K.NBT.1, added 2026-09-08 alongside
 * ten-frame's two teen modes.
 *
 * WHY IT IS NOT `decompose` WITH A BIGGER WHOLE. `decompose` asks for EVERY
 * pair and treats each one as a right answer; fourteen has eight of them and
 * seven are not what this objective is about. Here exactly ONE pair is
 * accepted — a full ten and the rest — and refusing 6+8 is the whole
 * pedagogy. Two different accept sets over the same gesture is a task
 * identity, not a difficulty setting, so it forks as a mode.
 *
 * WHY ITS WHOLE MAY EXCEED `BOND_WHOLE_MAX`. Every other kind is capped at ten
 * because its answer is spoken or symbolic and the caps keep both inside
 * benched ranges. This one is answered with HANDS and its whole is stated in
 * the ask, so the cap that binds it is the objective's own: 11-19.
 */
/**
 * `related-fact` — the SPOKEN half of the fact family, added 2026-09-09 for the
 * two K rows the 2026-09-08 band-floor re-audit left homeless (OPS001-02-G,
 * OPS001-03-F; qa/reader-fit/k-band-floor-2026-09-08.md).
 *
 * WHY IT IS NOT `missing-part`. A K probe of `missing_part` against both
 * objectives returned ten turns, every one of them "W is the whole. One part is
 * P. What is the other part?" — part-part-whole, ten times. The words "take
 * away" never occur, and nothing in the session asks the child to carry a fact
 * they just found into its subtraction form. The objectives name the CONNECTION
 * ("connect addition and subtraction as inverse operations ... using related
 * facts"), and one unknown-addend turn is one fact, not a relationship.
 *
 * WHY IT IS NOT `fact-family`. That mode's floor HELD at PRE and should: it
 * constructs every distinct equation, and written symbolic form IS its declared skill. This
 * one asks for the same relationship in the K-legal channel — the child SAYS
 * both facts, one number word each.
 *
 * THE SHAPE. One bond, two judged turns:
 *   turn 0 (addition)     "Two and how many more make five?"      -> three
 *   turn 1 (subtraction)  "Five take away three — what is left?"  -> two
 * Turn 1's known part is the number turn 0 produced, so the child has to spend
 * their own answer to get the next one. That is the inverse relationship as an
 * action rather than an assertion.
 *
 * WHY THE PARTS MUST DIFFER. If part1 === part2 both turns have the SAME answer
 * and turn 1 scores for a child who simply repeats themselves. `itemsFromChallenge`
 * drops a symmetric bond outright — the pedagogy does not survive it.
 */
export const BOND_TEN = 10;
export const TEEN_WHOLE_MIN = 11;
export const TEEN_WHOLE_MAX = 19;

/** The benched spoken-number window (shared family constants). Zero is
 *  excluded by the class record itself; 20 is the benched ceiling. */
export const SPOKEN_ANSWER_MIN = 1;
export const SPOKEN_ANSWER_MAX = 20;

/** Structural bounds a bond must satisfy to be askable at all. */
export const BOND_WHOLE_MIN = 2;
export const BOND_WHOLE_MAX = 10;

const int = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** A spoken answer must be inside the benched window. */
export const isSayableAnswer = (n: unknown): n is number =>
  int(n) && n >= SPOKEN_ANSWER_MIN && n <= SPOKEN_ANSWER_MAX;

/**
 * A KNOWN part must be 1..whole−1 — 0 or the whole makes the task trivial and
 * puts "zero" (unbenched) or the whole itself in the child's mouth. THE ONE
 * SHARED PREDICATE for both sides of the wire: the generator repairs against
 * it, this module drops against it. Hand-synced copies drift (letter-spotter's
 * two sides disagreed live), so the generator must IMPORT this, never re-state
 * it.
 */
export const isValidBondPart = (whole: number, part: unknown): part is number =>
  int(part) && part >= 1 && part <= whole - 1;

// ── Answer material — the fork, as code ─────────────────────────────────────

const SPOKEN_KINDS: readonly NumberBondKind[] = ['missing-part', 'related-fact'];

export const answerKindFor = (kind: NumberBondKind): 'voice' | 'gesture' =>
  SPOKEN_KINDS.includes(kind) ? 'voice' : 'gesture';

/** How many ones sit beside the ten on a `ten-and-ones` item. */
export const onesOf = (whole: number): number => whole - BOND_TEN;

export const responseClassFor = (kind: NumberBondKind): ResponseClassId =>
  SPOKEN_KINDS.includes(kind) ? 'number_word_to_20' : 'manipulation';

/** Task identity for the runner's how-to-play policy: when consecutive items
 *  change `action`, the next cue re-speaks what to do. */
export const actionFor = (kind: NumberBondKind): string => {
  switch (kind) {
    case 'decompose': return 'split';
    // Same gesture as decompose, different accept set — and the ASK is
    // materially different ("break it into a ten and some more"), so a session
    // that moves between them re-speaks the how-to-play rather than assuming a
    // five-year-old carried the rule across.
    case 'ten-and-ones': return 'ten-split';
    case 'missing-part': return 'say';
    // A DIFFERENT action id from `missing-part` on purpose: both are spoken, but
    // this one runs two linked turns over one bond, so a session that moves
    // between the two re-speaks the how-to-play instead of assuming the rule
    // carried across.
    case 'related-fact': return 'say-family';
    case 'fact-family': return 'write';
    case 'build-equation': return 'build';
  }
};

export interface NumberBondItem extends JudgedScriptItem {
  /** Runtime split-and-say expansion; source challenge identity stays unchanged. */
  splitPhase?: 'build' | 'say';
  /** Stateful phase added by the runtime expander. */
  interactionPhase?: NumberBondInteractionPhase;
  /** Existing assessment-unit id underneath one or more runtime phases. */
  logicalId?: string;
  /** Transformation the student performed or is being asked to perform. */
  bondAction?: BondModelAction;
  /** Fact-family form owned by this transform/build pair. */
  familyForm?: BondFamilyForm;
  kind: NumberBondKind;
  band: BondBand;
  /** The generated challenge this item came from — decompose expands one
   *  challenge into several items, and the component resets its found-pairs
   *  ledger when this changes. */
  sourceId: string;
  whole: number;
  /** missing-part: the SHOWN part. fact-family / build-equation: part1.
   *  decompose: 0 (the child chooses both parts). */
  knownPart: number;
  /** fact-family / build-equation: part2 (= whole − part1). missing-part: the
   *  part the child must produce. decompose: 0. */
  otherPart: number;
  /** decompose only: which way this turn asks for (0-based) and how many
   *  unique ways exist. 0 / 1 elsewhere. */
  pairIndex: number;
  pairCount: number;
  /** What the child must PRODUCE: said aloud on missing-part (whole − known);
   *  for the hand modes the artifact is judged in code and this carries the
   *  whole, the number every verdict is about. */
  answer: number;
  /**
   * A decompose say step: the split the question asks about, stamped by the component when the step opens (the
   * learner's own, or the example it shows after a capped build). Absent: the first unmade pair (`prepareSplit`).
   */
  askedSplit?: { left: number; right: number };
}

// ── Equation parsing — MOVED here from the component so the judge, the
// component and the harness share one parser ────────────────────────────────

export interface ParsedBondEquation {
  left: number;
  op: '+' | '-';
  right: number;
  result: number;
  /** The arithmetic checks out. */
  valid: boolean;
  /** Uses exactly {whole, part1, part2}. */
  usesCorrectNumbers: boolean;
  /** Mathematical equivalence key — commutative addition collapses. */
  canonicalKey: string;
  /** Required family form; addition order remains visible here. */
  familyFormKey: string;
}

/** Parse "a op b = c" or "c = a op b", whitespace-insensitive. */
export const parseBondEquation = (
  input: string,
  whole: number,
  p1: number,
  p2: number,
): ParsedBondEquation | null => {
  const s = (input ?? '').replace(/\s+/g, '').replace(/[−–]/g, '-');
  if (!s) return null;
  let left: number, op: '+' | '-', right: number, result: number;
  const m1 = s.match(/^(\d+)([+-])(\d+)=(\d+)$/);
  const m2 = m1 ? null : s.match(/^(\d+)=(\d+)([+-])(\d+)$/);
  if (m1) {
    left = parseInt(m1[1], 10); op = m1[2] as '+' | '-';
    right = parseInt(m1[3], 10); result = parseInt(m1[4], 10);
  } else if (m2) {
    result = parseInt(m2[1], 10); left = parseInt(m2[2], 10);
    op = m2[3] as '+' | '-'; right = parseInt(m2[4], 10);
  } else {
    return null;
  }
  const valid = op === '+' ? left + right === result : left - right === result;
  const nums = [left, right, result].sort((a, b) => a - b);
  const expected = [whole, p1, p2].sort((a, b) => a - b);
  const usesCorrectNumbers =
    nums[0] === expected[0] && nums[1] === expected[1] && nums[2] === expected[2];
  const canonicalKey = op === '+'
    ? `${Math.min(left, right)}+${Math.max(left, right)}=${result}`
    : `${left}-${right}=${result}`;
  const familyFormKey = `${left}${op}${right}=${result}`;
  return { left, op, right, result, valid, usesCorrectNumbers, canonicalKey, familyFormKey };
};

/** Required family forms. Equality orientation is normalized by the parser,
 * while unequal addition orders remain distinct. Symmetric bonds have 2. */
export const factFamilyCanonicalKeys = (whole: number, p1: number, p2: number): Set<string> => {
  return new Set([
    `${p1}+${p2}=${whole}`,
    `${p2}+${p1}=${whole}`,
    `${whole}-${p1}=${p2}`,
    `${whole}-${p2}=${p1}`,
  ]);
};

export const familyFormKeyFor = (
  form: BondFamilyForm,
  whole: number,
  p1: number,
  p2: number,
): string => {
  switch (form) {
    case 'add-left': return `${p1}+${p2}=${whole}`;
    case 'add-right': return `${p2}+${p1}=${whole}`;
    case 'subtract-left': return `${whole}-${p1}=${p2}`;
    case 'subtract-right': return `${whole}-${p2}=${p1}`;
  }
};

export const factFamilyForms = (p1: number, p2: number): BondFamilyForm[] =>
  p1 === p2
    ? ['add-left', 'subtract-left']
    : ['add-left', 'add-right', 'subtract-left', 'subtract-right'];


// ── Build gates — DROP an unaskable item, never repair it into one ──────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface NumberBondChallengeLike {
  id: string;
  type: string;
  whole?: number;
  part1?: number | null;
  part2?: number | null;
}

export interface BondBuildContext {
  band: BondBand;
  maxNumber: number;
}

const KINDS: readonly NumberBondKind[] = ['decompose', 'missing-part', 'related-fact', 'ten-and-ones', 'fact-family', 'build-equation'];
const K_KINDS: readonly NumberBondKind[] = ['decompose', 'missing-part', 'related-fact', 'ten-and-ones'];

/**
 * One generated challenge → its judged items, or [] when it cannot be asked
 * honestly:
 *   - an unknown type, or a symbolic type (fact-family / build-equation) at K
 *   - a whole outside 2..min(maxNumber, 10)
 *   - a known part outside 1..whole−1 (missing-part / fact-family /
 *     build-equation) — which also keeps every SPOKEN answer in 1..9
 * decompose expands into one item per unique pair (see the module docblock).
 * Nothing is backfilled.
 */
export const itemsFromChallenge = (
  ch: NumberBondChallengeLike,
  ctx: BondBuildContext,
): NumberBondItem[] => {
  const kind = KINDS.find((k) => k === ch.type);
  if (!kind) return [];
  if (ctx.band === 'K' && !K_KINDS.includes(kind)) return [];

  const whole = ch.whole;
  const base = {
    band: ctx.band,
    sourceId: ch.id,
    whole: whole as number,
    answerKind: answerKindFor(kind),
    responseClass: responseClassFor(kind),
    action: actionFor(kind),
  };

  if (kind === 'ten-and-ones') {
    // Gestural, and the whole is PUBLIC (the ask states it), so neither the
    // spoken bench nor `maxNumber` binds — the objective's own 11-19 window
    // does. A whole of ten or twenty has no "ten and some more" to make.
    if (!int(whole) || whole < TEEN_WHOLE_MIN || whole > TEEN_WHOLE_MAX) return [];
    return [{
      ...base,
      id: ch.id,
      kind,
      knownPart: BOND_TEN,
      otherPart: onesOf(whole),
      pairIndex: 0,
      pairCount: 1,
      answer: whole,
    }];
  }

  const ceiling = Math.min(BOND_WHOLE_MAX, int(ctx.maxNumber) ? ctx.maxNumber : BOND_WHOLE_MAX);
  if (!int(whole) || whole < BOND_WHOLE_MIN || whole > ceiling) return [];

  if (kind === 'decompose') {
    // allPairs is NEVER trusted from the wire — the pair space is arithmetic.
    const pairCount = Math.floor(whole / 2) + 1;
    return Array.from({ length: pairCount }, (_, pairIndex) => ({
      ...base,
      id: `${ch.id}::p${pairIndex}`,
      kind,
      knownPart: 0,
      otherPart: 0,
      pairIndex,
      pairCount,
      answer: whole,
    }));
  }

  const p1 = ch.part1;
  if (!isValidBondPart(whole, p1)) return [];
  const p2 = whole - p1;

  if (kind === 'missing-part') {
    // The spoken gate binds the tutor's EAR: the answer must be sayable. With
    // whole ≤ 10 and part 1..whole−1 it always is; asserted so a future
    // capacity change cannot launder an unbenched class into production.
    if (!isSayableAnswer(p2)) return [];
    return [{ ...base, id: ch.id, kind, knownPart: p1, otherPart: p2, pairIndex: 0, pairCount: 1, answer: p2 }];
  }

  if (kind === 'related-fact') {
    // TWO spoken turns, so BOTH numbers have to be sayable — not just the one
    // `missing-part` would have asked for.
    if (!isSayableAnswer(p1) || !isSayableAnswer(p2)) return [];
    // A symmetric bond (three and three make six) gives both turns the same
    // answer, and a child who repeats themselves scores turn 1 without the
    // relationship. Dropped, never repaired: the pair IS the item.
    if (p1 === p2) return [];
    return [
      // turn 0 — the ADDITION fact. The child produces p2.
      { ...base, id: `${ch.id}::f0`, kind, knownPart: p1, otherPart: p2, pairIndex: 0, pairCount: 2, answer: p2 },
      // turn 1 — the RELATED SUBTRACTION over the same three numbers. Its known
      // part is what the child just said, so the answer is the OTHER part: the
      // echo of turn 0 is now a wrong answer, and `discriminationFor` says so.
      { ...base, id: `${ch.id}::f1`, kind, knownPart: p2, otherPart: p1, pairIndex: 1, pairCount: 2, answer: p1 },
    ];
  }

  return [{ ...base, id: ch.id, kind, knownPart: p1, otherPart: p2, pairIndex: 0, pairCount: 1, answer: whole }];
};

/**
 * The whole session's items. Drops consecutive same-content challenges
 * (type + whole + part): weak content (N challenges = N problems) that would
 * also recite a byte-identical 13-word missing-part ask twice in a row.
 * Duplicate challenge IDs are dropped too — decompose sub-item ids derive from
 * them, and `validateJudgedScriptPack` refuses duplicate item ids.
 */
export const buildBondItems = (
  challenges: NumberBondChallengeLike[],
  ctx: BondBuildContext,
): { items: NumberBondItem[]; droppedChallenges: number } => {
  const items: NumberBondItem[] = [];
  let dropped = 0;
  let previousKey: string | null = null;
  const seenIds = new Set<string>();
  for (const ch of challenges ?? []) {
    if (seenIds.has(ch.id)) { dropped++; continue; }
    const key = `${ch.type}|${ch.whole}|${ch.part1 ?? ''}`;
    if (key === previousKey) { dropped++; continue; }
    const built = itemsFromChallenge(ch, ctx);
    if (built.length === 0) { dropped++; continue; }
    seenIds.add(ch.id);
    previousKey = key;
    items.push(...built);
  }
  return { items, droppedChallenges: dropped };
};

// ── The asks — code-owned at every band; numbers spoken as WORDS ────────────

/** The question as the runner asks it. The adapter publishes this as the tutor task. */
export const askFor = (item: NumberBondItem): string => {
  const wholeWord = numberWordFor(item.whole);
  switch (item.kind) {
    case 'decompose':
      if (item.pairIndex === 0) {
        return `Here is ${wholeWord}. Make ${wholeWord} with two parts.`;
      }
      // The short repeat ask for the invariant mode (repeat-ask gate): the
      // action stated, nothing recited. The last way gets its own words.
      return item.pairIndex === item.pairCount - 1
        ? `Find the last way to make ${wholeWord}.`
        : `Find a different way to make ${wholeWord}.`;
    case 'ten-and-ones':
      // The whole and the TEN are both public — the ten is the structure the
      // objective names, not a number the child has to find. The ONES are the
      // answer and appear nowhere before the verdict.
      return `${cap(wholeWord)} is the whole. Your turn — break it into a ten and some more.`;
    case 'missing-part':
      // "has TWO parts" would put the word "two" in every ask — and two IS the
      // answer whenever whole − part = 2. "is the whole" carries no number but
      // the public ones.
      return `${cap(wholeWord)} is the whole. One part is ${numberWordFor(item.knownPart)}. What is the other part?`;
    case 'related-fact':
      // Turn 0 is the ADDITION form of the same unknown `missing-part` asks for
      // — worded as a fact ("and how many more make") rather than as a part, so
      // turn 1 can then quote it back as the fact they already know.
      // Turn 1 names the whole and the part the child JUST PRODUCED; the answer
      // is the third number, which the ask does not say.
      return item.pairIndex === 0
        ? `${cap(numberWordFor(item.knownPart))} and how many more make ${wholeWord}?`
        : `Good — now the other way round. ${cap(wholeWord)} take away ${numberWordFor(item.knownPart)}. What is left?`;
    case 'fact-family':
      return `The parts are ${numberWordFor(item.knownPart)} and ${numberWordFor(item.otherPart)}, and the whole is ${wholeWord}. Build all ${factFamilyForms(item.knownPart, item.otherPart).length} distinct equations for this fact family.`;
    case 'build-equation':
      return `The parts are ${numberWordFor(item.knownPart)} and ${numberWordFor(item.otherPart)}, and the whole is ${wholeWord}. Build a number sentence with the tiles.`;
  }
};

/**
 * `ten-and-ones` faults — code-decided, so the correction names the actual
 * misconception. `no-ten` is the one this mode exists for: 6 and 8 is a
 * perfectly good pair that makes fourteen and a perfectly wrong answer to
 * K.NBT.1, and a judge that only checked the sum would affirm it.
 */
export type TenAndOnesFault = 'match' | 'empty' | 'miscount' | 'no-ten';

export const tenAndOnesFaultOf = (
  item: NumberBondItem,
  left: number,
  right: number,
): TenAndOnesFault => {
  if (left + right === 0) return 'empty';
  if (left + right !== item.whole) return 'miscount';
  if (left !== BOND_TEN && right !== BOND_TEN) return 'no-ten';
  return 'match';
};

/** Build-equation faults. Arithmetic validity and bond-number use are recorded
 * separately from whether the equation describes the committed action. */
export type BondEquationFault = 'match' | 'incomplete' | 'arithmetic' | 'numbers' | 'action';

export const bondEquationMatchesAction = (
  parsed: ParsedBondEquation,
  action: BondModelAction,
  whole: number,
  p1: number,
  p2: number,
): boolean => {
  if (action === 'join' || action === 'swap') {
    return parsed.op === '+' && parsed.result === whole
      && ((parsed.left === p1 && parsed.right === p2) || (parsed.left === p2 && parsed.right === p1));
  }
  if (action === 'separate-left') {
    return parsed.op === '-' && parsed.left === whole && parsed.right === p1 && parsed.result === p2;
  }
  return parsed.op === '-' && parsed.left === whole && parsed.right === p2 && parsed.result === p1;
};

export const bondEquationFaultOf = (
  item: NumberBondItem,
  tiles: readonly string[],
  action?: BondModelAction,
): BondEquationFault => {
  const parsed = parseBondEquation(tiles.join(''), item.whole, item.knownPart, item.otherPart);
  if (!parsed) return 'incomplete';
  if (!parsed.valid) return 'arithmetic';
  if (!parsed.usesCorrectNumbers) return 'numbers';
  if (action && !bondEquationMatchesAction(parsed, action, item.whole, item.knownPart, item.otherPart)) return 'action';
  return 'match';
};

/**
 * The fact-family worked example is MODELED ON CONTENT THE SESSION NEVER ASKS
 * ABOUT, picked in code (the pickModelNoun pattern): the shipped helper
 * hardcoded 2+3=5, which IS the answer sheet whenever the item is that very
 * bond. The first triple that is no bond of the session (this item or any other, contract R13) wins; the
 * three the helper has always shown come first, then every other unequal pair within ten.
 */
const HELPER_TRIPLES: ReadonlyArray<readonly [number, number, number]> = [
  [2, 3, 5], [3, 4, 7], [2, 4, 6],
  ...Array.from({ length: 10 }, (_, a) => a + 1).flatMap(a => Array.from({ length: 10 - a }, (_, i) => a + 1 + i)
    .filter(b => a + b <= 10).map(b => [a, b, a + b] as const)),
];

type Bond = Pick<NumberBondItem, 'whole' | 'knownPart' | 'otherPart'>;
const sameBond = ([a, b, w]: readonly [number, number, number], bond: Bond) =>
  w === bond.whole && a === Math.min(bond.knownPart, bond.otherPart) && b === Math.max(bond.knownPart, bond.otherPart);

export const familyHelperExample = (item: Bond, session: readonly Bond[] = []): readonly [number, number, number] =>
  HELPER_TRIPLES.find(t => !sameBond(t, item) && !session.some(bond => sameBond(t, bond)))
    ?? HELPER_TRIPLES.find(t => !sameBond(t, item)) ?? HELPER_TRIPLES[0];
