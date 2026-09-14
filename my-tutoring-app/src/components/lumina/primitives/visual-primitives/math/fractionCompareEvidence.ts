import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

export interface FractionCompareResponse {
  itemId: string;
  left: { numerator: number; denominator: number };
  right: { numerator: number; denominator: number };
  chosen: 'left' | 'right' | 'equal';
  correct: 'left' | 'right' | 'equal';
  /** 1 = first response to this pair; later responses follow on-screen "look again" feedback. */
  attempt: number;
  labelsShown: boolean;
  hintShown: boolean;
}

const text = (f: FractionCompareResponse['left']) => `${f.numerator}/${f.denominator}`;
const challenge = (r: FractionCompareResponse) =>
  `Compare ${text(r.left)} (left circle) and ${text(r.right)} (right circle): which is larger, or are they equal?`;
const said = (r: FractionCompareResponse, choice: FractionCompareResponse['chosen']) =>
  choice === 'equal' ? `They are equal` : `${text(choice === 'left' ? r.left : r.right)} (${choice} circle) is larger`;

/** Factual packet for the shared distiller: every pair's first response, the
 * incorrect history, and the first-response score. Never names a misconception.
 * Undefined when no response was incorrect. */
export function buildFractionCompareEvidence(responses: readonly FractionCompareResponse[]): DiagnosisEvidence | undefined {
  const wrong = responses.filter(r => r.chosen !== r.correct);
  if (!wrong.length) return undefined;
  const firsts = responses.filter(r => r.attempt === 1);
  const headline = wrong.filter(r => r.attempt === 1).at(-1) ?? wrong.at(-1)!;
  return {
    challengeSummary: 'Compare two fractions shown as shaded slices of two equal-sized circles, each cut into equal slices, and choose which is larger or say they are equal.',
    expected: `${challenge(headline)} Correct: ${said(headline, headline.correct)}.`,
    observed: `Chose: ${said(headline, headline.chosen)}.`,
    priorAttempts: wrong.filter(r => r !== headline).map(r => ({ challenge: challenge(r), observed: `Chose: ${said(r, r.chosen)} (response ${r.attempt})` })),
    phases: firsts.map(r => ({
      itemId: r.itemId, phase: 'compare', challenge: challenge(r),
      expected: said(r, r.correct), observed: said(r, r.chosen),
      support: `First response, before any feedback; fraction labels ${r.labelsShown ? 'shown' : 'hidden'}.`,
    })),
    firstResponseScore: firsts.length ? Math.round((firsts.filter(r => r.chosen === r.correct).length / firsts.length) * 100) : undefined,
  };
}
