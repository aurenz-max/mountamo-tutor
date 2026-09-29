/**
 * Spatial scene on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B3), plain shape: `useWorkspaceProgress` in place of
 * `useChallengeProgress`. Every challenge is one workspace item:
 *   - identify / describe: the learner picks a position word and presses Check (the key stays hidden);
 *   - place / place_in / place_between: the learner taps a cell and presses Check;
 *   - follow_directions: every step placement is checked; a wrong step is a checked miss that keeps
 *     the steps already placed, and the last right step is the success;
 *   - describe_scene: spoken, judged on the relation AND the reference object (contract R16).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpatialSceneChallenge } from './SpatialScene';
import { modelSpatialDescription } from './spatialSceneDescriptionScript';

const relationText = (relation: string) => relation.replaceAll('_', ' ');

/** The spoken ask for `describe_scene`: from the fixed YOU viewpoint, never naming the relation. */
export const describeSceneAsk = (c: SpatialSceneChallenge) =>
  `Look from the YOU arrow. Tell where the ${c.targetObject.name} is compared with the ${c.referenceObjectName}.`;

/**
 * A described scene's known wrong answer for the `spoken_miss` observer: the relation word that points the other way
 * (right of for left of, behind for in front of). The rest of a description is open, so nothing else is listed.
 */
export function spatialSpokenMisses(c: SpatialSceneChallenge): KnownMiss[] {
  // `OPPOSITE` (below) is the harness's wrong relation, already in words.
  const opposite = c.type === 'describe_scene' ? OPPOSITE[c.correctPosition] : undefined;
  if (!opposite) return [];
  const t = c.targetObject.name, ref = c.referenceObjectName;
  return [{ id: 'opposite_word', pattern: `From the YOU arrow, the ${t} is ${relationText(c.correctPosition)} the ${ref}. The learner says `
    + `the ${t} is ${opposite} the ${ref}, the relation that points the other way.`,
    examples: [`The ${t} is ${opposite} the ${ref}.`] }];
}

export function spatialAssignment(c: SpatialSceneChallenge): TeachingAssignment {
  if (c.type === 'describe_scene') {
    const misses = spatialSpokenMisses(c);
    return { id: c.id, task: describeSceneAsk(c), response: 'speech',
      expectedAnswer: `A description naming BOTH the relation "${relationText(c.correctPosition)}" and the reference `
        + `object ${c.referenceObjectName}, from the YOU viewpoint, for example "${modelSpatialDescription(c)}"`,
      ...(misses.length ? { misses } : {}) };
  }
  return { id: c.id, task: c.instruction, response: 'gesture' };
}

/** The learner's checked work in their terms, never the key. */
export const describeSpatialCheck = (c: SpatialSceneChallenge, view: { option?: string | null;
  cell?: { row: number; col: number } | null; step?: number }) => {
  if (c.type === 'identify' || c.type === 'describe') return `Chose "${relationText(view.option ?? '?')}"`;
  if (c.type === 'follow_directions') return `Placed step ${(view.step ?? 0) + 1} at row ${view.cell?.row}, column ${view.cell?.col}`;
  return `Chose the cell at row ${view.cell?.row}, column ${view.cell?.col}`;
};

/**
 * What a checked wrong choice shows (handoff 20 Part A), from the scene's own geometry:
 *   - identify / describe name the KIND of word chosen: `opposite_word` (it points the other way on the
 *     same line: above for below, left of for right of), `same_axis_word` (same up-down or side-to-side
 *     line but it does not fit the distance: on for a gap, beside for two cells away), `other_axis_word`
 *     (an up-down word for a side-to-side arrangement, or the reverse);
 *   - place_in: `other_object` (tapped a different drawn thing), `next_to_container` (an empty cell touching
 *     the container), `away_from_container`;
 *   - place_between: `next_to_one` (a cell touching one of the two references, not the gap), `touches_neither`;
 *   - follow_directions: `later_step_cell` (the cell a later direction asks for), `other_cell`.
 * `place` names none: the challenge stores only the target cell, not the reference or the word, so a check
 * can say no more than "another cell". describe_scene is spoken (Part B).
 */
export type SpatialMiss = 'opposite_word' | 'same_axis_word' | 'other_axis_word' | 'other_object' | 'next_to_container'
  | 'away_from_container' | 'next_to_one' | 'touches_neither' | 'later_step_cell' | 'other_cell';

type Cell = { row: number; col: number };
const WORD_STEP: Record<string, Cell> = { above: { row: -1, col: 0 }, on: { row: -1, col: 0 }, below: { row: 1, col: 0 },
  under: { row: 1, col: 0 }, left_of: { row: 0, col: -1 }, right_of: { row: 0, col: 1 } };
const VERTICAL = new Set(['above', 'below', 'on', 'under']);
const same = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;
const touches = (a: Cell, b: Cell) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

export function spatialMiss(c: SpatialSceneChallenge, view: { option?: string | null; cell?: Cell | null; step?: number }): SpatialMiss | undefined {
  const at = (name?: string) => c.sceneObjects.find(o => o.name === name)?.position;
  if (c.type === 'identify' || c.type === 'describe') {
    const chosen = view.option, ref = at(c.referenceObjectName), t = c.targetObject.position;
    if (!chosen || chosen === c.correctPosition || !ref) return undefined;
    const dr = Math.sign(t.row - ref.row), dc = Math.sign(t.col - ref.col), step = WORD_STEP[chosen];
    if (step && step.row === -dr && step.col === -dc) return 'opposite_word';
    return VERTICAL.has(chosen) === (dc === 0) ? 'same_axis_word' : 'other_axis_word';
  }
  const cell = view.cell;
  if (!cell) return undefined;
  if (c.type === 'place_in') {
    const box = at(c.referenceObjectName);
    if (!box || same(cell, box)) return undefined;
    if (c.sceneObjects.some(o => same(o.position, cell))) return 'other_object';
    return touches(cell, box) ? 'next_to_container' : 'away_from_container';
  }
  if (c.type === 'place_between') {
    if (c.correctCell && same(cell, c.correctCell)) return undefined;
    return [at(c.referenceObjectName), at(c.referenceObjectName2)].some(r => r && touches(cell, r)) ? 'next_to_one' : 'touches_neither';
  }
  if (c.type === 'follow_directions') {
    const steps = c.steps ?? [], now = view.step ?? 0;
    if (!steps[now] || same(cell, steps[now].correctCell)) return undefined;
    return steps.slice(now + 1).some(s => same(s.correctCell, cell)) ? 'later_step_cell' : 'other_cell';
  }
  return undefined;
}

const CONSTRAINTS: Record<SpatialSceneChallenge['type'], string> = {
  identify: 'The learner picks a position word and presses Check; the scene checks it. The position word is the answer.',
  describe: 'The learner picks the word that describes where the object is and presses Check; the scene checks it.',
  place: 'The learner taps an empty cell and presses Check; the scene checks the cell.',
  place_in: 'The learner taps the thing the object goes inside and presses Check; the scene checks it.',
  place_between: 'The learner taps the empty cell with one object on each side and presses Check; the scene checks it.',
  follow_directions: 'The learner places one object per step by tapping a cell; each step is checked as it is placed.',
  describe_scene: 'The learner says aloud where the object is from the YOU arrow, naming the relation and the other '
    + 'object. Left and right are the learner’s own; in front of is nearer the arrow. The relation is not printed '
    + 'until it is credited.',
};

export function spatialScene(c: SpatialSceneChallenge, view: { step?: number }): WorkspaceScene {
  return { objects: [], facts: {
    kind: c.type,
    ...(c.type === 'follow_directions' && c.steps ? { step: `${(view.step ?? 0) + 1} of ${c.steps.length}` } : {}),
    ...(c.supportTier ? { supportTier: c.supportTier } : {}),
    constraints: CONSTRAINTS[c.type],
  } };
}

/** What "Hear the question again" asks the tutor to say: the ask only, never the relation. */
export const hearSceneQuestionRequest = (c: SpatialSceneChallenge) =>
  `The learner asked to hear the question again. Say only this, once: "${describeSceneAsk(c)}"`;

/** The on-screen label of a position word ("left_of" -> "Left of"), as the option buttons print it. */
export const positionLabel = (word: string) => {
  const text = relationText(word);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const OPPOSITE: Record<string, string> = { above: 'below', below: 'above', left_of: 'right of', right_of: 'left of',
  in_front_of: 'behind', behind: 'in front of', on: 'under', under: 'on' };

type HarnessInput = { type: 'choose'; label: string } | { type: 'touch'; target: string } | { type: 'check' }
  | { type: 'answer'; text: string };

/**
 * The journey's inputs for one challenge, through the real controls: a position word and Check, a cell
 * and Check, each remaining direction step, or a spoken description. `wrong` picks another word, another
 * empty cell, or the opposite relation. `step` is the published follow-directions step (1-based text).
 */
export function spatialHarnessInputs(c: SpatialSceneChallenge, wrong: boolean, gridSize = 3, step?: string): HarnessInput[] {
  const occupied = new Set(c.sceneObjects.map(o => `${o.position.row}-${o.position.col}`));
  const emptyExcept = (not?: { row: number; col: number }) => {
    for (let row = 0; row < gridSize; row++) for (let col = 0; col < gridSize; col++) {
      if (!occupied.has(`${row}-${col}`) && !(not && not.row === row && not.col === col)) return `cell-${row}-${col}`;
    }
    throw new Error('spatial-scene: no empty cell for a wrong placement');
  };
  switch (c.type) {
    case 'identify': case 'describe': {
      const pick = wrong ? (c.options ?? []).find(o => o !== c.correctPosition)! : c.correctPosition;
      return [{ type: 'choose', label: positionLabel(pick) }, { type: 'check' }];
    }
    case 'place': case 'place_in': case 'place_between':
      return [{ type: 'touch', target: wrong ? emptyExcept(c.correctCell) : `cell-${c.correctCell!.row}-${c.correctCell!.col}` },
        { type: 'check' }];
    case 'follow_directions': {
      const from = step ? Number(step.split(' ')[0]) - 1 : 0;
      const steps = c.steps ?? [];
      // Cells the earlier steps already filled are not tappable.
      steps.slice(0, from).forEach(s => occupied.add(`${s.correctCell.row}-${s.correctCell.col}`));
      if (wrong) return [{ type: 'touch', target: emptyExcept(steps[from]?.correctCell) }];
      return steps.slice(from).map(s => ({ type: 'touch' as const, target: `cell-${s.correctCell.row}-${s.correctCell.col}` }));
    }
    default: {
      const model = modelSpatialDescription(c);
      const opposite = OPPOSITE[c.correctPosition];
      return [{ type: 'answer', text: wrong && opposite ? model.replace(relationText(c.correctPosition), opposite) : model }];
    }
  }
}
