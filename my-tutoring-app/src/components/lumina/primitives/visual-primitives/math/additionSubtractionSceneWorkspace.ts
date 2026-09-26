/**
 * Addition-subtraction scene on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C4). Its only teaching path: the scripted runner was
 * retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. solve-story and
 * Grade 1 act-out are one spoken number. act-out at K and create-story are enacted on the
 * picture, and build-equation is built from tiles: those commit when the child stops (the
 * stillness window) and the activity checks them. A change group that waits for the story
 * is a stimulus the tutor brings in with `present` (or the learner with Show me).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import {
  addSubHarnessAnswers,
  askFor,
  equationFaultOf,
  equationSpoken,
  publicValuesFor,
  type AddSubSceneItem,
} from './additionSubtractionSceneScript';
import { numberWordFor } from './countingBoardScript';

/** The pack's own ask, without its "Your turn" hand-over. */
const ask = (item: AddSubSceneItem) => askFor(item).replace(/\s*Your turn(\.| —)\s*/, ' ').replace(/\s+/g, ' ').trim();

/** Are the items built on the picture (the child brings objects in or sends them away)? */
export const isEnacted = (item: AddSubSceneItem) =>
  item.kind === 'create-story' || (item.kind === 'act-out' && (item.band === 'K' || item.operation === 'subtraction'));

export function additionSubtractionAssignment(item: AddSubSceneItem): TeachingAssignment {
  if (item.answerKind === 'gesture') return { id: item.id, task: ask(item), response: 'gesture' };
  const echoed = publicValuesFor(item).filter(v => v !== item.answer);
  return { id: item.id, task: ask(item), response: 'speech',
    expectedAnswer: `${numberWordFor(item.answer)} (${item.answer}). Counting aloud that ends on ${numberWordFor(item.answer)} `
      + `counts, and so does the number with the ${item.objectType} named after it.`
      + (echoed.length ? ` ${echoed.map(v => numberWordFor(v)).join(' or ')}, a number the story says out loud, is not it.` : '') };
}

export interface AddSubView {
  /** Objects in the picture now, on an enacted item. */
  inPicture: number;
  /** A change group still waiting on the story. */
  changeWaiting: boolean;
}

export function additionSubtractionScene(item: AddSubSceneItem, view: AddSubView): WorkspaceScene {
  const facts: Record<string, string | number> = {
    [item.kind === 'create-story' ? 'numberSentence' : 'story']: item.kind === 'create-story' ? equationSpoken(item) : item.situation,
    objects: item.objectType,
  };
  // The picture's count is a fact only where the picture is the answer (the enacted gesture items).
  if (item.answerKind === 'gesture' && isEnacted(item)) facts.inPicture = view.inPicture;
  if (view.changeWaiting) {
    facts.changeGroup = `Only the first ${numberWordFor(item.startCount)} are in the picture. The ones that join arrive `
      + 'when you use present, after you tell that part of the story.';
  }
  facts.constraints = item.kind === 'build-equation'
    ? 'The learner builds the number sentence from tiles; it is checked when they stop. You cannot place tiles.'
    : item.answerKind === 'gesture'
      ? `The learner brings ${item.objectType} in with the add button and taps one to send it away; the picture is checked `
        + 'when they stop. You cannot add or remove objects.'
      : 'The learner says the number out loud' + (isEnacted(item) ? ' after sending the ones that go away out of the picture.' : '.')
        + ' The number sentence appears only after credit.';
  return { objects: [], facts };
}

/** The activity's checks and how a commit reads to the tutor and the observer, never the key. */
export const sceneMatches = (item: AddSubSceneItem, placed: number) => placed === item.answer;
export const describeScene = (item: AddSubSceneItem, placed: number) => `The picture ends with ${placed} ${item.objectType}.`;
export const equationMatches = (item: AddSubSceneItem, tiles: readonly string[]) => equationFaultOf(item, tiles) === 'match';
export const describeEquation = (tiles: readonly string[]) => `Built the number sentence "${tiles.join(' ').trim() || 'nothing'}".`;

/** What tap-to-hear asks the tutor to say: the story and the question, never the answer. */
export const hearStoryRequest = (item: AddSubSceneItem) =>
  `The learner asked to hear the story again. Say only this, once: "${ask(item)}" Never say the answer.`;

/** The journey's answers: a number said, the tiles pressed, or the count the picture must end on. */
export function additionSubtractionJourneyAnswers(item: AddSubSceneItem) {
  const { correct, plainWrong, tapped, placed } = addSubHarnessAnswers(item);
  return { correct, plainWrong, tapped, placed };
}
