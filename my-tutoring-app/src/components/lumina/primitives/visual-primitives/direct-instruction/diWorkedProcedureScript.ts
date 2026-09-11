/**
 * diWorkedProcedureScript — HAND-AUTHORED Direct Instruction script for
 * di-worked-procedure, the first pack in the "DI for Older Learners" tier
 * (design brief 2026-09-07). The child works a multi-digit subtraction OUT
 * LOUD, one column at a time; the tutor judges each MOVE where it happens and
 * corrects at that column, never at the end.
 *
 * WHAT IS NEW, AND WHAT IS NOT. The runner, the sentinels, the correction cap
 * and the context sync are the family's (`useJudgedScriptRunner`). What this
 * module adds is a unit of judgment: a STEP. Two kinds —
 *
 *   decide    "The ones column. Tell me what you do." The child reads the
 *             column and either regroups ("I can't take eight from three, so I
 *             regroup: four tens, thirteen ones") or subtracts cleanly ("four
 *             minus two is two"). Class `procedure_step` — a MOVE plus its
 *             result, where the wrong move is fluent and confident.
 *   subtract  "Now subtract the ones." after an affirmed regroup. The child
 *             says the difference. Class `number_word_to_20` — the benched
 *             number-word class; the narration around it is accepted.
 *
 * The ask never states the column's digits (except at the `easy` support
 * tier): reading "4 − 2" off a page where the 5 was struck IS the skill, and
 * stating "four minus two" would hand the decrement over. That is also why a
 * regroup is judged on BOTH new numbers — a child who says "thirteen" and
 * never touches the five has made the forgot-to-decrement error exactly where
 * a teacher would catch it, and the correction names it.
 *
 * THE SCREEN ONLY FOLLOWS. Every affirmed step writes itself onto the problem
 * (strike, carry mark, difference digit) — nothing the child must say is ever
 * printed before they say it. The canonical chain comes from
 * `diWorkedProcedurePlan.ts`, never from the model.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn"); every correction
 * re-models the column then re-elicits (standing gate 3). Corrections are
 * CONTRASTIVE where a wrong thing was said (⟨what they said⟩ is a slot the
 * tutor fills from the audio — never spoken as marks), and each step scripts
 * its SPECIFIC branches ahead of the general one, in the family's order: ask,
 * affirm, specific corrections, general last (`diDrivePlan.ts` item 27).
 *
 * MOVE-ON CARRIES THE STEP. When the cap is reached the tutor states the move
 * ("We regroup: four tens, thirteen ones.") before the next ask, and the stage
 * writes it as carried — otherwise "Now subtract the ones" would refer to a
 * thirteen the page never showed.
 */

import type {
  DiActionContract,
  JudgedCueOptions,
  JudgedCueSurface,
  JudgedScriptItem,
} from '../../../hooks/judgedScriptContract';
import {
  numberWord,
  planSubtraction,
  PLACES,
  PLACE_UNIT,
  type Place,
  type SubtractionColumn,
  type SubtractionPlan,
} from './diWorkedProcedurePlan';
import {
  WORKED_PROCEDURE_HOW_TO_PLAY,
  diWorkedProcedureModePlan,
  workedProcedureColumnPhrase,
  type WorkedProcedureChallengeType,
  type WorkedProcedureSupportTier,
  type WorkedStepKind,
} from './diWorkedProcedureModes';

export type {
  WorkedProcedureChallengeType,
  WorkedProcedureSupportTier,
  WorkedStepKind,
} from './diWorkedProcedureModes';

/** L3 lever: at `easy` the ask STATES the column's digits (reading the page is
 *  handed over); otherwise the child reads the column. `medium` and `hard` are
 *  identical in this pilot — a later /add-support-tiers pass owns the split. */

/** What the generator emits per problem. The step chain is built HERE from the
 *  two numbers; a spec that fails the plan gates is dropped, never backfilled. */
export interface WorkedProblemSpec {
  id: string;
  minuend: number;
  subtrahend: number;
  challengeType: WorkedProcedureChallengeType;
  supportTier?: WorkedProcedureSupportTier;
}

export interface WorkedProcedureItem extends JudgedScriptItem {
  action: 'talk_through';
  kind: WorkedStepKind;
  challengeType: WorkedProcedureChallengeType;
  supportTier?: WorkedProcedureSupportTier;
  problemId: string;
  /** Position of this problem in the session (0-based). */
  problemIndex: number;
  /** Position of this step within its problem (0-based). */
  stepIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  minuend: number;
  subtrahend: number;
  /** "53 − 28" — the printed stimulus. Never contains the answer. */
  problemDisplay: string;
  /** "fifty-three minus twenty-eight". */
  problemSpoken: string;
  finalDifference: number;
  columnIndex: number;
  place: Place;
  column: SubtractionColumn;
  /** decide only: the correct move is to regroup. */
  regroup: boolean;
  /** decide+regroup only: the digit the place above reads after lending. */
  newAbove: number;
  placeAbove: Place | null;
  /** The canonical utterance, for evidence and the harness. */
  answerSpoken: string;
}

export type ActionableWorkedProcedureItem = WorkedProcedureItem & {
  actionContract: DiActionContract;
};

export interface DiWorkedProcedureData {
  title: string;
  description: string;
  challengeType: WorkedProcedureChallengeType;
  problems: WorkedProblemSpec[];
  gradeLevel?: string;
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: unknown) => void;
}

const w = numberWord;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const MINUS = '−';

export const problemDisplayOf = (minuend: number, subtrahend: number): string =>
  `${minuend} ${MINUS} ${subtrahend}`;
export const problemSpokenOf = (minuend: number, subtrahend: number): string =>
  `${w(minuend)} minus ${w(subtrahend)}`;

// ── Items from problems (the ONE builder; the harness calls it too) ──────────

const stepsForPlan = (
  spec: WorkedProblemSpec,
  plan: SubtractionPlan,
  problemIndex: number,
): WorkedProcedureItem[] => {
  const base = {
    action: 'talk_through' as const,
    answerKind: 'voice' as const,
    challengeType: spec.challengeType,
    supportTier: spec.supportTier,
    problemId: spec.id,
    problemIndex,
    minuend: plan.minuend,
    subtrahend: plan.subtrahend,
    problemDisplay: problemDisplayOf(plan.minuend, plan.subtrahend),
    problemSpoken: problemSpokenOf(plan.minuend, plan.subtrahend),
    finalDifference: plan.difference,
  };
  const items: WorkedProcedureItem[] = [];
  plan.columns.forEach((column, columnIndex) => {
    const placeAbove = column.regroup ? PLACES[columnIndex + 1] : null;
    const newAbove = column.regroup ? plan.columns[columnIndex + 1].top - 1 : -1;
    const decide: WorkedProcedureItem = {
      ...base,
      id: `${spec.id}-c${columnIndex}-decide`,
      kind: 'decide',
      responseClass: 'procedure_step',
      stepIndex: items.length,
      isFirstStep: items.length === 0,
      isLastStep: !column.regroup && columnIndex === plan.columns.length - 1,
      columnIndex,
      place: column.place,
      column,
      regroup: column.regroup,
      newAbove,
      placeAbove,
      answerSpoken: column.regroup
        ? `I can't take ${w(column.bottom)} from ${w(column.topAfterLend)}, so I regroup: `
          + `${w(newAbove)} ${placeAbove}, ${w(column.effectiveTop)} ${column.place}`
        : `no regrouping, ${w(column.topAfterLend)} minus ${w(column.bottom)} is ${w(column.difference)}`,
    };
    items.push(withWorkedProcedureAction(decide));
    if (column.regroup) {
      items.push(withWorkedProcedureAction({
        ...base,
        id: `${spec.id}-c${columnIndex}-subtract`,
        kind: 'subtract',
        responseClass: 'number_word_to_20',
        stepIndex: items.length,
        isFirstStep: false,
        isLastStep: false,
        columnIndex,
        place: column.place,
        column,
        regroup: false,
        newAbove: -1,
        placeAbove: null,
        answerSpoken: w(column.difference),
      }));
    }
  });
  return items;
};

/**
 * Build the judged items for a session. Problems that fail the plan gates are
 * DROPPED and counted — a placeholder step in a judged loop becomes a spoken
 * ask the tutor must judge, so nothing is ever backfilled.
 */
export function itemsFromProblems(problems: readonly WorkedProblemSpec[]): {
  items: WorkedProcedureItem[];
  dropped: number;
} {
  const items: WorkedProcedureItem[] = [];
  let dropped = 0;
  let problemIndex = 0;
  for (const spec of problems) {
    const plan = planSubtraction(spec.minuend, spec.subtrahend);
    if (!plan) { dropped++; continue; }
    // A mode promise is a content gate: a no-regroup session must not contain a
    // regroup, and a regroup session must regroup at least once.
    if (spec.challengeType === 'subtract_no_regroup' && plan.regroupCount > 0) { dropped++; continue; }
    if (spec.challengeType === 'subtract_regroup' && plan.regroupCount === 0) { dropped++; continue; }
    items.push(...stepsForPlan(spec, plan, problemIndex));
    problemIndex++;
  }
  return { items, dropped };
}

/** Every distinct problem in item order — the stage renders one at a time. */
export const problemsOf = (items: readonly WorkedProcedureItem[]): string[] =>
  Array.from(new Set(items.map((it) => it.problemId)));

// ── The spoken lines ─────────────────────────────────────────────────────────

const statesDigits = (item: WorkedProcedureItem): boolean => item.supportTier === 'easy';

/** The column phrase at `easy` — the ONE place the ask says the digits. */
export const columnPhrase = (item: WorkedProcedureItem): string =>
  workedProcedureColumnPhrase(item);

/** The exact current move shown on screen and included in the spoken ask. */
export const withWorkedProcedureAction = (
  item: WorkedProcedureItem,
): ActionableWorkedProcedureItem => {
  const actionContract = diWorkedProcedureModePlan(item).answerStep.actionContract;
  return { ...item, answerKind: actionContract.answerKind, actionContract };
};

/** The ask for one step — what the child hears right before their turn. */
export const askLine = (item: WorkedProcedureItem): string => {
  const instruction = withWorkedProcedureAction(item).actionContract.instruction;
  return item.isFirstStep ? `${cap(item.problemSpoken)}. ${instruction}` : instruction;
};

/** The short re-ask every correction ends on. Never restates the problem. */
const reAsk = (item: WorkedProcedureItem): string =>
  `Your turn. ${withWorkedProcedureAction(item).actionContract.instruction}`;

const HOW_TO_PLAY = WORKED_PROCEDURE_HOW_TO_PLAY;

/** The resolved column as a statement — the affirmation's body and the
 *  move-on's carry line. For the last step it closes the whole problem. */
const resolution = (item: WorkedProcedureItem): string => {
  const c = item.column;
  if (item.kind === 'decide' && item.regroup) {
    return `regroup: ${w(item.newAbove)} ${item.placeAbove}, ${w(c.effectiveTop)} ${c.place}.`;
  }
  const fact = `${w(c.effectiveTop)} minus ${w(c.bottom)} is ${w(c.difference)}.`;
  const closing = item.isLastStep ? ` ${cap(item.problemSpoken)} is ${w(item.finalDifference)}.` : '';
  return item.kind === 'decide' ? `no regrouping: ${fact}${closing}` : `${fact}${closing}`;
};

/** Affirmation. MUST begin with "Yes" — the engine scans that sentinel. */
export const verifyLine = (item: WorkedProcedureItem): string => `Yes, ${resolution(item)}`;

/** The model of the correct move, spoken by the tutor in every correction. */
const modelOf = (item: WorkedProcedureItem): string => {
  const c = item.column;
  if (item.kind === 'decide' && item.regroup) {
    const unit = PLACE_UNIT[item.placeAbove as Place];
    return `I can't take ${w(c.bottom)} from ${w(c.topAfterLend)}, so I regroup. `
      + `One ${unit} becomes ten ${c.place}: ${w(item.newAbove)} ${item.placeAbove}, ${w(c.effectiveTop)} ${c.place}.`;
  }
  return `${w(c.effectiveTop)} minus ${w(c.bottom)} is ${w(c.difference)}.`;
};

/**
 * The correction branches for one step, SPECIFIC first and the general fallback
 * LAST (the harness reads the final span as the catch-all). Every line opens
 * with "My turn" and ends on the re-ask.
 */
export const correctionLines = (item: WorkedProcedureItem): {
  forgotDecrement?: string;
  unneededRegroup?: string;
  contrast: string;
  fallback: string;
} => {
  const c = item.column;
  const end = ` ${reAsk(item)}`;
  if (item.kind === 'decide' && item.regroup) {
    const above = item.placeAbove as Place;
    return {
      forgotDecrement:
        `My turn: when you regroup, the ${above} change too. ${cap(w(item.newAbove + 1))} ${above} becomes `
        + `${w(item.newAbove)}: ${w(item.newAbove)} ${above}, ${w(c.effectiveTop)} ${c.place}.${end}`,
      contrast:
        `My turn: not ⟨what they said⟩ — ${w(c.topAfterLend)} minus ${w(c.bottom)}, ${modelOf(item)}${end}`,
      fallback: `My turn: ${w(c.topAfterLend)} minus ${w(c.bottom)}. ${modelOf(item)}${end}`,
    };
  }
  if (item.kind === 'decide') {
    return {
      unneededRegroup:
        `My turn: you can take ${w(c.bottom)} from ${w(c.topAfterLend)}, so you do not regroup. ${cap(modelOf(item))}${end}`,
      ...(c.lent
        ? {
            forgotDecrement:
              `My turn: not ⟨what they said⟩ — this column lent one, so it is ${w(c.topAfterLend)} now, not ${w(c.top)}. `
              + `${cap(modelOf(item))}${end}`,
          }
        : {}),
      contrast: `My turn: not ⟨what they said⟩ — ${modelOf(item)}${end}`,
      fallback: `My turn: ${modelOf(item)}${end}`,
    };
  }
  return {
    contrast: `My turn: not ⟨what they said⟩ — ${modelOf(item)}${end}`,
    fallback: `My turn: ${modelOf(item)}${end}`,
  };
};

// ── The judging contract ─────────────────────────────────────────────────────

const WAIT_FACT = 'You then stay silent while the learner works. ';
const SLOT_RULE =
  'Replace ⟨what they said⟩ with the words they actually said, and never speak the ⟨ ⟩ marks. ';
const CLOSING_LAW =
  'After you affirm, you stop; the application sends the next column, and you never continue into '
  + 'another column or another problem yourself. Never begin any other sentence with the word "Yes" '
  + 'or the words "My turn". Speak nothing beyond these exact lines, and never announce that you are '
  + 'waiting or listening — simply stop speaking.';

const regroupContract = (item: WorkedProcedureItem): string => {
  const c = item.column;
  const above = item.placeAbove as Place;
  const lines = correctionLines(item);
  const flip = c.bottom - c.topAfterLend;
  return (
    WAIT_FACT
    + `The learner is deciding what to do in the ${c.place} column, where the top digit ${w(c.topAfterLend)} `
    + `is smaller than the bottom digit ${w(c.bottom)}. The correct move is to REGROUP — a child may say `
    + `borrow, trade, or take one from the ${above} — so one ${PLACE_UNIT[above]} becomes ten ${c.place}: `
    + `the ${above} become ${w(item.newAbove)} and the ${c.place} become ${w(c.effectiveTop)}. `
    + `A right answer names the regroup move AND both new numbers, in any order and any wording — `
    + `"I can't, so I borrow: ${w(item.newAbove)} ${above} and ${w(c.effectiveTop)} ${c.place}", `
    + `"trade a ${PLACE_UNIT[above]}, it's ${w(c.effectiveTop)} and ${w(item.newAbove)}", `
    + `"regroup, ${w(c.effectiveTop)} and ${w(item.newAbove)}". `
    + `If the answer is right, say exactly: "${verifyLine(item)}" `
    + `If the learner names the regroup and ${w(c.effectiveTop)} but never changes the ${above} — nothing `
    + `about ${w(item.newAbove)} — they forgot to decrement; say exactly: "${lines.forgotDecrement}" `
    + `The signature error is turning the column upside down — "${w(c.bottom)} minus ${w(c.topAfterLend)} `
    + `is ${w(flip)}" — which sounds confident and is wrong. If the learner subtracts without regrouping, `
    + `regroups to a different number, or gives a bare number with no move, say exactly: `
    + `"${lines.contrast}" ${SLOT_RULE}`
    + `If there is no answer, only a filler sound like "um" or "hmm", or the learner says they do not `
    + `know, say exactly: "${lines.fallback}" `
    + CLOSING_LAW
  );
};

const noRegroupContract = (item: WorkedProcedureItem): string => {
  const c = item.column;
  const lines = correctionLines(item);
  const lentNote = c.lent
    ? ` (it was ${w(c.top)} before it lent one to the ${PLACES[c.index - 1]}, and the ${w(c.top)} is crossed out)`
    : '';
  const forgot = c.lent
    ? `If the learner says ${w(c.top - c.bottom)}, they read the crossed-out ${w(c.top)} and forgot this `
      + `column lent one; say exactly: "${lines.forgotDecrement}" `
    : '';
  return (
    WAIT_FACT
    + `The learner is deciding what to do in the ${c.place} column, where the top digit reads `
    + `${w(c.topAfterLend)}${lentNote} and the bottom digit is ${w(c.bottom)}. No regrouping is needed: `
    + `${w(c.topAfterLend)} minus ${w(c.bottom)} is ${w(c.difference)}. A right answer lands on `
    + `${w(c.difference)} — the bare number, the whole column said aloud, or "no regroup, ${w(c.difference)}" — `
    + `right away or after counting back to it. `
    + `If the answer is right, say exactly: "${verifyLine(item)}" `
    + `If the learner regroups here — says borrow, trade, or regroup, or works from ${w(c.topAfterLend + 10)} — `
    + `that is the signature error, regrouping when the column subtracts cleanly; say exactly: `
    + `"${lines.unneededRegroup}" `
    + forgot
    + `If the learner says a different number, say exactly: "${lines.contrast}" ${SLOT_RULE}`
    + `If there is no answer, only a filler sound like "um" or "hmm", or anything that is not a number or `
    + `a move, say exactly: "${lines.fallback}" `
    + CLOSING_LAW
  );
};

const subtractContract = (item: WorkedProcedureItem): string => {
  const c = item.column;
  const lines = correctionLines(item);
  const flip = c.bottom - c.topAfterLend;
  return (
    WAIT_FACT
    + `The learner just regrouped, so the ${c.place} column now reads ${w(c.effectiveTop)} minus `
    + `${w(c.bottom)}. The correct answer is ${w(c.difference)} — the bare number, or the whole fact said `
    + `aloud, right away or after counting back to it. `
    + `If the answer is right, say exactly: "${verifyLine(item)}" `
    + `A different number is always wrong; the commonest is ${w(flip)}, the digits subtracted the wrong `
    + `way round. If the learner says a different number, say exactly: "${lines.contrast}" ${SLOT_RULE}`
    + `If there is no answer, only a filler sound like "um" or "hmm", or anything that is not a number, `
    + `say exactly: "${lines.fallback}" `
    + CLOSING_LAW
  );
};

export const judgingContract = (item: WorkedProcedureItem): string => {
  if (item.kind === 'subtract') return subtractContract(item);
  return item.regroup ? regroupContract(item) : noRegroupContract(item);
};

// ── Cues ─────────────────────────────────────────────────────────────────────

/** One step's ask. The how-to-play rides INSIDE the quoted line on the opening
 *  turn only (SWAP-1); every later ask is the short column signal. */
export const itemCue = (item: WorkedProcedureItem, opts: JudgedCueOptions): string => {
  const how = opts.opening ? HOW_TO_PLAY : '';
  return `[WP_ITEM] Say exactly: "${how}${askLine(item)}" ${judgingContract(item)}`;
};

/** Cap reached: the tutor STATES the step (so the page can carry it), then asks
 *  the next one. The last step of the run closes warmly. */
export const moveOnCue = (
  item: WorkedProcedureItem,
  next: WorkedProcedureItem | null,
  _opts: JudgedCueOptions,
): string => {
  const carry = `Good try. ${item.kind === 'decide' && item.regroup ? `We ${resolution(item)}` : cap(resolution(item))}`;
  if (!next) {
    return `[WP_MOVE_ON] Say exactly: "${carry} That's the end of our subtraction work for today." Then stop — the activity is over.`;
  }
  return `[WP_MOVE_ON] Say exactly: "${carry} ${askLine(next)}" ${judgingContract(next)}`;
};

export const completeCue = (): string =>
  '[WP_COMPLETE] Say exactly: "That\'s the end of our subtraction work. You did every column yourself. '
  + 'Great work today!" Then stop — the activity is over.';

/** Tap-to-hear: the PROBLEM, never a column\'s working or a difference. */
export const pronounceCue = (item: WorkedProcedureItem): string =>
  `[WP_HEAR] Say exactly: "${cap(item.problemSpoken)}." Then stop — say nothing else.`;

/** RUNTIME STATE, stimulus side only: the printed problem and which column is
 *  open. Never a difference, never the regrouped digits. Keys stay in lockstep
 *  with `contextKeys` on the catalog entry. */
export const contextFor = (item: WorkedProcedureItem): Record<string, string> => ({
  challengeType: item.challengeType,
  problem: item.problemDisplay,
  column: item.place,
  supportTier: item.supportTier ?? 'medium',
});

// ── Gates the generator and the harness share ────────────────────────────────

/**
 * The ask must not say the step's answer. Regroup steps guard the new ones
 * number ("thirteen"); every other step guards its difference. The problem
 * statement is exempt on the opening ask (a minuend of thirteen is a legal
 * thing to say), and the `easy` column phrase is exempt by design.
 */
export const leakTokensFor = (item: WorkedProcedureItem): string[] =>
  item.kind === 'decide' && item.regroup
    ? [w(item.column.effectiveTop)]
    : [w(item.column.difference)];

export const leakExemptSpansFor = (item: WorkedProcedureItem): string[] => [
  cap(item.problemSpoken),
  ...(statesDigits(item) ? [columnPhrase(item)] : []),
];

// ── The cue surface — exported once, spread by the component and the harness ─

export const diWorkedProcedurePackBase = (
  items: WorkedProcedureItem[],
): JudgedCueSurface<WorkedProcedureItem> => ({
  primitiveType: 'di-worked-procedure',
  activityLine: 'live direct instruction talk-through subtraction, one column at a time',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor,
});
