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
        ? 'The tutor says the number; the learner writes one digit in each labelled column. The chart checks the number once every column is filled and the learner stops.'
        : 'The learner says the answer. The number is printed without column labels.',
    },
  };
}
