/**
 * Array grid on the shared tutor/JEV teaching workspace, on a boss (`arrayGrid.card.ts`, `arrayGrid.boss.ts`), plus the
 * open build `make_array` (/add-eval-modes references/build-mode.md).
 *
 * Pure: the component, the boss and any probe read the same items, ask, scene, check and misses. Every challenge is
 * answered on the screen and checked by the activity, so the tutor is never handed the total.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { ArrayGridChallenge, ArrayGridChallengeType, ArrayGridData, ArrayGridIconType } from './ArrayGrid';
import type { ArrayMiss, ArrayTotalMiss, MakeArrayMiss } from './arrayGrid.card';

export { ARRAY_MISSES_BY_MODE, MAKE_ARRAY_MISSES, type ArrayMiss, type ArrayTotalMiss, type MakeArrayMiss } from './arrayGrid.card';

// ── make_array: the build grid and its shape ────────────────────────────────

/** The empty grid a make_array item opens on: room for every array of `total` up to 8 rows and 12 columns. */
export const gridFor = (total: number) => ({ rows: Math.min(Math.max(total, 1), 8), columns: Math.min(Math.max(total, 1), 12) });

export const cellKey = (row: number, column: number) => `${row}-${column}`;
const parseCell = (key: string) => key.split('-').map(Number) as [number, number];

export interface ArrayShape {
  /** Occupied rows and columns. */
  rows: number;
  columns: number;
  squares: number;
  /** The squares fill one rectangle with no gap. */
  rectangular: boolean;
  /** Squares in each occupied row, top to bottom. */
  rowLengths: number[];
}

export function arrayShape(cells: readonly string[]): ArrayShape {
  if (!cells.length) return { rows: 0, columns: 0, squares: 0, rectangular: false, rowLengths: [] };
  const byRow = new Map<number, number>(), cols = new Set<number>();
  for (const [r, c] of cells.map(parseCell)) { byRow.set(r, (byRow.get(r) ?? 0) + 1); cols.add(c); }
  const rs = Array.from(byRow.keys()).sort((a, b) => a - b), cs = Array.from(cols);
  const height = rs[rs.length - 1] - rs[0] + 1, width = Math.max(...cs) - Math.min(...cs) + 1;
  return { rows: rs.length, columns: cs.length, squares: cells.length,
    rectangular: cells.length === height * width, rowLengths: rs.map(r => byRow.get(r)!) };
}

/** Every rows × columns array of `total` that fits its grid, fewest rows first. */
export function arraysOf(total: number): Array<{ rows: number; columns: number }> {
  const grid = gridFor(total), out: Array<{ rows: number; columns: number }> = [];
  for (let rows = 1; rows <= grid.rows; rows++) {
    if (total % rows === 0 && total / rows <= grid.columns) out.push({ rows, columns: total / rows });
  }
  return out;
}

/** The ask, written by code: the number of squares is the task, stated. */
export const makeArrayAsk = (total: number, ways: 1 | 2 = 1) => ways === 2
  ? `Make an array with ${total} squares. Then make a different array with ${total} squares.`
  : `Make an array with ${total} squares.`;

/** What a wrong make shows (`MakeArrayMiss`, `arrayGrid.card.ts`). */
export function makeArrayMiss(total: number, cells: readonly string[], first?: { rows: number; columns: number } | null): MakeArrayMiss | undefined {
  const s = arrayShape(cells);
  if (!s.rectangular) return 'ragged';
  const { rows: r, columns: c } = s;
  if (s.squares === total) return first && first.rows === r && first.columns === c ? 'same_as_first' : undefined;
  if ((r + 1) * c === total || r * (c + 1) === total) return 'one_line_short';
  if ((r - 1) * c === total || r * (c - 1) === total) return 'one_line_over';
  return s.squares < total ? 'too_few' : 'too_many';
}

const arrayWords = (a: { rows: number; columns: number }) => `${a.rows} row${a.rows === 1 ? '' : 's'} of ${a.columns}`;

// ── Every mode: items, ask, work, misses, scene ─────────────────────────────

/** One item as the boss and the levers read it: the challenge with the session's mode and icon stamped on it. */
export type ArrayItem = ArrayGridChallenge & { mode: ArrayGridChallengeType; icon: ArrayGridIconType };

/** The lesson's items. make_array always builds squares: the ask names them. */
export const arrayItems = (d: ArrayGridData): ArrayItem[] => (d.challenges ?? []).map(c => ({ ...c, mode: d.challengeType,
  icon: d.challengeType === 'make_array' ? 'square' : d.iconType ?? 'star' }));

/** What the learner is asked on one item. Never the total. */
export function arrayAsk(c: ArrayItem): string {
  switch (c.mode) {
    case 'make_array': return c.instruction ?? makeArrayAsk(c.total ?? 0, c.ways);
    case 'build_array': return `Build an array with ${c.targetRows} rows and ${c.targetColumns} columns, then type how many ${c.icon}s there are in all.`;
    case 'count_array': return `How many ${c.icon}s are in the array? Type the total.`;
    default: return 'Write the multiplication sentence for the array: rows × columns = total.';
  }
}

/** What the component reads off the screen for the check, the description and the scene. */
export interface ArrayGridView {
  mode: ArrayGridChallengeType;
  icon: string;
  /** build_array: the rows and columns picked. */
  rows: number;
  columns: number;
  totalAnswer: string;
  rowsAnswer: string;
  columnsAnswer: string;
  labelsShown: boolean;
  /** make_array: the squares on the grid, and the first array on a two-ways item once it passed. */
  cells: readonly string[];
  firstWay: { rows: number; columns: number } | null;
}

const typed = (text: string) => text.trim() || '?';

/** The learner's work in their own terms, never the key. */
export function describeArrayWork(view: ArrayGridView): string {
  switch (view.mode) {
    case 'make_array': {
      const s = arrayShape(view.cells);
      if (!s.squares) return 'No squares on the grid yet';
      const made = s.rectangular ? `an array of ${arrayWords(s)}` : `${s.squares} squares in rows of ${s.rowLengths.join(', ')}`;
      return view.firstWay ? `Second array: ${made} (first: ${arrayWords(view.firstWay)})` : `Made ${made}`;
    }
    case 'build_array': {
      const built = view.rows && view.columns ? `Built ${view.rows} rows and ${view.columns} columns` : 'No array built yet';
      return view.totalAnswer.trim() ? `${built}. Typed ${view.totalAnswer.trim()} as the total` : built;
    }
    case 'count_array': return view.totalAnswer.trim() ? `Typed ${view.totalAnswer.trim()} as the total` : 'No total typed yet';
    default: return `Wrote ${typed(view.rowsAnswer)} × ${typed(view.columnsAnswer)} = ${typed(view.totalAnswer)}`;
  }
}

function totalMiss(got: number, rows: number, columns: number): ArrayTotalMiss | undefined {
  const product = rows * columns, off = Math.abs(got - product);
  if (got === product) return undefined;
  if (got === rows + columns) return 'added_sides';
  if (off === columns) return 'one_row_off';
  if (off === rows) return 'one_column_off';
  return off === 1 ? 'off_by_one' : 'other_total';
}

export function arrayMiss(challenge: ArrayGridChallenge | null, view: ArrayGridView): ArrayMiss | undefined {
  if (!challenge) return undefined;
  if (view.mode === 'make_array') return makeArrayMiss(challenge.total ?? 0, view.cells, view.firstWay);
  const { targetRows: r, targetColumns: c } = challenge;
  if (view.mode === 'multiply_array') {
    const rows = parseInt(view.rowsAnswer, 10), columns = parseInt(view.columnsAnswer, 10);
    if (rows !== r || columns !== c) return rows === c && columns === r ? 'swapped_sides' : 'wrong_side';
  }
  const got = parseInt(view.totalAnswer, 10);
  return Number.isNaN(got) ? undefined : totalMiss(got, r, c);
}

/** What is drawn and asked. No total is ever published. The moves and the rules are the card's. */
export function workspaceScene(challenge: ArrayGridChallenge, view: ArrayGridView): SceneOf {
  const drawn: Record<string, string | number> = { kind: view.mode };
  if (view.mode === 'make_array') {
    const s = arrayShape(view.cells);
    // The made array as numbers, so the shared work history records a revision (`squaresMade 0 → 13 → 12`).
    drawn.grid = 'a grid of empty cells with no numbers';
    drawn.rowsMade = s.rows; drawn.columnsMade = s.columns; drawn.squaresMade = s.squares;
    if (challenge.ways === 2) {
      drawn.way = view.firstWay ? 'second' : 'first';
      if (view.firstWay) drawn.firstArray = `${arrayWords(view.firstWay)}, drawn small beside the grid`;
    }
    return { objects: [], facts: { ...drawn, learnerWork: describeArrayWork(view) } };
  }
  drawn.labels = view.labelsShown ? 'every row and column numbered' : 'hidden';
  if (view.mode === 'build_array') {
    drawn.asked = `${challenge.targetRows} rows and ${challenge.targetColumns} columns`;
    drawn.rowsBuilt = view.rows; drawn.columnsBuilt = view.columns;
  } else if (view.mode === 'count_array') {
    // On count the rows and columns are the learner's to find: the tutor is told the array, never its size.
    drawn.array = `${view.icon}s in equal rows`;
  } else {
    drawn.array = `${challenge.targetRows} rows of ${challenge.targetColumns} ${view.icon}s`;
  }
  return { objects: [], facts: { ...drawn, learnerWork: describeArrayWork(view) } };
}
