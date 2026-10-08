/**
 * Open builder on the shared tutor/JEV teaching workspace (born bound, plain shape).
 *
 * Every project is one gesture item: the learner builds with blocks and presses "I'm done!", and the
 * vision judge's reading of a picture of the board is the check. There is no key: many builds meet a goal.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import {
  SCENES, describeBuild, type OpenBuilderChallenge, type OpenBuilderVerdict, type Placed,
} from './openBuilderModel';

export { OPEN_BUILDER_MISSES, type OpenBuilderMiss } from './openBuilderModel';

export const openBuilderAssignment = (c: OpenBuilderChallenge): TeachingAssignment =>
  ({ id: c.id, task: c.goal, response: 'gesture' });

/** The checked work, in the learner's terms. */
export const describeBuildWork = (c: OpenBuilderChallenge, placed: Placed[]) => `Built: ${describeBuild(SCENES[c.sceneId], placed)}`;

export interface OpenBuilderView {
  placed: Placed[];
  phase: 'building' | 'checking' | 'checked';
  /** The judge's last reading, while it is on screen. */
  verdict: OpenBuilderVerdict | null;
  /** The watcher's live line about the build as it stands, if any. */
  seeing?: string;
}

export function openBuilderScene(c: OpenBuilderChallenge, view: OpenBuilderView): WorkspaceScene {
  const scene = SCENES[c.sceneId];
  return { objects: [], facts: {
    project: c.title,
    scenery: scene.sceneNote,
    builtSoFar: describeBuild(scene, view.placed),
    ...(view.seeing ? { buddySeesNow: view.seeing } : {}),
    ...(view.verdict ? { inspectorSaid: [view.verdict.noticed, view.verdict.nudge].filter(Boolean).join(' ') } : {}),
    constraints: 'The learner picks a block shape and a color and taps where to drop it; it falls until it rests on '
      + 'the ground or a block. Nothing can sit on a triangle. Blocks never run out. Undo takes back the last block. '
      + 'The learner presses "I\'m done!" and a building buddy looks at a picture of the board. Many different builds '
      + 'can meet the goal. You cannot place or remove blocks.',
  } };
}
