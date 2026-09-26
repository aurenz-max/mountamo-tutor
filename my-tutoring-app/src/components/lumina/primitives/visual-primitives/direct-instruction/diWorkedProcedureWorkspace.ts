/**
 * di-worked-procedure on the shared tutor/JEV teaching workspace (rollout C6), through `DiTeachingStage`.
 * A multi-digit subtraction is printed in columns and worked OUT LOUD one step at a time: a column
 * decision (regroup, or subtract straight away) and, after a regroup, the column's difference. Each step
 * is one spoken answer. Pure: the component and the journey read the same assignment and scene.
 *
 * What the scripted judging contract carried that is task structure stays in the key: a regroup is right
 * only with BOTH new numbers (naming the regroup without taking one from the place above is the
 * forgot-to-decrement miss); the upside-down column ("eight minus three") is the signature error; a column
 * that subtracts cleanly must not regroup; after a lend the crossed-out digit is no longer the top. The
 * correction branches, sentinel lines and move-on carry were control protocol and are gone: a wrong answer
 * no longer closes a step, so the page only ever writes what the child earned.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { numberWord as w, PLACES, type Place } from './diWorkedProcedurePlan';
import { itemsFromProblems, withWorkedProcedureAction, type DiWorkedProcedureData, type WorkedProcedureItem } from './diWorkedProcedureScript';

/** The steps a payload asks, built by the one builder the generator and the drive harness use. */
export const workedProcedureItems = (data: Pick<DiWorkedProcedureData, 'problems'>): WorkedProcedureItem[] =>
  itemsFromProblems(data.problems ?? []).items;

/** The ask: the column move alone, never the answer. Not the pack's `askLine`, which opens a problem's first
 *  step with the whole problem ("Sixty-nine minus fifty-four."): with the whole problem in the task or the
 *  facts, the observer read a column's answer as partial work on the subtraction and refused a clear credit
 *  (3/3 on replay each). The child reads the problem off the page. */
export const workedProcedureAskFor = (item: WorkedProcedureItem): string =>
  withWorkedProcedureAction(item).actionContract.instruction;

export function workedProcedureKey(item: WorkedProcedureItem): string {
  const c = item.column;
  const flip = `"${w(c.bottom)} minus ${w(c.topAfterLend)}"`;
  if (item.kind === 'decide' && item.regroup) {
    const above = item.placeAbove as Place;
    return `Regroup (borrow, trade, or take one from the ${above}) AND both new numbers, in any order or wording: `
      + `${w(item.newAbove)} ${above} and ${w(c.effectiveTop)} ${c.place}. Naming the regroup and `
      + `${w(c.effectiveTop)} with nothing about ${w(item.newAbove)} ${above} is not yet the answer (the ${above} were `
      + `never changed). Turning the column upside down, ${flip}, is the signature error.`;
  }
  const answer = `"${w(c.difference)}": the bare number, or the whole fact ${w(c.effectiveTop)} minus ${w(c.bottom)} said aloud, `
    + 'straight away or after counting back to it.';
  if (item.kind === 'subtract') {
    return `${answer} Any other number is wrong; ${w(c.bottom - c.topAfterLend)} is the digits subtracted the wrong way round.`;
  }
  const lent = c.lent ? ` Saying ${w(c.top - c.bottom)} reads the crossed-out ${w(c.top)}: this column lent one to the `
    + `${PLACES[c.index - 1]}.` : '';
  return `${answer} No regrouping is needed; regrouping here (working from ${w(c.topAfterLend + 10)}) is the signature `
    + `error.${lent}`;
}

export function workedProcedureAssignment(item: WorkedProcedureItem): TeachingAssignment {
  return { id: item.id, task: workedProcedureAskFor(item), response: 'speech', expectedAnswer: workedProcedureKey(item) };
}

/** What the page shows: the problem in columns, the current column ringed, and the marks already credited on
 *  this problem. The difference being asked is never on it. The label names no number: with the whole problem
 *  in it ("92 − 75"), the observer refused a clear credit for the tens column ("eight minus seven is one"),
 *  3/3 on replay (count-fact rule). */
export function workedProcedureScene(item: WorkedProcedureItem): WorkspaceScene {
  const c = item.column;
  return {
    objects: [{ id: 'problem', selected: false, group: 'assignment target',
      label: `the subtraction printed in columns, with the ${c.place} column ringed` }],
    facts: { kind: item.challengeType, step: item.kind === 'decide' ? 'decide what to do in this column' : 'subtract this column',
      column: c.place, ...(item.supportTier ? { supportTier: item.supportTier } : {}),
      constraints: 'The learner says the move or the number aloud; the page writes each step only after it is credited. '
        + (c.lent ? `The top digit of the ${c.place} column is crossed out: it lent one to the ${PLACES[c.index - 1]}. ` : '')
        + (item.kind === 'subtract' ? `The ${c.place} column was just regrouped. ` : '') },
  };
}

/** The journey's answers: the pack's canonical utterance, or the column's signature miss. */
export function diWorkedProcedureHarnessAnswers(item: WorkedProcedureItem): { correct: string; plainWrong: string } {
  const c = item.column;
  if (item.kind === 'decide' && item.regroup) {
    return { correct: item.answerSpoken, plainWrong: `${w(c.bottom)} minus ${w(c.topAfterLend)} is ${w(c.bottom - c.topAfterLend)}` };
  }
  // The whole fact, without the canonical "no regrouping, …" opener: synthetic audio heard it as "Now
  // regrouping", which is this column's signature error (C6 smoke, 2026-09-26).
  return { correct: `${w(c.effectiveTop)} minus ${w(c.bottom)} is ${w(c.difference)}`,
    plainWrong: w(c.difference === 9 ? 8 : c.difference + 1) };
}

/** A payload the stage can ask: at least one problem, and every problem builds its steps. */
export function workedProcedureDataValid(data: Pick<DiWorkedProcedureData, 'problems'>): boolean {
  if (!Array.isArray(data?.problems) || !data.problems.length) return false;
  const built = itemsFromProblems(data.problems);
  return built.dropped === 0 && built.items.length > 0;
}

