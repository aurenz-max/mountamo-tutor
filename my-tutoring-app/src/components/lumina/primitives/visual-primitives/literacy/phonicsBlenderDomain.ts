/**
 * phonics-blender's domain: the items, the ask, the spoken key, the known misses, the scene and the content gate. Pure;
 * the boss, the levers, the component and the tests read the same rules.
 *
 * A spoken item is one word: the learner reads its letters and says the whole word (sounding it out first is right).
 * The letters are the stimulus and are always shown; the whole word printed as a word, and its picture, are not shown
 * before the word is credited (the picture would name it). A build item (`build_blend`) is the shared letter build
 * (`letterBuild.ts`); its checks live there.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { PhonicsBlenderData } from './PhonicsBlender';
import type { SpokenBlendMode } from './phonicsBlender.card';
import { letterAssignment, letterItemsFrom, type LetterBuildItem } from './letterBuild';
import { speakablePhoneme } from './phonemeVoice';
import { wordReadingMisses } from './spokenReadingMisses';

/** One word the learner reads and blends aloud. Mirrors the generator. */
export interface BlendItem {
  id: string;
  targetWord: string;
  phonemes: Array<{ id: string; sound: string; letters: string }>;
  emoji?: string;
}

/** A spoken item: the word, its eval mode and the lesson's tier (when the model lever comes). */
export type BlendWord = BlendItem & { mode: SpokenBlendMode; supportTier: SupportTier };
/** A build item: the shared letter build's ask, on build_blend. */
export type BlendBuild = LetterBuildItem & { mode: 'build_blend'; supportTier: SupportTier };
export type PhonicsBlenderItem = BlendWord | BlendBuild;

export const isBuild = (item: PhonicsBlenderItem): item is BlendBuild => item.mode === 'build_blend';

/** The eval mode a payload's pattern belongs to (catalog `challengeTypes`). */
export function blendModeOf(patternType: string | undefined): SpokenBlendMode {
  if (patternType === 'cvce' || patternType === 'blend') return 'cvce_blend';
  if (patternType === 'digraph') return 'digraph';
  if (patternType === 'r-controlled' || patternType === 'diphthong') return 'advanced';
  return 'cvc';
}

const tierOf = (data: Pick<PhonicsBlenderData, 'supportTier'>): SupportTier => data.supportTier ?? 'medium';

/** The words as plain items (the fields the tutor may see; the word-space stamp stays behind). */
export const blendItems = (words: ReadonlyArray<{ id: string; targetWord: string; phonemes: BlendItem['phonemes']; emoji?: string }>): BlendItem[] =>
  words.map(w => ({ id: w.id, targetWord: w.targetWord, phonemes: w.phonemes, emoji: w.emoji }));

/** A word as a spoken item of this lesson. */
export const asWord = (item: BlendItem, mode: SpokenBlendMode, supportTier: SupportTier): BlendWord => ({ ...item, mode, supportTier });
/** A letter-build ask as a build item of this lesson. */
export const asBuild = (item: LetterBuildItem, supportTier: SupportTier): BlendBuild => ({ ...item, mode: 'build_blend', supportTier });

/** The session's spoken words, each stamped with the lesson's mode and tier. */
export const blendWords = (data: Pick<PhonicsBlenderData, 'words' | 'patternType' | 'supportTier'>): BlendWord[] =>
  blendItems(data.words ?? []).map(w => asWord(w, blendModeOf(data.patternType), tierOf(data)));

/** The session's build asks, through the shared build's own gate. */
export const blendBuilds = (data: Pick<PhonicsBlenderData, 'buildItems' | 'supportTier'>): BlendBuild[] =>
  letterItemsFrom(data.buildItems ?? [], data.supportTier).map(i => asBuild(i, tierOf(data)));

/** The session's items: the build asks on build_blend, the words otherwise. */
export const phonicsBlenderItems = (data: PhonicsBlenderData): PhonicsBlenderItem[] =>
  data.task === 'letter_build' ? blendBuilds(data) : blendWords(data);

const BLEND_ASK = 'Blend the sounds of the letters on screen and say the whole word out loud.';

/** What the learner is asked. Never the word: the letters on screen are the stimulus. */
export const blendAsk = (item: PhonicsBlenderItem): string => (isBuild(item) ? letterAssignment(item).task : BLEND_ASK);

/** The spoken key: the word; a sound-out that ends in it is right, the sounds alone are not. Null on a build. */
export function blendKey(item: PhonicsBlenderItem): SpokenKey | null {
  if (isBuild(item)) return null;
  return { answer: item.targetWord, alsoAccept: [],
    acceptRule: `Sounding it out first and then saying ${item.targetWord} whole is right.`,
    signatureError: 'The separate sounds with no word at the end, the letter names, or a close but different word '
      + `(one sound changed) are not yet ${item.targetWord}.` };
}

/** The item's known wrong blends, in precedence order: the word-reading patterns on its letters. */
export function blendSpokenMisses(item: BlendItem | PhonicsBlenderItem): KnownMiss[] {
  if ('mode' in item && isBuild(item)) return [];
  const word = item as BlendItem;
  return wordReadingMisses(word.targetWord, { sounds: word.phonemes.map(p => p.letters) });
}

export type Segmentation = 'full' | 'word' | 'none';

/** What the tutor reads about a spoken item. The letters are the print the learner reads. */
export function blendScene(item: BlendItem, segmentation: Segmentation): SceneOf {
  return { objects: [], facts: {
    letters: item.phonemes.map(p => p.letters).join(segmentation === 'none' ? '' : ' '),
    constraints: 'The word is never printed, and its picture appears only after the word is credited.'
      + (segmentation === 'none'
        ? ' The letters are joined as one word at this level: do not split it into sounds for the learner.'
        : ''),
  } } satisfies WorkspaceScene;
}

/** What a tapped letter asks the tutor to say: its sound, never the word (the word is the answer). */
export const soundRequest = (raw: string) => `The learner tapped a letter. Say only its sound, once: ${speakablePhoneme(raw)}.`;

/** The journey's answers: the word itself, or a plainly different word. */
export function blendHarnessAnswers(item: Pick<BlendItem, 'targetWord'>): { correct: string; plainWrong: string } {
  const wrong = ['dog', 'sun', 'hen', 'map'].find(candidate => candidate !== item.targetWord) ?? 'dog';
  return { correct: item.targetWord, plainWrong: wrong };
}

/** Reject a word list that cannot be asked: every word needs a target and its letters. */
export function validatePhonicsBlenderData(value: unknown): PhonicsBlenderData {
  const d = value as PhonicsBlenderData;
  if (d?.task === 'letter_build') {
    // The open build (build_blend): every ask must pass the surface's own gate.
    if (typeof d.title !== 'string' || !Array.isArray(d.buildItems) || !d.buildItems.length || d.buildItems.length > 12
        || letterItemsFrom(d.buildItems, d.supportTier).length !== d.buildItems.length)
      throw new Error('Generated phonics blender has invalid lesson content.');
    return d;
  }
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.words) || !d.words.length || d.words.length > 12
      || new Set(d.words.map(w => w?.id)).size !== d.words.length
      || d.words.some(w => !w || typeof w.id !== 'string' || !w.id || typeof w.targetWord !== 'string' || !w.targetWord.trim()
        || !Array.isArray(w.phonemes) || !w.phonemes.length
        || w.phonemes.some(p => !p || typeof p.id !== 'string' || typeof p.letters !== 'string' || !p.letters
          || typeof p.sound !== 'string')))
    throw new Error('Generated phonics blender has invalid lesson content.');
  return d;
}
