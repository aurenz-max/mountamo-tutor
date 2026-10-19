/**
 * Letter sounds' boss, on the spoken preset (`components/live-activity/boss.ts`): the card is
 * `diLetterSounds.card.ts`; this file is what the preset cannot know — the content check, the key, the known
 * misses, the levers and the harness's answers. The live adapter and the journey row are built from it.
 */
import type { DiLetterSoundsData } from './DiLetterSounds';
import { spokenBoss } from '../../../components/live-activity/boss';
import { diLetterSoundsCard } from './diLetterSounds.card';
import { askFor, buildLetterSoundItems, diLetterSoundSpokenMisses, DI_LETTER_SOUNDS_MAX_ITEMS, letterSoundChallengeValid,
  letterSoundHarnessAnswers, type LetterSoundItem, type SpokenDiLetterSoundMiss } from './diLetterSoundsDomain';
import { LETTER_LEVERS } from './diLetterSoundsLevers';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old. */
export function validateDiLetterSoundsData(value: unknown): DiLetterSoundsData {
  const d = value as DiLetterSoundsData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length
      || d.challenges.length > DI_LETTER_SOUNDS_MAX_ITEMS || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated letter sounds has invalid lesson content.');
  if (!d.challenges.every(letterSoundChallengeValid)) throw new Error('A letter-sound item cannot run in the teaching workspace.');
  return d;
}

export const diLetterSoundsBoss = spokenBoss<DiLetterSoundsData, LetterSoundItem, SpokenDiLetterSoundMiss>({
  card: diLetterSoundsCard,
  validate: validateDiLetterSoundsData,
  items: data => buildLetterSoundItems(data.challenges),
  levers: LETTER_LEVERS,
  speech: {
    ask: askFor,
    key: item => item.key,
    misses: diLetterSoundSpokenMisses,
    // The sound itself comes from the domain: the harness never invents a phoneme.
    say: letterSoundHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/direct-instruction/DiLetterSounds.tsx',
    instanceId: 'sounds',
    defaults: { grade: 'Kindergarten', mode: 'letter_sound', topic: 'Saying the continuous sound a printed letter makes' },
    mounted: '[data-sound-object="stimulus"]',
    probes: { demonstration: { selector: '[data-tutor-demonstration="true"]', kind: 'count' } },
  },
});
