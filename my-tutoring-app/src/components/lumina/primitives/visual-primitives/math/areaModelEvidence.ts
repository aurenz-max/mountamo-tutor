import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

/** One checked entry, recorded as it happened; never inferred afterwards. */
export interface AreaModelResponse {
  challengeId: string;
  step: 'cell' | 'sum' | 'perimeter' | 'dimensions';
  /** 1-based try on this step (per cell for cell entries). */
  attempt: number;
  factor1Parts: number[];
  factor2Parts: number[];
  /** [row, col] of a cell entry: row part from factor2Parts, column part from factor1Parts. */
  cell?: [number, number];
  expected: string;
  entered: string;
  correct: boolean;
  /** Cell pre-labelled with its two parts, or the perimeter side sum written out. */
  scaffoldShown: boolean;
  hintsBefore: number;
}

const total = (parts: readonly number[]) => parts.reduce((s, v) => s + v, 0);
const factorText = (parts: readonly number[]) => (parts.length > 1 ? `(${parts.join(' + ')})` : String(parts[0]));
const modelText = (r: AreaModelResponse) => `${factorText(r.factor1Parts)} × ${factorText(r.factor2Parts)}`;
const cellParts = (r: AreaModelResponse) => r.cell ? [r.factor1Parts[r.cell[1]], r.factor2Parts[r.cell[0]]] : [];
const products = (r: AreaModelResponse) => r.factor2Parts.map(row => r.factor1Parts.map(col => col * row));

function question(r: AreaModelResponse): string {
  switch (r.step) {
    case 'cell': return `Area model ${modelText(r)}: the cell in column ${cellParts(r)[0]} and row ${cellParts(r)[1]}.`;
    case 'sum': return `Area model ${modelText(r)}: add the cell products ${products(r).flat().join(' + ')}.`;
    case 'perimeter': return `Perimeter of a rectangle with sides ${total(r.factor1Parts)} and ${total(r.factor2Parts)}.`;
    case 'dimensions': return `Grid of cell products ${products(r).map(row => row.join(', ')).join(' / ')}: enter the column parts and the row parts.`;
  }
}

function scaffold(r: AreaModelResponse): string {
  if (r.step === 'cell') {
    const [col, row] = cellParts(r);
    return r.scaffoldShown ? `cell labelled "${col} × ${row}"` : `cell not labelled; column header ${col} and row header ${row} shown`;
  }
  if (r.step === 'perimeter') return r.scaffoldShown ? 'side sum written out on screen' : 'no side sum written out';
  return r.step === 'sum' ? 'correct cell products listed above the sum' : 'cell products shown, headers blank';
}

const label = (r: AreaModelResponse) => r.step === 'cell' ? `${cellParts(r).join(' × ')} cell`
  : r.step === 'sum' ? `sum for ${modelText(r)}` : r.step === 'perimeter' ? `perimeter ${total(r.factor1Parts)} by ${total(r.factor2Parts)}` : `parts for ${products(r).flat().join(', ')}`;

const EXPECTED: Record<string, string> = {
  perimeter: 'The perimeter is the total of all four sides: length + width + length + width.',
  factor: 'Enter the column and row parts whose products give every cell.',
};

/** Factual evidence for the shared distiller, or undefined when every entry was right first time.
 *  Entries repeat until correct, so errors appear only as corrected tries; a model counts toward the
 *  first-response score only when none of its entries was wrong. */
export function areaModelDiagnosisEvidence(
  challengeIds: readonly string[], responses: readonly AreaModelResponse[],
  challengeType: string, supportTier?: string,
): DiagnosisEvidence | undefined {
  const wrong = responses.filter(r => !r.correct);
  if (!wrong.length || !challengeIds.length) return undefined;
  const clean = challengeIds.filter(id => responses.some(r => r.challengeId === id) && !wrong.some(r => r.challengeId === id)).length;
  // The store keeps 12 phases. Keep every wrong entry first, then first-try entries from the same
  // models (which cells were right), then the corrected retries; emit them in the order they happened.
  const withErrors = new Set(wrong.map(r => r.challengeId));
  const sameModels = responses.filter(r => withErrors.has(r.challengeId));
  const kept = new Set([...wrong.slice(-12), ...sameModels.filter(r => r.correct && r.attempt === 1), ...sameModels.filter(r => r.correct && r.attempt > 1)].slice(0, 12));
  return {
    firstResponseScore: Math.round((clean / challengeIds.length) * 100),
    challengeSummary: challengeType === 'perimeter'
      ? `Area model (perimeter): ${challengeIds.length} rectangles with labelled sides; the student types each perimeter, retrying until correct. ${clean} of ${challengeIds.length} were right first time.`
      : challengeType === 'factor'
        ? `Area model (factor): ${challengeIds.length} grids show every cell product; the student types the column and row parts, retrying until correct. ${clean} of ${challengeIds.length} were right first time.`
        : `Area model (${challengeType}): ${challengeIds.length} multiplications, each factor already split into place-value parts on the grid headers. The student types every cell product, then the sum of the cells; each entry repeats until correct. ${clean} of ${challengeIds.length} models had every entry right first time.`,
    expected: EXPECTED[challengeType] ?? 'Each cell equals its column part times its row part; the product is the sum of all cells.',
    observed: wrong.map(r => `${label(r)}, try ${r.attempt}: ${r.entered}`).join('; ').slice(0, 2000),
    phases: sameModels.filter(r => kept.has(r)).map(r => ({
      itemId: r.challengeId, phase: r.step, challenge: question(r), expected: r.expected,
      observed: `${r.correct ? 'Correct' : 'Incorrect'}: entered ${r.entered}`,
      support: `Try ${r.attempt}; ${scaffold(r)}; ${r.hintsBefore} help panel opening(s) on this model; support tier ${supportTier ?? 'none'}.`,
    })),
  };
}
