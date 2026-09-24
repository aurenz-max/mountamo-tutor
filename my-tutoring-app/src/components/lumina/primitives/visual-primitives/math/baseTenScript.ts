/**
 * baseTenScript — base-ten-blocks' spoken-mat items (`read_blocks` + `regroup`): the build gates,
 * one judged item per plan step, the payload routing rule, and the drive-harness answer material the
 * workspace journey reads. The spoken asks live in `baseTenModes.ts` and the arithmetic in
 * `baseTenModel.ts`; `baseTenWorkspace.ts` turns an item into the workspace assignment and scene.
 * The scripted runner's cues and judging contracts were deleted with that path (LA-14): the teaching
 * workspace is the only teaching path.
 *
 * ── THE THREE SIGNATURE ERRORS ──────────────────────────────────────────────
 *
 * Each is the fluent, confident wrong answer a judge is most likely to affirm
 * by accident, and each is the misconception its step exists to undo:
 *
 *   count   — the VALUE said where the COUNT was asked ("forty" for "four").
 *   worth   — the BARE COUNT said for the value ("four" for "forty").
 *   predict — "ten": the blocks the trade CREATES, with the ones already on the
 *             mat forgotten.
 *
 * `baseTenHarnessAnswers` carries each as `signatureWrong` for the drives.
 */
import type { DiActionContract, JudgedScriptItem } from '../../../hooks/judgedScriptContract';
import { digitValueWord } from './spokenNumberWords';
import {
  blockNoun,
  btProblem,
  occupiedPlaces,
  placeValueOf,
  predictedCount,
  readCount,
  readWorthWord,
  wordFor,
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
 * Does this hydrated payload belong to the spoken mat? HOMOGENEOUS sessions
 * only — the same predicate the catalog's `audioInputByMode` resolver applies,
 * so the transport the backend was told about and the component the child gets
 * can never disagree. A mixed payload keeps the click mat.
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
// Drive-harness answer material (the workspace journey, liveJourneySpec.ts)
//
// Declared structurally here rather than imported from a harness module, so the
// domain never depends on a harness.
// ============================================================================

export interface BaseTenHarnessAnswers {
  correct: string;
  plainWrong: string;
  /** The step's signature wrong answer, and WHY it is wrong. */
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
        leakExemptSpan: blockNoun(problem.place, count),
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
