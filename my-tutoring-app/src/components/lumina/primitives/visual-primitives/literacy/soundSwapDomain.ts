/**
 * sound-swap's domain: the items, the ask, the spoken key, the known misses, the scene and the content gate. Pure; the
 * boss, the levers, the component and the tests read the same rules.
 *
 * A spoken item is one change: the learner hears a starting word and one named sound to add, take away or change, and
 * says the new word. The starting word and its sounds are the stimulus and are shown; the new word is the answer and
 * is not shown, pictured or said before it is credited. The move names its sound every time: "change one sound in
 * cat" is answered by cap, cot, bat and a dozen more, and an ask with many right answers cannot be judged. A build
 * item (`swap_build`) is the shared letter build (`letterBuild.ts`); its checks live there.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import type { SoundSwapChallenge, SoundSwapData } from './SoundSwap';
import type { SwapOperation } from './soundSwap.card';
import { letterAssignment, letterItemsFrom, type LetterBuildItem } from './letterBuild';
import { speakablePhoneme } from './phonemeVoice';
import { wordReadingMisses } from './spokenReadingMisses';

/** A spoken item: the challenge, its eval mode (its operation) and the lesson's tier (when the model lever comes). */
export type SwapWord = SoundSwapChallenge & { mode: SwapOperation; supportTier: SupportTier };
/** A build item: the shared letter build's ask, on swap_build. */
export type SwapBuild = LetterBuildItem & { mode: 'swap_build'; supportTier: SupportTier };
export type SoundSwapItem = SwapWord | SwapBuild;

export const isSwapBuild = (item: SoundSwapItem): item is SwapBuild => item.mode === 'swap_build';

const tierOf = (data: Pick<SoundSwapData, 'supportTier'>): SupportTier => data.supportTier ?? 'medium';

/** A challenge as a spoken item of this lesson. */
export const asSwapWord = (c: SoundSwapChallenge, supportTier: SupportTier): SwapWord => ({ ...c, mode: c.operation, supportTier });
/** A letter-build ask as a build item of this lesson. */
export const asSwapBuild = (item: LetterBuildItem, supportTier: SupportTier): SwapBuild => ({ ...item, mode: 'swap_build', supportTier });

/** The session's spoken items, each stamped with its operation and the lesson's tier. */
export const swapWords = (data: Pick<SoundSwapData, 'challenges' | 'supportTier'>): SwapWord[] =>
  (data.challenges ?? []).map(c => asSwapWord(c, tierOf(data)));

/** The session's build asks, through the shared build's own gate. */
export const swapBuilds = (data: Pick<SoundSwapData, 'buildItems' | 'supportTier'>): SwapBuild[] =>
  letterItemsFrom(data.buildItems ?? [], data.supportTier).map(i => asSwapBuild(i, tierOf(data)));

/** The session's items: the build asks on swap_build, the challenges otherwise. */
export const soundSwapItems = (data: SoundSwapData): SoundSwapItem[] =>
  data.task === 'letter_build' ? swapBuilds(data) : swapWords(data);

/**
 * The MOVE, as an imperative, naming its sound every time. Every phoneme goes through `speakablePhoneme`: the line is
 * spoken, and a medial-vowel swap ("Change /æ/ to /ɛ/") is the one place a phoneme cannot be dropped for being
 * unsayable (user ruling, first live run 2026-08-09: the sound-by-sound walk before the move was deleted).
 */
export function moveAsk(item: Pick<SoundSwapChallenge, 'operation' | 'addPhoneme' | 'addPosition' | 'deletePhoneme' | 'oldPhoneme' | 'newPhoneme'>): string {
  const say = speakablePhoneme;
  if (item.operation === 'addition') return `Add ${say(item.addPhoneme ?? '')} at the ${item.addPosition ?? 'beginning'}.`;
  if (item.operation === 'deletion') return `Take away ${say(item.deletePhoneme ?? '')}.`;
  return `Change ${say(item.oldPhoneme ?? '')} to ${say(item.newPhoneme ?? '')}.`;
}

/** What the learner is asked: the starting word, the move, the hand-over. Never the new word. */
export const swapAsk = (item: SoundSwapItem): string =>
  (isSwapBuild(item) ? letterAssignment(item).task : `The word is ${item.originalWord}. ${moveAsk(item)} Say the new word.`);

/**
 * What the ask says by design: its frame. A new word that is one of the frame's own words (his → is) is not told by
 * the ask; the item's own words and sounds are never in this list, so a real leak still fails `askLeaks`.
 */
const ASK_FRAME = 'The word is … Add … at the beginning … at the end … Take away … Change … to … Say the new word.';
export const swapGiven = (item: SoundSwapItem): readonly string[] => (isSwapBuild(item) ? [] : [ASK_FRAME]);

/** The spoken key: the new word; a sound-out that ends in it is right; the starting word said back is not. Null on a build. */
export function swapKey(item: SoundSwapItem): SpokenKey | null {
  if (isSwapBuild(item)) return null;
  return { answer: item.resultWord, alsoAccept: [],
    acceptRule: `Sounding it out first and then saying ${item.resultWord} whole is right.`,
    signatureError: `The starting word ${item.originalWord} said back unchanged, a different word (even one close to `
      + `${item.resultWord}, usually a different sound changed), or the separate sounds with no word at the end are not yet `
      + `${item.resultWord}.` };
}

/**
 * The item's known wrong answers (handoff 20 Part B), from the ids `SWAP_MISSES` declares, most specific first:
 * the new word's sounds with no word, the starting word said back, an added sound put at the other end, a made-up
 * word. `other_position` is stated for addition only, where the other end is one place.
 */
export function swapSpokenMisses(c: SoundSwapChallenge | SoundSwapItem): KnownMiss[] {
  if ('mode' in c && isSwapBuild(c)) return [];
  const item = c as SoundSwapChallenge;
  const start = item.originalWord.toLowerCase(), result = item.resultWord.toLowerCase();
  const sound = (item.addPhoneme ?? '').replace(/\//g, '').trim();
  const moved = item.operation === 'addition' && /^[a-z]{1,2}$/.test(sound) && item.addPosition
    ? (item.addPosition === 'beginning' ? `${start}${sound}` : `${sound}${start}`) : null;
  return [
    ...wordReadingMisses(result, { only: ['sounds_no_word'], fact: `The new word is "${result}". ` }),
    { id: 'echo_start', pattern: `The starting word is "${start}" and the new word is "${result}". The learner says the starting word "${start}" back unchanged.`, examples: [start] },
    ...(moved ? [{ id: 'other_position', pattern: `The sound /${sound}/ goes at the ${item.addPosition} of "${start}" to make "${result}". The learner puts it at the other end instead and says "${moved}".`, examples: [moved] }] : []),
    { id: 'nonword', pattern: `The new word is "${result}", a real word. The learner says a made-up word that is not a real word and is neither "${start}" nor "${result}".` },
  ];
}

/** What the tutor reads about a spoken item, beyond the ask. */
export function swapScene(c: SoundSwapChallenge, view: { highlighted: boolean }): SceneOf {
  return { objects: [], facts: {
    operation: c.operation,
    constraints: 'The starting word and its sounds are printed; the new word and its picture caption are not shown '
      + 'until it is credited.' + (view.highlighted ? ' The sound to change is highlighted.' : ''),
  } };
}

/** What a tapped sound asks the tutor to say: that sound only, never the new word. */
export const swapSoundRequest = (raw: string) => `The learner tapped a sound. Say only that sound, once: ${speakablePhoneme(raw)}.`;

/** The journey's answers: the new word, or the starting word said back unchanged. */
export const swapHarnessAnswers = (c: Pick<SoundSwapChallenge, 'resultWord' | 'originalWord'>) =>
  ({ correct: c.resultWord, plainWrong: c.originalWord });

/** The sound each operation names; the ask cannot be judged without it. */
const namesItsSound = (c: SoundSwapChallenge) =>
  c.operation === 'addition' ? !!c.addPhoneme
    : c.operation === 'deletion' ? !!c.deletePhoneme
      : c.operation === 'substitution' ? !!c.oldPhoneme && !!c.newPhoneme : false;

/** The open build (swap_build): every ask must pass the surface's own gate. */
function validateLetterBuild(d: SoundSwapData): SoundSwapData {
  if (typeof d.title !== 'string' || !Array.isArray(d.buildItems) || !d.buildItems.length || d.buildItems.length > 12
      || letterItemsFrom(d.buildItems, d.supportTier).length !== d.buildItems.length)
    throw new Error('Generated sound swap has invalid lesson content.');
  return d;
}

/** Reject a challenge the stage cannot ask: a starting word with its sounds, the named sound and a result word. */
export const validateSoundSwapData = (value: unknown): SoundSwapData => (value as SoundSwapData)?.task === 'letter_build'
  ? validateLetterBuild(value as SoundSwapData) : validateChallengePool<SoundSwapData>(value,
  c => !!c && typeof c.originalWord === 'string' && !!c.originalWord.trim() && Array.isArray(c.originalPhonemes)
    && c.originalPhonemes.length > 0 && typeof c.resultWord === 'string' && !!c.resultWord.trim() && namesItsSound(c),
  { pool: 'Generated sound swap has invalid lesson content.', item: 'A sound-swap challenge cannot be asked.' });
