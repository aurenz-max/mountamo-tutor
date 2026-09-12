/**
 * baseTenScript — the HAND-AUTHORED judged-loop script for base-ten-blocks
 * (`read_blocks` + `regroup`). The exact wording IS the pedagogy: these lines
 * are authored here, never generated. Item content (which numbers) is
 * generator-scoped; this module owns the cue shapes, the build gates and the
 * in-band judging contracts. `baseTenModes.ts` owns the task identities and the
 * asks; `baseTenModel.ts` owns the arithmetic.
 *
 * ── THE THREE SIGNATURE ERRORS ──────────────────────────────────────────────
 *
 * Each is the fluent, confident wrong answer the judge is most likely to affirm
 * by accident, and each is the misconception its step exists to undo:
 *
 *   count   — the VALUE said where the COUNT was asked ("forty" for "four").
 *             The mirror image of the `worth` error, and the reason the two
 *             steps are asked in this order.
 *   worth   — the BARE COUNT said for the value ("four" for "forty"). Carried
 *             from place-value-chart's `say_value` and ordinal-line's "three
 *             for third": it is corrected, never leniently accepted, because
 *             the correction is where "one ten-stick is worth ten, so four of
 *             them are worth forty" actually gets said.
 *   predict — "ten": the blocks the trade CREATES, with the ones already on the
 *             mat forgotten. This is the whole content of regrouping, and a
 *             click surface could not ask it at all.
 *
 * ── WHY THE HOW-TO-PLAY IS OPENING-ONLY ─────────────────────────────────────
 *
 * Items alternate step by step (count, worth, count, worth…), so EVERY
 * consecutive pair changes action and the runner's action-change policy would
 * re-recite the protocol on every single item — add-di-loop defect 13, arriving
 * through the item shape instead of the generator. `itemCue` therefore reads
 * `opts.opening` only and ignores `opts.howToPlay`. The lead-in is established
 * once, not recited.
 */
import type {
  DiActionContract,
  JudgedCueOptions,
  JudgedCueSurface,
  JudgedScriptItem,
} from '../../../hooks/judgedScriptContract';
import { digitValueWord } from './spokenNumberWords';
import {
  blockNoun,
  blockNounPlural,
  btProblem,
  btScene,
  btTradeFeedback,
  occupiedPlaces,
  placeValueOf,
  predictedCount,
  readCount,
  readWorthWord,
  startingLowerCount,
  standardColumns,
  tradeSolved,
  wordFor,
  type BtColumns,
  type BtMode,
  type BtProblem,
} from './baseTenModel';
import { baseTenModePlan, isBaseTenDiChallengeType, type BaseTenPlanItem } from './baseTenModes';

export type BaseTenStep = 'count' | 'worth' | 'predict' | 'trade';

export interface BaseTenItem extends JudgedScriptItem {
  problem: BtProblem;
  step: BaseTenStep;
  actionContract: DiActionContract;
}

/** A session never exceeds this many judged asks. Whole PROBLEMS are selected,
 *  never sliced mid-problem — a half-problem strands a spoken step with no
 *  hands turn behind it (defect class 1: select, don't truncate). */
export const MAX_SESSION_ITEMS = 12;

export interface BaseTenChallengeLike {
  type?: string;
  targetNumber?: unknown;
}

// ============================================================================
// Build gates — EXPORTED, and imported by the generator (never re-copied)
// ============================================================================

/** The band this pack may put on a mat: two to four digits, so at least one
 *  non-ones place exists to ask about. */
export const MIN_TARGET = 10;
export const MAX_TARGET = 9999;

export const isInBandTarget = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= MIN_TARGET && n <= MAX_TARGET;

/**
 * Can this number carry a judged item at all? Both modes need a non-zero digit
 * above the ones place — `read_blocks` because the ones column makes "how many"
 * and "what are they worth" the same answer, `regroup` because a standard-form
 * mat can only break a bigger unit DOWN. A number that fails is DROPPED, never
 * repaired into a different one.
 */
export const isAskableTarget = (n: unknown, mode: BtMode): n is number =>
  isInBandTarget(n) && btProblem(n, mode, 0) !== null;

export const problemsFromChallenges = (
  challenges: readonly BaseTenChallengeLike[],
  mode: BtMode,
): BtProblem[] => {
  const problems: BtProblem[] = [];
  for (const challenge of challenges) {
    const problem = btProblem(challenge?.targetNumber, mode, problems.length);
    if (problem) problems.push(problem);
  }
  return problems;
};

// ============================================================================
// Items — one problem becomes one judged item per plan step
// ============================================================================

const planItemFor = (problem: BtProblem): BaseTenPlanItem => ({
  id: problem.id,
  challengeType: problem.mode,
  problem,
});

export const baseTenItems = (problems: readonly BtProblem[]): BaseTenItem[] =>
  problems.flatMap((problem) => baseTenModePlan(planItemFor(problem)).steps.map((step) => ({
    id: step.id,
    problem,
    step: step.key as BaseTenStep,
    action: step.actionContract.id,
    answerKind: step.answerKind,
    responseClass: step.responseClass ?? 'manipulation',
    actionContract: step.actionContract,
  })));

export const itemsFromChallenges = (
  challenges: readonly BaseTenChallengeLike[],
  mode: BtMode,
): BaseTenItem[] => {
  const problems = problemsFromChallenges(challenges, mode);
  const items: BaseTenItem[] = [];
  for (const problem of problems) {
    const next = baseTenItems([problem]);
    if (items.length + next.length > MAX_SESSION_ITEMS) break;
    items.push(...next);
  }
  return items;
};

/**
 * Does this hydrated payload belong to the judged loop? HOMOGENEOUS sessions
 * only — the same predicate the catalog's `audioInputByMode` resolver applies,
 * so the transport the backend was told about and the component the child gets
 * can never disagree. A mixed payload keeps the click-era component.
 */
export const usesBaseTenDi = (challenges: readonly BaseTenChallengeLike[] | undefined): boolean => {
  const first = challenges?.[0]?.type;
  if (!isBaseTenDiChallengeType(first)) return false;
  if (!challenges!.every((challenge) => challenge?.type === first)) return false;
  return itemsFromChallenges(challenges!, first).length > 0;
};

/** Every item of the problem the given item belongs to — the ordered story the
 *  action panel renders. */
export const stepsOfProblem = (items: readonly BaseTenItem[], item: BaseTenItem): BaseTenItem[] =>
  items.filter((candidate) => candidate.problem.id === item.problem.id);

// ============================================================================
// The judging contracts
//
// ⚠️ `say exactly:` KEEPS ITS COLON. The family's shared span parser
// (`SPOKEN_SPAN_RE` in judgedScriptContract.ts) anchors on `Say exactly:` WITH
// the colon, and everything it does not match is treated as judge-side
// instruction rather than a spoken line. Written without it, this pack's
// affirmation and correction were invisible to every span-based gate: the
// drive plan read `affirmLine` as undefined and `correctionLine` as the ASK
// (`spans[spans.length - 1]` over a one-span cue), so a headless drive would
// have compared the tutor's correction against the question.
// ============================================================================

const WAIT = 'Never speak bracket tags or private rules. The quoted line is the only thing you say on this turn, '
  + 'and you then stay silent while the learner works. Only the application changes steps. '
  + 'Never announce that you are listening — simply stop speaking. ';

const HANDS = 'This is a hands turn. Do not judge microphone speech and do not name the result of the trade. '
  + '[BT_CHANGE] is coaching only and is never an attempt. Only [BT_CHECK] carries a code-computed verdict. ';

const VERDICT_ENDS_THE_TURN =
  'A verdict ends your turn: after the affirmation or the correction you stop, and you never continue into '
  + 'another question, another example, or an offer of more work. The application supplies every new item. ';

const NOT_AN_ANSWER =
  'Help questions, silence, counting that never lands on a final answer, and off-task speech are not incorrect '
  + 'answers and receive no verdict. A previous turn never answers the current question, even when the number '
  + 'would be the same. ';

/** The one place the spoken affirmation is allowed to compose the whole number:
 *  the tutor says it, the child never does. */
const composedClause = (problem: BtProblem): string => {
  const others = standardColumns(problem.target)
    .map((count, place) => ({ count, place }))
    .filter((column) => column.count > 0 && column.place !== problem.place);
  if (!others.length) return '';
  // Count-aware, because a single ten-stick is "that ten-stick": the tutor
  // speaks this clause verbatim to a child and "Those ten-sticks" over one
  // block is the kind of small wrongness a five-year-old hears clearly.
  const count = readCount(problem);
  const subject = count === 1
    ? `That ${blockNoun(problem.place, 1)}`
    : `Those ${blockNounPlural(problem.place)}`;
  return ` ${subject} and the rest of the mat make ${problem.target}.`;
};

export function countJudging(item: BaseTenItem): string {
  const count = readCount(item.problem);
  const noun = blockNoun(item.problem.place, count);
  return `Private expected count: ${count}. Judge only the current spoken count of ${blockNounPlural(item.problem.place)}. `
    + `Accept a number word or a short sentence such as "${wordFor(count)} ${noun}". `
    + `The signature wrong answer is the VALUE said where the COUNT was asked — "${readWorthWord(item.problem)}" `
    + 'instead of the plain count — and it is incorrect here. So is a count of a different block size, and so is '
    + 'the whole number the mat shows. Negated correct numbers and conflicting guesses are incorrect. '
    + `If correct say exactly: "Yes, ${wordFor(count)} ${noun}." `
    + `If incorrect say exactly: "My turn: there ${count === 1 ? 'is' : 'are'} ${wordFor(count)} ${noun}. `
    + `Your turn. ${item.actionContract.instruction}" `
    + NOT_AN_ANSWER + VERDICT_ENDS_THE_TURN;
}

export function worthJudging(item: BaseTenItem): string {
  const count = readCount(item.problem);
  const worth = readWorthWord(item.problem);
  const one = digitValueWord(1, item.problem.place);
  return `Private expected value: ${worth}. Judge only the current spoken value of those blocks. `
    + `Accept "${worth}" alone or inside a short sentence, with or without the block name. `
    + `The signature wrong answer is the BARE COUNT said for the value — "${wordFor(count)}" instead of `
    + `"${worth}" — and it is incorrect, not a near miss. The same digit at the wrong size is also incorrect. `
    + 'The whole number the mat shows is not an answer to this question. '
    + `If correct say exactly: "Yes, ${wordFor(count)} ${blockNoun(item.problem.place, count)} `
    + `${count === 1 ? 'is' : 'are'} worth ${worth}.${composedClause(item.problem)}" `
    // A ONE-BLOCK MAT TAKES THE SHORT CORRECTION. The model sentence is "one X
    // is worth V, so N of them are worth V×N", and at N of one the second half
    // restates the first ("so one of them is worth one thousand") — a live
    // drive heard it, with the agreement broken as well. The relationship is
    // the whole point of the correction, so the degenerate half goes.
    + `If incorrect say exactly: "My turn: one ${blockNoun(item.problem.place, 1)} is worth ${one}`
    + `${count === 1 ? '' : `, so ${wordFor(count)} of them are worth ${worth}`}. `
    + `Your turn. ${item.actionContract.instruction}" `
    + NOT_AN_ANSWER + VERDICT_ENDS_THE_TURN;
}

export function predictJudging(item: BaseTenItem): string {
  const lower = startingLowerCount(item.problem);
  const expected = predictedCount(item.problem);
  const lowerNoun = blockNounPlural(item.problem.place - 1);
  // `lower` is never 0 — the build gate drops a mat whose receiving place is
  // empty — but one block takes the singular verb.
  const already = `${wordFor(lower)} ${lower === 1 ? 'was' : 'were'} already there, `
    + `so there are ${wordFor(expected)}`;
  return `Private expected count: ${expected}. Judge only the current spoken prediction. `
    + `Accept a number word or a short sentence such as "${wordFor(expected)} ${lowerNoun}". `
    + 'The signature wrong answer is "ten" — the blocks the trade creates, with the ones already on the mat '
    + 'forgotten — and it is incorrect. The starting count on its own is also incorrect. '
    + 'Negated correct numbers and conflicting guesses are incorrect. '
    + `If correct say exactly: "Yes, ${wordFor(expected)} ${lowerNoun}." `
    + `If incorrect say exactly: "My turn: ten new ${lowerNoun} arrive and ${already}. Your turn. ${item.actionContract.instruction}" `
    + NOT_AN_ANSWER + VERDICT_ENDS_THE_TURN;
}

export const judgingFor = (item: BaseTenItem): string => {
  switch (item.step) {
    case 'count': return countJudging(item);
    case 'worth': return worthJudging(item);
    case 'predict': return predictJudging(item);
    case 'trade': return HANDS;
  }
};

// ============================================================================
// Cues
// ============================================================================

const HOW_TO_PLAY: Record<BtMode, string> = {
  read_blocks: 'Let us read the blocks together. I will ask about one size at a time, and you answer out loud. ',
  regroup: 'Let us trade some blocks. You tell me what will happen first, and then you make it happen. ',
};

const columnsFor = (item: BaseTenItem, columns?: BtColumns): BtColumns => columns ?? item.problem.start;

/**
 * The ask. `opts.howToPlay` is deliberately ignored — see the module docblock:
 * the alternating step shape would otherwise re-recite the protocol every item.
 */
export function baseTenItemCue(
  item: BaseTenItem,
  opts: JudgedCueOptions,
  columns?: BtColumns,
): string {
  const opening = opts.opening ? HOW_TO_PLAY[item.problem.mode] : '';
  return `[BT_ITEM] Scene: ${btScene(item.problem, columnsFor(item, columns))} `
    + `Say exactly: "${opening}${item.actionContract.instruction}" `
    + judgingFor(item) + WAIT;
}

/** Hands-turn coaching as the mat changes. Never a verdict, never the result. */
export const baseTenChangeCue = (item: BaseTenItem, columns: BtColumns): string =>
  `[BT_CHANGE] Scene: ${btScene(item.problem, columns)} `
  + `Say exactly: "${btTradeFeedback(item.problem, columns)}" ` + HANDS + WAIT;

/** The hands verdict, computed in code and handed to the tutor as fact. */
export function baseTenCheckCue(item: BaseTenItem, columns: BtColumns): string {
  const solved = tradeSolved(item.problem, columns);
  const lowerNoun = blockNounPlural(item.problem.place - 1);
  // The correction MODELS then re-elicits, like every spoken correction in the
  // pack. A bare "My turn: <the child's own instruction>" — which is what this
  // said until a live drive read it back — promises a demonstration and then
  // hands the job straight back, and the trade relationship never gets said.
  const line = solved
    ? `Yes, one ${blockNoun(item.problem.place, 1)} became ten ${lowerNoun}. The mat still shows the same number.`
    : `My turn: one ${blockNoun(item.problem.place, 1)} breaks into ten ${lowerNoun}. `
      + `Your turn. ${item.actionContract.instruction}`;
  return `[BT_CHECK] Scene: ${btScene(item.problem, columns)} Code computed solved=${solved}. Use this result. `
    + `Say exactly: "${line}" ` + VERDICT_ENDS_THE_TURN + WAIT;
}

export function baseTenMoveOnCue(
  item: BaseTenItem,
  next: BaseTenItem | null,
  _opts: JudgedCueOptions,
  columns?: BtColumns,
): string {
  if (!next) return baseTenCompleteCue(item.problem.mode);
  return `[BT_MOVE] Scene: ${btScene(next.problem, columnsFor(next, columns))} `
    + `Say exactly: "Let us keep going. ${next.actionContract.instruction}" `
    + judgingFor(next) + WAIT;
}

/** The sign-off names the work the child actually did — a regroup session was
 *  being told "you read the blocks and said what they are worth". */
export const baseTenCompleteCue = (mode: BtMode = 'read_blocks'): string =>
  `[BT_COMPLETE] Say exactly: "${mode === 'regroup'
    ? 'You said what would happen and then you made every trade.'
    : 'You read the blocks and said what they are worth.'} Nice work with the mat!" Then stop.`;

/** Tap-to-hear: the question again, never a hint and never the answer. */
export const baseTenHearCue = (item: BaseTenItem, columns?: BtColumns): string =>
  `[BT_HEAR] Scene: ${btScene(item.problem, columnsFor(item, columns))} `
  + `Say exactly: "${item.actionContract.instruction}" Do not judge speech you have just heard. `
  + judgingFor(item) + WAIT;

/**
 * THE LEGACY CONTEXT KEYS, FILLED SAFELY.
 *
 * base-ten-blocks is a STAGED port: its catalog `tutoring` block still serves
 * `build_number` and the operate modes, so it still declares the click era's
 * eleven context keys and still interpolates three of them. A DI pack that
 * pushed only its own two would leave those rendering the literal "(not set)",
 * which a tutor has read aloud to a child as content. So the pack pushes the
 * whole legacy key set and WITHHOLDS every value that could be an answer —
 * balance-scale's staged-port technique, which keeps the catalog prose honest
 * without a rewrite that would break the modes still on the click surface.
 */
const WITHHELD = 'withheld; the scripted cue carries every value you may say';

export const contextForItem = (item: BaseTenItem, regroupsUsed = 0): Record<string, string> => ({
  numberValue: WITHHELD,
  interactionMode: item.problem.mode === 'regroup' ? 'regroup' : 'decompose',
  decimalMode: 'false',
  gradeBand: '2-3',
  currentTotal: WITHHELD,
  columns: WITHHELD,
  targetNumber: WITHHELD,
  challengeType: item.problem.mode,
  instruction: item.actionContract.instruction,
  attemptNumber: '0',
  regroupsUsed: String(regroupsUsed),
});

/**
 * The context channel, answer-free by construction. On `read_blocks` the counts
 * ARE the answers, so the stimulus says what kind of mat is on screen and
 * nothing about what is on it.
 */
export const stimulusFor = (item: BaseTenItem): string => {
  if (item.problem.mode === 'read_blocks') {
    return `A block mat is on screen. The child is naming the ${blockNounPlural(item.problem.place)} `
      + 'and then what they are worth. The counts and the number are withheld from you.';
  }
  return `A block mat in standard form. The child is trading one ${blockNoun(item.problem.place, 1)} `
    + `for ten ${blockNounPlural(item.problem.place - 1)}.`;
};

// ============================================================================
// The cue surface — ONE source, spread by the component and the drive harness
// ============================================================================

export const baseTenPackBase = (
  items: BaseTenItem[],
  columnsFn: (item: BaseTenItem) => BtColumns = (item) => item.problem.start,
): JudgedCueSurface<BaseTenItem> => ({
  primitiveType: 'base-ten-blocks',
  activityLine: 'read a block mat aloud and trade blocks between places',
  items,
  itemCue: (item, opts) => baseTenItemCue(item, opts, columnsFn(item)),
  moveOnCue: (item, next, opts) => baseTenMoveOnCue(item, next, opts, next ? columnsFn(next) : undefined),
  completeCue: () => baseTenCompleteCue(items[0]?.problem.mode),
  pronounceCue: (item) => baseTenHearCue(item, columnsFn(item)),
  contextFor: (item) => contextForItem(item),
});

// ============================================================================
// Drive-harness answer material (`/tutor-test --di`)
//
// The shape is `DiHarnessAnswers` (service/qa/di/diDrivePlan.ts), declared
// structurally here rather than imported: a script module importing the drive
// plan would invert the dependency the adapter registry exists to express.
// ============================================================================

export interface BaseTenHarnessAnswers {
  correct: string;
  plainWrong: string;
  /** The fluent wrong answer `judgingFor` CLAIMS the judge refuses, and WHY. */
  signatureWrong?: { text: string; why: string };
  /** A hands commit carries the PLACE the child tapped. */
  placed?: { correct: number; wrong: number };
  /** Answer tokens the spoken ask must not contain. */
  leakTokens: string[];
  /** A span of the ask inside which those tokens are legitimate. */
  leakExemptSpan?: string | string[];
}

/**
 * The place a WRONG hands turn taps: another block ON the mat, never the one
 * the tutor asked for. Falls back to the ones column, which has nothing below
 * it to break into — the mat is then unchanged, which is also not the trade.
 */
export const wrongTradePlace = (problem: BtProblem): number =>
  occupiedPlaces(problem.start).find((place) => place !== problem.place && place >= 1) ?? 0;

export function baseTenHarnessAnswers(item: BaseTenItem): BaseTenHarnessAnswers {
  const { problem } = item;
  const count = readCount(problem);
  switch (item.step) {
    case 'count':
      return {
        correct: wordFor(count),
        plainWrong: wordFor(count === 9 ? 1 : count + 1),
        signatureWrong: {
          text: readWorthWord(problem),
          why: 'the VALUE said where the COUNT was asked — the mirror image of the worth step',
        },
        leakTokens: [wordFor(count), String(count)],
      };
    case 'worth':
      return {
        correct: readWorthWord(problem),
        plainWrong: digitValueWord(count === 9 ? 1 : count + 1, problem.place),
        signatureWrong: {
          text: wordFor(count),
          why: 'the BARE COUNT said for the value — "four" for "forty"',
        },
        leakTokens: [readWorthWord(problem), String(count * placeValueOf(problem.place))],
        // THE BLOCK NAME IS NOT A LEAK. One ten-stick is worth "ten", and the
        // ask has to name the blocks it is asking about — so on that one mat
        // the answer word sits inside the noun and nowhere else. Subtracting
        // the noun keeps the scan STRONGER than emptying `leakTokens` would:
        // the value said anywhere else in the turn is still a leak.
        leakExemptSpan: blockNounPlural(problem.place),
      };
    case 'predict': {
      const expected = predictedCount(problem);
      return {
        correct: wordFor(expected),
        plainWrong: wordFor(expected === 19 ? 11 : expected + 1),
        signatureWrong: {
          text: 'ten',
          why: 'the blocks the trade CREATES, with the ones already on the mat forgotten',
        },
        leakTokens: [wordFor(expected), String(expected)],
      };
    }
    case 'trade': {
      // No `signatureWrong`: on a hands turn the signature error IS the wrong
      // placement, and it rides `placed.wrong` into the code-computed verdict.
      const wrong = wrongTradePlace(problem);
      return {
        correct: `one ${blockNoun(problem.place, 1)} tapped`,
        plainWrong: wrong >= 1 ? `one ${blockNoun(wrong, 1)} tapped` : 'no block traded',
        placed: { correct: problem.place, wrong },
        leakTokens: [],
      };
    }
  }
}
