/**
 * The in-item levers on angle-workshop's open build, make_angle (`/add-eval-modes` references/build-mode.md). They
 * start bare at every tier: judging the opening by eye against a square corner IS the task, so the levers come on a
 * miss. From the misses `makeAngleMiss` observes (no real-learner evidence yet):
 * - `corner_marker` (help): a dashed square corner and a dashed straight line drawn at the vertex, the two benchmark
 *   angles every class is defined against. Answers an angle of the wrong kind. Leak rule: the benchmarks only; the
 *   learner's ray is not moved and no measure is written.
 * - `protractor` (help): a degree scale behind the rays, read by the learner. Answers a degree range missed on either
 *   side. Leak rule: the scale only; no reading is marked.
 * - `coarser_class` (simplify): an ungraded practice ask on one side of a right angle only ("bigger than a right
 *   angle" / "smaller than a right angle"); the full item comes back after it. A straight ask coarsens to "bigger
 *   than a right angle". Not on a right-angle ask or a range that holds 90°: neither has a coarser side.
 * `not_opened` has no lever: the ray has not left the fixed ray, and the screen already says to open it.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { AngleTargetKind, AngleWorkshopChallenge } from './AngleWorkshop';
import { makeAngleAsk } from './angleWorkshopWorkspace';

export const CORNER_LEVER = 'corner_marker';
export const PROTRACTOR_LEVER = 'protractor';
export const COARSER_LEVER = 'coarser_class';

/** The coarser side of a right angle an ask reduces to, or null when it has none (a right angle). */
function coarserKind(c: AngleWorkshopChallenge): AngleTargetKind | null {
  switch (c.targetKind) {
    case 'acute': return 'smaller_than_right';
    case 'obtuse': case 'between_right_straight': case 'straight': return 'bigger_than_right';
    case 'range': return (c.targetMax ?? 0) < 90 ? 'smaller_than_right' : (c.targetMin ?? 0) > 90 ? 'bigger_than_right' : null;
    default: return null;
  }
}

/** The easier ask for a make_angle item, or null. */
export function coarserMakeAngle(c: AngleWorkshopChallenge): AngleWorkshopChallenge | null {
  if (c.type !== 'make_angle') return null;
  const kind = coarserKind(c);
  if (!kind) return null;
  return { ...c, id: `${c.id}~coarser`, targetKind: kind, targetMin: undefined, targetMax: undefined, instruction: makeAngleAsk(kind) };
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly string[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

/** The levers on a make_angle session item (none on another type, or while the easier practice item is up). */
export function makeAngleLevers(c: AngleWorkshopChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (c?.type !== 'make_angle') return [];
  return [
    lever(CORNER_LEVER, 'help', ['made_acute', 'made_right', 'made_obtuse', 'made_straight'],
      'The learner\'s angle is a different kind from the one asked for.',
      'Draws a dashed square corner and a dashed straight line at the vertex, to compare the angle with. The learner\'s ray stays where it is; no measure is written.',
      pulled),
    lever(PROTRACTOR_LEVER, 'help', ['below_range', 'above_range'],
      'The learner\'s angle is outside the degrees asked for, or they cannot judge its size.',
      'Puts a protractor scale behind the rays for the learner to read. No reading is marked.',
      pulled),
    ...(coarserMakeAngle(c) ? [lever(COARSER_LEVER, 'simplify', ['made_acute', 'made_obtuse', 'made_straight', 'below_range', 'above_range'],
      'The learner keeps making the wrong kind of angle, or cannot start.',
      'Opens an easier ask first: an angle on one side of a right angle only (bigger than, or smaller than, a right angle). It is not graded; the full item comes back after it.',
      pulled)] : []),
  ];
}

/** What the pulled levers put on screen, for the tutor's `onScreen` fact. */
export function makeAngleLeverFacts(pulled: readonly string[]): string | undefined {
  const notes = [
    pulled.includes(CORNER_LEVER) && 'A dashed square corner and a dashed straight line are drawn at the vertex.',
    pulled.includes(PROTRACTOR_LEVER) && 'A protractor scale is behind the rays.',
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}
