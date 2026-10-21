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


import type { JudgedCueSurface } from '../../../hooks/judgedScriptContract';
import { digitValueWord, digitWord, MAX_SPOKEN_PLACE, placeWord, spokenIntegerWord } from './spokenNumberWords';
import { resolveScaffolds, type LiveScaffold } from '../../../components/live-activity/runtime/liveScaffolds';
import { askFor, chartPlacesFor, digitAtPlace, type PlaceValueItem, type PlaceValueKind } from './placeValueDomain';

/** The items, the gates, the ask and the harness answers live in `placeValueDomain.ts` (the boss reads them there). */
export * from './placeValueDomain';

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "a five" / "an eight" — these lines are SPOKEN, so the article is audible. */
const an = (word: string): string => (/^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`);

// ============================================================================
// The spoken surface (retired: the place-value-chart boss never sends these cues)
// ============================================================================

/** ⚠️ No place name and no value word may appear here — on two of the three
 *  kinds the answer IS one of those, and a friendly "let us find the tens and
 *  hundreds!" would speak an answer inside the greeting. */
const GREETING = 'Hi! Time to work with big numbers! ';

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
 * and the `observation` that reads the live chart); the drive-plan
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

/* ------------------------------------------------------------------ *
 * Live-tutor misstep inventory (see `/add-live-tutor-tools`).
 *
 * Kept beside the correction lines above, because the two answer different
 * things. The correction walks the columns and STATES the answer, and it fires
 * however the child was wrong. These aids name the misstep and never state the
 * answer — which here means never a PLACE WORD (the answer on `find_place`),
 * never the digit's VALUE (the answer on `say_value`) and never the target
 * number (which `build_number` is dictated and must write).
 *
 * Missteps deliberately left to another lane:
 *   - "cannot read the digit" — a reading task, not a place-value one.
 *   - "put the right digits in the wrong columns" — telling that apart from a
 *     partly-built chart needs per-column expectations published against
 *     per-column entries; the adapter publishes how many columns are filled,
 *     not which digit sits where. Publish that evidence before declaring it.
 *   - "needs the column headers labelled" — that is the support tier.
 * ------------------------------------------------------------------ */

/** What the child has actually done on this item, as the adapter publishes it. */
export interface PlaceValueMisstepEvidence {
  /** The raw transcript, lower-cased. Null when nothing has been heard. */
  said: string | null;
  /** The number the transcript names, or null. */
  saidNumber: number | null;
  /** The place index the transcript names (0 = ones), or -1. */
  saidPlace: number;
  /** build_number: how many chart columns currently hold a digit. */
  columnsFilled: number;
  /** build_number: how many columns this number needs. */
  columnsNeeded: number;
}

export type PlaceValueScaffold = LiveScaffold<PlaceValueItem, PlaceValueMisstepEvidence>;

/** Which place the child named, or -1. Routing only, never judging. */
export const saidPlaceOf = (text: string | null | undefined): number => {
  if (!text) return -1;
  const lower = text.toLowerCase();
  for (let place = 0; place <= 4; place++) {
    if (new RegExp(`\\b${placeWord(place)}\\b`).test(lower)) return place;
  }
  return -1;
};

/**
 * One method reminder per kind, and not one of them contains a place word, a
 * digit or a value — each is the answer on one of these three asks.
 */
const METHOD: Record<PlaceValueKind, PlaceValueScaffold> = {
  find_place: { strategyId: 'count-the-columns-from-the-right', when: 'the child needs the method again',
    hint: () => 'Start at the right-hand end of the chart and name the columns as you move left.' },
  say_value: { strategyId: 'the-column-tells-you-what-it-is-worth', when: 'the child needs the method again',
    hint: () => 'Read the glowing digit, then think about what the column it sits in is worth.' },
  build_number: { strategyId: 'a-digit-in-each-column', when: 'the child needs the method again',
    hint: () => 'Put a digit in each column, working across from the left.' },
};

/**
 * The error-specific aids, offered only once the published evidence fits. Each
 * `when` states the CONDITION, because the model routes on that sentence.
 */
const AIDS: readonly PlaceValueScaffold[] = [
  { strategyId: 'you-named-the-column-next-door', when: 'the child named the column beside the glowing one',
    hint: () => 'You named the column next door. Count the columns again from the right-hand end.',
    matches: (i, e) => i.kind === 'find_place' && e.saidPlace >= 0
      && Math.abs(e.saidPlace - i.place) === 1 },

  { strategyId: 'name-the-column-not-the-number', when: 'the child answered a column question with a number',
    hint: () => 'That is a number. I am asking for the name of the column it is sitting in.',
    matches: (i, e) => i.kind === 'find_place' && e.saidPlace === -1 && e.saidNumber !== null },

  { strategyId: 'the-digit-is-not-the-whole-worth', when: 'the child said the digit itself instead of what it is worth',
    // Only where those two actually differ: in the ones column the digit IS
    // what it is worth, and this line would be false there.
    hint: () => 'That is the digit you can see. In that column it stands for more than that.',
    matches: (i, e) => i.kind === 'say_value' && i.place > 0 && e.saidNumber === i.digit },

  { strategyId: 'just-the-glowing-column', when: 'the child said the whole number instead of one column',
    hint: () => 'That is the whole number. I am asking about the glowing column on its own.',
    matches: (i, e) => i.kind === 'say_value' && e.saidNumber === i.targetNumber
      && i.targetNumber !== i.digit },

  { strategyId: 'every-column-needs-a-digit', when: 'the child left a column empty',
    hint: () => 'There is still an empty column. Every column needs a digit in it.',
    matches: (i, e) => i.kind === 'build_number'
      && e.columnsFilled > 0 && e.columnsFilled < e.columnsNeeded },
];

/** The kind's method reminder plus every aid whose evidence currently fits. */
export function placeValueScaffoldsFor(item: PlaceValueItem | null | undefined,
  evidence: PlaceValueMisstepEvidence): PlaceValueScaffold[] {
  return resolveScaffolds(item, evidence, item ? METHOD[item.kind] : undefined, AIDS);
}
