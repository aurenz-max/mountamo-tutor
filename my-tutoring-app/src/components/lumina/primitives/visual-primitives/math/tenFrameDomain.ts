/**
 * ten-frame's domain: the items one lesson asks (the build gates that drop an unaskable challenge), the ask, the
 * code judges (`judgeSplit`, `judgeTeen`) and the harness answers. Pure and React-free: the boss, the component, the
 * levers, the generator and the probes read it. The answer-material fork and the gates are argued in
 * `tenFrameScript.ts`, which keeps the retired scripted cues and re-exports this module.
 */
import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { countWalk, numberWordFor } from './countingBoardDomain';

export type TenFrameItemKind =
  | 'build'
  | 'subitize'
  | 'make_ten'
  | 'split'
  | 'build_teen'
  | 'decompose_teen'
  | 'build_pair'
  | 'add'
  | 'subtract';
export type TenFrameBand = 'K' | '1-2';

/**
 * `build_pair` is the OPEN BUILD of K.OA.3 (open build, math wave 3): the frame opens EMPTY and the learner makes
 * the number out of red and yellow counters, any pair. `split` hands over the group and asks only where the line
 * falls; here the learner makes the whole and its parts, so the count and the partition are both theirs. Judged in
 * code at "I'm done!" with `split`'s judge and per-total ledger: the total, two non-empty colours, and a different
 * pair each time the same total comes back. The total is public (the ask states it); a pair is never said first.
 */
export const isPairKind = (kind: string): boolean => kind === 'split' || kind === 'build_pair';

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
  /** The lesson's support tier, stamped by the generator; when a model lever comes (`TEN_FRAME_LEVERS.support`). */
  supportTier?: SupportTier;
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

export const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "one counter" / "two counters" — the number is adjacent in several asks and
 *  "Put one counters on the frame" is the kind of line a five-year-old hears
 *  as noise. */
export const countersWord = (n: number) => (n === 1 ? 'counter' : 'counters');

const int = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** A spoken answer must be inside the benched window. This is the gate that
 *  keeps zero and >20 out of the tutor's ear. */
export const isSayableAnswer = (n: unknown): n is number =>
  int(n) && n >= SPOKEN_ANSWER_MIN && n <= SPOKEN_ANSWER_MAX;

/** Model the counted walk only where it is sayable; above ten a chant is ear
 *  noise, so the correction names the answer and the strategy instead
 *  (countingBoardScript's rule, held). */
export const WALK_CEILING = 10;

// ── Answer material — the fork, as code ─────────────────────────────────────

export const answerKindFor = (
  kind: TenFrameItemKind,
  band: TenFrameBand,
): 'voice' | 'gesture' =>
  kind === 'build' || isPairKind(kind) || isTeenKind(kind) || (kind === 'make_ten' && band === 'K')
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
  if (kind === 'build_pair') return 'make-pair';
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
  supportTier?: SupportTier;
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
    ...(ch.supportTier ? { supportTier: ch.supportTier } : {}),
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
    case 'build_pair': {
      // `split`'s gate on an EMPTY frame: the learner places the whole group, so nothing is seeded.
      const total = ch.targetCount;
      if (!int(total) || total < 2 || total > capacity) return null;
      return { ...base, shown: 0, answer: total };
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

  // Per kind and total: a `build_pair` of five and a `split` of five keep their own ledgers.
  const seenPerTotal = new Map<string, number>();
  for (const item of items) {
    if (item.kind === 'decompose_teen') {
      item.seedCells = scatterCells(item.answer, ctx.capacity, item.id);
      continue;
    }
    if (!isPairKind(item.kind)) continue;
    const key = `${item.kind}:${item.answer}`;
    const nth = (seenPerTotal.get(key) ?? 0) + 1;
    seenPerTotal.set(key, nth);
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
    case 'build_pair':
      return 'Pick red or yellow, then tap the boxes to put counters on. Tap a counter to take it off. Press I am done when you are finished! ';
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

export const askFor = (item: TenFrameItem): string => {
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
    case 'build_pair':
      // The total is public, as on `split`; the parts are the learner's to choose and are never named first.
      return (item.splitOrdinal ?? 1) > 1
        ? `Make ${answerWord} again with red and yellow counters. Your turn — make it a DIFFERENT way.`
        : `Make ${answerWord} with red and yellow counters. Your turn — use both colours.`;
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
    case 'build_pair':
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
    case 'build_pair': {
      // `placed` is the YELLOW count on a frame holding exactly the total; the rest are red. The signature miss is
      // one colour only: the right number on the frame, and no second group.
      const yellow = Math.max(1, Math.floor(item.answer / 2));
      return {
        ...base,
        correct: `${item.answer - yellow} red and ${yellow} yellow on the frame`,
        plainWrong: `${item.answer} red and no yellow on the frame`,
        placed: { correct: yellow, wrong: 0 },
        signatureWrong: { text: `${item.answer} red and no yellow on the frame`, why: 'one colour only, so there are not two groups' },
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
