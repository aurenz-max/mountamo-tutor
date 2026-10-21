/**
 * Open builder on the shared tutor/JEV teaching workspace (its boss: `openBuilder.boss.ts`).
 *
 * Every project is one gesture item: the learner builds with blocks and presses "I'm done!", and the
 * vision judge's reading of a picture of the board is the check. There is no key: many builds meet a goal.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import {
  SCENES, describeBuild, type OpenBuilderChallenge, type OpenBuilderVerdict, type Placed,
} from './openBuilderModel';

export { OPEN_BUILDER_MISSES, type OpenBuilderMiss } from './openBuilder.card';

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

/** The project as the tutor sees it. How the learner builds and checks is the card's `moves`; this is the board's own physics. */
export function openBuilderScene(c: OpenBuilderChallenge, view: OpenBuilderView): SceneOf {
  const scene = SCENES[c.sceneId];
  return { objects: [], facts: {
    project: c.title,
    scenery: scene.sceneNote,
    builtSoFar: describeBuild(scene, view.placed),
    ...(view.seeing ? { buddySeesNow: view.seeing } : {}),
    ...(view.verdict ? { inspectorSaid: [view.verdict.noticed, view.verdict.nudge].filter(Boolean).join(' ') } : {}),
    constraints: 'A dropped block falls until it rests on the ground or a block. Nothing can sit on a triangle. Blocks '
      + 'never run out. Many different builds can meet the goal.',
  } };
}
