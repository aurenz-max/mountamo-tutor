import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

/** One checked response, recorded as it happened; never inferred afterwards. */
export interface FractionBarResponse {
  challengeId: string;
  numerator: number;
  denominator: number;
  phase: 'numerator' | 'denominator' | 'build';
  expected: number;
  /** Chosen number, or the shaded part count for build. */
  selected: number;
  attempt: number;
  hintsBefore: number;
  choices?: number[];
}

const question = (r: FractionBarResponse) => r.phase === 'build'
  ? `Fraction ${r.numerator}/${r.denominator}: shade parts of a bar divided into ${r.denominator} equal parts.`
  : `Fraction ${r.numerator}/${r.denominator}: which number is the ${r.phase}? Choices: ${(r.choices ?? []).join(', ')}.`;
const answer = (r: FractionBarResponse, value: number) => r.phase === 'build' ? `shaded ${value} of ${r.denominator} parts` : String(value);

/** Factual evidence for the shared distiller. Every question repeats until it is
 * answered correctly, so errors appear only as corrected responses; the
 * first-response score is per fraction (all three questions right first try). */
export function fractionBarDiagnosisEvidence(
  challengeIds: readonly string[], responses: readonly FractionBarResponse[],
  challengeType: string, supportTier?: string,
): DiagnosisEvidence | undefined {
  const wrong = responses.filter(r => r.selected !== r.expected);
  if (!wrong.length || !challengeIds.length) return undefined;
  const firstTry = challengeIds.filter(id => {
    const own = responses.filter(r => r.challengeId === id);
    return (['numerator', 'denominator', 'build'] as const).every(phase =>
      own.some(r => r.phase === phase && r.attempt === 1 && r.selected === r.expected));
  }).length;
  return {
    firstResponseScore: Math.round((firstTry / challengeIds.length) * 100),
    challengeSummary: `Fraction bar (${challengeType}): for each of ${challengeIds.length} fractions the student chooses the numerator from four numbers, then the denominator from four numbers, then shades that many equal parts on a bar. A question repeats until answered correctly.`,
    expected: 'Choose the top number as the numerator and the bottom number as the denominator, then shade as many of the bar\'s equal parts as the numerator.',
    observed: wrong.map(r => `${r.numerator}/${r.denominator} ${r.phase}, attempt ${r.attempt}: ${answer(r, r.selected)}`).join('; ').slice(0, 2000),
    phases: wrong.slice(-12).map(r => ({
      itemId: r.challengeId, phase: r.phase, challenge: question(r),
      expected: answer(r, r.expected), observed: answer(r, r.selected),
      support: `Attempt ${r.attempt} on this question; ${r.hintsBefore} hint(s) viewed on this fraction before responding; support tier ${supportTier ?? 'none'}; feedback followed every earlier response in the session.`,
    })),
  };
}
