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
import { numberMisses, offByMisses, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
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

/** What a wrong spoken story answer shows (handoff 20 Part B). */
export type SpokenAddSubMiss = OffByMiss | 'said_start' | 'said_change' | 'said_result' | 'other_operation';

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer: a number the story says
 * (how many at the start, how many joined or left, how many at the end), the story's two numbers put together the
 * other way, then the off-by misses.
 */
export function additionSubtractionSpokenMisses(item: AddSubSceneItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const a = item.answer, obj = item.objectType, join = item.operation === 'addition';
  const unknown = item.kind === 'solve-story' ? item.unknownPosition : 'result';
  const [x, y] = publicValuesFor(item), sum = x + y, diff = Math.abs(x - y);
  return [...numberMisses(a, [
    { id: 'said_start', value: unknown === 'start' ? undefined : item.startCount,
      pattern: n => `The story starts with ${n} ${obj}. The learner's answer is ${n}, the number the story starts with.` },
    { id: 'said_change', value: unknown === 'change' ? undefined : item.changeCount,
      pattern: n => `In the story ${n} ${obj} ${join ? 'join' : 'go away'}. The learner's answer is ${n}, the number that ${join ? 'joined' : 'went away'}.` },
    { id: 'said_result', value: unknown === 'result' ? undefined : item.resultCount,
      pattern: n => `The story ends with ${n} ${obj}. The learner's answer is ${n}, the number at the end of the story.` },
    { id: 'other_operation', value: a === sum ? diff : sum,
      pattern: n => `The story's numbers are ${x} and ${y}. The learner's answer is ${n}, those two numbers ${a === sum ? 'taken apart' : 'added together'} instead.` },
  ]), ...offByMisses(a, `the ${a} ${obj} the question asks for`)];
}

export function additionSubtractionAssignment(item: AddSubSceneItem): TeachingAssignment {
  if (item.answerKind === 'gesture') return { id: item.id, task: ask(item), response: 'gesture' };
  const echoed = publicValuesFor(item).filter(v => v !== item.answer);
  const misses = additionSubtractionSpokenMisses(item);
  return { id: item.id, task: ask(item), response: 'speech',
    expectedAnswer: `${numberWordFor(item.answer)} (${item.answer}). Counting aloud that ends on ${numberWordFor(item.answer)} `
      + `counts, and so does the number with the ${item.objectType} named after it.`
      + (echoed.length ? ` ${echoed.map(v => numberWordFor(v)).join(' or ')}, a number the story says out loud, is not it.` : ''),
    ...(misses.length ? { misses } : {}) };
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
      + 'when you use present, after you tell that part of the story. Then, in the same turn, finish the task: '
      + 'the rest of the story and its question.';
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

/**
 * What a wrong picture or number sentence shows (`TeachingAttempt.miss`, handoff 20):
 * - a picture (act-out at K, create-story): `no_change` (it ends on the story's start number), `wrong_way`
 *   (objects sent away on a joining story, or brought in on a leaving one, from where the picture started),
 *   then `one_short` / `one_over` / `short_by_more` / `over_by_more` from the answer;
 * - a number sentence: `unfinished_equation`, `false_equation` (it does not add up), `other_operation` (true,
 *   with the other sign), `other_numbers` (true, with numbers the story does not have).
 * The spoken items name none: the tutor judges them.
 */
export type AddSubMiss = 'no_change' | 'wrong_way' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more'
  | 'unfinished_equation' | 'false_equation' | 'other_operation' | 'other_numbers';

const EQUATION_MISS = { incomplete: 'unfinished_equation', arithmetic: 'false_equation', operator: 'other_operation',
  numbers: 'other_numbers', match: undefined } as const;

export function addSubMiss(item: AddSubSceneItem | null, work: { placed: number } | { tiles: readonly string[] }): AddSubMiss | undefined {
  if (!item || item.answerKind !== 'gesture') return undefined;
  if ('tiles' in work) return EQUATION_MISS[equationFaultOf(item, work.tiles)];
  const { placed } = work, off = placed - item.answer;
  if (off === 0) return undefined;
  if (placed === item.startCount) return 'no_change';
  // Where the picture started: empty on a create-story join, the start group everywhere else.
  const seeded = item.kind === 'create-story' && item.operation === 'addition' ? 0 : item.startCount;
  if (seeded > 0 && (item.operation === 'addition' ? placed < seeded : placed > seeded)) return 'wrong_way';
  return off === -1 ? 'one_short' : off === 1 ? 'one_over' : off < 0 ? 'short_by_more' : 'over_by_more';
}

/** What tap-to-hear asks the tutor to say: the story and the question, never the answer. */
export const hearStoryRequest = (item: AddSubSceneItem) =>
  `The learner asked to hear the story again. Say only this, once: "${ask(item)}" Never say the answer.`;

/** The journey's answers: a number said, the tiles pressed, or the count the picture must end on. */
export function additionSubtractionJourneyAnswers(item: AddSubSceneItem) {
  const { correct, plainWrong, tapped, placed } = addSubHarnessAnswers(item);
  return { correct, plainWrong, tapped, placed };
}
