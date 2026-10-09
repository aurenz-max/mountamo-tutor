/**
 * Area model on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, row C12).
 *
 * Pure: the component and any probe read the same assignment and scene. Every answer is typed on the screen and
 * checked by the activity's own check, so the tutor is never handed a cell product, the total, the perimeter or the
 * parts the factor mode asks for. A forward item (build_model, find_area, multiply) has two steps: each cell, then
 * the sum. A right cell is kept and is not a commit; a wrong cell, and the sum either way, commit.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { AreaModelChallenge, AreaModelChallengeType } from './AreaModel';

const sum = (parts: readonly number[]) => parts.reduce((s, v) => s + v, 0);
const factorText = (parts: readonly number[]) => (parts.length > 1 ? `(${parts.join(' + ')})` : String(parts[0]));
export const modelText = (c: Pick<AreaModelChallenge, 'factor1Parts' | 'factor2Parts'>) =>
  `${factorText(c.factor1Parts)} × ${factorText(c.factor2Parts)}`;
/** Cell products, row by row: row parts come from factor2Parts, column parts from factor1Parts. */
export const cellProducts = (c: Pick<AreaModelChallenge, 'factor1Parts' | 'factor2Parts'>) =>
  c.factor2Parts.map(row => c.factor1Parts.map(col => col * row));
export const isForward = (mode: AreaModelChallengeType) => mode !== 'perimeter' && mode !== 'factor';

export function workspaceTask(c: AreaModelChallenge, mode: AreaModelChallengeType): string {
  const w = sum(c.factor1Parts), h = sum(c.factor2Parts);
  if (mode === 'perimeter') return `Find the perimeter of a rectangle with sides ${w} and ${h}.`;
  if (mode === 'factor') return `Find the column parts and the row parts whose products make every cell. The total area is ${w * h}.`;
  return `Find ${modelText(c)} with the area model: multiply each cell's column part by its row part, then add the cell products.`;
}

/** The task for an item, its mode read from the item (the generator pins one mode per session). */
export const workspaceAssignmentFor = (mode: AreaModelChallengeType) =>
  (c: AreaModelChallenge): TeachingAssignment => ({ id: c.id, task: workspaceTask(c, mode), response: 'gesture' });

/** One checked entry: a cell, the sum of the cells, the perimeter, or the parts. */
export type AreaCheck =
  | { step: 'cell'; row: number; col: number; entered: string }
  | { step: 'sum'; entered: string }
  | { step: 'perimeter'; entered: string }
  | { step: 'dimensions'; top: readonly string[]; left: readonly string[] };

/** What is on screen of the learner's work, beside what the item draws. */
export interface AreaView {
  /** Each cell's last checked entry, keyed "row,col". */
  cells: Readonly<Record<string, { entered: string; correct: boolean }>>;
  sumInput: string;
  perimeterInput: string;
  factorTop: readonly string[];
  factorLeft: readonly string[];
  /** Each cell shows its two parts (`showCellEquations`, withdrawn at the hard tier). */
  cellsLabelled: boolean;
  /** The perimeter's side sum is written out (`showPerimeterExpansion`, withdrawn at the hard tier). */
  sideSumShown: boolean;
  /** A wrong check still on screen, in the learner's terms, until Try again clears it. */
  lastWrong: string | null;
}

export const EMPTY_AREA_VIEW: AreaView = { cells: {}, sumInput: '', perimeterInput: '', factorTop: [], factorLeft: [],
  cellsLabelled: true, sideSumShown: true, lastWrong: null };

const place = (row: number, col: number) => `row ${row + 1}, column ${col + 1}`;

/** The learner's work in their own terms, never the key. */
export function describeAreaCheck(c: AreaModelChallenge, check: AreaCheck, labelled: boolean): string {
  switch (check.step) {
    case 'cell': {
      const label = labelled ? ` (labelled ${c.factor1Parts[check.col]} × ${c.factor2Parts[check.row]})` : '';
      return `Typed ${check.entered.trim() || 'nothing'} in the cell in ${place(check.row, check.col)}${label}`;
    }
    case 'sum': return `Typed ${check.entered.trim() || 'nothing'} as the sum of the cell products`;
    case 'perimeter': return `Typed ${check.entered.trim() || 'nothing'} as the perimeter`;
    default: return `Typed column parts ${check.top.map(v => v.trim() || '?').join(', ')} and row parts ${check.left.map(v => v.trim() || '?').join(', ')}`;
  }
}

/** Whether typed parts make every cell: any parts that do are right, not only the generator's split. */
export function partsFit(c: AreaModelChallenge, top: readonly string[], left: readonly string[]): boolean {
  if (top.length !== c.factor1Parts.length || left.length !== c.factor2Parts.length) return false;
  const t = top.map(v => parseInt(v, 10)), l = left.map(v => parseInt(v, 10));
  if ([...t, ...l].some(n => !Number.isInteger(n) || n <= 0)) return false;
  return cellProducts(c).every((row, r) => row.every((p, k) => t[k] * l[r] === p));
}

/** Whether a check is right, by the activity's own rule. */
export function areaCheckCorrect(c: AreaModelChallenge, check: AreaCheck): boolean {
  const n = check.step === 'dimensions' ? NaN : parseInt(check.entered, 10);
  switch (check.step) {
    case 'cell': return n === c.factor1Parts[check.col] * c.factor2Parts[check.row];
    case 'sum': return n === sum(c.factor1Parts) * sum(c.factor2Parts);
    case 'perimeter': return n === 2 * (sum(c.factor1Parts) + sum(c.factor2Parts));
    default: return partsFit(c, check.top, check.left);
  }
}

/**
 * What a wrong entry shows (`TeachingAttempt.miss`, handoff 20), from the entry the check reads. Only the observable
 * pattern, drawn from the catalog's commonStruggles (wrong partial product, place-value errors) and the perimeter
 * remediation (adding only two sides, area for perimeter):
 * - a cell: `added_not_multiplied` (the two parts added), `dropped_zeros` / `extra_zeros` (the product with a power of
 *   ten too few or too many), `one_group_off` (one column part or one row part away), `wrong_product`;
 * - the sum: `left_out_part` (the total less one cell), `carry_slip` (off by 10, 100 or 1000), `sum_off`;
 * - the perimeter: `gave_area` (length times width), `two_sides_only` (length plus width), `three_sides`,
 *   `perimeter_off`;
 * - the parts: `swapped` (the column parts typed as the row parts and back), `one_part_wrong`, `parts_wrong`.
 */
export type AreaModelMiss = 'added_not_multiplied' | 'dropped_zeros' | 'extra_zeros' | 'one_group_off' | 'wrong_product'
  | 'left_out_part' | 'carry_slip' | 'sum_off'
  | 'gave_area' | 'two_sides_only' | 'three_sides' | 'perimeter_off'
  | 'swapped' | 'one_part_wrong' | 'parts_wrong';

export const CELL_MISSES: readonly AreaModelMiss[] = ['added_not_multiplied', 'dropped_zeros', 'extra_zeros', 'one_group_off', 'wrong_product'];
export const SUM_MISSES: readonly AreaModelMiss[] = ['left_out_part', 'carry_slip', 'sum_off'];
export const PERIMETER_MISSES: readonly AreaModelMiss[] = ['gave_area', 'two_sides_only', 'three_sides', 'perimeter_off'];
export const FACTOR_MISSES: readonly AreaModelMiss[] = ['swapped', 'one_part_wrong', 'parts_wrong'];

const powerOfTen = (n: number) => Number.isInteger(n) && n >= 10 && /^10+$/.test(String(n));

export function areaMiss(c: AreaModelChallenge | null, check: AreaCheck): AreaModelMiss | undefined {
  if (!c || areaCheckCorrect(c, check)) return undefined;
  if (check.step === 'dimensions') {
    const same = (typed: readonly string[], key: readonly number[]) => typed.length === key.length && typed.every((v, i) => parseInt(v, 10) === key[i]);
    if (c.factor1Parts.join() !== c.factor2Parts.join() && same(check.top, c.factor2Parts) && same(check.left, c.factor1Parts)) return 'swapped';
    const off = [...check.top.map((v, i) => parseInt(v, 10) !== c.factor1Parts[i]), ...check.left.map((v, i) => parseInt(v, 10) !== c.factor2Parts[i])]
      .filter(Boolean).length;
    return off === 1 ? 'one_part_wrong' : 'parts_wrong';
  }
  const n = parseInt(check.entered, 10);
  if (!Number.isInteger(n)) return check.step === 'cell' ? 'wrong_product' : check.step === 'sum' ? 'sum_off' : 'perimeter_off';
  const w = sum(c.factor1Parts), h = sum(c.factor2Parts);
  if (check.step === 'cell') {
    const a = c.factor1Parts[check.col], b = c.factor2Parts[check.row], p = a * b;
    if (n === a + b) return 'added_not_multiplied';
    if (n > 0 && powerOfTen(p / n)) return 'dropped_zeros';
    if (powerOfTen(n / p)) return 'extra_zeros';
    if (Math.abs(n - p) === a || Math.abs(n - p) === b) return 'one_group_off';
    return 'wrong_product';
  }
  if (check.step === 'sum') {
    const total = w * h;
    if (cellProducts(c).flat().includes(total - n)) return 'left_out_part';
    if ([10, 100, 1000].includes(Math.abs(total - n))) return 'carry_slip';
    return 'sum_off';
  }
  if (n === w * h) return 'gave_area';
  if (n === w + h) return 'two_sides_only';
  if (n === 2 * w + h || n === w + 2 * h) return 'three_sides';
  return 'perimeter_off';
}

/** The learner's work on the item so far: right cells are theirs and on screen; no key. */
export function describeAreaWork(c: AreaModelChallenge, mode: AreaModelChallengeType, view: AreaView): string {
  const wrong = view.lastWrong ? `${view.lastWrong}, marked wrong. ` : '';
  if (mode === 'perimeter') return wrong || (view.perimeterInput.trim() ? `Typing ${view.perimeterInput.trim()} as the perimeter` : 'No perimeter typed yet');
  if (mode === 'factor') {
    const typed = [...view.factorTop, ...view.factorLeft].some(v => v.trim());
    return wrong || (typed ? describeAreaCheck(c, { step: 'dimensions', top: view.factorTop, left: view.factorLeft }, false) : 'No parts typed yet');
  }
  const total = c.factor1Parts.length * c.factor2Parts.length;
  const right = Object.entries(view.cells).filter(([, s]) => s.correct)
    .map(([key, s]) => { const [r, k] = key.split(',').map(Number); return `${s.entered} in ${place(r, k)}`; });
  const cells = right.length ? `${right.length} of ${total} cells right (${right.join('; ')})` : `No cell right yet, ${total} to fill`;
  const sumStep = right.length === total ? '. Every cell is right; the sum is next' : '';
  return `${wrong}${cells}${sumStep}`;
}

/** What is drawn and asked. Every number here is printed on the screen; no product, total, perimeter or part is. */
export function workspaceScene(c: AreaModelChallenge, mode: AreaModelChallengeType, view: AreaView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  if (mode === 'perimeter') {
    drawn.rectangle = `sides ${sum(c.factor1Parts)} (top) and ${sum(c.factor2Parts)} (left) are labelled`;
    drawn.sideSum = view.sideSumShown ? 'the four sides are written out as an addition, with no total' : 'not written out';
  } else if (mode === 'factor') {
    drawn.cells = cellProducts(c).map((row, r) => `row ${r + 1}: ${row.join(', ')}`).join('; ');
    drawn.totalArea = sum(c.factor1Parts) * sum(c.factor2Parts);
    drawn.headers = `blank: ${c.factor1Parts.length} column parts along the top and ${c.factor2Parts.length} row parts down the side for the learner to type`;
  } else {
    drawn.model = modelText(c);
    drawn.grid = `${c.factor2Parts.length} row${c.factor2Parts.length > 1 ? 's' : ''} by ${c.factor1Parts.length} column${c.factor1Parts.length > 1 ? 's' : ''} of cells; `
      + `column parts ${c.factor1Parts.join(', ')} along the top, row parts ${c.factor2Parts.join(', ')} down the side`;
    drawn.cellLabels = view.cellsLabelled ? 'each cell shows its column part × its row part'
      : 'not shown: the learner reads each cell\'s column part (top) and row part (side)';
  }
  return {
    objects: [],
    facts: {
      kind: mode, ...drawn,
      learnerWork: describeAreaWork(c, mode, view),
      constraints: isForward(mode)
        ? 'The learner taps a cell, types its product and presses Check; once every cell is right they type the sum and '
          + 'press Submit Final Answer. The activity checks each entry itself. You cannot tap or type for the learner.'
        : 'The learner types the answer and presses its button; the activity checks it itself. You cannot type for the learner.',
    },
  };
}
