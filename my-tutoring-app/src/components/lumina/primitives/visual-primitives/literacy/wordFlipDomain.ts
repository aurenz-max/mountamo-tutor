/**
 * word-flip's domain: the items, the ask, the spoken key, the known misses, the scene and the content gate. Pure; the
 * boss, the levers, the component and the tests read the same rules.
 *
 * A spoken item is one changed word: the frame shows the source word and its picture (one thing, or an action today)
 * and how many there are now (or "yesterday"); the learner says the changed word. The source word is the stimulus and
 * is shown; the changed word is the answer and is a blank until it is credited. There are no answer chips: tapping
 * "dogs" out of three printed words is reading, and a chip prints the answer. A build item (`build_inflect`) is the
 * shared word-part build (`inflectBuild.ts`); its checks live there.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { WordFlipChallenge, WordFlipChallengeType, WordFlipData } from './WordFlip';
import type { SpokenFlipMode } from './wordFlip.card';
import { affixBuildAssignment } from './affixBuild';
import { inflectItemsFrom, type InflectBuildItem } from './inflectBuild';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';

/** A spoken item: the challenge, its eval mode (its type) and the lesson's tier (when the model lever comes). */
export type FlipWord = WordFlipChallenge & { mode: SpokenFlipMode; supportTier: SupportTier };
/** A build item: the word-part build's ask, on build_inflect. */
export type FlipBuild = InflectBuildItem & { mode: 'build_inflect'; supportTier: SupportTier };
export type WordFlipItem = FlipWord | FlipBuild;

export const isFlipBuild = (item: WordFlipItem): item is FlipBuild => item.mode === 'build_inflect';
export const isPluralFlip = (type: WordFlipChallengeType): boolean => type !== 'past_ed' && type !== 'past_irregular';

const tierOf = (data: Pick<WordFlipData, 'supportTier'>): SupportTier => data.supportTier ?? 'medium';

/** A challenge as a spoken item of this lesson. */
export const asFlipWord = (c: WordFlipChallenge, supportTier: SupportTier): FlipWord => ({ ...c, mode: c.type, supportTier });
/** A build ask as a build item of this lesson. */
export const asFlipBuild = (item: InflectBuildItem, supportTier: SupportTier): FlipBuild => ({ ...item, mode: 'build_inflect', supportTier });

/** The session's spoken items, each stamped with its mode and the lesson's tier. */
export const flipWords = (data: Pick<WordFlipData, 'challenges' | 'supportTier'>): FlipWord[] =>
  (data.challenges ?? []).map(c => asFlipWord(c, tierOf(data)));

/** The session's build asks, through the build's own gate. */
export const flipBuilds = (data: Pick<WordFlipData, 'buildItems' | 'availableParts' | 'supportTier'>): FlipBuild[] =>
  inflectItemsFrom(data.buildItems ?? [], data.availableParts ?? [], data.supportTier).map(i => asFlipBuild(i, tierOf(data)));

/** The session's items: the build asks on build_inflect, the challenges otherwise. */
export const wordFlipItems = (data: WordFlipData): WordFlipItem[] =>
  data.task === 'build_inflect' ? flipBuilds(data) : flipWords(data);

// ── Words the frame and the ask share ────────────────────────────────────────

/** Number words for the many-side, printed and said from here, so the ask and the caption agree. */
const COUNT_WORDS: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };
export const countWord = (count: number): string => COUNT_WORDS[count] ?? String(count);
export const countWordCapitalized = (count: number): string => {
  const word = countWord(count);
  return word.charAt(0).toUpperCase() + word.slice(1);
};

/**
 * Before/after pairs per rule, for the model and practice levers and the build's ending chart. Code-owned: each is a
 * clean case of its rule, and a lever uses only a pair the session never asks about.
 */
export interface FlipModelPair { singular: string; plural: string }
export const MODEL_PAIRS: Record<WordFlipChallengeType, readonly FlipModelPair[]> = {
  plural_s: [
    { singular: 'hat', plural: 'hats' }, { singular: 'cup', plural: 'cups' }, { singular: 'bug', plural: 'bugs' },
    { singular: 'pen', plural: 'pens' }, { singular: 'mug', plural: 'mugs' }, { singular: 'bed', plural: 'beds' },
    { singular: 'van', plural: 'vans' }, { singular: 'rug', plural: 'rugs' },
  ],
  plural_es: [
    { singular: 'bus', plural: 'buses' }, { singular: 'box', plural: 'boxes' }, { singular: 'dish', plural: 'dishes' },
    { singular: 'brush', plural: 'brushes' }, { singular: 'watch', plural: 'watches' }, { singular: 'peach', plural: 'peaches' },
  ],
  plural_y: [
    { singular: 'baby', plural: 'babies' }, { singular: 'puppy', plural: 'puppies' }, { singular: 'bunny', plural: 'bunnies' },
    { singular: 'pony', plural: 'ponies' }, { singular: 'cherry', plural: 'cherries' }, { singular: 'fly', plural: 'flies' },
  ],
  irregulars: [
    { singular: 'mouse', plural: 'mice' }, { singular: 'child', plural: 'children' }, { singular: 'foot', plural: 'feet' },
    { singular: 'tooth', plural: 'teeth' }, { singular: 'goose', plural: 'geese' }, { singular: 'person', plural: 'people' },
  ],
  past_ed: [
    { singular: 'jump', plural: 'jumped' }, { singular: 'walk', plural: 'walked' }, { singular: 'play', plural: 'played' },
    { singular: 'help', plural: 'helped' }, { singular: 'look', plural: 'looked' }, { singular: 'wash', plural: 'washed' },
  ],
  past_irregular: [
    { singular: 'go', plural: 'went' }, { singular: 'run', plural: 'ran' }, { singular: 'eat', plural: 'ate' },
    { singular: 'see', plural: 'saw' }, { singular: 'come', plural: 'came' }, { singular: 'sit', plural: 'sat' },
  ],
};

// ── The ask and the key ──────────────────────────────────────────────────────

/**
 * What the learner is asked. Never the changed word. "Three what?" has one correct completion, the plural, where
 * "What word?" could be answered with the picture's name.
 */
export function flipAsk(item: WordFlipItem): string {
  if (isFlipBuild(item)) return affixBuildAssignment(item).task;
  const count = countWord(item.count ?? 2);
  return isPluralFlip(item.type)
    ? `There is one ${item.sourceWord}. Now there are ${count}. Say the word for ${count} of them: ${count} what?`
    : `Today I ${item.sourceWord}. It already happened yesterday. Say how it goes: yesterday I...`;
}

/** What the ask says by design: the source word (the stimulus). */
export const flipGiven = (item: WordFlipItem): string[] => (isFlipBuild(item) ? [] : [item.sourceWord]);

/** The regular rule applied to an irregular word: the miss an irregular item names. */
const regularized = (item: WordFlipChallenge) => {
  const source = item.sourceWord.toLowerCase();
  if (isPluralFlip(item.type)) return `${source}s`;
  return /[^aeiou][aeiou][bdgmnpt]$/.test(source) ? `${source}${source.at(-1)}ed` : `${source.replace(/e$/, '')}ed`;
};
const doubled = (item: WordFlipChallenge) => (item.type === 'past_ed' ? `${item.answer}ed` : `${item.answer}es`);

/** The spoken key: the changed word, alone or in the frame's phrase. Null on a build item (the build checks it). */
export function flipKey(item: WordFlipItem): SpokenKey | null {
  if (isFlipBuild(item)) return null;
  const answer = item.answer, source = item.sourceWord;
  const phrase = isPluralFlip(item.type) ? `${countWord(item.count ?? 2)} ${answer}` : `yesterday I ${answer}`;
  const irregular = item.type === 'irregulars' || item.type === 'past_irregular';
  return { answer, alsoAccept: [phrase],
    acceptRule: 'The changed word inside a short phrase is right; the whole word, its ending included, is what is judged.',
    signatureError: irregular
      ? `"${source}" said back unchanged, or the usual ending added ("${regularized(item)}"), is not ${answer}.`
      : `"${source}" said back unchanged, a different ending, or the ending put on twice ("${doubled(item)}") is not ${answer}.` };
}

/**
 * The item's known wrong answers (handoff 20 Part B): the word said back unchanged, the regular rule on an irregular
 * word, the ending twice. `wrong_ending` is not stated: on -es, -y and -ed items it is heard as the answer ("boxs" as
 * "box", "babys" as "babies"), and on plural_s the observer read "sockses" as the "sockes" pattern in 5 of 5 probe
 * runs on 09-28.
 */
export function flipSpokenMisses(item: WordFlipItem | WordFlipChallenge): KnownMiss[] {
  if ('mode' in item && isFlipBuild(item)) return [];
  const c = item as WordFlipChallenge;
  const source = c.sourceWord.toLowerCase(), answer = c.answer.toLowerCase();
  const plural = isPluralFlip(c.type), change = plural ? `the word for more than one ${source}` : `"${source}" said as already happened`;
  const fact = `The answer is "${answer}", ${change}. `;
  const unchanged = { id: 'unchanged', pattern: `${fact}The learner says "${source}", the same word as for ${plural ? `one ${source}` : 'today'}, with nothing added or changed.`, examples: [source, `${plural ? countWord(c.count ?? 2) : 'yesterday I'} ${source}`] };
  if (c.type === 'irregulars' || c.type === 'past_irregular') {
    const regular = regularized(c);
    return [{ id: 'regularized', pattern: `${fact}The learner adds the usual ending to "${source}" and says "${regular}", a word that is not "${answer}".`, examples: [regular] }, unchanged];
  }
  const twice = doubled(c);
  return [
    unchanged,
    { id: 'double_ending', pattern: `${fact}The learner puts the ending on twice and says "${twice}".`, examples: [twice] },
  ];
}

/** What the tutor reads about a spoken item. The source word is the stimulus; the changed word is never in it. */
export function flipScene(item: WordFlipChallenge): SceneOf {
  return { objects: [], facts: {
    change: isPluralFlip(item.type) ? `one to ${countWord(item.count ?? 2)}` : 'today to yesterday',
    constraints: 'The word on the one-side card is printed; the new word is a blank until it is credited.',
  } };
}

/** What a tapped source card asks the tutor to say: the word unchanged, never the answer. */
export const sourceWordRequest = (sourceWord: string) =>
  `The learner tapped the word card. Say this word once, unchanged, and nothing else: "${sourceWord}".`;

/** The journey's answers: the changed word, or the source word said back (the signature error). */
export const flipHarnessAnswers = (c: Pick<WordFlipChallenge, 'sourceWord' | 'answer'>) => ({ correct: c.answer, plainWrong: c.sourceWord });

const TYPES: readonly string[] = ['plural_s', 'plural_es', 'plural_y', 'irregulars', 'past_ed', 'past_irregular'];

/**
 * Reject content the frame cannot ask. Every challenge needs its type, a source word and a code-derived answer that
 * CHANGES the word: an answer equal to its source (one sheep, two sheep) is solved by saying the picture's name back.
 * The open build: every ask must pass the build's own gate.
 */
export function validateWordFlipData(value: unknown): WordFlipData {
  const d = value as WordFlipData;
  if (d?.task === 'build_inflect') {
    if (typeof d.title !== 'string' || !Array.isArray(d.availableParts) || !Array.isArray(d.buildItems) || !d.buildItems.length
        || d.buildItems.length > 12) throw new Error('Generated word flip has invalid lesson content.');
    if (inflectItemsFrom(d.buildItems, d.availableParts, d.supportTier).length !== d.buildItems.length)
      throw new Error('A word-flip build ask cannot be asked.');
    return d;
  }
  return validateChallengePool<WordFlipData>(value,
    c => !!c && TYPES.includes(c.type) && typeof c.sourceWord === 'string' && !!c.sourceWord.trim()
      && typeof c.answer === 'string' && !!c.answer.trim() && c.answer.trim().toLowerCase() !== c.sourceWord.trim().toLowerCase(),
    { pool: 'Generated word flip has invalid lesson content.', item: 'A word-flip challenge cannot be asked.' });
}
