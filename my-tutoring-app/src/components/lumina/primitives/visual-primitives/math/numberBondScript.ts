/**
 * numberBondScript — HAND-AUTHORED judged-loop script for number-bond
 * (qa/di/BACKLOG.md item 18 P3-correction block, the third MATH port after
 * ten-frame and addition-subtraction-scene). The exact wording IS the pedagogy —
 * these lines are authored per pack, never generated. Item CONTENT (the wholes,
 * the parts) is generator-scoped; this module owns the cue shapes, the build
 * gates and the in-band judging contracts.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1) ─────────────────────────────────
 *
 *   missing-part   (K + 1)  → SPOKEN number        number_word_to_20  (benched)
 *   decompose      (K + 1)  → SPLIT counters       manipulation
 *   fact-family    (1 only) → WRITTEN equations    manipulation
 *   build-equation (1 only) → BUILT number sentence manipulation
 *
 * WHY MISSING-PART SPEAKS. At the table the teacher says "one part is three —
 * what is the other part?" and the child answers OUT LOUD. The shipped surface
 * ended in a −/+ stepper and a Check button: a child who cannot find the part
 * can still operate a stepper, so the stepper was a costume — and a 0…max
 * stepper is also a weak MENU (recognition over production, guess floor 1-in-
 * maxNumber). Same shape ASS's solve-story struck at K.
 *
 * WHY THREE MODES KEPT THEIR HANDS. Costume test — can a child who cannot do
 * the skill still perform this action correctly?
 *   - `decompose`: no. Splitting the counters into two groups IS decomposition
 *     — the K concrete manipulative. Saying pairs aloud would be a different
 *     (and open-ended) task.
 *   - `fact-family`: no. The mode's identity is writing all four related
 *     equations — symbolic FORM, the third unsayable shape. Reciting them
 *     aloud would not show the child can write them. The four input slots are
 *     the page a teacher pushes across the table.
 *   - `build-equation`: no. Same FORM argument, settled on ASS's identical
 *     mode (its docblock calls it "the pack's one genuinely arguable fork" and
 *     rules it built; do not re-derive).
 *
 * ── DECOMPOSE EXPANDS: ONE CHALLENGE → ONE JUDGED TURN PER PAIR ─────────────
 *
 * "Find all the ways to make five" is inherently multi-commit, and the runner's
 * model is one item = one verdict. The click era already paced it one pair per
 * Submit — so the build gate expands each decompose challenge into
 * `pairCount` judged items ("Make five with two parts." → "Find a different
 * way to make five."), the same volume of work with the tutor's verdict where
 * the feedback card used to be. Precedent: decodable-reader splits one passage
 * into per-sentence items. Properties that make it sound:
 *   - each commit CAN be wrong (an under-full split; a pair already made), so
 *     no close is correctness-gated;
 *   - an affirmed sub-item banks exactly one pair, and a capped/moved-on one
 *     banks none, so "find a different way" stays satisfiable to the end;
 *   - the repeat ask is DELIBERATELY short ("Find a different way to make
 *     five.", 7 words) — the invariant-mode short form the repeat-ask gate
 *     requires, with the action stated.
 *
 * ── THE §2 SCRIPT QUESTIONS, ANSWERED HERE ──────────────────────────────────
 *
 * 1. IS THE MODEL THE ANSWER? For missing-part, yes — a model would say the
 *    number. Nothing is modeled before the ask; the count-up walk is earned in
 *    the CORRECTION. The fact-family worked example is modeled on content the
 *    session never asks about, picked IN CODE (`familyHelperExample`).
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? The bond diagram is numerals a
 *    K child cannot read, so THE ASK STATES ITS PROBLEM ALOUD at every band:
 *    "Five has two parts. One part is three. What is the other part?" Every
 *    correction re-ask inherits the numbers.
 *
 * 3. THE SIGNATURE ERROR, missing-part — the fluent, confident miss is a
 *    number the ask itself just said: the WHOLE (or the known part) echoed
 *    back. The accept clause matters as much: "two more" counts as two, and
 *    counting up aloud is the child WORKING, not answering — judge the number
 *    they offer when the counting stops. When the bond is symmetric (whole 6,
 *    part 3) the known part IS the answer, so the echo-refusal list excludes
 *    any value equal to the answer (ASS's filter, kept).
 *
 * ── CONTENT GATES (skill step 4) — KEEP OR DROP, NEVER BACKFILL ─────────────
 *
 * ZERO IS UNBENCHED as a spoken answer and 20 is the ceiling; a known part of
 * 0 or of the whole makes the spoken answer the whole itself or zero, so
 * `isValidBondPart` (1..whole−1) gates every non-decompose item ON BOTH SIDES
 * OF THE WIRE — the generator imports it to repair, this module uses it to
 * DROP. whole ≤ 10 by the generator's own clamp, so every spoken answer is
 * 1..9, entirely inside the benched range; the gate is asserted anyway so a
 * capacity change cannot launder an unbenched class into production.
 *
 * Nothing generated is ever SPOKEN by this pack — every cue is code-built from
 * the numeric fields, with numbers as words — so there is no sentinel scan
 * over generated prose to run at build time. Consecutive challenges with the
 * same (type, whole, part) are deduped, both as weak content (N challenges =
 * N problems) and because two byte-identical 13-word missing-part asks in a
 * row would be recitation.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * `checkPackGates` in this pack's test file over every cue it can emit.
 */

import type { JudgedScriptItem, ResponseClassId, JudgedCueSurface } from '../../../hooks/judgedScriptContract';
import { numberWordFor } from './countingBoardScript';

export type NumberBondKind = 'decompose' | 'missing-part' | 'fact-family' | 'build-equation';
export type BondBand = 'K' | '1';

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

export const answerKindFor = (kind: NumberBondKind): 'voice' | 'gesture' =>
  kind === 'missing-part' ? 'voice' : 'gesture';

export const responseClassFor = (kind: NumberBondKind): ResponseClassId =>
  kind === 'missing-part' ? 'number_word_to_20' : 'manipulation';

/** Task identity for the runner's how-to-play policy: when consecutive items
 *  change `action`, the next cue re-speaks what to do. */
export const actionFor = (kind: NumberBondKind): string => {
  switch (kind) {
    case 'decompose': return 'split';
    case 'missing-part': return 'say';
    case 'fact-family': return 'write';
    case 'build-equation': return 'build';
  }
};

export interface NumberBondItem extends JudgedScriptItem {
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
  /** Dedup key — commutative addition collapses to one key. */
  canonicalKey: string;
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
  return { left, op, right, result, valid, usesCorrectNumbers, canonicalKey };
};

/** The 3 canonical keys that cover all 4 fact-family equations (a+b and b+a
 *  collapse). Symmetric bonds (3+3=6) legitimately have 2. */
export const factFamilyCanonicalKeys = (whole: number, p1: number, p2: number): Set<string> => {
  const min = Math.min(p1, p2);
  const max = Math.max(p1, p2);
  return new Set([`${min}+${max}=${whole}`, `${whole}-${min}=${max}`, `${whole}-${max}=${min}`]);
};

/** "two plus three equals five" — an equation spoken; numerals stay off the
 *  tutor's tongue everywhere in this pack. */
const equationSpoken = (left: number, op: '+' | '-', right: number, result: number): string =>
  `${numberWordFor(left)} ${op === '+' ? 'plus' : 'take away'} ${numberWordFor(right)} equals ${numberWordFor(result)}`;

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

const KINDS: readonly NumberBondKind[] = ['decompose', 'missing-part', 'fact-family', 'build-equation'];
const K_KINDS: readonly NumberBondKind[] = ['decompose', 'missing-part'];

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

  const ceiling = Math.min(BOND_WHOLE_MAX, int(ctx.maxNumber) ? ctx.maxNumber : BOND_WHOLE_MAX);
  const whole = ch.whole;
  if (!int(whole) || whole < BOND_WHOLE_MIN || whole > ceiling) return [];

  const base = {
    band: ctx.band,
    sourceId: ch.id,
    whole,
    answerKind: answerKindFor(kind),
    responseClass: responseClassFor(kind),
    action: actionFor(kind),
  };

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

// ── How-to-play — spoken on the opener AND whenever the ACTION changes ──────

export const howToPlayFor = (item: NumberBondItem): string => {
  switch (item.kind) {
    case 'decompose':
      return 'Tap the two circles to split the counters into two parts. When you stop, I will look at your way. ';
    case 'missing-part':
      return 'Look at the number bond and think, then say the missing part out loud. ';
    case 'fact-family':
      return 'Write all four equations in the boxes — two plus and two take away. When you stop, I will check them. ';
    case 'build-equation':
      return 'Tap the tiles to build the number sentence. When you stop, I will check it. ';
  }
};

// ── The asks — code-owned at every band; numbers spoken as WORDS ────────────

const askFor = (item: NumberBondItem): string => {
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
    case 'missing-part':
      // "has TWO parts" would put the word "two" in every ask — and two IS the
      // answer whenever whole − part = 2. "is the whole" carries no number but
      // the public ones.
      return `${cap(wholeWord)} is the whole. One part is ${numberWordFor(item.knownPart)}. What is the other part?`;
    case 'fact-family':
      return `The parts are ${numberWordFor(item.knownPart)} and ${numberWordFor(item.otherPart)}, and the whole is ${wholeWord}. Write all four equations for this fact family.`;
    case 'build-equation':
      return `The parts are ${numberWordFor(item.knownPart)} and ${numberWordFor(item.otherPart)}, and the whole is ${wholeWord}. Build a number sentence with the tiles.`;
  }
};

// ── The correction — DISTAR re-model then re-elicit; the answer is EARNED ───

/** "four, five" — the count-up walk from the known part to the whole, the
 *  strategy the correction models. Never more than 9 words (whole ≤ 10). */
const countUpWalk = (from: number, to: number): string =>
  Array.from({ length: to - from }, (_, i) => numberWordFor(from + 1 + i)).join(', ');

const correctionFor = (item: NumberBondItem): string => {
  const answerWord = numberWordFor(item.answer);
  const knownWord = numberWordFor(item.knownPart);
  const wholeWord = numberWordFor(item.whole);
  // Only missing-part carries a spoken correction inside its item cue; the
  // hand modes are corrected through their code-computed verdict cues below.
  return `My turn: start at ${knownWord} and count up to ${wholeWord}: ${countUpWalk(item.knownPart, item.whole)}. `
    + `That is ${answerWord} more. Your turn. One part is ${knownWord} — what is the other part?`;
};

// ── Judging contract (missing-part — the pack's one spoken mode) ────────────

/** The refuse clause and the accept clause, both halves load-bearing. Values
 *  equal to the answer are excluded from the echo list — a symmetric bond
 *  (whole six, part three) makes the known part the RIGHT answer. */
const discriminationFor = (item: NumberBondItem): string => {
  const answerWord = numberWordFor(item.answer);
  const echo = [item.whole, item.knownPart]
    .filter((value, i, all) => all.indexOf(value) === i && value !== item.answer)
    .map((value) => `"${numberWordFor(value)}"`);
  const echoClause = echo.length > 0
    ? `The question already says ${echo.join(' and ')} out loud, so ${echo.length > 1 ? 'those numbers' : 'that number'} said back ${echo.length > 1 ? 'are' : 'is'} NOT the answer, however confident it sounds. `
    : '';
  return (
    echoClause
    + `Counting up aloud is the learner working, not answering — judge the number they OFFER when the counting stops. `
    + `"${answerWord}", "${answerWord} more", or "${answerWord}" said after counting up all count as ${answerWord}. `
  );
};

/**
 * ⚠️ THE WAIT IS DESCRIBED AS THE TUTOR'S STATE, NEVER AS AN IMPERATIVE — an
 * imperative aimed at the tutor gets PERFORMED (ten-frame voiced "[WAIT
 * silently]" to a child). `findPerformedStageDirections` keeps this structural.
 */
const judgingContract = (item: NumberBondItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner works, and their think time is unbounded. `
  + `Never say the answer during their turn and never count aloud with them. `
  + `The correct answer is "${numberWordFor(item.answer)}". `
  + discriminationFor(item)
  + `If the answer is right, say exactly: "Yes, ${numberWordFor(item.answer)} — ${numberWordFor(item.answer)} and ${numberWordFor(item.knownPart)} make ${numberWordFor(item.whole)}." and stop there — add no praise, no encouragement and no mention of what comes next. `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop there; that correction is the whole turn, `
  + `and it is the SAME line on every wrong answer, including a repeat of the same wrong answer — `
  + `never paraphrase it, never soften it, and never replace it with a hint of your own.`;

/** The gesture contract is a SILENCE contract: nothing to judge until the
 *  commit is described, and the quantities are banned from the tutor's mouth
 *  for the whole item. */
const silenceContract = (item: NumberBondItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS on the screen, not with their voice, so you then stay completely silent. `
  + (item.kind === 'decompose'
    ? `Do not count the counters aloud and never say which pairs make ${numberWordFor(item.whole)}. `
    : item.kind === 'fact-family'
      ? `Do not read the equations aloud and never say what any equation should be. `
      : `Do not read the tiles aloud and never say what the number sentence should be. `)
  + `Do not narrate what they are doing or fill the pause. `
  + `You will be told what they made and whether it matches; only then do you speak.`;

/** Named at the end of every contract-carrying cue — it names the exact
 *  failure a drive produced rather than trusting a generic "don't read tags". */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const contractFor = (item: NumberBondItem): string =>
  item.answerKind === 'gesture' ? silenceContract(item) : judgingContract(item);

// ── Cues ────────────────────────────────────────────────────────────────────

export interface NumberBondCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line, never as a second catalog directive on the same turn). */
export const itemCue = (item: NumberBondItem, opts: NumberBondCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time for number bonds! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[NB_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${contractFor(item)} ${NEVER_PERFORM}`;
};

/**
 * The decompose verdict — THE MATCH IS COMPUTED IN CODE (sum + novelty
 * against the pairs already banked); the tutor is never asked to count pixels.
 * The digits in the head are for the judge's eyes; spoken lines carry WORDS.
 * Not correctness-gated anywhere upstream: an under-full split and a repeated
 * pair both arrive here and are corrected, which is what makes the item
 * judgeable at all.
 */
export const splitVerdictCue = (
  item: NumberBondItem,
  left: number,
  right: number,
  foundBefore: ReadonlyArray<readonly [number, number]>,
): string => {
  const wholeWord = numberWordFor(item.whole);
  const sum = left + right;
  const lo = Math.min(left, right);
  const hi = Math.max(left, right);
  const duplicate = sum === item.whole && foundBefore.some((p) => p[0] === lo && p[1] === hi);
  const matches = sum === item.whole && !duplicate;
  const head =
    `[NB_SPLIT] The learner split the counters into ${left} and ${right}; the whole is ${item.whole}`
    + `${duplicate ? ', and they already made that pair' : ''} — that ${matches ? 'MATCHES' : 'does NOT match'}. `;

  let line: string;
  if (matches) {
    const foundAll = foundBefore.length + 1 >= item.pairCount;
    line = `Say exactly: "Yes! ${cap(numberWordFor(left))} and ${numberWordFor(right)} make ${wholeWord}.`
      + `${foundAll ? ` You found every way to make ${wholeWord}!` : ''}" `;
  } else if (sum === 0) {
    line = `Say exactly: "My turn: the counters go into the circles first. Your turn — make ${wholeWord} with two parts." `;
  } else if (sum !== item.whole) {
    line = `Say exactly: "My turn: ${numberWordFor(left)} and ${numberWordFor(right)} make ${numberWordFor(sum)}, not ${wholeWord}. Count all ${wholeWord} in. Your turn — make ${wholeWord} with two parts." `;
  } else {
    line = `Say exactly: "My turn: you already made ${numberWordFor(lo)} and ${numberWordFor(hi)}. Your turn — find a way you have not made yet." `;
  }
  return `${head}${line}Never read bracket tags aloud.`;
};

/** Which of the fact-family faults happened — code-decided so the correction
 *  names the actual misconception rather than issuing one generic line. */
export type FamilyFault = 'match' | 'incomplete' | 'bad-math' | 'wrong-numbers' | 'duplicate';

export const familyFaultOf = (
  item: NumberBondItem,
  inputs: readonly string[],
): { fault: FamilyFault; uniqueCorrect: number; needed: number } => {
  const keys = factFamilyCanonicalKeys(item.whole, item.knownPart, item.otherPart);
  const seen = new Set<string>();
  let badMath = false;
  let wrongNumbers = false;
  let duplicate = false;
  for (const raw of inputs) {
    if (!raw || !raw.trim()) continue;
    const parsed = parseBondEquation(raw, item.whole, item.knownPart, item.otherPart);
    if (!parsed) continue; // an unparseable slot reads as incomplete below
    if (!parsed.valid) { badMath = true; continue; }
    if (!parsed.usesCorrectNumbers) { wrongNumbers = true; continue; }
    if (seen.has(parsed.canonicalKey)) { duplicate = true; continue; }
    if (keys.has(parsed.canonicalKey)) seen.add(parsed.canonicalKey);
  }
  const fault: FamilyFault = seen.size >= keys.size
    ? 'match'
    : badMath ? 'bad-math'
      : wrongNumbers ? 'wrong-numbers'
        : duplicate ? 'duplicate'
          : 'incomplete';
  return { fault, uniqueCorrect: seen.size, needed: keys.size };
};

export const familyVerdictCue = (item: NumberBondItem, inputs: readonly string[]): string => {
  const { fault, uniqueCorrect, needed } = familyFaultOf(item, inputs);
  const p1w = numberWordFor(item.knownPart);
  const p2w = numberWordFor(item.otherPart);
  const ww = numberWordFor(item.whole);
  const wrote = inputs.filter((s) => s && s.trim()).join(' ; ') || 'nothing';
  const head =
    `[NB_FAMILY] The learner wrote "${wrote}"; the fact family is ${item.knownPart}+${item.otherPart}=${item.whole} `
    + `(${uniqueCorrect} of ${needed} unique facts) — that ${fault === 'match' ? 'MATCHES' : 'does NOT match'}. `;
  if (fault === 'match') {
    return `${head}Say exactly: "Yes! The same three numbers — ${p1w}, ${p2w} and ${ww} — make all four facts. You wrote the whole fact family!" Never read bracket tags aloud.`;
  }
  const specific =
    fault === 'bad-math'
      ? `My turn: check the arithmetic — ${p1w} plus ${p2w} equals ${ww}. Your turn — fix the equation that does not add up.`
      : fault === 'wrong-numbers'
        ? `My turn: a fact family uses the SAME three numbers — ${p1w}, ${p2w} and ${ww}, and no others. Your turn — write the four equations with just those.`
        : fault === 'duplicate'
          ? `My turn: two of your equations say the same thing. ${cap(ww)} take away ${p1w} and ${ww} take away ${p2w} are different facts. Your turn — make every equation different.`
          : `My turn: a fact family needs four equations — two plus and two take away. Your turn — write all four.`;
  return `${head}Say exactly: "${specific}" Never read bracket tags aloud.`;
};

/** build-equation faults, same three checks the click-era button ran. Any
 *  valid form over {p1, p2, whole} matches — the shipped grading, kept. */
export type BondEquationFault = 'match' | 'incomplete' | 'arithmetic' | 'numbers';

export const bondEquationFaultOf = (
  item: NumberBondItem,
  tiles: readonly string[],
): BondEquationFault => {
  const parsed = parseBondEquation(tiles.join(''), item.whole, item.knownPart, item.otherPart);
  if (!parsed) return 'incomplete';
  if (!parsed.valid) return 'arithmetic';
  if (!parsed.usesCorrectNumbers) return 'numbers';
  return 'match';
};

export const bondEquationVerdictCue = (item: NumberBondItem, tiles: readonly string[]): string => {
  const fault = bondEquationFaultOf(item, tiles);
  const p1w = numberWordFor(item.knownPart);
  const p2w = numberWordFor(item.otherPart);
  const ww = numberWordFor(item.whole);
  const built = tiles.join(' ').trim() || 'nothing';
  const head = `[NB_EQUATION] The learner built "${built}"; the bond is ${item.knownPart}+${item.otherPart}=${item.whole} — that ${fault === 'match' ? 'MATCHES' : 'does NOT match'}. `;
  if (fault === 'match') {
    const parsed = parseBondEquation(tiles.join(''), item.whole, item.knownPart, item.otherPart)!;
    return `${head}Say exactly: "Yes! ${cap(equationSpoken(parsed.left, parsed.op, parsed.right, parsed.result))}. Your number sentence tells the truth about the bond!" Never read bracket tags aloud.`;
  }
  const specific =
    fault === 'arithmetic'
      ? `My turn: those numbers do not make that total. Look at the bond: ${p1w} and ${p2w} make ${ww}. Your turn — build the number sentence again.`
      : fault === 'numbers'
        ? `My turn: use the three numbers from the bond — ${p1w}, ${p2w} and ${ww}. Your turn — build the number sentence with just those.`
        : `My turn: a number sentence needs two numbers, a sign, an equals, and the total. Your turn — build the whole number sentence.`;
  return `${head}Say exactly: "${specific}" Never read bracket tags aloud.`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  item: NumberBondItem,
  next: NumberBondItem | null,
  opts: NumberBondCueOptions = {},
): string => {
  if (!next) {
    return `[NB_MOVE] Say exactly: "Good try! Number bonds take practice — we will see that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[NB_MOVE] Say exactly: "Good try! ${how}${askFor(next)}" ${contractFor(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[NB_COMPLETE] Say exactly: "What great number bond work today! You broke numbers apart and put them back together. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer, and never a hint. */
export const pronounceCue = (item: NumberBondItem): string =>
  `[NB_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY,
 * answer-free by construction: it names the task's SHAPE. The decompose whole
 * is public (the ask states it); missing-part names NO number at all, so no
 * branch can carry the value the child is about to produce.
 */
export const stimulusFor = (item: NumberBondItem): string => {
  switch (item.kind) {
    case 'decompose':
      return `breaking ${numberWordFor(item.whole)} into two parts on the number bond`;
    case 'missing-part':
      // "one part shown" would put the word "one" in the channel — and one IS
      // the answer whenever whole − part = 1. Same class as the "two parts"
      // ask fix.
      return 'a number bond with the whole shown and a single part shown; the other part is hidden';
    case 'fact-family':
      return 'a number bond with all three numbers shown; writing the four related equations';
    case 'build-equation':
      return 'a number bond with all three numbers shown; building one number sentence from tiles';
  }
};

/**
 * The fact-family worked example is MODELED ON CONTENT THE SESSION NEVER ASKS
 * ABOUT, picked in code (the pickModelNoun pattern): the shipped helper
 * hardcoded 2+3=5, which IS the answer sheet whenever the item is that very
 * bond. First triple that differs from the item's bond wins.
 */
const HELPER_TRIPLES: ReadonlyArray<readonly [number, number, number]> = [
  [2, 3, 5], [3, 4, 7], [2, 4, 6],
];

export const familyHelperExample = (
  item: Pick<NumberBondItem, 'whole' | 'knownPart' | 'otherPart'>,
): readonly [number, number, number] => {
  const lo = Math.min(item.knownPart, item.otherPart);
  const hi = Math.max(item.knownPart, item.otherPart);
  return HELPER_TRIPLES.find(([a, b, w]) => !(a === lo && b === hi && w === item.whole))
    ?? HELPER_TRIPLES[0];
};

// ── The cue surface — one source for the component and the DI harness ───────

/**
 * Everything number-bond ever sends the tutor. `NumberBond.tsx` spreads this
 * and adds what only a mounted component can own (status lines, and the
 * `diagnosisObservation` that reads the live workspace); the drive-plan
 * endpoint builds the identical cues for the headless judged-loop harness.
 */
export const numberBondPackBase = (
  items: NumberBondItem[],
): JudgedCueSurface<NumberBondItem> => ({
  primitiveType: 'number-bond',
  activityLine: 'live direct instruction number bond practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.kind,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ─────

export interface NumberBondHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** Gesture items commit an artifact, not a word — see the encoding note on
   *  `bondVerdictCueForPlaced`. */
  placed?: { correct: number; wrong: number };
  leakTokens: string[];
}

/** A wrong-but-plausible number that is not the answer, the whole, or the
 *  known part — the baseline refusal test needs it unambiguous. */
const plainWrongFor = (item: NumberBondItem): number => {
  for (let candidate = 1; candidate <= BOND_WHOLE_MAX; candidate++) {
    if (candidate !== item.answer && candidate !== item.whole && candidate !== item.knownPart) {
      return candidate;
    }
  }
  return item.answer + 1;
};

/**
 * The answers a headless student gives on a judged drive. Lives beside the
 * contract it mirrors: `discriminationFor` CLAIMS the judge refuses the whole
 * said back, and this is the claim made testable. Change one, change both.
 */
export const numberBondHarnessAnswers = (item: NumberBondItem): NumberBondHarnessAnswers => {
  switch (item.kind) {
    case 'missing-part': {
      const answerWord = numberWordFor(item.answer);
      return {
        correct: answerWord,
        plainWrong: numberWordFor(plainWrongFor(item)),
        signatureWrong: {
          text: numberWordFor(item.whole),
          why: 'the whole said back instead of the missing part — the ask itself just said it',
        },
        // Words the ask legitimately states are the question, not a leak: the
        // known part on a symmetric bond, and "one" always — every ask says
        // "One part is…".
        leakTokens: item.answer === item.knownPart || item.answer === 1
          ? []
          : [numberWordFor(item.answer)],
      };
    }
    case 'decompose': {
      const a = Math.floor(item.whole / 2);
      const b = item.whole - a;
      return {
        correct: `split ${a} and ${b}`,
        plainWrong: `split 0 and ${item.whole - 1}`,
        placed: { correct: a * 100 + b, wrong: item.whole - 1 },
        leakTokens: [],
      };
    }
    case 'fact-family':
      return {
        correct: 'wrote all four fact-family equations',
        plainWrong: 'wrote a valid equation over the wrong numbers',
        placed: { correct: 1, wrong: 0 },
        leakTokens: [],
      };
    case 'build-equation':
      return {
        correct: `built ${item.knownPart}+${item.otherPart}=${item.whole}`,
        plainWrong: `built ${item.knownPart}+${item.otherPart}=${item.whole + 1}`,
        placed: { correct: 1, wrong: 0 },
        leakTokens: [],
      };
  }
};

/**
 * Harness-side gesture verdict builder, `DiPortAdapter.gestureVerdictCue`'s
 * one-number shape. THE ENCODING (internal to this module — `placed` values
 * above are produced here and decoded here, nowhere else):
 *   - decompose: left × 100 + right (an under-full commit encodes as its sum
 *     with left 0, e.g. `whole − 1`);
 *   - fact-family / build-equation: 1 = a correct commit, 0 = a wrong one
 *     (wrong-numbers / arithmetic respectively), the artifact built inside.
 */
export const bondVerdictCueForPlaced = (item: NumberBondItem, placed: number): string => {
  switch (item.kind) {
    case 'decompose':
      return splitVerdictCue(item, Math.floor(placed / 100), placed % 100, []);
    case 'fact-family': {
      const { whole, knownPart: p1, otherPart: p2 } = item;
      const inputs = placed === 1
        ? [`${p1}+${p2}=${whole}`, `${p2}+${p1}=${whole}`, `${whole}-${p1}=${p2}`, `${whole}-${p2}=${p1}`]
        : [`${whole}+${whole}=${whole * 2}`, '', '', ''];
      return familyVerdictCue(item, inputs);
    }
    case 'build-equation': {
      const { whole, knownPart: p1, otherPart: p2 } = item;
      const tiles = placed === 1
        ? [String(p1), '+', String(p2), '=', String(whole)]
        : [String(p1), '+', String(p2), '=', String(whole + 1)];
      return bondEquationVerdictCue(item, tiles);
    }
    default:
      return splitVerdictCue(item, 0, 0, []);
  }
};
