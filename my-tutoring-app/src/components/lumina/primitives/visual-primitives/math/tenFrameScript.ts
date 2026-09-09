/**
 * tenFrameScript — HAND-AUTHORED judged-loop script for ten-frame (the first
 * MATH port of the tutor-owned DI loop; qa/di/BACKLOG.md item 18, brief
 * `qa/HANDOFF-di-ten-frame-2026-08-12.md`). The exact wording IS the pedagogy —
 * these lines are authored per pack, never generated. Item CONTENT (the
 * numbers) is generator-scoped; this module owns the cue shapes, the build
 * gates, and the in-band judging contracts.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1), and why math forks where literacy
 *    did not ────────────────────────────────────────────────────────────────
 *
 *   subitize      → SPOKEN count            number_word_to_20   (benched)
 *   make_ten @K   → ENACTED complement      manipulation        (contract R6)
 *   make_ten @1-2 → SPOKEN complement       number_word_to_20   (benched)
 *   build         → ENACTED construction    manipulation
 *   split         → ENACTED partition       manipulation        (contract R9)
 *   add/subtract  → SPOKEN sum/difference   number_word_to_20   (benched)
 *
 * `split` is the newest arrival and it is a PAIR, not a number — which is
 * exactly why it is enacted. Asking a five-year-old to SAY "two and three"
 * would benchmark a two-number spoken class nobody has benched, and it would
 * let a child who cannot partition anything recite a pair they heard last item.
 * Flipping two counters yellow while three stay red IS the decomposition; the
 * costume test has no answer for it (K.OA.3, "decompose numbers ≤ 10 into pairs
 * in more than one way, e.g. by using objects or drawings").
 *
 * In literacy, conversion was almost always right because the clicking stood in
 * for a mouth. IN MATH THE MANIPULATIVE IS OFTEN THE SKILL. Applying the
 * costume test — can a child who cannot do the skill still perform this action
 * correctly? — a stepper is a costume (anyone can operate one), but PLACING
 * COUNTERS IS THE ACT OF BUILDING A QUANTITY. So the steppers died and the
 * frame lived.
 *
 * `make_ten` @ K is the sharp case and it is a CONTRACT ruling, not a
 * preference: R6 (the only REQUIRED requirement on ten-frame) was written by
 * reader-fit item 12 under the standing direct-manipulation-first ruling, and
 * it pins the ABSENCE of a stepper and a Check button. It post-dates the click
 * era. Re-basing it means keeping the manipulation and letting the tutor judge
 * it — never replacing it with a spoken count.
 *
 * ── THE §3 SCRIPT QUESTIONS, ANSWERED FOR TEN-FRAME ─────────────────────────
 *
 * 1. IS THE MODEL THE ANSWER? For `subitize` and the operations, yes — a model
 *    would say the count. So nothing is modeled before the ask; the count is
 *    earned in the CORRECTION, where DISTAR pays for it. At ten or below the
 *    correction models the counted walk (`countWalk`, reused from
 *    countingBoardScript — not re-rolled); above ten a spoken walk is ear noise
 *    (SWAP-1's sayability lesson) so the correction names the answer instead.
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? "How many?" against a HIDDEN frame
 *    has exactly one right completion — this primitive is naturally
 *    unambiguous, unlike word-flip's. The asks stay short.
 *
 * 3. THE ASK STATES ITS PROBLEM ALOUD. A pre-reader cannot read the screen, and
 *    every correction re-ask inherits the ask, so `add` SAYS its fact ("Three
 *    plus two. How many altogether?") and `subtract` says its take-away. This
 *    is `findUnspokenStimulus`'s rule and it is the defect a live drive of
 *    di-spoken-practice caught.
 *
 * 4. THE SIGNATURE ERROR, PER MODE — the wrong answer that is fluent,
 *    confident, and most likely to be wrongly affirmed:
 *      subitize  — COUNTING ALOUD ONE-BY-ONE after the flash. It reaches the
 *                  right number by the wrong route and is the exact skill the
 *                  mode exists to defeat. ⚠ But the ACCEPT clause matters just
 *                  as much: a child who says the total FIRST and then verifies
 *                  by counting is correct — land-on-the-total is an accept
 *                  (phoneme-explorer's blend rule, one layer over).
 *      make_ten  — saying the TOTAL (ten) instead of the complement.
 *      split     — TWO of them, and both are gestures rather than words.
 *                  (a) The EMPTY PART: flipping none, or flipping every
 *                  counter, leaves one group and nothing. It looks like a
 *                  finished, confident answer and it is not a decomposition —
 *                  a part is not the whole, and zero is not a group.
 *                  (b) The REPEAT: showing four-and-one again on the next item
 *                  is a correct partition and a wrong answer to "a DIFFERENT
 *                  way", which is the half of K.OA.3 the mode exists for. Both
 *                  are judged in code and handed to the tutor as a verdict; she
 *                  is never asked to count pixels or remember prior items.
 *      add       — saying one of the ADDENDS back.
 *      subtract  — saying the START or the number TAKEN AWAY back.
 *
 * ── CONTENT GATES SPECIFIC TO TEN-FRAME (skill step 4, brief §4) ────────────
 *
 * ZERO IS UNBENCHED. "zero"/"none" is not a benched spoken answer (di-shapes
 * rung 2 residual) and an EMPTY FRAME is a legitimate subitize stimulus while a
 * subtraction can answer 0. Every spoken answer is floored at 1 and any item
 * that computes to 0 is DROPPED — `itemFromChallenge` returns null and the
 * component never shows it. Nothing is backfilled: a placeholder item in a
 * judged loop becomes a spoken ask the tutor must judge.
 *
 * THE ≤20 CEILING. `number_word_to_20` is benched; `number_word_to_120` is
 * build-ahead with #63 acceptance owed. Ten-frame tops out at 20 (double
 * frame), so this primitive fits ENTIRELY inside the benched range — one of the
 * reasons it is the right first math port. The gate is asserted anyway so a
 * future capacity change cannot launder an unbenched class into production.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * validateJudgedScriptPack in this pack's test file: no spoken line below opens
 * a sentence with either.
 */

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import { countWalk, numberWordFor } from './countingBoardScript';

export type TenFrameItemKind =
  | 'build'
  | 'subitize'
  | 'make_ten'
  | 'split'
  | 'build_teen'
  | 'decompose_teen'
  | 'add'
  | 'subtract';
export type TenFrameBand = 'K' | '1-2';

/**
 * THE TEEN MODES ARE THE ONE PLACE K GETS A DOUBLE FRAME (contract R2 fork,
 * 2026-09-08). K.NBT.1 asks a five-year-old to see 14 as "a ten and four more",
 * and a ten cannot be a UNIT on a frame that holds exactly ten — the child
 * needs the full frame beside the loose ones. R2 pins K to a single frame for
 * every OTHER mode and that pin is untouched; these two are pinned to a DOUBLE
 * frame at every band instead, which is why they are new modes rather than a
 * band gate on `build`.
 *
 *   build_teen     — the ten is GIVEN (top frame full) and the child places
 *                    the ones. Composition: 10 + ? = 14.
 *   decompose_teen — a teen group arrives SCATTERED over both frames and the
 *                    child turns exactly ten of them yellow. Decomposition:
 *                    14 = 10 + ?, with the ten found rather than handed over.
 *
 * The scatter is the pedagogy, not decoration. Seeded top-frame-first, a full
 * row of ten would be a LAYOUT cue — "flip the top frame" is solvable by a
 * child who cannot count to ten, which is the trivial-from-layout failure
 * pedagogy rule #1 forbids. Scattered, the only route to ten is counting ten.
 */
export const TEEN_TEN = 10;
export const TEEN_MIN = 11;
export const TEEN_MAX = 19;
const TEEN_KINDS: readonly TenFrameItemKind[] = ['build_teen', 'decompose_teen'];
export const isTeenKind = (kind: string): boolean =>
  (TEEN_KINDS as readonly string[]).includes(kind);

/** The benched spoken-number window. Zero is excluded by the class record
 *  itself; 20 is the ceiling `number_word_to_20` was benched at. */
export const SPOKEN_ANSWER_MIN = 1;
export const SPOKEN_ANSWER_MAX = 20;

export interface TenFrameItem extends JudgedScriptItem {
  kind: TenFrameItemKind;
  /** Frame capacity — 10 for a single frame, 20 for a double. */
  capacity: number;
  /** Counters seeded on the frame when the item opens (make_ten, subtract). */
  shown: number;
  /** The number the child must PRODUCE: said aloud on voice items, enacted on
   *  gesture items (build = counters placed; make_ten @K = the complement). */
  answer: number;
  /** Counters that must be on the frame for a gesture item to auto-commit.
   *  Only make_ten @K has one (R6: it judges when the frame reaches capacity);
   *  `build` has no terminal state and closes its turn on stillness instead. */
  commitAt?: number;
  addend1?: number;
  addend2?: number;
  /** subtract: how many the child takes off the frame. */
  removed?: number;
  /** Teen modes only: the teen number itself, 11-19. `answer` carries what the
   *  child must PRODUCE (the ones on `build_teen`, the whole group on
   *  `decompose_teen`, mirroring `split`), so the total needs its own field. */
  teenTotal?: number;
  /** `decompose_teen` only: which of the 20 cells the scattered group occupies.
   *  Produced once, in `itemsFromChallenges`, so the stage and any harness see
   *  the same board — and deterministic per item id, because a scatter that
   *  changed under a re-render would move counters out from under the child's
   *  finger mid-count. */
  seedCells?: number[];
  /**
   * `split` only: this item's 1-based position among the split items that share
   * its TOTAL. Ordinal 1 asks for "a way"; every later one asks for "a
   * DIFFERENT way", which is the half of K.OA.3 ("in more than one way") that a
   * single item cannot assess no matter how well it is judged. Stamped at
   * pack-build time by `itemsFromChallenges`, so the ask, the correction and
   * the harness all read one deterministic number instead of tracking session
   * state three times.
   */
  splitOrdinal?: number;
}

// ── split: the pair is the answer, so it needs its own vocabulary ───────────

/**
 * One partition the child enacted, as code reads it off the frame. `a` is the
 * first colour (the counters left alone), `b` the second (the ones flipped).
 * ORDER IS KEPT: on a two-colour frame "two red and three yellow" and "three
 * red and two yellow" are different pictures and different number pairs, which
 * is what gives a total of five four ways to be shown instead of two.
 */
export interface TenFrameSplit {
  a: number;
  b: number;
}

/** Canonical key for "has this way already been shown?" — ordered, per total. */
export const splitKey = (split: TenFrameSplit): string => `${split.a}+${split.b}`;

/** How many ORDERED pairs of positive parts a total can be shown as. Five has
 *  four (1+4, 2+3, 3+2, 4+1); two has exactly one. The distinctness rule below
 *  needs this so it can never demand a way that does not exist. */
export const waysToSplit = (total: number): number => Math.max(0, total - 1);

export type SplitVerdict = 'correct' | 'empty_part' | 'repeat' | 'miscount';

/**
 * THE WHOLE JUDGE FOR `split`, IN CODE. The tutor is handed a verdict, never a
 * board to inspect — the same rule `frameVerdictCue` already follows for
 * build/make-ten, one step further because the answer here is a pair.
 *
 * `alreadyShown` is the set of `splitKey`s the child has already produced for
 * THIS total in THIS session. A repeat is wrong ONLY while an unshown way still
 * exists: once a child has exhausted a small total's ways, demanding a new one
 * would make the item unwinnable, so any valid partition is accepted again.
 */
export const judgeSplit = (
  item: TenFrameItem,
  split: TenFrameSplit,
  alreadyShown: ReadonlySet<string> = new Set(),
): SplitVerdict => {
  if (split.a + split.b !== item.answer) return 'miscount';
  if (split.a < 1 || split.b < 1) return 'empty_part';
  const waysLeft = waysToSplit(item.answer) - alreadyShown.size;
  if (waysLeft > 0 && alreadyShown.has(splitKey(split))) return 'repeat';
  return 'correct';
};

// ── Small speakable helpers ─────────────────────────────────────────────────

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "one counter" / "two counters" — the number is adjacent in several asks and
 *  "Put one counters on the frame" is the kind of line a five-year-old hears
 *  as noise. */
const countersWord = (n: number) => (n === 1 ? 'counter' : 'counters');

const int = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** A spoken answer must be inside the benched window. This is the gate that
 *  keeps zero and >20 out of the tutor's ear. */
export const isSayableAnswer = (n: unknown): n is number =>
  int(n) && n >= SPOKEN_ANSWER_MIN && n <= SPOKEN_ANSWER_MAX;

/** Model the counted walk only where it is sayable; above ten a chant is ear
 *  noise, so the correction names the answer and the strategy instead
 *  (countingBoardScript's rule, held). */
const WALK_CEILING = 10;

// ── Answer material — the fork, as code ─────────────────────────────────────

export const answerKindFor = (
  kind: TenFrameItemKind,
  band: TenFrameBand,
): 'voice' | 'gesture' =>
  kind === 'build' || kind === 'split' || isTeenKind(kind) || (kind === 'make_ten' && band === 'K')
    ? 'gesture'
    : 'voice';

export const responseClassFor = (
  kind: TenFrameItemKind,
  band: TenFrameBand,
): ResponseClassId =>
  answerKindFor(kind, band) === 'gesture' ? 'manipulation' : 'number_word_to_20';

/** Task identity for the runner's how-to-play policy: when consecutive items
 *  change `action`, the next cue re-speaks what to do. A mixed session can
 *  interleave placing, filling, looking and operating, so "what to do" is not a
 *  static protocol a non-reader can look up (cvc-speller rule). */
export const actionFor = (kind: TenFrameItemKind, band: TenFrameBand): string => {
  if (kind === 'make_ten') return band === 'K' ? 'fill' : 'complement';
  if (kind === 'add' || kind === 'subtract') return 'operate';
  if (kind === 'split') return 'split';
  // The two teen actions are genuinely different hands — placing the loose ones
  // beside a given ten, versus finding the ten inside a scattered group — so
  // they get their own action words and the runner re-speaks the how-to-play
  // when a session moves between them.
  if (kind === 'build_teen') return 'place-ones';
  if (kind === 'decompose_teen') return 'find-ten';
  return kind === 'build' ? 'place' : 'look';
};

// ── Build gates — DROP an unaskable item, never repair it into one ───────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface TenFrameChallengeLike {
  id: string;
  type: TenFrameItemKind;
  targetCount: number;
  startCount?: number;
  addend1?: number;
  addend2?: number;
}

/**
 * One generated challenge → one judged item, or NULL when the item cannot be
 * asked honestly. The drop conditions are ten-frame's two, plus structural
 * coherence:
 *   - a spoken answer of 0 (empty-frame subitize, a subtraction to nothing)
 *   - a spoken answer above 20 (outside the benched class)
 *   - a make-ten with nothing to complete, an add without addends, a
 *     subtraction that removes nothing.
 */
export const itemFromChallenge = (
  ch: TenFrameChallengeLike,
  ctx: { capacity: number; band: TenFrameBand },
): TenFrameItem | null => {
  const { capacity, band } = ctx;
  const base = {
    id: ch.id,
    kind: ch.type,
    answerKind: answerKindFor(ch.type, band),
    responseClass: responseClassFor(ch.type, band),
    action: actionFor(ch.type, band),
    capacity,
  } as const;

  switch (ch.type) {
    case 'build': {
      // Gestural: the target is the QUESTION (spoken in the ask), the placement
      // is the answer — so the ≤20 bench does not bind, only the frame does.
      if (!int(ch.targetCount) || ch.targetCount < 1 || ch.targetCount > capacity) return null;
      return { ...base, shown: 0, answer: ch.targetCount };
    }
    case 'subitize': {
      // An empty frame is a legitimate stimulus whose answer is "zero" — and
      // "zero" is unbenched. Drop it rather than teach the tutor to hear it.
      if (!isSayableAnswer(ch.targetCount) || ch.targetCount > capacity) return null;
      return { ...base, shown: 0, answer: ch.targetCount };
    }
    case 'split': {
      // Gestural, and the total is PUBLIC (the ask states it), so the spoken
      // bench does not bind. Two is the floor: a total of one cannot be shown
      // as two groups at all, and an item with no right answer is dropped, not
      // repaired. The group must fit the frame it is seeded onto.
      const total = ch.targetCount;
      if (!int(total) || total < 2 || total > capacity) return null;
      // `shown` seeds the frame with the WHOLE group — the child partitions a
      // set that is already there rather than building one (obj wording:
      // "split a group of up to 5 objects into two smaller groups").
      return { ...base, shown: total, answer: total };
    }
    case 'build_teen': {
      // The ten is GIVEN — a full top frame — and the child places the ones.
      // The teen number itself is the QUESTION (spoken in the ask), so the
      // spoken bench does not bind; the double frame does. A single frame
      // cannot hold a teen number at all, so those items DROP rather than being
      // repaired down to a number that is no longer a teen number.
      const total = ch.targetCount;
      if (!int(total) || total < TEEN_MIN || total > TEEN_MAX) return null;
      if (total > capacity) return null;
      return { ...base, shown: TEEN_TEN, answer: total - TEEN_TEN, teenTotal: total };
    }
    case 'decompose_teen': {
      // The group ARRIVES and the child finds the ten inside it. Gestural, and
      // both the total and the ten are PUBLIC (the ask states both), so the
      // spoken bench does not bind here either. `answer` carries the whole
      // group, as it does on `split`; the ones fall out as total − ten.
      const total = ch.targetCount;
      if (!int(total) || total < TEEN_MIN || total > TEEN_MAX) return null;
      if (total > capacity) return null;
      return { ...base, shown: total, answer: total, teenTotal: total };
    }
    case 'make_ten': {
      const shown = ch.targetCount;
      if (!int(shown) || shown < 1 || shown >= capacity) return null;
      const complement = capacity - shown;
      // At K the complement is ENACTED, so the spoken bench does not apply;
      // reader grades say it aloud and must stay inside the window.
      if (band !== 'K' && !isSayableAnswer(complement)) return null;
      return {
        ...base,
        shown,
        answer: complement,
        commitAt: band === 'K' ? capacity : undefined,
      };
    }
    case 'add': {
      if (!int(ch.addend1) || !int(ch.addend2) || ch.addend1 < 1 || ch.addend2 < 1) return null;
      const sum = ch.addend1 + ch.addend2;
      if (!isSayableAnswer(sum) || sum > capacity) return null;
      return { ...base, shown: 0, answer: sum, addend1: ch.addend1, addend2: ch.addend2 };
    }
    case 'subtract': {
      const start = ch.startCount;
      if (!int(start) || start < 1 || start > capacity) return null;
      // A difference of zero answers "zero" — unbenched, so the item drops.
      if (!isSayableAnswer(ch.targetCount) || ch.targetCount >= start) return null;
      return { ...base, shown: start, answer: ch.targetCount, removed: start - ch.targetCount };
    }
  }
};

/**
 * The whole generated set → the judged items, unaskable ones DROPPED.
 *
 * This exists so `splitOrdinal` has ONE producer. The stage and the headless
 * drive plan both call it, which is the property that stopped letter-spotter's
 * generator and script disagreeing live: an ordinal computed in the component
 * and not in the harness would mean the harness never drives the "different
 * way" ask at all, and the ask that ships would be the one nothing tested.
 */
export const itemsFromChallenges = (
  challenges: readonly TenFrameChallengeLike[],
  ctx: { capacity: number; band: TenFrameBand },
): TenFrameItem[] => {
  const items = challenges
    .map((ch) => itemFromChallenge(ch, ctx))
    .filter((item): item is TenFrameItem => item !== null);

  const seenPerTotal = new Map<number, number>();
  for (const item of items) {
    if (item.kind === 'decompose_teen') {
      item.seedCells = scatterCells(item.answer, ctx.capacity, item.id);
      continue;
    }
    if (item.kind !== 'split') continue;
    const nth = (seenPerTotal.get(item.answer) ?? 0) + 1;
    seenPerTotal.set(item.answer, nth);
    item.splitOrdinal = nth;
  }
  return items;
};

/**
 * Where a `decompose_teen` group sits on the double frame — SCATTERED, and
 * that is the whole point (see the TEEN_TEN docblock): seeded top-frame-first,
 * "flip the full row" would solve the item without counting.
 *
 * Deterministic in the item id so the board is stable across re-renders and
 * reproducible in a test. The generator supplies no positions for these items;
 * this is the one producer, the same rule `splitOrdinal` follows.
 */
export const scatterCells = (count: number, capacity: number, seedKey: string): number[] => {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) seed = (seed * 31 + seedKey.charCodeAt(i)) % 2147483647;
  let state = (seed || 1) % 2147483647;
  const rand = () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
  const cells = Array.from({ length: capacity }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  // A REJECTED ARRANGEMENT IS STILL A LEAK: a draw that happens to fill one
  // whole frame hands the child the ten as a shape. Re-roll off the same
  // stream until neither frame is full, so determinism survives.
  //
  // ⚠ NINETEEN IS THE ONE TOTAL WHERE THIS IS UNSATISFIABLE, and it is
  // geometry, not a bug: nineteen counters over two frames of ten must fill
  // one of them. So at nineteen the board does show the ten as a shape, and
  // the item degrades from "count out ten" to "spot the full frame" — which is
  // still the other half of K.NBT.1 ("identify a group of ten ones"), just an
  // easier half. The re-roll loop below simply runs out of arrangements and
  // returns one; it is recorded here rather than fixed by capping the mode at
  // eighteen, because the published objective names 16-19 and a cap below what
  // the objective names is the defect this whole mode was written to close.
  const fillsAFrame = (picked: number[]) => {
    for (let frame = 0; frame * 10 < capacity; frame++) {
      const inFrame = picked.filter((c) => c >= frame * 10 && c < frame * 10 + 10).length;
      if (inFrame === 10) return true;
    }
    return false;
  };
  let picked = cells.slice(0, count).sort((a, b) => a - b);
  for (let attempt = 0; attempt < 8 && fillsAFrame(picked); attempt++) {
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    picked = cells.slice(0, count).sort((a, b) => a - b);
  }
  return picked;
};

// ── How-to-play — spoken on the opener AND whenever the ACTION changes ──────

export const howToPlayFor = (item: TenFrameItem): string => {
  switch (item.kind) {
    case 'build':
      return 'Tap the boxes to put counters on the frame. ';
    case 'subitize':
      return 'Watch the frame — the counters show for just a moment. Then say how many you saw! ';
    case 'make_ten':
      return item.answerKind === 'gesture'
        ? 'Some counters are already there. Tap the empty boxes until every box is full. '
        : 'Some counters are already there. Then say how many MORE counters fill the frame. ';
    case 'split':
      // The gesture has to be TAUGHT — a two-colour counter that turns over
      // when you touch it is not a thing a five-year-old can guess at. Named
      // colours, not "the other colour": the child is looking at the frame.
      return 'The counters are all red. Tap a counter to turn it yellow — that makes two groups! ';
    case 'build_teen':
      return 'The top frame is already full. Tap the empty boxes to put more counters on. ';
    case 'decompose_teen':
      // Same taught gesture as `split`, different target: there the child
      // chooses where the line falls, here the line is fixed at ten.
      return 'The counters are all red. Tap a counter to turn it yellow — count them out as you go! ';
    case 'add':
      return 'Put the counters on the frame, then say how many there are altogether. ';
    case 'subtract':
      return 'Take counters off the frame, then say how many are left. ';
  }
};

// ── The asks — short, one defensible answer, problem STATED aloud ───────────

/**
 * THE SPLIT COLOURS ARE PINNED, and this constant is why. Every line below
 * NAMES them ("tap a counter to turn it yellow"), so a generator-chosen palette
 * would let the tutor's mouth disagree with the child's screen — the exact
 * class of drift SP-17 killed for instruction text. Red-and-yellow is also what
 * the physical manipulative is: a two-colour counter, red on one face, yellow
 * on the other. `twoColorMode`'s colours still govern the decorative build
 * challenges they were written for; they do not reach `split`.
 */
export const SPLIT_COLOR_A = 'red';
export const SPLIT_COLOR_B = 'yellow';

const askFor = (item: TenFrameItem): string => {
  const answerWord = numberWordFor(item.answer);
  const shownWord = numberWordFor(item.shown);
  const capWord = numberWordFor(item.capacity);

  switch (item.kind) {
    case 'build':
      return `Put ${answerWord} ${countersWord(item.answer)} on the frame. Your turn.`;
    case 'subitize':
      // Past tense on purpose: by the time this is answered the counters are
      // hidden (R4). Nothing here names a quantity.
      return 'Eyes ready — watch the frame! Your turn. How many counters did you see?';
    case 'make_ten':
      return item.answerKind === 'gesture'
        ? `There are ${shownWord} ${countersWord(item.shown)} on the frame. Your turn — fill it up.`
        : `There are ${shownWord} ${countersWord(item.shown)} on the frame. Your turn. How many more counters make ${capWord}?`;
    case 'split':
      // The TOTAL is public — the ask states it, so hearing it back is not a
      // leak. The PARTS never appear in the tutor's mouth before the verdict.
      return (item.splitOrdinal ?? 1) > 1
        ? `${cap(shownWord)} ${countersWord(item.shown)} again. Your turn — show me a DIFFERENT way to make two groups.`
        : `Here are ${shownWord} ${countersWord(item.shown)}. Your turn — turn some yellow to make two groups.`;
    case 'build_teen': {
      // The TEN is public and it is the model being taught — a full frame IS
      // ten, and saying so is the whole of K.NBT.1's "ten ones". The ONES are
      // the answer and never appear before the verdict.
      const totalWord = numberWordFor(item.teenTotal ?? item.answer + TEEN_TEN);
      return `The top frame is full. That is ten. Your turn — make ${totalWord}.`;
    }
    case 'decompose_teen':
      // Both numbers here are the QUESTION: the total is on screen and stated,
      // and ten is what the child is asked to count out. What is never said is
      // how many are LEFT — the ones — which is what the affirmation names.
      return `Here are ${answerWord} counters, all mixed up. Your turn — turn ten of them yellow.`;
    case 'add':
      return `${cap(numberWordFor(item.addend1 ?? 0))} plus ${numberWordFor(item.addend2 ?? 0)}. Your turn. How many altogether?`;
    case 'subtract':
      return `${cap(shownWord)} ${countersWord(item.shown)}. Take away ${numberWordFor(item.removed ?? 0)}. Your turn. How many are left?`;
  }
};

// ── The corrections — DISTAR re-model then re-elicit (standing gate 3) ──────
// This is the FIRST place the answer is ever spoken, and it is earned.

/**
 * THE TEEN JUDGE, IN CODE — the tutor is handed a ruling, never a board.
 *
 * Both teen modes measure ONE number against ONE target and the target is
 * fixed by the mode, not chosen by the child: `build_teen` wants the ONES
 * (total − ten) placed beside the given ten, `decompose_teen` wants exactly
 * TEN turned yellow out of the scattered group. That is what makes them
 * cheaper than `split` to judge and, pedagogically, a step BELOW it — there is
 * one right partition here, and it is the one K.NBT.1 names.
 */
export type TeenVerdict = 'correct' | 'too_few' | 'too_many';

/** What the child must produce on a teen item: the ones on `build_teen`, the
 *  ten on `decompose_teen`. */
export const teenTargetFor = (item: TenFrameItem): number =>
  item.kind === 'build_teen' ? item.answer : TEEN_TEN;

export const teenTotalFor = (item: TenFrameItem): number =>
  item.teenTotal ?? (item.kind === 'build_teen' ? item.answer + TEEN_TEN : item.answer);

export const judgeTeen = (item: TenFrameItem, produced: number): TeenVerdict => {
  const target = teenTargetFor(item);
  if (produced === target) return 'correct';
  return produced < target ? 'too_few' : 'too_many';
};

/** "eleven, twelve, thirteen, fourteen" — counting ON from the ten already
 *  there, which is the strategy `build_teen` exists to teach. Never more than
 *  nine words (the ones top out at nine). */
const countOnWalk = (from: number, to: number): string =>
  Array.from({ length: to - from }, (_, i) => numberWordFor(from + 1 + i)).join(', ');

/**
 * The teen correction forks on WHICH miss happened, and both branches re-model
 * the SAME strategy: a ten holds still and the ones are counted against it.
 * `build_teen` earns the ones in its model (DISTAR pays for the answer in the
 * correction); `decompose_teen` never names the ones at all, because the ones
 * are what its affirmation is for — its model is of counting out ten.
 */
const teenCorrectionFor = (item: TenFrameItem, verdict: TeenVerdict): string => {
  const total = teenTotalFor(item);
  const totalWord = numberWordFor(total);
  if (item.kind === 'build_teen') {
    const onesWord = numberWordFor(item.answer);
    const opener = verdict === 'too_many'
      ? `My turn: that is past ${totalWord}.`
      : `My turn: that is not ${totalWord} yet.`;
    return (
      `${opener} The top frame is ten. Watch me count on: ${countOnWalk(TEEN_TEN, total)}. `
      + `That is ${onesWord} more than ten. Your turn — make ${totalWord}.`
    );
  }
  const opener = verdict === 'too_many'
    ? `My turn: that is more than ten yellow.`
    : `My turn: that is not ten yellow yet.`;
  return (
    `${opener} Watch me count out ten. ${cap(countWalk(TEEN_TEN))}. Stop at ten. `
    + `Your turn — turn ten of them yellow.`
  );
};

/**
 * `split`'s correction forks on WHICH miss happened, because "you left a group
 * empty" and "you showed that way already" are different lessons and a child
 * who hears the wrong one learns nothing. Every branch models the property that
 * was violated and re-elicits; NO BRANCH NAMES A PAIR, at any point, including
 * the move-on — a valid partition spoken aloud is the answer to every remaining
 * item on this total, not just to this one.
 */
const splitCorrectionFor = (item: TenFrameItem, verdict: SplitVerdict): string => {
  const totalWord = numberWordFor(item.answer);
  switch (verdict) {
    case 'repeat':
      return (
        `My turn: that is a way to make ${totalWord}, and it is the same way you showed me before. `
        + `There is more than one way. Your turn — turn a different number of counters yellow.`
      );
    case 'miscount':
      // Unreachable from the stage (taps only flip colour; nothing is added or
      // removed), so this is the harness's branch and a guard against a future
      // edit that lets the count move.
      return (
        `My turn: all ${totalWord} counters stay on the frame. We are not taking any away — `
        + `we are turning some of them yellow. Your turn.`
      );
    case 'empty_part':
    case 'correct':
    default:
      return (
        `My turn: two groups means I can see red counters AND yellow counters. `
        + `Not all red. Not all yellow. Your turn — turn some of them yellow, but leave some red.`
      );
  }
};

const correctionFor = (item: TenFrameItem): string => {
  const answerWord = numberWordFor(item.answer);
  const shownWord = numberWordFor(item.shown);
  const capWord = numberWordFor(item.capacity);

  switch (item.kind) {
    case 'build':
      return item.answer <= WALK_CEILING
        ? `My turn: I need ${answerWord}. Watch me count them. ${countWalk(item.answer)}. That is ${answerWord}. Your turn. Put ${answerWord} ${countersWord(item.answer)} on the frame.`
        : `My turn: I need ${answerWord} — fill the first frame all the way, then keep going. Your turn. Put ${answerWord} ${countersWord(item.answer)} on the frame.`;
    case 'subitize':
      return `My turn: it was ${answerWord}. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?`;
    case 'make_ten':
      return item.answerKind === 'gesture'
        ? `My turn: the frame is not full yet. Every box needs a counter. Your turn — keep tapping the empty boxes.`
        : `My turn: ${shownWord} and ${answerWord} make ${capWord}. ${cap(answerWord)} more. Your turn. How many more counters make ${capWord}?`;
    case 'build_teen':
    case 'decompose_teen':
      // The DEFAULT is the too-few branch — the miss a child makes by stopping
      // early. `teenVerdictCue` overrides it once the count is known.
      return teenCorrectionFor(item, 'too_few');
    case 'split':
      // The DEFAULT correction is the empty-part one, because that is the miss
      // this mode is built to catch. `splitCorrectionFor` overrides it once the
      // verdict is known. Neither line ever names a pair: the model here is of
      // the PROPERTY the child missed ("I can see both colours"), not of a
      // partition, which would hand over the answer the item is asking for —
      // the same restraint the K make-ten gesture correction already keeps.
      return splitCorrectionFor(item, 'empty_part');
    case 'add':
      return item.answer <= WALK_CEILING
        ? `My turn: ${numberWordFor(item.addend1 ?? 0)} plus ${numberWordFor(item.addend2 ?? 0)}. Watch me count. ${countWalk(item.answer)}. ${cap(answerWord)} altogether. Your turn. How many altogether?`
        : `My turn: ${numberWordFor(item.addend1 ?? 0)} plus ${numberWordFor(item.addend2 ?? 0)} makes ${answerWord}. Fill the first frame to ten, then count on. Your turn. How many altogether?`;
    case 'subtract':
      return `My turn: ${shownWord} take away ${numberWordFor(item.removed ?? 0)} leaves ${answerWord}. ${cap(answerWord)} ${item.answer === 1 ? 'is' : 'are'} left. Your turn. How many are left?`;
  }
};

// ── Judging contracts ───────────────────────────────────────────────────────

/** What looks like an answer for this mode and is not — plus the right answer
 *  that does not look right. Both halves matter: the refuse clause stops a
 *  fluent miss being affirmed, the accept clause stops a correct child being
 *  corrected. */
const discriminationFor = (item: TenFrameItem): string => {
  const answerWord = numberWordFor(item.answer);
  switch (item.kind) {
    case 'subitize':
      return (
        `Saying "${answerWord}" straight away is correct, and checking it by counting AFTER saying it is still correct. `
        + `But counting up one at a time and only arriving at "${answerWord}" at the end is NOT a subitizing answer — treat that as wrong, because recognising the group at a glance is the whole skill here. `
      );
    case 'make_ten':
      return (
        `The total "${numberWordFor(item.capacity)}" said back is NOT the answer, however confident it sounds — the answer is how many MORE are needed. `
        + `"${answerWord} more" or "${answerWord} counters" counts as "${answerWord}". `
      );
    case 'add':
      return (
        `Either addend said back ("${numberWordFor(item.addend1 ?? 0)}" or "${numberWordFor(item.addend2 ?? 0)}") is NOT the answer. `
        + `Counting aloud that ENDS on "${answerWord}" counts as that answer — the last number said tells the total. `
      );
    case 'subtract':
      return (
        `The starting number "${numberWordFor(item.shown)}" and the number taken away "${numberWordFor(item.removed ?? 0)}" are NOT the answer. `
        + `Counting aloud that ENDS on "${answerWord}" counts as that answer — the last number said tells how many are left. `
      );
    default:
      return '';
  }
};

const affirmTailFor = (item: TenFrameItem): string => {
  const answerWord = numberWordFor(item.answer);
  switch (item.kind) {
    case 'subitize':
      return `${answerWord} ${countersWord(item.answer)}`;
    case 'make_ten':
      return `${answerWord} more`;
    case 'add':
      return `${answerWord} altogether`;
    case 'subtract':
      return `${answerWord} left`;
    default:
      return answerWord;
  }
};

/**
 * ⚠️ THE WAIT IS DESCRIBED AS THE TUTOR'S STATE, NEVER AS AN IMPERATIVE.
 * Drive 2 (2026-08-13) caught the model VOICING `[WAIT silently]` to the child,
 * immediately after the ask — it took the contract's old "Then WAIT silently…"
 * opener, wrapped it in a bracket tag mimicking `[TF_ITEM]`, and performed it.
 * A stage direction phrased as a command to the tutor reads, to the model, like
 * one more thing on the list of things to say. So the contract now states what
 * is true ("the quoted line is the only thing you say") rather than issuing an
 * order, and the cue names the failure explicitly at the end.
 */
/**
 * ⚠️ THE STOP BELONGS TO EACH VERDICT BRANCH, NOT ONLY TO THE ASK.
 * The opening sentence here says "the quoted line is the ONLY thing you say" —
 * but by the time the model reaches the branches below, "the quoted line" reads
 * as the ASK it was just handed, so the verdict lines inherited no stop at all.
 * The first headless DI run (2026-08-14) shows exactly that decay: the first
 * affirm came back clean ("Yes, three counters."), then every later one grew —
 * 26, 31, 37, 35, 34 unscripted words — into praise, a preview of the next
 * activity, and finally "We've completed this activity" at item 4 of 7.
 * The literacy packs never had this: they close every branch with `and stop`.
 */
const judgingContract = (item: TenFrameItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner works, and their think time is unbounded. Never say the answer during their turn and never count aloud with them. `
  + `The correct answer is "${numberWordFor(item.answer)}". `
  + discriminationFor(item)
  + `If the answer is right, say exactly: "Yes, ${affirmTailFor(item)}." and stop there — add no praise, no encouragement and no mention of what comes next, and never tell the learner the activity is finished. `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop there; that correction is the whole turn.`;

/** The gesture contract is a SILENCE contract (spell_word's pattern): there is
 *  nothing to judge until the placement is described, and the quantity is
 *  banned from the tutor's mouth for the whole item. */
const silenceContract = (item: TenFrameItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS on the frame, not with their voice, so you then stay completely silent. `
  + (item.kind === 'build'
    ? `Do not count the counters aloud and never say how many are on the frame. `
    : item.kind === 'build_teen'
      // The banned material is the ONES. The ten is on screen and in the ask;
      // how many MORE than ten is what the child is producing.
      ? `Never say how many more than ten are needed and never count the counters aloud. `
      : item.kind === 'decompose_teen'
        // Here the banned material is what is LEFT OVER. Ten is the ask, so it
        // may be said; the red remainder is the decomposition the affirmation
        // exists to name.
        ? `Never say how many counters will be left red and never count the counters aloud for them. `
        : item.kind === 'split'
      // The banned material here is a PAIR, not a count — and it stays banned
      // for the whole session, because naming one way answers every later item
      // on this total too.
          ? `Never suggest a pair of numbers that makes ${numberWordFor(item.answer)}, never say how many to turn yellow, and never count the counters aloud. `
          : `Never say how many more are needed and never count the empty boxes aloud. `)
  + `Do not narrate what they are doing or fill the pause. `
  + `You will be told what they placed and whether it matches; only then do you speak.`;

/** Named at the end of every cue that carries a contract. It names the exact
 *  failure a drive produced rather than trusting a generic "don't read tags". */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const contractFor = (item: TenFrameItem): string =>
  item.answerKind === 'gesture' ? silenceContract(item) : judgingContract(item);

// ── Cues ────────────────────────────────────────────────────────────────────

export interface TenFrameCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line, never as a second catalog directive on the same turn). */
export const itemCue = (item: TenFrameItem, opts: TenFrameCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time to work with the ten frame! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  const spoken = `${greeting}${how}${askFor(item)}`;
  return `[TF_ITEM] Say exactly: "${spoken}" ${contractFor(item)} ${NEVER_PERFORM}`;
};

/**
 * The gesture verdict ask (`build`, `make_ten` @K): describes what the child
 * committed and hands the tutor its exact line. The MATCH IS COMPUTED IN CODE —
 * the tutor is never asked to count pixels. The digits in this instruction are
 * for the judge's eyes; the spoken lines carry number WORDS only.
 */
export const frameVerdictCue = (
  item: TenFrameItem,
  placed: number,
  opts: { alreadyShown?: ReadonlySet<string> } = {},
): string => {
  // `split` commits a PAIR. The gesture channel still carries one number —
  // how many the child turned yellow — because the total is fixed by the item,
  // so `b` determines `a` and no adapter or harness needs a second field.
  if (item.kind === 'split') {
    const b = Math.max(0, Math.min(item.answer, placed));
    return splitVerdictCue(item, { a: item.answer - b, b }, opts.alreadyShown);
  }
  // Teen items commit ONE number too, and which number it is depends on the
  // mode: the ones the child placed, or the counters they turned yellow. The
  // component and the harness both hand this function that number and nothing
  // else, so neither needs to know the target.
  if (isTeenKind(item.kind)) return teenVerdictCue(item, placed);
  const answerWord = numberWordFor(item.answer);
  const matches = placed === item.answer;
  const head = item.kind === 'build'
    ? `[TF_FRAME] The learner put ${placed} counters on the frame; the ask was for ${item.answer} — that ${matches ? 'MATCHES' : 'does NOT match'}. `
    : `[TF_FRAME] The learner placed ${placed} of the ${item.answer} counters the frame still needed — that ${matches ? 'fills it' : 'does NOT fill it'}. `;

  const line = matches
    ? (item.kind === 'build'
      ? `Say exactly: "Yes! ${cap(answerWord)} ${countersWord(item.answer)} on the frame. You built it!" `
      : `Say exactly: "Yes! The frame is full. ${cap(numberWordFor(item.shown))} and ${answerWord} make ${numberWordFor(item.capacity)}." `)
    : `Say exactly: "${correctionFor(item)}" `;

  return `${head}${line}Never read bracket tags aloud.`;
};

/**
 * The teen verdict — the count the child produced, judged in CODE.
 *
 * The AFFIRMATION is the one place the whole decomposition may be spoken, and
 * it is spoken because the child built it: "Ten and four make fourteen". On
 * every wrong branch she gets the correction verbatim and the ones never
 * appear on a `decompose_teen` item at all.
 */
export const teenVerdictCue = (item: TenFrameItem, produced: number): string => {
  const verdict = judgeTeen(item, produced);
  const total = teenTotalFor(item);
  const totalWord = numberWordFor(total);
  const onesWord = numberWordFor(total - TEEN_TEN);
  const head = item.kind === 'build_teen'
    ? `[TF_TEEN] The learner put ${produced} more counters beside the ten already on the frame, `
      + `making ${TEEN_TEN + produced}; the ask was for ${total} — that ${verdict === 'correct' ? 'MATCHES' : 'does NOT match'}. `
    : `[TF_TEEN] The learner turned ${produced} of the ${total} counters yellow; the ask was for ten `
      + `— that ${verdict === 'correct' ? 'MATCHES' : 'does NOT match'}. `;

  const line = verdict === 'correct'
    ? (item.kind === 'build_teen'
      ? `Say exactly: "Yes! Ten and ${onesWord} make ${totalWord}." `
      : `Say exactly: "Yes! Ten yellow, and ${onesWord} left red. ${cap(totalWord)} is ten and ${onesWord}." `)
    : `Say exactly: "${teenCorrectionFor(item, verdict)}" `;

  return `${head}${line}Never read bracket tags aloud.`;
};

/**
 * The `split` verdict — the pair the child enacted, judged in CODE, handed to
 * the tutor as a finished ruling.
 *
 * She is told the two numbers so her AFFIRMATION can name the decomposition the
 * child just built ("Yes! Two red and three yellow make five") — which is the
 * one moment in the item where a pair may be spoken, and it is spoken because
 * the child produced it, not to hand it over. On every wrong branch she gets
 * the correction verbatim and the pair never appears.
 */
export const splitVerdictCue = (
  item: TenFrameItem,
  split: TenFrameSplit,
  alreadyShown: ReadonlySet<string> = new Set(),
): string => {
  const verdict = judgeSplit(item, split, alreadyShown);
  const totalWord = numberWordFor(item.answer);
  const head =
    `[TF_SPLIT] The learner left ${split.a} counters red and turned ${split.b} yellow, `
    + `out of ${item.answer}. Verdict: ${verdict.toUpperCase()}`
    + (verdict === 'repeat' ? ` (they have already shown this exact pair for ${item.answer} in this session)` : '')
    + `. `;

  const line = verdict === 'correct'
    ? `Say exactly: "Yes! ${cap(numberWordFor(split.a))} red and ${numberWordFor(split.b)} yellow make ${totalWord}." `
    : `Say exactly: "${splitCorrectionFor(item, verdict)}" `;

  return `${head}${line}Never read bracket tags aloud.`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  item: TenFrameItem,
  next: TenFrameItem | null,
  opts: TenFrameCueOptions = {},
): string => {
  if (!next) {
    return `[TF_MOVE] Say exactly: "Good try! The ten frame takes practice — we will see that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[TF_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${askFor(next)}" ${contractFor(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[TF_COMPLETE] Say exactly: "What great number work today! Your eyes and your hands did hard thinking. See you next time!" Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer. On `subitize` this is
 * the audio half of "flash again": it re-asks, and it must never narrate the
 * count (cvc's `[ISOLATE_VOWEL]` was an answer leak on demand — the same trap).
 */
export const pronounceCue = (item: TenFrameItem): string =>
  `[TF_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 * (di-math-facts rule), answer-free by construction: `subitize` pushes no
 * quantity at all because its count IS the answer, and neither make-ten branch
 * pushes the complement.
 */
export const stimulusFor = (item: TenFrameItem): string => {
  switch (item.kind) {
    case 'build':
      return `put ${numberWordFor(item.answer)} ${countersWord(item.answer)} on the frame`;
    case 'subitize':
      return 'a quick flash of counters on the frame';
    case 'make_ten':
      return `${numberWordFor(item.shown)} ${countersWord(item.shown)} shown, frame of ${numberWordFor(item.capacity)}`;
    case 'split':
      // Stimulus-side only: the total is on screen and in the ask. The PAIR the
      // child is working toward is never pushed through this channel.
      return `${numberWordFor(item.answer)} red ${countersWord(item.answer)} to split into two colour groups`;
    case 'build_teen':
      // Stimulus-side only: the full top frame and the teen number are both
      // public. The ones the child must place are not pushed.
      return `a full top frame of ten, and empty boxes below it, making ${numberWordFor(teenTotalFor(item))}`;
    case 'decompose_teen':
      return `${numberWordFor(item.answer)} red counters scattered over two frames, with a group of ten to find inside`;
    case 'add':
      return `${numberWordFor(item.addend1 ?? 0)} plus ${numberWordFor(item.addend2 ?? 0)}`;
    case 'subtract':
      return `${numberWordFor(item.shown)} ${countersWord(item.shown)}, take away ${numberWordFor(item.removed ?? 0)}`;
  }
};

// ── The cue surface — one source for the component and the DI harness ───────

/**
 * Everything ten-frame ever sends the tutor. `TenFrame.tsx` spreads this and
 * adds what only a mounted component can own (status lines, and the
 * `diagnosisObservation` that reads the live board); the drive-plan endpoint
 * builds the identical cues for the headless judged-loop harness.
 *
 * The split exists so the harness cannot drift from production: a Python
 * journey that mirrors the cue wording by hand is a second source of truth,
 * and this family has already paid that bill once (letter-spotter's generator
 * and script disagreed live on what a sayable sentence was).
 */
export const tenFramePackBase = (
  items: TenFrameItem[],
): JudgedCueSurface<TenFrameItem> => ({
  primitiveType: 'ten-frame',
  activityLine: 'live direct instruction ten frame practice',
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

/** Numbers the ask STATES aloud, so hearing one back is not a leak. A
 *  make-ten of five into a frame of ten asks "there are five… how many more?"
 *  where the answer is also five; forbidding the word there would flag the
 *  question itself. */
const publicValuesFor = (item: TenFrameItem): number[] => {
  switch (item.kind) {
    case 'build':
      return [item.answer];
    case 'subitize':
      return [];
    case 'make_ten':
      return [item.shown, item.capacity];
    case 'build_teen':
      // The ask states the ten and the teen number; the ONES are the answer.
      return [teenTotalFor(item), TEEN_TEN];
    case 'decompose_teen':
      // Both the total and the ten are stated; what is left red is not.
      return [item.answer, TEEN_TEN];
    case 'split':
      // The TOTAL is stated in the ask. The parts are the answer and are not
      // public — but they are also not spoken material, so no leak token is
      // derivable from them; `leakTokens` for this kind is empty by
      // construction and the silence contract carries the ban instead.
      return [item.answer];
    case 'add':
      return [item.addend1 ?? 0, item.addend2 ?? 0];
    case 'subtract':
      return [item.shown, item.removed ?? 0];
  }
};

export interface TenFrameHarnessAnswers {
  /** What a correct child says (or places). */
  correct: string;
  /** Unambiguously wrong — the baseline refusal test. */
  plainWrong: string;
  /**
   * The FLUENT miss this item's judging contract explicitly refuses. Testing
   * it tests the discrimination clause rather than mere arithmetic: a judge
   * that only catches "four for five" can still affirm the addend said back.
   */
  signatureWrong?: { text: string; why: string };
  /** Gesture items commit a placement, not a word — code computes the match. */
  placed?: { correct: number; wrong: number };
  /** Answer tokens that must NOT appear in the spoken ask. */
  leakTokens: string[];
}

/**
 * The answers a headless student says on a judged drive. This lives beside the
 * contract it mirrors on purpose: `discriminationFor` above CLAIMS the judge
 * refuses these, and this is the claim made testable. Change one, change both.
 */
export const tenFrameHarnessAnswers = (item: TenFrameItem): TenFrameHarnessAnswers => {
  const answerWord = numberWordFor(item.answer);
  const wrongValue = item.answer < SPOKEN_ANSWER_MAX ? item.answer + 1 : item.answer - 1;
  const leakTokens = publicValuesFor(item).includes(item.answer) ? [] : [answerWord];

  const base: TenFrameHarnessAnswers = {
    correct: answerWord,
    plainWrong: numberWordFor(wrongValue),
    leakTokens,
  };

  switch (item.kind) {
    case 'split': {
      // The gesture number is HOW MANY TURN YELLOW. A correct child leaves both
      // colours on the board; the signature miss turns them ALL yellow, which
      // is a confident, finished-looking action that produces one group and an
      // empty one. Middle split for the correct case so neither part is 1 by
      // accident — a total of two has no middle and takes the only pair it has.
      const yellow = Math.max(1, Math.floor(item.answer / 2));
      return {
        ...base,
        correct: `${item.answer - yellow} red and ${yellow} yellow`,
        plainWrong: `all ${item.answer} turned yellow`,
        placed: { correct: yellow, wrong: item.answer },
        signatureWrong: {
          text: `all ${item.answer} turned yellow`,
          why: 'every counter flipped — one group and an empty one, which is not a decomposition',
        },
        leakTokens: [],
      };
    }
    case 'build_teen': {
      // The fluent miss is BUILDING THE TEEN NUMBER AGAIN from nothing —
      // placing all fourteen beside the ten that is already there. It looks
      // like diligent counting and it is exactly the child who has not yet
      // seen the full frame as ONE ten, which is the skill.
      const total = teenTotalFor(item);
      return {
        ...base,
        correct: `${item.answer} more counters placed beside the ten`,
        plainWrong: `${total} more counters placed beside the ten`,
        placed: { correct: item.answer, wrong: total },
        signatureWrong: {
          text: `${total} more counters placed`,
          why: 'built the whole teen number again instead of counting on from the ten already there',
        },
        leakTokens: base.leakTokens,
      };
    }
    case 'decompose_teen':
      // The fluent miss is turning EVERY counter yellow — a finished-looking
      // action that separates no ten out of anything (`split`'s empty-part
      // miss, one mode over).
      return {
        ...base,
        correct: `ten turned yellow`,
        plainWrong: `all ${item.answer} turned yellow`,
        placed: { correct: TEEN_TEN, wrong: item.answer },
        signatureWrong: {
          text: `all ${item.answer} turned yellow`,
          why: 'every counter flipped — no group of ten was ever counted out of the group',
        },
        leakTokens: [],
      };
    case 'build':
    case 'make_ten':
      if (item.answerKind === 'gesture') {
        return {
          ...base,
          correct: `${item.answer} counters placed`,
          plainWrong: `${Math.max(0, item.answer - 1)} counters placed`,
          placed: { correct: item.answer, wrong: Math.max(0, item.answer - 1) },
        };
      }
      // make_ten @1-2: the contract refuses the TOTAL said back.
      return {
        ...base,
        signatureWrong: {
          text: numberWordFor(item.capacity),
          why: 'the total said back instead of how many MORE are needed',
        },
      };
    case 'subitize':
      return {
        ...base,
        signatureWrong: {
          text: countWalk(item.answer),
          why: 'counted up one at a time — lands on the right number, but subitizing is the skill',
        },
      };
    case 'add':
      return {
        ...base,
        signatureWrong: {
          text: numberWordFor(item.addend1 ?? 0),
          why: 'an addend said back instead of the total',
        },
      };
    case 'subtract':
      return {
        ...base,
        signatureWrong: {
          text: numberWordFor(item.shown),
          why: 'the starting number said back instead of what is left',
        },
      };
  }
};
