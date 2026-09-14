import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';
import { isSnappedPlacementExact } from './numberLineGrading';

/** One Check press on a show_jump challenge, as the learner performed it.
 *  Facts only: what was asked, where each landing was placed, and the support
 *  on screen. The distiller interprets; this module never names an error type. */
export interface JumpResponse {
  challengeId: string;
  /** 1-based try number within the challenge. */
  attempt: number;
  operations: { type: 'add' | 'subtract'; startValue: number; changeValue: number }[];
  expectedLandings: number[];
  placedLandings: number[];
  correct: boolean;
  arcShown: boolean;
}

export function jumpResponseFor(
  challengeId: string, attempt: number,
  operations: readonly { type: 'add' | 'subtract'; startValue: number; changeValue: number; showJumpArc?: boolean }[],
  placedLandings: readonly number[], snapPrecision: number,
): JumpResponse {
  const expectedLandings = operations.map(op => op.type === 'add' ? op.startValue + op.changeValue : op.startValue - op.changeValue);
  return {
    challengeId, attempt,
    operations: operations.map(({ type, startValue, changeValue }) => ({ type, startValue, changeValue })),
    expectedLandings, placedLandings: [...placedLandings],
    correct: expectedLandings.length > 0 && expectedLandings.length === placedLandings.length
      && expectedLandings.every((e, i) => isSnappedPlacementExact(placedLandings[i], e, snapPrecision)),
    arcShown: operations.some(op => op.showJumpArc === true),
  };
}

const spaces = (n: number) => `${n} space${n === 1 ? '' : 's'}`;
const askText = (r: JumpResponse) => r.operations.map((op, i) =>
  `${i === 0 ? `Start at ${op.startValue} and` : 'then'} ${op.type === 'add' ? 'add' : 'subtract'} ${op.changeValue}`
  + ` (${spaces(op.changeValue)} ${op.type === 'add' ? 'right' : 'left'})`).join(', ');
const expectedText = (r: JumpResponse) => r.expectedLandings.map((v, i) =>
  r.expectedLandings.length > 1 ? `landing ${i + 1} at ${v}` : `landing at ${v}`).join('; ');
const observedText = (r: JumpResponse) => r.operations.map((op, i) => {
  const placed = r.placedLandings[i];
  if (placed === undefined) return `no landing ${i + 1} placed`;
  const moved = placed - op.startValue;
  const where = moved === 0 ? 'on the start itself' : `${spaces(Math.abs(moved))} ${moved > 0 ? 'right' : 'left'} of ${op.startValue}`;
  return `${r.operations.length > 1 ? `landing ${i + 1}` : 'landing'} placed at ${placed}, ${where}`;
}).join('; ');

/** Structured evidence for the shared distiller, or undefined when every Check
 *  was correct. Retried challenges keep each try; a later correct try does not
 *  erase an earlier incorrect one, and it is not a claim of independence. */
export function buildJumpDiagnosisEvidence(
  responses: readonly JumpResponse[], range: { min: number; max: number },
): DiagnosisEvidence | undefined {
  const wrong = responses.filter(r => !r.correct);
  if (!wrong.length) return undefined;
  const last = wrong[wrong.length - 1];
  return {
    challengeSummary: `Show additions and subtractions as hops on a whole-number line from ${range.min} to ${range.max}: start at the marked number and place where the hops land. ${askText(last)}.`,
    expected: expectedText(last),
    observed: observedText(last),
    phases: responses.slice(-12).map(r => ({
      itemId: `${r.challengeId}#try${r.attempt}`,
      phase: r.operations.length > 1 ? 'two chained jumps' : 'single jump',
      challenge: askText(r),
      expected: expectedText(r),
      observed: `${r.correct ? 'Correct' : 'Incorrect'}: ${observedText(r)}`,
      support: `${r.arcShown ? 'Jump arc and hop size drawn on the line' : 'Start marked; no jump arc drawn'}; `
        + (r.attempt > 1 ? `try ${r.attempt}, after "not quite" feedback and the written hint` : 'first try'),
    })),
    priorAttempts: wrong.slice(0, -1).slice(-4).map(r => ({ challenge: askText(r), observed: observedText(r) })),
  };
}

/** Percent of jump challenges whose FIRST Check was correct; undefined if none were checked. */
export function jumpFirstResponseScore(responses: readonly JumpResponse[]): number | undefined {
  const firsts = responses.filter(r => r.attempt === 1);
  return firsts.length ? Math.round((firsts.filter(r => r.correct).length / firsts.length) * 100) : undefined;
}
