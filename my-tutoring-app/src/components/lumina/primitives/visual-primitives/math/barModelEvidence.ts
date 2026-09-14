import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';
import type { BarModelChallenge } from './BarModel';

export interface BarModelSelectionRecord {
  challengeId: string;
  /** Every option the learner tapped, in order; the last one is the accepted answer when solved. */
  selectedOptions?: number[];
}

/**
 * Factual picture_graph evidence for the shared distiller: what each graph showed, the
 * choices offered and the selections in order. No interpretation of why a choice was made.
 */
export function buildPictureGraphEvidence(
  challenges: readonly BarModelChallenge[],
  records: readonly BarModelSelectionRecord[],
): DiagnosisEvidence | undefined {
  const graphs = challenges.flatMap((c) => {
    const row = c.values[c.targetBarIndex ?? -1];
    const iconValue = c.scale?.iconValue ?? 1;
    const selections = records.find((r) => r.challengeId === c.id)?.selectedOptions ?? [];
    if (c.evalMode !== 'picture_graph' || !row || iconValue < 2 || typeof c.expectedValue !== 'number' || !selections.length) return [];
    return [{ c, row, iconValue, selections, firstCorrect: selections[0] === c.expectedValue }];
  });
  const phases = graphs.filter((g) => !g.firstCorrect).map(({ c, row, iconValue, selections }) => ({
    itemId: c.id,
    phase: 'picture_graph',
    challenge: `${c.prompt} Key: each ${c.scale?.iconEmoji ?? 'icon'} stands for ${iconValue}. `
      + `Row "${row.label}" shows ${row.value / iconValue} icons. Choices: ${(c.options ?? []).join(', ')}.`,
    expected: String(c.expectedValue),
    observed: `Selections in order: ${selections.join(', ')}${selections.at(-1) === c.expectedValue ? '' : ' (not solved)'}`,
    support: `${c.showTargetHighlight ? 'The named row was highlighted.' : 'No row was highlighted.'} `
      + 'After an incorrect choice the hint was shown and the learner could choose again.',
  }));
  if (!phases.length) return undefined;
  const [first, ...rest] = phases;
  return {
    phases,
    challengeSummary: `Picture graph reading: ${graphs.length} graphs, each asking for the total of one named row given `
      + `a key where one icon stands for more than one item. ${graphs.length - phases.length} of ${graphs.length} `
      + 'were answered correctly on the first choice.',
    expected: `${first.challenge} Correct total: ${first.expected}.`,
    observed: first.observed,
    priorAttempts: rest.map((p) => ({ challenge: p.challenge, observed: p.observed })),
    // picture_graph advances only after a correct choice, so the canonical score hides first-choice errors.
    firstResponseScore: Math.round((100 * (graphs.length - phases.length)) / graphs.length),
  };
}
