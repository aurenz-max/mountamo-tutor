/**
 * Place value chart on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/live-runtime-handoffs/15-workspace-rollout.md).
 *
 * Pure: the component and any probe read the same assignment and scene. The items
 * still come from `itemsFromChallenges` in `placeValueScript.ts`. The analyze kinds
 * are spoken against `answerText`; a dictated number is written into the chart and
 * checked by code, so the tutor is not handed its digits.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, type PlaceValueItem } from './placeValueScript';
import { placeWord } from './spokenNumberWords';

export function workspaceAssignment(item: PlaceValueItem): TeachingAssignment {
  if (item.answerKind === 'gesture') return { id: item.id, task: askFor(item), response: 'gesture' };
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer: item.answerText };
}

/** The chart as written, one entry per column HIGH → LOW; `null` is an empty column. */
export type WrittenChart = ReadonlyArray<number | null>;

export const chartComplete = (item: PlaceValueItem, written: WrittenChart) =>
  written.length === item.chartPlaces.length && written.every(d => d !== null);

export const chartMatches = (item: PlaceValueItem, written: WrittenChart) =>
  chartComplete(item, written) && item.expectedDigits.every((d, i) => written[i] === d);

/**
 * What a wrong chart shows (`TeachingAttempt.miss`, handoff 20), from the written digits:
 * - `zero_left_empty`: only columns whose digit is zero were left empty; `column_empty`: another column is empty;
 * - `digits_swapped`: the right digits, some in the wrong columns (406 written 046);
 * - `teen_ty_swap`: a teen written as its -ty or the reverse (13 as 30, 30 as 13), in the last two columns;
 * - `one_short` / `one_over` / `one_ten_off`: the written number is one or ten away;
 * - `short_by_more` / `over_by_more`: any other number.
 * Undefined for a right chart and for the spoken kinds.
 */
export type PlaceValueMiss = 'zero_left_empty' | 'column_empty' | 'digits_swapped' | 'teen_ty_swap'
  | 'one_short' | 'one_over' | 'one_ten_off' | 'short_by_more' | 'over_by_more';

export function placeValueMiss(item: PlaceValueItem | null, written: WrittenChart): PlaceValueMiss | undefined {
  if (!item || item.kind !== 'build_number' || chartMatches(item, written)) return undefined;
  const want = item.expectedDigits;
  if (!chartComplete(item, written)) {
    return want.every((d, i) => (written[i] ?? null) !== null || d === 0) ? 'zero_left_empty' : 'column_empty';
  }
  const got = written as readonly number[];
  if ([...got].sort().join() === [...want].sort().join()) return 'digits_swapped';
  const n = want.length, head = (ds: readonly number[]) => ds.slice(0, n - 2).join();
  const [wt, wo] = want.slice(n - 2), [gt, go] = got.slice(n - 2);
  const teenTy = (t: number, o: number, t2: number, o2: number) => t === 1 && o > 0 && t2 === o && o2 === 0;
  if (head(got) === head(want) && (teenTy(wt, wo, gt, go) || teenTy(gt, go, wt, wo))) return 'teen_ty_swap';
  const off = Number(got.join('')) - item.targetNumber;
  if (off === -1) return 'one_short';
  if (off === 1) return 'one_over';
  if (Math.abs(off) === 10) return 'one_ten_off';
  return off < 0 ? 'short_by_more' : 'over_by_more';
}

/** The committed chart in the learner's terms, as the tutor and the observer read it. */
export const describeChart = (item: PlaceValueItem, written: WrittenChart) =>
  `Wrote ${item.chartPlaces.map((p, i) => `${placeWord(p)}: ${written[i] ?? 'empty'}`).join(', ')}`;

export function workspaceScene(item: PlaceValueItem, view: { written: WrittenChart }): WorkspaceScene {
  const build = item.kind === 'build_number';
  return {
    objects: [],
    facts: {
      kind: item.kind,
      // Analyze items print the number with one digit glowing; the column headers are
      // hidden, because on find_place they are the answer.
      ...(build ? { columns: item.chartPlaces.length, columnsFilled: view.written.filter(d => d !== null).length }
        : { printedNumber: item.targetNumber, glowingDigit: item.digit }),
      constraints: build
        ? 'The tutor says the number; the learner writes one digit in each labelled column. The chart checks what is written once the learner stops, even with a column left empty.'
        : 'The learner says the answer. The number is printed without column labels.',
    },
  };
}
