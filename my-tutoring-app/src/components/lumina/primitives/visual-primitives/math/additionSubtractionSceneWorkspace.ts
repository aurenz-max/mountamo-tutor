/**
 * Addition-subtraction scene on the shared tutor/JEV teaching workspace (`additionSubtractionScene.boss.ts`, spoken
 * preset). Pure: the boss, the component and the journey read the same key, scene and checks.
 *
 * solve-story and Grade 1 act-out are one spoken number, judged against `additionSubtractionKey`. act-out at K and
 * create-story are enacted on the picture, and build-equation is built from tiles: those have no key, commit when the
 * child stops (the stillness window) and the activity checks them. A change group that waits for the story is a
 * stimulus the tutor brings in with `present` (or the learner with Show me).
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { numberMisses, offByMisses, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import {
  askFor,
  equationFaultOf,
  equationSpoken,
  publicValuesFor,
  type AddSubSceneItem,
} from './additionSubtractionSceneDomain';
import { numberWordFor } from './countingBoardDomain';
import type { AddSubMiss } from './additionSubtractionScene.card';
import { PRACTICE_NOTE } from './additionSubtractionSceneLevers';

export type { AddSubMiss, SpokenAddSubMiss } from './additionSubtractionScene.card';

/** The pack's own ask, without its "Your turn" hand-over. */
export const addSubAsk = (item: AddSubSceneItem) =>
  askFor(item).replace(/\s*Your turn(\.| —)\s*/, ' ').replace(/\s+/g, ' ').trim();

/** Are the items built on the picture (the child brings objects in or sends them away)? */
export const isEnacted = (item: AddSubSceneItem) =>
  item.kind === 'create-story' || (item.kind === 'act-out' && (item.band === 'K' || item.operation === 'subtraction'));

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The key a spoken item is judged against (`spokenKeyText` writes it); null on a picture or a number sentence, which
 * the activity checks. The scripted pack's judging contract, kept: counting aloud that ends on the answer counts, the
 * number with the objects named after it counts, and a number the story says out loud is not it.
 */
export function additionSubtractionKey(item: AddSubSceneItem): SpokenKey | null {
  if (item.answerKind === 'gesture') return null;
  const word = numberWordFor(item.answer);
  const echoed = Array.from(new Set(publicValuesFor(item))).filter(v => v !== item.answer).map(numberWordFor);
  return { answer: word, alsoAccept: [],
    acceptRule: `Counting aloud that ends on ${word} is that answer: the last number said tells the total. `
      + `${cap(word)} with the ${item.objectType} named after it is ${word} too.`,
    signatureError: (echoed.length ? `${cap(echoed.join(' or '))}, a number the story says out loud, is not it. ` : '')
      + 'A different number is not the answer, however close it is.' };
}

/** What the ask says by design: the story's own numbers, which may be the answer too (four take away two is two). */
export const additionSubtractionGiven = (item: AddSubSceneItem): string[] =>
  publicValuesFor(item).flatMap(v => [numberWordFor(v), String(v)]);

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

export interface AddSubView {
  /** Objects in the picture now, on an enacted item. */
  inPicture: number;
  /** A change group still waiting on the story. */
  changeWaiting: boolean;
  /** An easier practice story is on screen in place of the session item. */
  practice?: boolean;
}

/** The picture as the tutor reads it. Only this primitive's own facts: how to answer is the card's `moves`. */
export function additionSubtractionScene(item: AddSubSceneItem, view: AddSubView): SceneOf {
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
  // The number sentence is the reward: it is on screen only after credit.
  if (item.answerKind !== 'gesture') facts.afterCredit = 'The number sentence appears on screen only after credit.';
  if (view.practice) facts.practice = PRACTICE_NOTE;
  return { objects: [], facts };
}

/** The activity's checks and how a commit reads to the tutor and the observer, never the key. */
export const sceneMatches = (item: AddSubSceneItem, placed: number) => placed === item.answer;
export const describeScene = (item: AddSubSceneItem, placed: number) => `The picture ends with ${placed} ${item.objectType}.`;
export const equationMatches = (item: AddSubSceneItem, tiles: readonly string[]) => equationFaultOf(item, tiles) === 'match';
export const describeEquation = (tiles: readonly string[]) => `Built the number sentence "${tiles.join(' ').trim() || 'nothing'}".`;

const EQUATION_MISS = { incomplete: 'unfinished_equation', arithmetic: 'false_equation', operator: 'other_operation',
  numbers: 'other_numbers', match: undefined } as const;

/** What a wrong picture or number sentence shows (`AddSubMiss`). The spoken items name none here: the tutor judges them. */
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
  `The learner asked to hear the story again. Say only this, once: "${addSubAsk(item)}" Never say the answer.`;
