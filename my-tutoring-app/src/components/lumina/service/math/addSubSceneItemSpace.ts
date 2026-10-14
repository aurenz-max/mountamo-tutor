/**
 * addition-subtraction-scene problems from an item space (service/itemSpace, skill /add-item-space).
 *
 * When a lesson asks for a tier (`config.difficulty`) and the objective is a strand code owns, the
 * space picks every challenge's numbers (and, on solve-story, which one is hidden); the LLM writes only
 * the story around them. A story that drops a given number, adds one, or states the hidden one is
 * replaced by the code template here, so a challenge never ships off its item.
 *
 * Which items each mode can use (contract R6, item-space clause):
 *   - every mode: one step (the scene shows one group and one action), every count within maxNumber.
 *   - solve-story: any unknown slot.
 *   - act-out, build-equation, create-story: the result unknown. Act-out enacts start ± change and
 *     counts; build-equation writes the forward sentence; create-story builds the scene for it.
 *   - build-equation keeps its story-situation ladder (join/separate, part-whole, compare): the
 *     translation from story to symbols is a difficulty the space does not model. Part-whole stories
 *     take addition items, compare stories subtraction items.
 *   - create-story has no tier (open-ended building); the space gives it varied equations, which
 *     the LLM did not (10 + 3, 12 + 4, 15 − 5 every run).
 */
import type { AddSubChallenge } from '../../primitives/visual-primitives/math/AdditionSubtractionScene';
import { numberWordFor, objectSingularFor } from '../../primitives/visual-primitives/math/countingBoardDomain';
import type { AddSub20Item } from '../itemSpace/addSub20';
import type { ItemSpaceId } from '../itemSpace';

export type SceneMode = 'act-out' | 'build-equation' | 'solve-story' | 'create-story';
export type SceneStoryType = 'join' | 'separate' | 'compare' | 'part-whole';

export interface SceneStory {
  operation: 'addition' | 'subtraction';
  storyType: SceneStoryType;
  startCount: number;
  changeCount: number;
  resultCount: number;
  unknownPosition: 'result' | 'change' | 'start';
  equation: string;
}

/** Each space a story can be built from, and how one of its items becomes a story (null: not tellable). */
const TO_STORY: Partial<Record<ItemSpaceId, (item: any) => SceneStory | null>> = {
  'add-sub-20': (it: AddSub20Item) => {
    if (it.steps.length !== 1) return null;
    const { a, b, op } = it.steps[0];
    const r = op === '+' ? a + b : a - b;
    return {
      operation: op === '+' ? 'addition' : 'subtraction',
      storyType: op === '+' ? 'join' : 'separate',
      startCount: a,
      changeCount: b,
      resultCount: r,
      unknownPosition: it.unknown,
      equation: `${a} ${op} ${b} = ${r}`,
    };
  },
};

export const sceneSpaceSupported = (space: ItemSpaceId): boolean => !!TO_STORY[space];

const opFits = (t: SceneStoryType, op: SceneStory['operation']) =>
  (t === 'part-whole' || t === 'join' ? op === 'addition' : op === 'subtraction');

/**
 * The item as a story when the mode can use it in a scene capped at `maxNumber`, else null. `storyTypes`
 * is build-equation's tier situation: part-whole needs an addition item, compare a subtraction item.
 */
export function itemAsStory(
  space: ItemSpaceId, item: unknown, maxNumber: number,
  mode: SceneMode = 'solve-story', storyTypes?: readonly SceneStoryType[],
): SceneStory | null {
  const s = TO_STORY[space]?.(item);
  if (!s) return null;
  if ([s.startCount, s.changeCount, s.resultCount].some((v) => v > maxNumber)) return null;
  if (mode !== 'solve-story' && s.unknownPosition !== 'result') return null;
  if (storyTypes?.length) {
    const fits = storyTypes.filter((t) => opFits(t, s.operation));
    if (!fits.length) return null;
    return { ...s, storyType: fits.includes(s.storyType) ? s.storyType : fits[0] };
  }
  return s;
}

/** The numbers the story says out loud (the other one is what the learner finds). */
export const givenCounts = (s: SceneStory): number[] =>
  s.unknownPosition === 'change' ? [s.startCount, s.resultCount]
    : s.unknownPosition === 'start' ? [s.changeCount, s.resultCount]
      : [s.startCount, s.changeCount];

export const hiddenCount = (s: SceneStory): number =>
  s.unknownPosition === 'change' ? s.changeCount : s.unknownPosition === 'start' ? s.startCount : s.resultCount;

/** Every number a story states, as numerals or number words up to twenty, in order of appearance. */
function numbersIn(text: string): number[] {
  const words = Array.from({ length: 21 }, (_, n) => numberWordFor(n));
  const tokens = text.toLowerCase().match(/\d+|[a-z]+/g) ?? [];
  return tokens.flatMap((t) => (/^\d+$/.test(t) ? [Number(t)] : words.includes(t) ? [words.indexOf(t)] : []));
}

/**
 * The written story states each given count, no other number, and not the hidden one. "one" counts
 * as a number, so "one by one" sends the story to the template; that costs only variety.
 */
export function storyFitsItem(story: string, s: SceneStory): boolean {
  const said = numbersIn(story);
  const given = givenCounts(s);
  const count = (xs: number[], v: number) => xs.filter((x) => x === v).length;
  const keepsGiven = given.every((v) => count(said, v) >= count(given, v));
  const extra = said.some((v) => !given.includes(v));
  return keepsGiven && !extra && !/\?/.test(story);
}

/** A correct story built in code, used when the written one misses its item. */
export function templateStory(s: SceneStory, objectType: string, scene: string): string {
  const noun = (n: number) => `${n} ${n === 1 ? objectSingularFor(objectType) : objectType}`;
  const place = `in the ${scene}`;
  const be = (n: number) => (n === 1 ? 'is' : 'are');
  if (s.storyType === 'part-whole') {
    return `${noun(s.startCount)} ${be(s.startCount)} ${place}. ${noun(s.changeCount)} ${be(s.changeCount)} outside.`;
  }
  if (s.storyType === 'compare') {
    return `${noun(s.startCount)} ${be(s.startCount)} big. ${noun(s.changeCount)} ${be(s.changeCount)} small.`;
  }
  const move = (n: number | null) => (s.operation === 'addition'
    ? (n === null ? 'Some more come.' : `${n} more ${n === 1 ? 'comes' : 'come'}.`)
    : (n === null ? 'Some go away.' : `${n} ${n === 1 ? 'goes' : 'go'} away.`));
  const now = `Now there ${be(s.resultCount)} ${noun(s.resultCount)}.`;
  if (s.unknownPosition === 'change') return `${noun(s.startCount)} ${be(s.startCount)} ${place}. ${move(null)} ${now}`;
  if (s.unknownPosition === 'start') return `Some ${objectType} are ${place}. ${move(s.changeCount)} ${now}`;
  return `${noun(s.startCount)} ${be(s.startCount)} ${place}. ${move(s.changeCount)}`;
}

export interface SpaceStory {
  story: SceneStory;
  itemSpace: { space: string; structure: string; beta: number };
}

/** `count` stories in the beta band that the mode can tell, or empty (the caller keeps its own path). */
export function pickSpaceStories(opts: {
  space: ItemSpaceId;
  pick: (n: number, lo: number, hi: number, rand?: () => number, accept?: (item: any) => boolean) => { beta: number; structure: string }[];
  band: [number, number];
  count: number;
  maxNumber: number;
  mode?: SceneMode;
  storyTypes?: readonly SceneStoryType[];
  rand?: () => number;
}): SpaceStory[] {
  const asStory = (it: unknown) => itemAsStory(opts.space, it, opts.maxNumber, opts.mode, opts.storyTypes);
  const items = opts.pick(opts.count, opts.band[0], opts.band[1], opts.rand, (it) => asStory(it) !== null);
  if (items.length < opts.count) return [];
  return items.map((it) => ({
    story: asStory(it)!,
    itemSpace: { space: opts.space, structure: it.structure, beta: Number(it.beta.toFixed(2)) },
  }));
}

/** Overwrite a written challenge with its item's numbers; keep its story only when it fits. */
export function applySpaceStory(ch: AddSubChallenge, s: SpaceStory, mode: SceneMode = 'solve-story'): AddSubChallenge {
  const { story } = s;
  const storyText = ch.storyText && storyFitsItem(ch.storyText, story)
    ? ch.storyText : templateStory(story, ch.objectType, ch.scene);
  return { ...ch, type: mode, ...story, storyText, itemSpace: s.itemSpace };
}
