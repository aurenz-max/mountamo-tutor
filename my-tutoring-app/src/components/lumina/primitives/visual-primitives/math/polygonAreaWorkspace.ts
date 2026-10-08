/**
 * Polygon area builder on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. Every challenge is answered on the screen
 * (an area typed and checked, or squares shaded on the open-build grid and "I'm done!") and checked by the activity's
 * own check, so the tutor is never handed `expectedArea`. The figure's drawn dimensions are the task's givens and are
 * published; the area they make is the answer and is not.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { PolygonAreaChallenge } from './PolygonAreaBuilder';
import { buildAreaFacts, isBuildArea, type Cell } from './polygonAreaBuild';

export function workspaceAssignment(challenge: PolygonAreaChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

export interface PolygonAreaView {
  /** The typed area, as typed. */
  areaInput: string;
  /** decompose: the cut triangle was slid into the slot (the answer box unlocks only then). */
  rearranged: boolean;
  /** build_area: the shaded squares, in the order shaded. */
  cells: readonly Cell[];
  /** build_area, two-shape item: the first shape, once it was checked right. */
  firstShape: readonly Cell[] | null;
  /** An easier build stands in for the item (a simplify lever). */
  practice: boolean;
}

/** The figure as drawn, with the labels the canvas prints. Never its area. */
export function describeFigure(c: PolygonAreaChallenge): string {
  const u = c.unitLabel;
  switch (c.figureType) {
    case 'triangle': return `a triangle with base ${c.base} ${u} and a dashed perpendicular height of ${c.height} ${u}`;
    case 'parallelogram': return c.type === 'decompose'
      ? `a parallelogram with a cut triangle at its left end to slide into the dashed slot; once it forms a rectangle the `
        + `base (${c.base} ${u}) and height (${c.height} ${u}) labels appear`
      : `a parallelogram with base ${c.base} ${u} and a dashed perpendicular height of ${c.height} ${u}`;
    case 'trapezoid': return `a trapezoid with bottom base ${c.base} ${u}, top base ${c.base2} ${u} and a dashed height of ${c.height} ${u}`;
    case 'composite': return `a figure made of ${(c.parts ?? []).length} rectangles on a unit grid, the pieces' widths and heights labelled `
      + `(${(c.parts ?? []).map(p => `${p.w} by ${p.h}`).join(', ')})`;
    case 'coordinate': return `a polygon on a coordinate grid with corners at ${(c.vertices ?? []).map(v => `(${v.x}, ${v.y})`).join(', ')}`;
    default: return 'an empty grid';
  }
}

/** The learner's work in their own terms, never the key. */
export function describeAreaWork(c: PolygonAreaChallenge, view: PolygonAreaView): string {
  const typed = view.areaInput.trim() ? `Typed ${view.areaInput.trim()} ${c.unitLabel}² as the area` : 'No area typed yet';
  if (c.type === 'decompose' && !view.rearranged) return 'The cut triangle is not in the slot yet';
  return c.type === 'decompose' ? `Slid the cut triangle across to make a rectangle. ${typed}` : typed;
}

/**
 * What a wrong typed area shows (`TeachingAttempt.miss`, handoff 20), from the figure the check reads and the
 * commonStruggles in the catalog. Only the observable pattern:
 * - `forgot_half`: base × height on a triangle, or (b1 + b2) × h on a trapezoid (the ½ left out);
 * - `halved`: half the area of a parallelogram, rectangle or composite (a ½ that does not belong);
 * - `added_sides`: the labelled lengths added instead of multiplied;
 * - `one_piece`: one rectangle of a composite figure, not the whole;
 * - `bounding_box`: the rectangle around a coordinate polygon, not the polygon;
 * - `wrong_area`: any other area.
 */
export type AreaMiss = 'forgot_half' | 'halved' | 'added_sides' | 'one_piece' | 'bounding_box' | 'wrong_area';

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

export function areaMiss(c: PolygonAreaChallenge | null, typed: number): AreaMiss | undefined {
  if (!c || isBuildArea(c) || !Number.isFinite(typed) || near(typed, c.expectedArea)) return undefined;
  const b = c.base ?? 0, h = c.height ?? 0;
  if ((c.figureType === 'triangle' || c.figureType === 'trapezoid') && near(typed, c.expectedArea * 2)) return 'forgot_half';
  if (c.figureType !== 'triangle' && c.figureType !== 'trapezoid' && near(typed, c.expectedArea / 2)) return 'halved';
  if (b && h && near(typed, b + h + (c.figureType === 'trapezoid' ? c.base2 ?? 0 : 0))) return 'added_sides';
  if (c.figureType === 'composite' && (c.parts ?? []).some(p => near(typed, p.w * p.h))) return 'one_piece';
  if (c.figureType === 'coordinate' && (c.vertices ?? []).length) {
    const xs = c.vertices!.map(v => v.x), ys = c.vertices!.map(v => v.y);
    if (near(typed, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)))) return 'bounding_box';
  }
  return 'wrong_area';
}

export function workspaceScene(c: PolygonAreaChallenge, view: PolygonAreaView): WorkspaceScene {
  if (isBuildArea(c)) return { objects: [], facts: buildAreaFacts(c, view.cells, view.firstShape, view.practice) };
  return {
    objects: [],
    facts: {
      kind: c.type,
      figure: describeFigure(c),
      ...(c.type === 'decompose' ? { rearranged: view.rearranged ? 'yes' : 'no' } : {}),
      learnerWork: describeAreaWork(c, view),
      constraints: c.type === 'decompose'
        ? 'The learner drags the cut triangle into the slot to make a rectangle; that unlocks the answer box. Then they type '
          + 'the area and press Check; the screen checks it. You cannot drag, type or check for the learner.'
        : 'The learner types the area and presses Check; the screen checks it against the figure. You cannot type or '
          + 'check for the learner.',
    },
  };
}
