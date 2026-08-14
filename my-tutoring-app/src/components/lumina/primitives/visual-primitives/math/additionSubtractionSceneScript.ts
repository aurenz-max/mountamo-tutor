/**
 * additionSubtractionSceneScript — HAND-AUTHORED judged-loop script for
 * addition-subtraction-scene (qa/di/BACKLOG.md item 18 P2, the second MATH port
 * and the taxonomy's purest Class-A case: "the answer is a NUMBER the child
 * reports"). The exact wording IS the pedagogy — these lines are authored per
 * pack, never generated. Item CONTENT (the story, the counts) is
 * generator-scoped; this module owns the cue shapes, the build gates and the
 * in-band judging contracts.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1) ─────────────────────────────────
 *
 *   solve-story    (K + 1)  → SPOKEN number       number_word_to_20  (benched)
 *   act-out    @ Grade 1    → SPOKEN number       number_word_to_20  (benched)
 *   act-out    @ K          → ENACTED scene       manipulation       (contract R3)
 *   build-equation (K + 1)  → BUILT number sentence  manipulation
 *   create-story   (K + 1)  → BUILT scene         manipulation
 *
 * The user's own framing for this port was *"may benefit from speaking aloud
 * instead of typing"*, and the typed numeral is exactly what dies: at Grade 1
 * `act-out` and `solve-story` both ended in a keyboard, and at K `solve-story`
 * ended in a row of numeral tiles. All three are the mouth's job.
 *
 * WHY THE NUMERAL TILES WENT TOO, AND WHY THAT IS NOT A DEMOTION OF R3. R3
 * (reader-fit item 1b) banned TYPING at K and gave `solve_story` a tappable
 * 0…max row as the non-keyboard answer surface. A spoken answer is not typing
 * either, and it is strictly better on the same axis: the tile row is a MENU,
 * so it converts production into recognition and floors a guess at 1-in-6 — the
 * letter-spotter ruling ("they dont need to click a button") struck exactly
 * this shape. The requirement is RE-BASED onto what it protected (no keyboard
 * at K), never reversed.
 *
 * WHY THREE MODES KEPT THEIR HANDS. Costume test — can a child who cannot do
 * the skill still perform this action correctly?
 *   - `act-out` @ K: no. Contract R3 (item 11) rebuilt this mode as direct
 *     manipulation *because* an earlier version asked for a proxy number, and
 *     the enacted scene count IS the answer. Adding "now say how many" would
 *     reintroduce the proxy one layer up. Same ruling shape as ten-frame's R6.
 *   - `create-story`: no. Building the scene for a given number sentence is
 *     production; saying it back is a different task (and free production of a
 *     whole story is `open_set_word`, BLOCKED).
 *   - `build-equation`: no. ⚠️ This is the pack's one genuinely arguable fork
 *     and it was NOT decided on judge difficulty (that would be the
 *     letter-spotter mistake). "Three plus two equals five" is sayable — but
 *     this mode's identity is *represent the scene in SYMBOLS* (catalog: K-1
 *     bridging from manipulatives to symbolic math), so the answer is the FORM,
 *     the third unsayable shape: saying the sentence aloud would not show the
 *     child can write it. The tray is the page a teacher would push across the
 *     table. R6 also makes the tile pool (`allowedTiles`) a shipped AXIS-1
 *     support lever, so deleting the tray would ablate a difficulty axis for
 *     skills that already depend on it. Flag for the drive, do not re-derive.
 *
 * ── THE §2 SCRIPT QUESTIONS, ANSWERED HERE ──────────────────────────────────
 *
 * 1. IS THE MODEL THE ANSWER? For every spoken mode, yes — a model would say
 *    the number. So nothing is modeled before the ask; the number is earned in
 *    the CORRECTION, where DISTAR pays for it with a counted walk.
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? Not by itself — which is why THE
 *    ASK IS CODE-OWNED AT EVERY BAND. Generated `storyText` sometimes ends with
 *    its own question and sometimes does not, and when it does that question
 *    may not be the one this item's `unknownPosition` is about (a story asking
 *    "how many now?" under a start-unknown item would be a straight-up wrong
 *    ask). `situationOf` therefore strips every interrogative sentence and the
 *    pack asks its own question. Same discipline as contract R3's changelog
 *    item 12(d), where the printed instruction became code-owned after naming
 *    an action the band did not implement.
 *
 * 3. THE ASK STATES ITS PROBLEM ALOUD. Contract R1 already made reading the
 *    story word-for-word a durable requirement — a K-1 child cannot read the
 *    screen. Under the judged loop that stops being a catalog directive the
 *    tutor might drop and becomes the ask itself: the situation is INSIDE the
 *    quoted line, so every correction re-ask inherits it.
 *
 * 4. THE SIGNATURE ERROR, PER MODE — the wrong answer that is fluent,
 *    confident, and most likely to be wrongly affirmed:
 *      solve-story / act-out — SAYING A NUMBER FROM THE STORY BACK. The story
 *        publicly states two of the three values, so the confident miss is
 *        echoing an operand ("five ducks were in the pond" → "five"). The
 *        accept clause matters as much: counting aloud that LANDS on the answer
 *        is correct — the last number said tells the total.
 *      build-equation — a valid sum built from the WRONG numbers, or the right
 *        numbers with the wrong operator. Both are code-decidable, so the
 *        verdict cue names which one happened rather than issuing one generic
 *        correction.
 *
 * ── CONTENT GATES (skill step 4) — KEEP OR DROP, NEVER BACKFILL ─────────────
 *
 * ZERO IS UNBENCHED as a spoken answer ("zero"/"none", di-shapes rung 2
 * residual), and a subtraction can land on nothing. Every SPOKEN answer is
 * floored at 1; gesture answers are exempt, because the child's hands can
 * legitimately produce an empty scene — the ceiling belongs to the tutor's ear,
 * not to the arithmetic. (Ten-frame's K make-ten exemption, same reasoning.)
 *
 * THE ≤20 CEILING. `number_word_to_20` is benched; `number_word_to_120` is
 * build-ahead with #63 acceptance owed. This primitive tops out at
 * `maxNumber` = 5 (K) / 10 (Grade 1), so it fits ENTIRELY inside the benched
 * range with no band gate — the empirical half of why it is the right P2. The
 * gate is asserted anyway so a future capacity change cannot launder an
 * unbenched class into production.
 *
 * THE STORY IS GENERATED PROSE AND THE TUTOR NOW SPEAKS IT, so two gates run
 * over it that no click-era version needed:
 *   - `opensWithSentinel` — a story whose sentence opens with "Yes" would be
 *     read by the engine's verdict scan as a judgment (read-aloud-studio's
 *     finding; the same trap that turned a `y` keyword into "yo-yo").
 *   - `storyLeaksAnswer` — a story that states the value the child must produce
 *     hands the answer over in the tutor's own voice. Publicly stated operands
 *     are NOT leaks ("five ducks were in the pond, two flew away" may say five
 *     and two); the value under `unknownPosition` is. Writing the spoken ask is
 *     what surfaced this: under a Check button the story could say anything.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * `checkPackGates` in this pack's test file over every cue it can emit.
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import { countWalk, numberWordFor } from './countingBoardScript';

export type AddSubItemKind = 'act-out' | 'build-equation' | 'solve-story' | 'create-story';
export type AddSubBand = 'K' | '1';
export type AddSubOperation = 'addition' | 'subtraction';
export type AddSubUnknown = 'result' | 'change' | 'start';

/** The benched spoken-number window. Zero is excluded by the class record
 *  itself; 20 is the ceiling `number_word_to_20` was benched at. */
export const SPOKEN_ANSWER_MIN = 1;
export const SPOKEN_ANSWER_MAX = 20;

export interface AddSubSceneItem extends JudgedScriptItem {
  kind: AddSubItemKind;
  band: AddSubBand;
  operation: AddSubOperation;
  /** Plural noun as generated ("ducks"). Never inflected in a cue — see the
   *  directive builders, which are deliberately noun-free so a count of one
   *  cannot produce "bring one more ducks". */
  objectType: string;
  scene: string;
  startCount: number;
  changeCount: number;
  resultCount: number;
  unknownPosition: AddSubUnknown;
  /** The story with its own question(s) stripped — the situation only. Empty
   *  for `create-story`, whose prompt is the equation. */
  situation: string;
  equation: string;
  /** What the child must PRODUCE: said aloud on voice items, enacted on gesture
   *  items (act-out/create-story = objects on the scene; build-equation = the
   *  result slot of the sentence they assemble). */
  answer: number;
  /** Number tiles the tray may offer (R6 AXIS-1 lever). Undefined = full tray. */
  allowedTiles?: string[];
}

// ── Small speakable helpers ─────────────────────────────────────────────────

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const int = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** A spoken answer must be inside the benched window. This is the gate that
 *  keeps zero and >20 out of the tutor's ear. */
export const isSayableAnswer = (n: unknown): n is number =>
  int(n) && n >= SPOKEN_ANSWER_MIN && n <= SPOKEN_ANSWER_MAX;

/** Model the counted walk only where it is sayable; above ten a chant is ear
 *  noise, so the correction names the answer instead (countingBoardScript's
 *  rule, held). */
const WALK_CEILING = 10;

/** "three plus two equals five" — the equation, spoken. The numerals stay off
 *  the tutor's tongue everywhere in this pack. */
const equationSpoken = (item: Pick<AddSubSceneItem, 'operation' | 'startCount' | 'changeCount' | 'resultCount'>): string =>
  `${numberWordFor(item.startCount)} ${item.operation === 'addition' ? 'plus' : 'take away'} `
  + `${numberWordFor(item.changeCount)} equals ${numberWordFor(item.resultCount)}`;

// ── Answer material — the fork, as code ─────────────────────────────────────

export const answerKindFor = (
  kind: AddSubItemKind,
  band: AddSubBand,
): 'voice' | 'gesture' =>
  kind === 'solve-story' || (kind === 'act-out' && band !== 'K') ? 'voice' : 'gesture';

export const responseClassFor = (
  kind: AddSubItemKind,
  band: AddSubBand,
): ResponseClassId =>
  answerKindFor(kind, band) === 'gesture' ? 'manipulation' : 'number_word_to_20';

/** Task identity for the runner's how-to-play policy: when consecutive items
 *  change `action`, the next cue re-speaks what to do. A mixed session can
 *  interleave enacting, counting, solving, writing and making, so "what to do"
 *  is not a static protocol a non-reader can look up (cvc-speller rule). */
export const actionFor = (kind: AddSubItemKind, band: AddSubBand): string => {
  switch (kind) {
    case 'act-out': return band === 'K' ? 'enact' : 'count';
    case 'solve-story': return 'solve';
    case 'build-equation': return 'write';
    case 'create-story': return 'make';
  }
};

/** Which value this item asks the child to produce. */
export const targetValueFor = (
  ch: Pick<AddSubSceneItem, 'kind' | 'unknownPosition' | 'startCount' | 'changeCount' | 'resultCount'>,
): number => {
  if (ch.kind !== 'solve-story') return ch.resultCount;
  if (ch.unknownPosition === 'change') return ch.changeCount;
  if (ch.unknownPosition === 'start') return ch.startCount;
  return ch.resultCount;
};

/** The values the STORY is allowed to state out loud. Everything the child is
 *  meant to discover is excluded — that is the whole point of the leak gate. */
export const publicValuesFor = (
  ch: Pick<AddSubSceneItem, 'kind' | 'unknownPosition' | 'startCount' | 'changeCount' | 'resultCount'>,
): number[] => {
  if (ch.kind !== 'solve-story') return [ch.startCount, ch.changeCount];
  switch (ch.unknownPosition) {
    case 'change': return [ch.startCount, ch.resultCount];
    case 'start': return [ch.changeCount, ch.resultCount];
    default: return [ch.startCount, ch.changeCount];
  }
};

// ── Content gates over generated prose (shared with the generator) ──────────

/**
 * The situation half of a story: every interrogative sentence removed, because
 * the pack asks its own question and two questions in one breath is two asks.
 * Returns '' when nothing survives — an unaskable item, which the build gate
 * drops rather than repairs.
 */
export const situationOf = (story: string): string =>
  (story ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !sentence.endsWith('?'))
    .join(' ')
    .trim();

/**
 * Does this story state a value the child is supposed to produce? Checked as
 * the numeral AND the number word, since a generator writes both ("3 ducks" /
 * "three ducks"). A value that is also a publicly stated operand is not a leak
 * — 4 − 2 = 2 legitimately prints "2" as the change — so only values that
 * appear NOWHERE in the public set can convict.
 */
export const storyLeaksAnswer = (
  story: string,
  answer: number,
  publicValues: number[],
): boolean => {
  if (!int(answer)) return false;
  if (publicValues.includes(answer)) return false;
  const haystack = ` ${(story ?? '').toLowerCase()} `;
  const numeral = new RegExp(`(?<![0-9])${answer}(?![0-9])`);
  const word = new RegExp(`\\b${numberWordFor(answer)}\\b`);
  return numeral.test(haystack) || word.test(haystack);
};

// ── Build gates — DROP an unaskable item, never repair it into one ───────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface AddSubChallengeLike {
  id: string;
  type: AddSubItemKind;
  storyText?: string;
  scene?: string;
  objectType?: string;
  operation?: AddSubOperation;
  startCount?: number;
  changeCount?: number;
  resultCount?: number;
  equation?: string;
  unknownPosition?: AddSubUnknown;
  allowedTiles?: string[];
}

/**
 * One generated challenge → one judged item, or NULL when the item cannot be
 * asked honestly:
 *   - counts that do not model the operation (a stale cache, a hand-edited fixture)
 *   - a story where nothing happens (`changeCount` 0)
 *   - a SPOKEN answer of 0, or above the benched ceiling
 *   - a story that opens a sentence with a verdict sentinel
 *   - a story that states the value the child must produce
 *   - a story with no situation left once its own questions are stripped
 * Nothing is backfilled: a placeholder item in a judged loop becomes a spoken
 * ask the tutor must judge.
 */
export const itemFromChallenge = (
  ch: AddSubChallengeLike,
  ctx: { band: AddSubBand },
): AddSubSceneItem | null => {
  const { band } = ctx;
  const kind = ch.type;
  if (kind !== 'act-out' && kind !== 'build-equation' && kind !== 'solve-story' && kind !== 'create-story') {
    return null;
  }

  const operation: AddSubOperation = ch.operation === 'subtraction' ? 'subtraction' : 'addition';
  const startCount = ch.startCount;
  const changeCount = ch.changeCount;
  const resultCount = ch.resultCount;
  if (!int(startCount) || !int(changeCount) || !int(resultCount)) return null;
  if (startCount < 0 || changeCount < 1 || resultCount < 0) return null;

  // R5 is the generator's job; this re-checks it because a judged ask states
  // the arithmetic aloud, and an inconsistent triple would be spoken as fact.
  const consistent = operation === 'addition'
    ? startCount + changeCount === resultCount
    : startCount - changeCount === resultCount;
  if (!consistent) return null;

  const unknownPosition: AddSubUnknown =
    ch.unknownPosition === 'change' || ch.unknownPosition === 'start' ? ch.unknownPosition : 'result';
  const answerKind = answerKindFor(kind, band);
  const answer = targetValueFor({ kind, unknownPosition, startCount, changeCount, resultCount });

  // The zero/ceiling gate binds the tutor's EAR, so it applies to spoken
  // answers only — a gesture answer of zero is a scene the child can build.
  if (answerKind === 'voice' && !isSayableAnswer(answer)) return null;

  const situation = situationOf(ch.storyText ?? '');
  if (kind === 'create-story') {
    // The equation IS the prompt here: everything is public and there is no
    // story to gate, but the counts must describe a buildable scene.
    if (operation === 'subtraction' && startCount < 1) return null;
  } else {
    if (situation.length === 0) return null;
    if (opensWithSentinel(situation)) return null;
    if (storyLeaksAnswer(situation, answer, publicValuesFor({ kind, unknownPosition, startCount, changeCount, resultCount }))) {
      return null;
    }
  }

  const objectType = (ch.objectType ?? '').trim() || 'objects';
  const allowed = (ch.allowedTiles ?? []).filter((t) => /^\d+$/.test(t));

  return {
    id: ch.id,
    kind,
    band,
    answerKind,
    responseClass: responseClassFor(kind, band),
    action: actionFor(kind, band),
    operation,
    objectType,
    scene: (ch.scene ?? '').trim() || 'scene',
    startCount,
    changeCount,
    resultCount,
    unknownPosition,
    situation,
    equation: ch.equation ?? `${startCount} ${operation === 'addition' ? '+' : '-'} ${changeCount} = ${resultCount}`,
    answer,
    ...(allowed.length > 0 ? { allowedTiles: allowed } : {}),
  };
};

// ── The equation verdict — code-computed, never counted by the tutor ────────

export type EquationFault = 'match' | 'incomplete' | 'arithmetic' | 'operator' | 'numbers';

/** A finished number sentence: N op N = N. Used both as the STRUCTURAL close
 *  (the tray has reached a terminal shape) and as the verdict input — note it
 *  is not correctness-gated in either role: "3 + 2 = 9" parses fine and is
 *  wrong. */
export const parseEquationTiles = (
  tiles: readonly string[],
): { left: number; op: '+' | '-'; right: number; result: number } | null => {
  const match = tiles.join('').replace(/\s+/g, '').match(/^(\d+)([+-])(\d+)=(\d+)$/);
  if (!match) return null;
  return {
    left: parseInt(match[1], 10),
    op: match[2] as '+' | '-',
    right: parseInt(match[3], 10),
    result: parseInt(match[4], 10),
  };
};

/**
 * Which of the three things went wrong — the same three checks the click-era
 * Check button ran, kept because they name genuinely different misconceptions
 * (arithmetic slip vs. reading the story's direction backwards vs. inventing
 * numbers). The tutor is handed the verdict, never asked to derive it.
 */
export const equationFaultOf = (
  item: Pick<AddSubSceneItem, 'operation' | 'startCount' | 'changeCount' | 'resultCount'>,
  tiles: readonly string[],
): EquationFault => {
  const parsed = parseEquationTiles(tiles);
  if (!parsed) return 'incomplete';
  const { left, op, right, result } = parsed;
  if ((op === '+' ? left + right : left - right) !== result) return 'arithmetic';
  if ((item.operation === 'addition') !== (op === '+')) return 'operator';
  const said = [left, right, result].sort((a, b) => a - b);
  const want = [item.startCount, item.changeCount, item.resultCount].sort((a, b) => a - b);
  if (said[0] !== want[0] || said[1] !== want[1] || said[2] !== want[2]) return 'numbers';
  return 'match';
};

// ── How-to-play — spoken on the opener AND whenever the ACTION changes ──────

export const howToPlayFor = (item: AddSubSceneItem): string => {
  switch (actionFor(item.kind, item.band)) {
    case 'enact':
      return 'Tap the big button to bring more in, and tap one in the picture to send it away. ';
    case 'count':
      return item.operation === 'subtraction'
        ? 'Tap the ones that go away, then say how many are left out loud. '
        : 'Look at the picture and count, then say the number out loud. ';
    case 'solve':
      return 'Listen to the story, then say your answer out loud. ';
    case 'write':
      return 'Tap the tiles to build the number sentence. ';
    default:
      return 'Tap the big button to put more in, and tap one in the picture to send it away. ';
  }
};

// ── The asks — the story SPOKEN, then one code-owned question ───────────────

/** Noun-free on purpose: the story has already named the objects, and
 *  "bring one more ducks" is the pluralisation bug this avoids entirely. */
const enactDirective = (item: AddSubSceneItem): string =>
  item.operation === 'addition'
    ? `bring ${numberWordFor(item.changeCount)} more in`
    : `send ${numberWordFor(item.changeCount)} away`;

const questionFor = (item: AddSubSceneItem): string => {
  if (item.kind === 'solve-story') {
    if (item.unknownPosition === 'change') {
      return `How many ${item.objectType} ${item.operation === 'addition' ? 'came' : 'went away'}?`;
    }
    if (item.unknownPosition === 'start') {
      return `How many ${item.objectType} were there at the start?`;
    }
  }
  return item.operation === 'addition'
    ? `How many ${item.objectType} are there now?`
    : `How many ${item.objectType} are left?`;
};

const askFor = (item: AddSubSceneItem): string => {
  switch (item.kind) {
    case 'act-out':
      // @K the enactment IS the answer; @1 the child enacts a departure (a
      // static picture cannot show one — contract R3 item 12) and then counts
      // the survivors aloud.
      if (item.answerKind === 'gesture') {
        return `${item.situation} Your turn — ${enactDirective(item)}.`;
      }
      return item.operation === 'subtraction'
        ? `${item.situation} Your turn — ${enactDirective(item)}, then tell me: ${questionFor(item)}`
        : `${item.situation} Your turn. ${questionFor(item)}`;
    case 'solve-story':
      return `${item.situation} Your turn. ${questionFor(item)}`;
    case 'build-equation':
      return `${item.situation} Your turn — build the number sentence for that story.`;
    case 'create-story':
      return `Here is a number sentence: ${equationSpoken(item)}. `
        + `Your turn — make that story with the ${item.objectType} in the ${item.scene}.`;
  }
};

// NOTE ON THE REPEAT-ASK GATE. No short-form repeat ask is needed here and that
// is a property of the CONTENT, not an exemption: every ask embeds this item's
// own situation, so consecutive same-action asks can never come out
// byte-identical the way letter-spotter's match-it did. What DOES fade is the
// how-to-play — `itemCue` speaks it only on the opening cue and when the action
// changes, which is DISTAR fading the model rather than re-reading it.

// ── The corrections — DISTAR re-model then re-elicit (standing gate 3) ──────
// This is the FIRST place the answer is ever spoken, and it is earned.

const correctionFor = (item: AddSubSceneItem): string => {
  const answerWord = numberWordFor(item.answer);
  const startWord = numberWordFor(item.startCount);
  const changeWord = numberWordFor(item.changeCount);

  switch (item.kind) {
    case 'act-out':
      if (item.answerKind === 'gesture') {
        // The model is the story→action mapping, which is the skill here; the
        // total stays off the tutor's tongue because the hands produce it.
        return item.operation === 'addition'
          ? `My turn: the story says ${changeWord} more come, so ${changeWord} more go in. Your turn — ${enactDirective(item)}.`
          : `My turn: the story says ${changeWord} go away, so ${changeWord} come out of the picture. Your turn — ${enactDirective(item)}.`;
      }
      return item.answer <= WALK_CEILING
        ? `My turn: watch me count them. ${countWalk(item.answer)}. That is ${answerWord}. Your turn. ${questionFor(item)}`
        : `My turn: it is ${answerWord}. Your turn. ${questionFor(item)}`;
    case 'solve-story':
      if (item.unknownPosition === 'result') {
        return item.answer <= WALK_CEILING
          ? `My turn: ${startWord} ${item.operation === 'addition' ? 'and' : 'take away'} ${changeWord}. Watch me count. ${countWalk(item.answer)}. ${cap(answerWord)}. Your turn. ${questionFor(item)}`
          : `My turn: ${startWord} ${item.operation === 'addition' ? 'and' : 'take away'} ${changeWord} makes ${answerWord}. Your turn. ${questionFor(item)}`;
      }
      // Change/start unknowns are solved by working BACK from the total, so the
      // model has to say that out loud — counting up from nothing would model
      // the wrong strategy.
      return item.unknownPosition === 'change'
        ? `My turn: it went from ${startWord} to ${numberWordFor(item.resultCount)}, so ${answerWord} ${item.operation === 'addition' ? 'came' : 'went away'}. Your turn. ${questionFor(item)}`
        : `My turn: work backwards from ${numberWordFor(item.resultCount)}, and the start was ${answerWord}. Your turn. ${questionFor(item)}`;
    case 'build-equation':
      return `My turn: the story has ${startWord} and ${changeWord}, and they `
        + `${item.operation === 'addition' ? 'come together, so it is a plus' : 'go away, so it is a take away'}. `
        + `Your turn — build the number sentence again.`;
    case 'create-story':
      return `My turn: the number sentence says ${equationSpoken(item)}. `
        + `Your turn — make that story again with the ${item.objectType}.`;
  }
};

// ── Judging contracts ───────────────────────────────────────────────────────

/** What looks like an answer for this mode and is not — plus the right answer
 *  that does not look right. Both halves matter: the refuse clause stops a
 *  fluent miss being affirmed, the accept clause stops a correct child being
 *  corrected. */
const discriminationFor = (item: AddSubSceneItem): string => {
  const answerWord = numberWordFor(item.answer);
  const spoken = publicValuesFor(item)
    .filter((value, i, all) => all.indexOf(value) === i && value !== item.answer)
    .map((value) => `"${numberWordFor(value)}"`);
  const echo = spoken.length > 0
    ? `The story already says ${spoken.join(' and ')} out loud, so ${spoken.length > 1 ? 'those numbers' : 'that number'} said back ${spoken.length > 1 ? 'are' : 'is'} NOT the answer, however confident it sounds. `
    : '';
  return (
    echo
    + `Counting aloud that ENDS on "${answerWord}" counts as that answer — the last number said tells the total. `
    + `"${answerWord}" with the ${item.objectType} named after it counts too. `
  );
};

const affirmTailFor = (item: AddSubSceneItem): string => {
  const answerWord = numberWordFor(item.answer);
  if (item.kind === 'solve-story' && item.unknownPosition === 'change') {
    return `${answerWord} ${item.operation === 'addition' ? 'came' : 'went away'}`;
  }
  if (item.kind === 'solve-story' && item.unknownPosition === 'start') {
    return `${answerWord} at the start`;
  }
  return item.operation === 'addition'
    ? `${answerWord} ${item.objectType} now`
    : `${answerWord} ${item.objectType} left`;
};

/**
 * ⚠️ THE WAIT IS DESCRIBED AS THE TUTOR'S STATE, NEVER AS AN IMPERATIVE.
 * Ten-frame drive 2 (2026-08-13) caught the model VOICING `[WAIT silently]` to
 * the child: it took a contract's "Then WAIT silently…" opener, wrapped it in a
 * bracket tag mimicking the real one, and performed it. A stage direction
 * phrased as a command to the tutor reads, to the model, like one more thing on
 * the list of things to say. So the contract states what is TRUE about the turn
 * and names the exact failure at the end. `findPerformedStageDirections` keeps
 * this structural.
 */
const judgingContract = (item: AddSubSceneItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner works, and their think time is unbounded. `
  + `Never say the answer during their turn and never count aloud with them. `
  + `The correct answer is "${numberWordFor(item.answer)}". `
  + discriminationFor(item)
  + `If the answer is right, say exactly: "Yes, ${affirmTailFor(item)}." `
  + `If it is wrong, say exactly: "${correctionFor(item)}"`;

/** The gesture contract is a SILENCE contract (cvc-speller's pattern): there is
 *  nothing to judge until the commit is described, and the quantity is banned
 *  from the tutor's mouth for the whole item. */
const silenceContract = (item: AddSubSceneItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS on the screen, not with their voice, so you then stay completely silent. `
  + (item.kind === 'build-equation'
    ? `Do not read the tiles aloud and never say what the number sentence should be. `
    : `Do not count the ${item.objectType} aloud and never say how many there should be. `)
  + `Do not narrate what they are doing or fill the pause. `
  + `You will be told what they made and whether it matches; only then do you speak.`;

/** Named at the end of every cue that carries a contract. It names the exact
 *  failure a drive produced rather than trusting a generic "don't read tags". */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const contractFor = (item: AddSubSceneItem): string =>
  item.answerKind === 'gesture' ? silenceContract(item) : judgingContract(item);

// ── Cues ────────────────────────────────────────────────────────────────────

export interface AddSubCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line, never as a second catalog directive on the same turn). */
export const itemCue = (item: AddSubSceneItem, opts: AddSubCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time for some number stories! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  const spoken = `${greeting}${how}${askFor(item)}`;
  return `[ASS_ITEM] Say exactly: "${spoken}" ${contractFor(item)} ${NEVER_PERFORM}`;
};

/**
 * The gesture verdict ask for an enacted SCENE (`act-out` @K, `create-story`):
 * describes what the child committed and hands the tutor its exact line. THE
 * MATCH IS COMPUTED IN CODE — the tutor is never asked to count pixels. The
 * digits in this instruction are for the judge's eyes; the spoken lines carry
 * number WORDS only.
 */
export const sceneVerdictCue = (item: AddSubSceneItem, placed: number): string => {
  const matches = placed === item.answer;
  const head =
    `[ASS_SCENE] The learner's picture ended with ${placed} ${item.objectType}; the story needs ${item.answer} — `
    + `that ${matches ? 'MATCHES' : 'does NOT match'}. `;
  const line = matches
    ? `Say exactly: "Yes! ${cap(numberWordFor(item.answer))} ${item.objectType}. ${item.kind === 'create-story' ? 'You made the story!' : 'You acted out the story!'}" `
    : `Say exactly: "${correctionFor(item)}" `;
  return `${head}${line}Never read bracket tags aloud.`;
};

/**
 * The gesture verdict ask for a BUILT number sentence (`build-equation`). The
 * fault is code-decided so the correction can name what actually went wrong
 * rather than issuing one generic line for three different misconceptions.
 */
export const equationVerdictCue = (item: AddSubSceneItem, tiles: readonly string[]): string => {
  const fault = equationFaultOf(item, tiles);
  const built = tiles.join(' ').trim() || 'nothing';
  const head = `[ASS_EQUATION] The learner built "${built}"; the story is ${item.equation} — that ${fault === 'match' ? 'MATCHES' : 'does NOT match'}. `;
  if (fault === 'match') {
    return `${head}Say exactly: "Yes! ${cap(equationSpoken(item))}. Your number sentence tells the same story!" Never read bracket tags aloud.`;
  }
  const specific =
    fault === 'arithmetic'
      ? `My turn: those numbers do not make that total yet. Count the ${item.objectType} in the picture again. Your turn — build the number sentence again.`
      : fault === 'operator'
        ? `My turn: in this story the ${item.objectType} ${item.operation === 'addition' ? 'come together, so we need a plus' : 'go away, so we need a take away'}. Your turn — build the number sentence again.`
        : fault === 'numbers'
          ? correctionFor(item)
          : `My turn: a number sentence needs two numbers, a sign, an equals, and the total. Your turn — build the whole number sentence.`;
  return `${head}Say exactly: "${specific}" Never read bracket tags aloud.`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  item: AddSubSceneItem,
  next: AddSubSceneItem | null,
  opts: AddSubCueOptions = {},
): string => {
  if (!next) {
    return `[ASS_MOVE] Say exactly: "Good try! Number stories take practice — we will see that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[ASS_MOVE] Say exactly: "Good try! Here comes the next story. ${how}${askFor(next)}" ${contractFor(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[ASS_COMPLETE] Say exactly: "What great story math today! You listened hard and you did the thinking. See you next time!" Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer — on this primitive
 * that means the STORY again, which is the one thing a non-reader cannot get
 * back on their own. It must never narrate the count (cvc's `[ISOLATE_VOWEL]`
 * was an answer leak on demand — the same trap).
 */
export const pronounceCue = (item: AddSubSceneItem): string =>
  `[ASS_HEAR] The learner tapped to hear the story again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 * (di-math-facts rule), answer-free by construction: it names the situation's
 * SHAPE, never any count, so no branch of it can carry the value the child is
 * about to produce.
 */
export const stimulusFor = (item: AddSubSceneItem): string =>
  `${item.operation === 'addition' ? 'a joining' : 'a taking-away'} story about ${item.objectType} in the ${item.scene}`;
