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
import { numberMisses, offByMisses, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
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

/** What a wrong spoken step shows (handoff 20 Part B). */
export type SpokenProcedureMiss = OffByMiss | 'upside_down_column' | 'no_decrement' | 'said_no_regroup' | 'regrouped_needlessly'
  | 'read_crossed_out';

/**
 * A spoken step's known wrong answers, in precedence order, for the `spoken_miss` observer: the ringed column's
 * digits stated first, then the learner's move or number. Concrete per column, never a cause.
 */
export function workedProcedureSpokenMisses(item: WorkedProcedureItem): KnownMiss[] {
  const c = item.column;
  const col = `The ${c.place} column has ${c.topAfterLend} on top${c.lent ? ` (the ${c.top} is crossed out)` : ''} and ${c.bottom} below`;
  const flip = `${w(c.bottom)} minus ${w(c.topAfterLend)}`;
  if (item.kind === 'decide' && item.regroup) {
    const above = item.placeAbove as Place;
    const fact = `${col}, so it must regroup: ${item.newAbove} ${above} and ${c.effectiveTop} ${c.place}.`;
    return [
      { id: 'upside_down_column', pattern: `${fact} The learner subtracts the top from the bottom instead, "${flip}".`,
        examples: [`${flip} is ${w(c.bottom - c.topAfterLend)}`] },
      { id: 'no_decrement', pattern: `${fact} The learner says to regroup and names ${c.effectiveTop} ${c.place}, but says nothing about the ${above} becoming ${item.newAbove}.`,
        examples: [`regroup, ${w(c.effectiveTop)} ${c.place}`] },
      { id: 'said_no_regroup', pattern: `${fact} The learner says no regrouping is needed or subtracts straight away.`, examples: ['no regrouping'] },
    ];
  }
  const fact = `${col}; ${c.effectiveTop} minus ${c.bottom} is ${c.difference}.`;
  if (item.kind === 'subtract') {
    return [...numberMisses(c.difference, [{ id: 'upside_down_column', value: c.bottom - c.topAfterLend,
      pattern: v => `${fact} The learner's answer is ${v}, the ${c.bottom} below minus the ${c.topAfterLend} on top.` }]),
      ...offByMisses(c.difference, `the difference ${c.difference}`)];
  }
  return [
    { id: 'regrouped_needlessly', pattern: `${fact} No regrouping is needed; the learner says to regroup or works from ${c.topAfterLend + 10}.`,
      examples: ['regroup', `${w(c.topAfterLend + 10)} minus ${w(c.bottom)}`] },
    ...numberMisses(c.difference, [{ id: 'read_crossed_out', value: c.lent ? c.top - c.bottom : undefined,
      pattern: v => `${fact} The learner's answer is ${v}, subtracting from the crossed-out ${c.top}.` }]),
    ...offByMisses(c.difference, `the difference ${c.difference}`),
  ];
}

export function workedProcedureAssignment(item: WorkedProcedureItem): TeachingAssignment {
  const misses = workedProcedureSpokenMisses(item);
  return { id: item.id, task: workedProcedureAskFor(item), response: 'speech', expectedAnswer: workedProcedureKey(item),
    ...(misses.length ? { misses } : {}) };
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
      column: c.place,
      // DI's model is a DIFFERENT problem, never this one (ruling 2026-10-02): easy starts with its card on screen; no tier
      // is medium in this pack.
      support: item.supportTier === 'easy'
        ? 'the model card of a different subtraction starts on screen: walk every column of it as your turn, then ask this column. Never work this problem'
        : item.supportTier === 'hard' ? 'work it cold: model nothing before the learner tries, and never say a step answer of this problem'
          : 'the learner tries first; after a miss, model a different subtraction with the model_problem lever, never this one',
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

