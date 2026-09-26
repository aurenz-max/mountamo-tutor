/**
 * Push-pull arena on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C4). Its only teaching path: the scripted runner was
 * retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer, computed in code from the sim's physics: push or pull (observe, after the learner
 * presses Go), moves or stays (predict), which object slides farther (compare), big or little
 * (design, after free experiments).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, otherObjectName, pushPullArenaHarnessAnswers, type ArenaItem } from './pushPullArenaScript';

/** The pack's own ask, without its "Your turn." hand-over. */
const ask = (item: ArenaItem) => askFor(item).replace(/\s*Your turn\.\s*/, ' ').trim();

const REFUSAL: Record<ArenaItem['kind'], (item: ArenaItem) => string> = {
  observe: () => 'Describing the motion in other words ("it went that way") is not it: the force word is.',
  predict: () => 'Restating the setup ("it is on the ice") is not it: moves or stays is.',
  compare: item => `"${otherObjectName(item)}" is not it: the heavier object does not slide farther.`,
  design: () => 'Reporting what happened when they tried it is not it: big or little is.',
};

export function pushPullArenaAssignment(item: ArenaItem): TeachingAssignment {
  const also = item.alternates.length ? ` Also accept: ${item.alternates.join(', ')}.` : '';
  return { id: item.id, task: ask(item), response: 'speech',
    expectedAnswer: `${item.spokenAnswer}.${also} ${REFUSAL[item.kind](item)}` };
}

export function pushPullArenaScene(item: ArenaItem, view: { goal?: string; observed: boolean }): WorkspaceScene {
  const objects = item.kind === 'compare' ? `the ${item.objectName} and the ${item.object2Name}` : `the ${item.objectName}`;
  const facts: Record<string, string> = { shown: `${objects} on ${item.surfaceSpoken}, in the arena.` };
  if (item.kind === 'design' && view.goal) facts.goal = view.goal;
  facts.constraints = item.kind === 'observe'
    ? (view.observed ? 'The learner pressed Go and watched the preset force; they now say push or pull out loud.'
      : 'The learner presses Go to watch the preset force, then says push or pull out loud.')
    : item.kind === 'design'
      ? 'The learner may set a direction and strength and press Go as often as they like; then they say big or little out loud.'
      : 'Nothing moves before the answer: the learner says it out loud, and the arena plays the push once it is credited.';
  return { objects: [], facts };
}

/** The journey's answers: the code-computed answer, or its plain opposite. */
export function pushPullArenaJourneyAnswers(item: ArenaItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = pushPullArenaHarnessAnswers(item);
  return { correct, plainWrong };
}
