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
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
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
  const misses = pushPullSpokenMisses(item);
  return { id: item.id, task: ask(item), response: 'speech',
    expectedAnswer: `${item.spokenAnswer}.${also} ${REFUSAL[item.kind](item)}`, ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken answer shows (handoff 20 Part B): the other word of the pair, or no force word. */
export type SpokenPushPullMiss = 'opposite_force' | 'described_motion' | 'opposite_outcome' | 'other_object' | 'opposite_size';

const OTHER_WORD: Record<string, string> = { push: 'pull', pull: 'push', moves: 'stays', stays: 'moves', big: 'little', little: 'big' };

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: the other word of the ask's
 * pair (push or pull, moves or stays, big or little), the other object (compare), or a description of the motion
 * with no force word (observe). Concrete per item: the object, the surface and the answer computed from the sim.
 */
export function pushPullSpokenMisses(item: ArenaItem): KnownMiss[] {
  const answer = item.spokenAnswer.toLowerCase(), other = OTHER_WORD[answer];
  switch (item.kind) {
    case 'observe': return [
      ...(other ? [{ id: 'opposite_force', pattern: `The right answer is "${answer}": the ${item.objectName} was ${answer === 'push' ? 'pushed' : 'pulled'}. The learner gives the opposite force word, "${other}".`, examples: [other, `a ${other}`] }] : []),
      { id: 'described_motion', pattern: `The learner describes how the ${item.objectName} moved ("it went that way", "it rolled") and says neither push nor pull.`,
        examples: ['it went that way', 'it rolled'] }];
    case 'predict': return other ? [{ id: 'opposite_outcome',
      pattern: `The right answer is "${answer}": the ${item.objectName} on ${item.surfaceSpoken} ${answer === 'moves' ? 'moves' : 'stays still'}. `
        + `The learner gives the opposite answer, "${other}" (or "it ${other}", "it will ${other.replace(/s$/, '')}").`,
      examples: [other, other === 'stays' ? 'it stays' : 'it moves'] }] : [];
    case 'compare': {
      const wrong = otherObjectName(item);
      return [{ id: 'other_object', pattern: `The right answer is the ${item.spokenAnswer}: it slides farther than the ${wrong}. The learner names the other object, the ${wrong}.`, examples: [`the ${wrong.toLowerCase()}`] }];
    }
    case 'design': return other ? [{ id: 'opposite_size', pattern: `The right answer is "${answer}": the goal needs a ${answer} push. The learner gives the opposite answer, "${other}".`, examples: [other] }] : [];
  }
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
