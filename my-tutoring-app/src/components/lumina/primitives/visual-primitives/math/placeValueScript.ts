/**
 * placeValueScript — HAND-AUTHORED judged-loop script for place-value-chart
 * (qa/di/BACKLOG.md item 18, the EIGHTH math port after ten-frame,
 * addition-subtraction-scene, number-bond, compare-objects, shape-sorter,
 * ordinal-line and sorting-station). The exact wording IS the pedagogy — these
 * lines are authored per pack, never generated. Item content (which numbers,
 * which digit glows) is generator-scoped; this module owns the cue shapes, the
 * build gates and the in-band judging contracts.
 *
 * ── WHY THIS PRIMITIVE — THE CATALOG ALREADY KNEW ITS SKILL IS SPOKEN ───────
 *
 * The click era's Phase 2 asked, verbatim: *"How do you SAY this digit's value
 * out loud?"* — and served the question through four buttons. Its own
 * `commonStruggles` row defined the skill as speech: *"The SPOKEN VALUE
 * combines the digit with the place name. A 5 in the Tens place is said
 * 'fifty' (not just 'five' and not 'fifty hundred')."* A multiple-choice row
 * whose own prose says "say out loud" is the same costume as ordinal-line's
 * "Name ordinal position" tap, one primitive later.
 *
 * ── THE FIRST PORT PAST THE ≤20 BENCH — BUILD-AHEAD, GATED ON #63 ───────────
 *
 * Value words run past twenty ("forty", "three hundred", "ninety thousand"),
 * so this pack rides the `place_value_word` response class: user build-ahead
 * ruling 2026-08-19, acceptance riding the SAME #63 multi-word-numeral sitting
 * as `number_word_to_120`. The class is deliberately narrow — 1-2 tokens from
 * closed sets. The fully composed numeral ("forty-seven thousand three hundred
 * six") is NOT in it: the child NEVER says a whole number in this pack. Where
 * a whole number is the material, the TUTOR dictates it and the child answers
 * with their hands (build items). That split is what keeps the #63 exposure
 * small and named.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1) ─────────────────────────────────
 *
 * One click-era challenge (one number, three phases) is NOT one item:
 *
 *   find_place   → SPOKEN place name       short_spoken_word (benched)
 *   say_value    → SPOKEN value word       place_value_word  (build-ahead, #63)
 *   build_number → WRITTEN digits          manipulation      (benched)
 *
 * WHY build_number KEPT ITS HANDS — AND CHANGED ITS STIMULUS. The click era
 * PRINTED the target ("Now build 247") above the chart, so the build was a
 * copy task: a child who cannot do place value can copy digits left-to-right
 * into left-to-right columns. The costume was never the typing — writing
 * digits into labeled columns IS the page — it was the PRINTED TARGET. Ported,
 * the number never prints: the tutor SAYS it ("Write this number: four hundred
 * six") and the child translates speech into columns. Hearing "four hundred
 * six" and writing 4-0-6, not 46, is the production form of the mode's #1
 * misconception, and the click surface could not ask it at all.
 *
 * ── ⭐ ANALYZE AND DICTATE CHALLENGES ARE DISJOINT — THE PORT'S OWN LEAK GATE ─
 *
 * A number that was PRINTED on screen for two asks (find_place, say_value)
 * cannot then be "dictated" — the child just read it for two whole items, so
 * the build would be an echo-copy. And a number that was DICTATED names its
 * digits' values out loud ("two hundred forty-seven" contains "forty"), so a
 * later say_value ask about it is recall. `itemsFromChallenges` therefore
 * assigns each challenge ONE role, alternating: an ANALYZE challenge shows its
 * number and yields the two spoken asks; a DICTATE challenge never prints its
 * number and yields the build ask. No number serves both. The `build` eval
 * mode starts the rotation on dictate (construction is its identity); every
 * other mode starts on analyze.
 *
 * ── THE SIGNATURE ERRORS — ALL THREE WERE IN THE CATALOG'S OWN ROWS ─────────
 *
 *   1. find_place: the digit's VALUE (or the bare digit) said where its PLACE
 *      was asked — "forty" (or "four") for "tens". Row 2 verbatim: "Selecting
 *      the digit value when asked for the place."
 *   2. say_value: the BARE DIGIT said for the value — "four" for "forty" —
 *      and the same digit at the WRONG PLACE ("four hundred" for "forty"),
 *      which is exactly the click era's own distractor design. Row 1 verbatim.
 *   3. build_number: the zero-trap — "four hundred six" written with the six
 *      in the tens column (460) or the tens column left empty. Rows 4-5.
 *
 * Cardinal precedent carried: like ordinal-line's "three for third", the bare
 * digit for the value is WRONG and corrected, never leniently accepted — it is
 * the confusion the mode exists to undo, and the correction is where "four
 * counts ones; in the tens place it is worth forty" gets said.
 *
 * ── PLACE-NAME EAR ARITHMETIC ───────────────────────────────────────────────
 *
 * "thousands" is a spoken SUBSET of "ten thousands" (sorting-station's
 * negation-prefix lesson, wearing place vocabulary). Wherever place 4 is
 * askable the contract names the rule: the ten-thousands answer must carry the
 * "ten"; a bare "thousands" is the wrong column and is corrected — that IS the
 * misconception, not noise. The -ty/-teen ear ("forty"/"fourteen") is a mic-row
 * question, not a machine one; it is filed on the row, not judged leniently.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * `checkPackGates` in this pack's test file over every cue it can emit.
 */

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import {
  digitValueWord,
  digitWord,
  MAX_SPOKEN_PLACE,
  placeWord,
  spokenIntegerWord,
} from './spokenNumberWords';

// ============================================================================
// Domain vocabulary
// ============================================================================

export type PlaceValueKind = 'find_place' | 'say_value' | 'build_number';

export type PlaceValueMode = 'identify' | 'build' | 'compare' | 'expanded_form';

export type PlaceValueTier = 'easy' | 'medium' | 'hard';

/** The band this pack may ask in. 2-digit up to 5-digit whole numbers; the
 *  highest spoken place is ten-thousands (`place_value_word`'s ceiling). */
export const MIN_TARGET = 11;
export const MAX_TARGET = 99_999;

/** A session never exceeds this many judged asks. Whole challenges are
 *  SELECTED, never sliced mid-challenge (defect class 1: select, don't
 *  truncate). At the generator's cap of 6 challenges the rotation yields at
 *  most 9 items, so this is a backstop, not a working limit. */
export const MAX_SESSION_ITEMS = 12;

const int = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "a five" / "an eight" — these lines are SPOKEN, so the article is audible. */
const an = (word: string): string => (/^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`);

// ============================================================================
// Sayability + content gates — EXPORTED, and imported by the generator
// ============================================================================

/** Inside the band this pack may speak about: a whole number, 2-5 digits. */
export const isInBandTarget = (n: unknown): n is number =>
  int(n) && n >= MIN_TARGET && n <= MAX_TARGET;

/** How many digits the number has (its chart width). */
export const magnitudeOf = (n: number): number => String(Math.abs(Math.trunc(n))).length;

/** The chart's places for this number, HIGH → LOW (e.g. 247 → [2,1,0]). */
export const chartPlacesFor = (n: number): number[] => {
  const places: number[] = [];
  for (let p = magnitudeOf(n) - 1; p >= 0; p--) places.push(p);
  return places;
};

export const digitAtPlace = (n: number, place: number): number =>
  Math.floor(Math.abs(Math.trunc(n)) / Math.pow(10, place)) % 10;

/**
 * May this (number, place) pair carry a spoken ask? The place must be a real
 * column of THIS number, inside the spoken-place ceiling, and its digit must
 * be non-zero — a zero digit's worth is "zero", the excluded spoken answer
 * family-wide (generators must gate it out, and this drops it if one arrives).
 */
export const isAskablePlace = (n: number, place: unknown): place is number =>
  int(place)
  && place >= 0
  && place <= MAX_SPOKEN_PLACE
  && place <= magnitudeOf(n) - 1
  && digitAtPlace(n, place) !== 0;

// ============================================================================
// Answer material — the fork, as code
// ============================================================================

export const answerKindFor = (kind: PlaceValueKind): 'voice' | 'gesture' =>
  kind === 'build_number' ? 'gesture' : 'voice';

export const responseClassFor = (kind: PlaceValueKind): ResponseClassId => {
  switch (kind) {
    case 'find_place': return 'short_spoken_word';
    case 'say_value': return 'place_value_word';
    case 'build_number': return 'manipulation';
  }
};

export const actionFor = (kind: PlaceValueKind): string => {
  switch (kind) {
    case 'find_place': return 'name-place';
    case 'say_value': return 'say-value';
    case 'build_number': return 'write-number';
  }
};

export interface PlaceValueItem extends JudgedScriptItem {
  kind: PlaceValueKind;
  mode: PlaceValueMode;
  tier: PlaceValueTier;
  /** The challenge's number. On analyze items it is PRINTED with one digit
   *  glowing; on build items it is NEVER printed — the tutor dictates it. */
  targetNumber: number;
  /** The chart's places for this number, HIGH → LOW. */
  chartPlaces: number[];
  /** Analyze items: the glowing place and its digit. 0/0 on build items. */
  place: number;
  digit: number;
  /** THE ANSWER as the child says it. Empty on the gesture kind. */
  answerText: string;
  /** build_number: the number in words — the dictation the tutor speaks. */
  dictationWords: string;
  /** build_number: expected digit per chart place, HIGH → LOW. */
  expectedDigits: number[];
  /** say_value @ easy tier: a worked example on a (digit, place) this session
   *  never asks about, spoken ONCE in the how-to-play — never per item. Empty
   *  otherwise. Chosen in `itemsFromChallenges`, which sees the whole session. */
  modelClause: string;
  /** build_number: a code-picked foreign number (never a session number, has a
   *  zero column when the magnitude allows one) whose column walk the
   *  correction models — modeling the TARGET's own walk would turn the retry
   *  into a copy task. */
  modelNumber: number;
}

// ============================================================================
// Build gates — DROP an unaskable item, never repair it into one
// ============================================================================

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). The click
 *  era's MC rows are declared so the shape is honest about what the generator
 *  still sends, and READ BY NOTHING: no item carries them, so a cached
 *  challenge cannot put the buttons back. */
export interface PlaceValueChallengeLike {
  id: string;
  targetNumber?: number;
  highlightedDigitPlace?: number;
  placeNameChoices?: string[];
  digitValueChoices?: Array<{ value?: number; wordForm?: string }>;
}

export interface PlaceValueBuildContext {
  mode: PlaceValueMode;
  tier: PlaceValueTier;
}

/** Candidate worked examples for the easy-tier say_value model — each is a
 *  (digit, place) with its word. The first whose word the session never says
 *  wins; if the session somehow says all of them, the model is dropped rather
 *  than allowed to collide (DROP, never repair). */
const VALUE_MODEL_CANDIDATES: ReadonlyArray<{ digit: number; place: number }> = [
  { digit: 5, place: 1 },   // "fifty"
  { digit: 3, place: 2 },   // "three hundred"
  { digit: 8, place: 1 },   // "eighty"
  { digit: 6, place: 2 },   // "six hundred"
];

/** Candidate model numbers for the build correction, per magnitude — each has
 *  an interior/trailing zero so the correction teaches the zero-trap. */
const BUILD_MODEL_CANDIDATES: Record<number, readonly number[]> = {
  2: [40, 70, 90],
  3: [306, 502, 804],
  4: [4052, 7008, 2607],
  5: [30407, 60013, 50208],
};

const buildModelFor = (magnitude: number, sessionNumbers: ReadonlySet<number>): number => {
  const m = Math.min(3, magnitude);
  const candidates = BUILD_MODEL_CANDIDATES[m] ?? BUILD_MODEL_CANDIDATES[3];
  return candidates.find((n) => !sessionNumbers.has(n)) ?? candidates[0];
};

/**
 * The whole session's items.
 *
 * ONE CHALLENGE IS NOT ONE ITEM (defect class 1) — but neither is it always
 * three. Each kept challenge takes ONE role from an alternating rotation:
 *
 *   ANALYZE — the number prints with one digit glowing; yields find_place +
 *             say_value (two spoken asks about the glowing digit).
 *   DICTATE — the number never prints; yields build_number (the tutor says the
 *             number, the child writes it into the chart).
 *
 * The roles are disjoint BY CONSTRUCTION because each leaks into the other
 * (module docblock): a printed number cannot be dictated, and a dictated
 * number's value words are already said aloud.
 *
 * DEDUP IS SESSION-WIDE (defect class 2), on the thing that gets SAID:
 *   - `spokenValues` — every value word an ask answered OR a dictation spoke.
 *     A say_value ask whose word is already in it is recall, and is dropped.
 *   - `dictated` — a number may be dictated once.
 *   - place asks are NOT deduped: place names are a tiny closed set and every
 *     challenge is a NEW number, so a repeated place over a fresh digit is the
 *     sorting-station shape — repetition is the mode, not recall. The one
 *     suppression is the IDENTICAL TWIN: the same place AND the same digit
 *     back-to-back produce a byte-identical ask (the ask names the digit, not
 *     the number), which is the recitation shape the repeat-ask gate exists
 *     for — and the same (digit, place) pair is the same place-value FACT.
 */
export const itemsFromChallenges = (
  challenges: readonly PlaceValueChallengeLike[],
  ctx: PlaceValueBuildContext,
): { items: PlaceValueItem[]; droppedChallenges: number } => {
  const items: PlaceValueItem[] = [];
  const seenIds = new Set<string>();
  const spokenValues = new Set<string>();
  const dictated = new Set<number>();
  const sessionNumbers = new Set<number>();
  let lastPlaceAskKey = '';
  let dropped = 0;
  let keptChallenges = 0;

  for (const ch of challenges ?? []) {
    if (challengesWouldOverflow(items.length)) break;
    if (!ch?.id || seenIds.has(ch.id) || !isInBandTarget(ch.targetNumber)) { dropped++; continue; }
    const target = ch.targetNumber;
    const startOnDictate = ctx.mode === 'build';
    const role: 'analyze' | 'dictate' =
      (keptChallenges % 2 === 0) === startOnDictate ? 'dictate' : 'analyze';

    const base = {
      mode: ctx.mode,
      tier: ctx.tier,
      targetNumber: target,
      chartPlaces: chartPlacesFor(target),
      place: 0,
      digit: 0,
      answerText: '',
      dictationWords: '',
      expectedDigits: [] as number[],
      modelClause: '',
      modelNumber: 0,
    };

    if (role === 'dictate') {
      if (dictated.has(target)) { dropped++; continue; }
      dictated.add(target);
      sessionNumbers.add(target);
      // The dictation SPEAKS each digit's value inside the composed numeral, so
      // every one of them is spent for later say_value asks.
      for (const p of base.chartPlaces) {
        const d = digitAtPlace(target, p);
        if (d !== 0 && p <= MAX_SPOKEN_PLACE) spokenValues.add(digitValueWord(d, p));
      }
      seenIds.add(ch.id);
      items.push({
        ...base,
        id: `${ch.id}::build`,
        kind: 'build_number',
        answerKind: 'gesture',
        responseClass: 'manipulation',
        action: actionFor('build_number'),
        dictationWords: spokenIntegerWord(target),
        expectedDigits: base.chartPlaces.map((p) => digitAtPlace(target, p)),
        modelNumber: 0, // stamped in the session pass below, once all numbers are known
      });
      keptChallenges++;
      continue;
    }

    // ANALYZE
    if (!isAskablePlace(target, ch.highlightedDigitPlace)) { dropped++; continue; }
    const place = ch.highlightedDigitPlace;
    const digit = digitAtPlace(target, place);
    const valueWord = digitValueWord(digit, place);
    const placeAskKey = `${place}:${digit}`;
    const askPlace = placeAskKey !== lastPlaceAskKey;
    const askValue = !spokenValues.has(valueWord);
    if (!askPlace && !askValue) { dropped++; continue; }

    sessionNumbers.add(target);
    seenIds.add(ch.id);
    const analyzeBase = { ...base, place, digit };
    if (askPlace) {
      lastPlaceAskKey = placeAskKey;
      items.push({
        ...analyzeBase,
        id: `${ch.id}::place`,
        kind: 'find_place',
        answerKind: 'voice',
        responseClass: responseClassFor('find_place'),
        action: actionFor('find_place'),
        answerText: placeWord(place),
      });
    }
    if (askValue) {
      spokenValues.add(valueWord);
      items.push({
        ...analyzeBase,
        id: `${ch.id}::value`,
        kind: 'say_value',
        answerKind: 'voice',
        responseClass: responseClassFor('say_value'),
        action: actionFor('say_value'),
        answerText: valueWord,
      });
    }
    keptChallenges++;
  }

  // ── Session pass: the easy-tier model and the build-correction models are
  // chosen against the WHOLE session, which only this builder sees. ──────────
  const modelCandidate = VALUE_MODEL_CANDIDATES.find(
    (c) => !spokenValues.has(digitValueWord(c.digit, c.place)),
  );
  const modelClause =
    ctx.tier === 'easy' && modelCandidate
      ? `${cap(an(digitWord(modelCandidate.digit)))} in the ${placeWord(modelCandidate.place)} place is worth ${digitValueWord(modelCandidate.digit, modelCandidate.place)}. `
      : '';
  for (const item of items) {
    if (item.kind === 'say_value') item.modelClause = modelClause;
    if (item.kind === 'build_number') {
      item.modelNumber = buildModelFor(item.chartPlaces.length, sessionNumbers);
    }
  }

  return { items, droppedChallenges: dropped };
};

/** SELECT whole challenges: stop before a challenge whose worst case (2 items)
 *  would pass the backstop. */
const challengesWouldOverflow = (currentCount: number): boolean =>
  currentCount + 2 > MAX_SESSION_ITEMS;

// ============================================================================
// The spoken surface
// ============================================================================

/** ⚠️ No place name and no value word may appear here — on two of the three
 *  kinds the answer IS one of those, and a friendly "let us find the tens and
 *  hundreds!" would speak an answer inside the greeting. */
const GREETING = 'Hi! Time to work with big numbers! ';

/** "the ones place, the tens place, or the hundreds place" — the chart's own
 *  columns, low → high (the order a child walks them). */
const placeMenu = (item: PlaceValueItem): string => {
  const names = [...item.chartPlaces]
    .sort((a, b) => a - b)
    .filter((p) => p <= MAX_SPOKEN_PLACE)
    .map((p) => `the ${placeWord(p)} place`);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
};

/** The tier lever on find_place: easy and medium NAME the columns in the ask
 *  (the mats rule — an unknowable set is a broken task, and the child cannot
 *  be assumed to read the headers); hard names nothing and the child produces
 *  the place name unaided (letter-sound-link's tier-conditional exemption). */
export const namesChoices = (item: PlaceValueItem): boolean => item.tier !== 'hard';

/**
 * How-to-play — spoken on the OPENER and whenever the ACTION changes, never
 * per item (the analyze/dictate rotation changes the action every one or two
 * items, so these stay SHORT). The easy-tier worked example for say_value
 * lives here — established once, DISTAR fades the model rather than
 * re-reading it.
 */
export const howToPlayFor = (item: PlaceValueItem): string => {
  switch (item.kind) {
    case 'find_place':
      return 'Look at the glowing digit, then say the name of its place. ';
    case 'say_value':
      return `Say what the glowing digit is worth. ${item.modelClause}`;
    case 'build_number':
      return 'I say a number, and you write it — one digit in each column. '
        + 'When you stop, I look at your number. ';
  }
};

/**
 * The ask — code-owned at every tier, and it STATES ITS PROBLEM ALOUD. The
 * number itself is the one thing the ask never reads out on the analyze kinds:
 * reading "two hundred forty-seven" aloud would speak the value word a later
 * ask wants (the module-docblock leak), and the printed numeral is the page.
 * The build ask is the opposite by design — the dictation IS the stimulus.
 */
export const askFor = (item: PlaceValueItem): string => {
  switch (item.kind) {
    case 'find_place': {
      const menu = namesChoices(item) ? ` Is it ${placeMenu(item)}?` : '';
      return `Find the glowing ${digitWord(item.digit)}. Which place is it in?${menu}`;
    }
    case 'say_value':
      // ⚠️ The digit is deliberately NOT named here — reading it off the screen
      // is the child's half of the composition, and at the ones place the
      // digit word IS the answer, so naming it made the ask echoable (the
      // di-cap drill confirmed it as a HIGH: di-answer-leak-in-ask on a
      // ones-place item, 2026-08-18). The glow carries the reference.
      return `The glowing digit is in the ${placeWord(item.place)} place. `
        + `What is it worth?`;
    case 'build_number':
      return `Listen. The number is: ${item.dictationWords}. `
        + `Write it — one digit in each column.`;
  }
};

/**
 * The span of the ask inside which the answer may legitimately appear: ONLY
 * find_place's menu clause, and only at the tiers that speak one (the mats
 * exemption, tier-conditional). say_value's ask names the digit and the place
 * — the two INPUTS of the composition — and never the composed word; the
 * dictation is a gesture item's stimulus, not a spoken answer.
 */
export const leakExemptSpanFor = (item: PlaceValueItem): string | undefined =>
  item.kind === 'find_place' && namesChoices(item) ? ` Is it ${placeMenu(item)}?` : undefined;

// ── Verdict lines ───────────────────────────────────────────────────────────

const affirmFor = (item: PlaceValueItem): string => {
  switch (item.kind) {
    case 'find_place':
      return `Yes, the ${digitWord(item.digit)} is in the ${placeWord(item.place)} place.`;
    case 'say_value':
      return `Yes, ${item.answerText} — ${an(digitWord(item.digit))} in the ${placeWord(item.place)} place is worth ${item.answerText}.`;
    default:
      return '';
  }
};

/** "ones, tens, hundreds" — the walk from the ones place up to the target,
 *  spoken only in the CORRECTION (earned, never given: the click era printed
 *  the column names as a permanent answer key; the spoken walk is where the
 *  child learns to make one). */
const placeWalk = (upTo: number): string =>
  Array.from({ length: upTo + 1 }, (_, p) => placeWord(p)).join(', ');

/**
 * Standing gate 3: open "My turn:", re-model, then re-elicit. The re-ask
 * inherits the whole problem.
 *
 * ⭐ THE DIGIT/WORTH CONTRAST IS TAUGHT HERE AND ONLY HERE — "four counts
 * ones; in the tens place it is worth forty" is the ordinal-line
 * cardinal/ordinal correction wearing place vocabulary. The ones place gets
 * its own line, because there digit and worth genuinely coincide and the
 * generic contrast would read as nonsense.
 */
const correctionFor = (item: PlaceValueItem): string => {
  switch (item.kind) {
    case 'find_place': {
      const d = digitWord(item.digit);
      if (item.place === 0) {
        return `My turn: the digit at the very end is always in the ones place. `
          + `The ${d} sits at the end, so it is in the ones place. `
          + `Your turn. Which place is the glowing ${d} in?`;
      }
      return `My turn: I start at the end and walk left — ${placeWalk(item.place)}. `
        + `The ${d} sits in the ${placeWord(item.place)} place. `
        + `Your turn. Which place is the glowing ${d} in?`;
    }
    case 'say_value': {
      const d = digitWord(item.digit);
      if (item.place === 0) {
        return `My turn: a digit in the ones place is worth just itself — ${item.answerText}. `
          + `Your turn. What is the glowing ${d} worth?`;
      }
      return `My turn: I say the digit, then its place — ${d}, ${placeWord(item.place)}: ${item.answerText}. `
        + `${cap(d)} alone only counts ones; in the ${placeWord(item.place)} place it is worth ${item.answerText}. `
        + `Your turn. What is the glowing ${d} worth?`;
    }
    default:
      return '';
  }
};

/**
 * The refuse clause and the accept clause — both halves load-bearing. The
 * signature error per kind is the fluent, confident miss the click surface
 * absorbed silently, and all three were already recorded in the catalog's own
 * `commonStruggles` rows (module docblock).
 */
const discriminationFor = (item: PlaceValueItem): string => {
  if (item.kind === 'find_place') {
    const value = digitValueWord(item.digit, item.place);
    const d = digitWord(item.digit);
    const valueClause = item.place === 0
      ? `"${d}" — the digit read off the screen — is the confident wrong answer here: it says what `
        + `the digit IS, and this question asks WHERE it sits. `
      : `"${value}" — the digit's worth — is the confident wrong answer here: it answers what the `
        + `digit is WORTH, and this question asks WHERE it sits. "${d}" — the digit read off the `
        + `screen — is the same miss. Both are wrong however sure they sound; the correction walks `
        + `the places and re-asks. `;
    const tenThousands = item.place === 4
      ? `A bare "thousands" names the wrong column here — the right answer carries the "ten": `
        + `"ten thousands". Treat "thousands" alone as wrong and give the correction. `
      : item.place === 3 && item.chartPlaces.length > 4
        ? `"Ten thousands" is the column one further left — only plain "thousands" answers this. `
        : '';
    return valueClause
      + tenThousands
      + `A neighbouring column's name is the quieter miss — one place off in the walk. `
      + `Accept "${item.answerText}" on its own or inside the child's phrasing — `
      + `"the ${item.answerText}", "${item.answerText} place", "it is in the ${item.answerText}" `
      + `are all the same answer. `;
  }
  if (item.kind === 'say_value') {
    const d = digitWord(item.digit);
    if (item.place === 0) {
      const shifted = digitValueWord(item.digit, 1);
      return `"${shifted}" — the right digit moved to the wrong place — is the confident wrong `
        + `answer here. In the ones place a digit is worth just itself, so "${item.answerText}" `
        + `is the whole answer. `
        + `Accept "${item.answerText}" on its own or inside phrasing — "it is worth ${item.answerText}". `
        + `Reading the whole number off the screen does not answer this question — only the glowing `
        + `digit's worth does. `;
    }
    const shiftedPlace = item.place + 1 <= Math.min(MAX_SPOKEN_PLACE, item.chartPlaces.length - 1)
      ? item.place + 1
      : item.place - 1;
    const shifted = digitValueWord(item.digit, shiftedPlace);
    return `"${d}" on its own is the confident wrong answer here — the digit read off the screen `
      + `with no place. It is WRONG however close it sounds: it says how many ones, not what the `
      + `digit is worth here, and the correction is where the difference gets taught. `
      + `"${shifted}" is the other miss — the right digit in the wrong place. `
      + `Reading the whole number off the screen is not an answer to this question either. `
      + `Accept "${item.answerText}" on its own or inside phrasing — "it is worth ${item.answerText}" `
      + `counts. "${d} ${placeWord(item.place)}" — the unit way of saying it — is also right; `
      + `affirm it with the word "${item.answerText}". `;
  }
  return '';
};

/**
 * ⚠️ THE WAIT IS DESCRIBED AS THE TUTOR'S STATE, NEVER AS AN IMPERATIVE — an
 * imperative aimed at the tutor gets PERFORMED (ten-frame voiced "[WAIT
 * silently]" to a child). `findPerformedStageDirections` keeps this structural.
 */
const judgingContract = (item: PlaceValueItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner `
  + `looks and thinks, and their think time is unbounded. `
  + `Never say the answer during their turn, never read the number on the screen out loud, and `
  + `never name the columns beyond what the quoted line names. `
  + `EVERY answer gets exactly one of the two replies below and nothing else — the first wrong `
  + `answer as much as the second. `
  + `The correct answer is "${item.answerText}". `
  + discriminationFor(item)
  + `If the answer is right, say exactly: "${affirmFor(item)}" and stop there — add no praise, no `
  + `encouragement and no mention of what comes next, and never carry on into another question or `
  + `another digit, even one you can see on the screen. `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop there; that correction is the `
  + `whole turn, and it is the SAME line on every wrong answer, including a repeat of the same `
  + `wrong answer — never paraphrase it, never soften it, and never replace it with a hint of your own.`;

/** The gesture contract is a SILENCE contract: nothing to judge until the
 *  commit is described, and the number is banned from the tutor's mouth for
 *  the whole working turn — a dictation repeated while the child writes is a
 *  drip-feed of the answer's rhythm. Tap-to-hear is the sanctioned repeat. */
const silenceContract = (): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS, `
  + `writing one digit in each column, so you then stay completely silent. `
  + `Never repeat the number while they work, never say a digit or a column name, and never read `
  + `their chart back to them as they write. Do not narrate what they are doing or fill the pause. `
  + `You will be told what number they wrote and whether it matches; only then do you speak.`;

/** Named at the end of every contract-carrying cue — it names the exact
 *  failure a drive produced rather than trusting a generic "don't read tags". */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const contractFor = (item: PlaceValueItem): string =>
  item.answerKind === 'gesture' ? silenceContract() : judgingContract(item);

// ============================================================================
// Cues
// ============================================================================

export interface PlaceValueCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line, never as a second catalog directive on the same turn). */
export const itemCue = (item: PlaceValueItem, opts: PlaceValueCueOptions = {}): string => {
  const greeting = opts.opening ? GREETING : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[PVC_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${contractFor(item)} ${NEVER_PERFORM}`;
};

/** "a two in the hundreds place, a four in the tens place, a seven in the ones
 *  place" — the model walk the build correction speaks, computed in CODE. */
const columnWalk = (n: number): string =>
  chartPlacesFor(n)
    .map((p) => {
      const d = digitAtPlace(n, p);
      return d === 0
        ? `no ${placeWord(p)} — so a zero in the ${placeWord(p)} place`
        : `${an(digitWord(d))} in the ${placeWord(p)} place`;
    })
    .join('; ');

/**
 * The written-number verdict — THE MATCH IS COMPUTED IN CODE against the
 * dictated target; the tutor is never asked to read the chart. Not
 * correctness-gated anywhere upstream: an incomplete chart and a wrong one
 * both arrive here and are corrected, which is what makes the item judgeable.
 *
 * The correction models the METHOD ON A FOREIGN NUMBER (`modelNumber`, chosen
 * against the whole session) and then re-dictates the target — modeling the
 * target's own columns would turn the retry into a copy task.
 */
export const buildVerdictCue = (
  item: PlaceValueItem,
  written: ReadonlyArray<number | null>,
): string => {
  const complete = written.length === item.chartPlaces.length && written.every((d) => d !== null);
  const matches = complete && item.expectedDigits.every((d, i) => written[i] === d);
  const wroteDescription = written.some((d) => d !== null)
    ? item.chartPlaces
        .map((p, i) => `${placeWord(p)}: ${written[i] === null ? 'empty' : written[i]}`)
        .join(', ')
    : 'nothing yet';
  const head =
    `[PVC_WRITE] The learner wrote — ${wroteDescription}; `
    + `the dictated number is ${item.targetNumber} — that ${matches ? 'MATCHES' : 'does NOT match'}. `;

  if (matches) {
    return `${head}Say exactly: "Yes! ${cap(item.dictationWords)} — every digit in its own place." Never read bracket tags aloud.`;
  }
  const line = !complete
    ? `My turn: every column gets exactly one digit — and a column I hear nothing for gets a zero. `
      + `Your turn. Listen: ${item.dictationWords}. Fill every column.`
    : `My turn: when I hear ${spokenIntegerWord(item.modelNumber)}, I go column by column — `
      + `${columnWalk(item.modelNumber)}. `
      + `Your turn. Listen: ${item.dictationWords}. Write it again.`;
  return `${head}Say exactly: "${line}" Never read bracket tags aloud.`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward.
 *  It names NOTHING about the item just left — a closing line that named the
 *  place or the value would very often name a later item's answer too. */
export const moveOnCue = (
  item: PlaceValueItem,
  next: PlaceValueItem | null,
  opts: PlaceValueCueOptions = {},
): string => {
  if (!next) {
    return `[PVC_MOVE] Say exactly: "Good try! Big numbers take practice — we will look at that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[PVC_MOVE] Say exactly: "Good try! ${how}${askFor(next)}" ${contractFor(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[PVC_COMPLETE] Say exactly: "What great number work today! You know where every digit lives and what it is worth. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer, and never a hint. On
 *  a build item this re-dictates the whole number — which is exactly what
 *  replaces the printed target the click era showed. */
export const pronounceCue = (item: PlaceValueItem): string =>
  `[PVC_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY,
 * answer-free by construction. No branch names a digit, a place or a number:
 * every one describes the task's SHAPE, never its value.
 */
export const stimulusFor = (item: PlaceValueItem): string => {
  const n = item.chartPlaces.length;
  switch (item.kind) {
    case 'find_place':
      return `a ${n}-digit number with one digit glowing`;
    case 'say_value':
      return `a ${n}-digit number with one digit glowing, that digit's place now known`;
    case 'build_number':
      return `an empty place-value chart of ${n} labeled columns, waiting for a spoken number`;
  }
};

// ============================================================================
// The cue surface — one source for the component and the DI harness
// ============================================================================

/**
 * Everything place-value-chart ever sends the tutor. `PlaceValueChart.tsx`
 * spreads this and adds what only a mounted component can own (status lines,
 * and the `diagnosisObservation` that reads the live chart); the drive-plan
 * endpoint builds the identical cues for the headless judged-loop harness.
 */
export const placeValuePackBase = (
  items: PlaceValueItem[],
): JudgedCueSurface<PlaceValueItem> => ({
  primitiveType: 'place-value-chart',
  activityLine: 'live direct instruction place value practice',
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

// ============================================================================
// Harness answer material — what a right and a wrong child sound like
// ============================================================================

export interface PlaceValueHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** Gesture items commit a WRITTEN NUMBER, not a word — the harness's
   *  count-committed gesture channel (`placed`), carrying the whole number. */
  placed?: { correct: number; wrong: number };
  leakTokens: string[];
  leakExemptSpan?: string | string[];
}

/** A same-magnitude wrong build: the two highest differing adjacent digits
 *  swapped (247 → 427; 406 → 460 — the zero-trap shape); for an all-equal
 *  number, the tens digit nudged. Never the target, never a magnitude change. */
export const wrongBuildFor = (target: number): number => {
  const digits = String(target).split('').map(Number);
  for (let i = 0; i < digits.length - 1; i++) {
    if (digits[i] !== digits[i + 1] && (i > 0 || digits[i + 1] !== 0)) {
      const swapped = [...digits];
      [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
      const n = Number(swapped.join(''));
      if (n !== target && magnitudeOf(n) === digits.length) return n;
    }
  }
  const nudged = [...digits];
  nudged[digits.length - 1] = (nudged[digits.length - 1] + 1) % 10;
  const n = Number(nudged.join(''));
  return magnitudeOf(n) === digits.length && n !== target ? n : target + 1;
};

/**
 * The answers a headless student gives on a judged drive. Lives beside the
 * contract it mirrors: `discriminationFor` CLAIMS the judge refuses the
 * value-for-place, the bare digit, and the place-shifted value — this is those
 * claims made testable. Change one, change both.
 */
export const placeValueHarnessAnswers = (
  item: PlaceValueItem,
): PlaceValueHarnessAnswers => {
  switch (item.kind) {
    case 'find_place': {
      const otherPlace = item.chartPlaces.find(
        (p) => p !== item.place && p <= MAX_SPOKEN_PLACE,
      ) ?? 0;
      return {
        correct: item.answerText,
        plainWrong: placeWord(otherPlace),
        signatureWrong: {
          text: item.place === 0 ? digitWord(item.digit) : digitValueWord(item.digit, item.place),
          why: item.place === 0
            ? 'the digit read off the screen where its PLACE was asked — the catalog\'s recorded place/value confusion'
            : 'the digit\'s VALUE said where its PLACE was asked — the mode confusion the catalog\'s own struggle row records',
        },
        leakTokens: [item.answerText],
        leakExemptSpan: leakExemptSpanFor(item),
      };
    }
    case 'say_value': {
      const shiftedPlace = item.place + 1 <= Math.min(MAX_SPOKEN_PLACE, item.chartPlaces.length - 1)
        ? item.place + 1
        : Math.max(0, item.place - 1);
      return {
        correct: item.answerText,
        plainWrong: digitValueWord(item.digit === 9 ? 2 : item.digit + 1, item.place),
        signatureWrong: item.place === 0
          ? {
              text: digitValueWord(item.digit, 1),
              why: 'the right digit moved to the wrong place — in the ones place digit and worth coincide, so the shift is the only confident miss left',
            }
          : {
              text: digitWord(item.digit),
              why: 'the bare digit said for its worth — how many ones, not what it is worth here; the confusion this mode exists to undo, refused on purpose',
            },
        leakTokens: [item.answerText],
      };
    }
    default:
      return {
        correct: '',
        plainWrong: '',
        placed: { correct: item.targetNumber, wrong: wrongBuildFor(item.targetNumber) },
        // The dictation IS the ask on a build item — the whole point — so the
        // words are exempt inside it and a leak anywhere else is still a HIGH.
        leakTokens: [item.dictationWords],
        leakExemptSpan: item.dictationWords,
      };
  }
};
