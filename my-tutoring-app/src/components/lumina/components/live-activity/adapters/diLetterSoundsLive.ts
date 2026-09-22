import type { DiLetterSoundsData } from '../../../primitives/visual-primitives/direct-instruction/DiLetterSounds';
import { askFor, buildLetterSoundItems, letterSoundChallengeValid, DI_LETTER_SOUNDS_MAX_ITEMS,
  DI_LETTER_SOUNDS_WORKSPACE_MODES }
  from '../../../primitives/visual-primitives/direct-instruction/diLetterSoundsDomain';
import { workspaceGuidance, validateChallengePool, workspaceLessonStart, type LiveActivityAdapter } from './adapterContract';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old. */
export const validateDiLetterSoundsData = (value: unknown) =>
  validateChallengePool<DiLetterSoundsData>(value, letterSoundChallengeValid, {
    pool: 'Generated letter sounds has invalid lesson content.',
    item: 'A letter-sound item cannot run in the teaching workspace.' }, DI_LETTER_SOUNDS_MAX_ITEMS);

function diLetterSoundsState(data: DiLetterSoundsData) {
  const items = buildLetterSoundItems(data.challenges);
  return { title: data.title, instruction: askFor(items[0]), teachingOwner: 'tutor',
    totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. The child answers out loud; judge what you '
      + 'hear and say so naturally. The host records your completed feedback and handles retry and advance.' };
}

export const diLetterSoundsLive: LiveActivityAdapter<DiLetterSoundsData> = {
  tutoring: null,
  teachingOwner: 'tutor',
  // All three task identities are the same act — meet the stimulus, produce the
  // sound — so they bind to one workspace rather than to three.
  modes: DI_LETTER_SOUNDS_WORKSPACE_MODES,
  bindsTeachingWorkspace: true,
  canAdvance: false, // The dialogue observer owns checked progression.
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Letter Sounds', checkbox: 'Letter sounds', title: 'Learn Letter Sounds',
    lessons: [['letter_sound', 'Say the sound a letter makes'],
      ['letter_sound_review', 'Review sounds we have learned'],
      ['first_sound_in_word', 'Say the first sound in a word']],
  },
  lessonStart: workspaceLessonStart('letter-sounds', 'di-letter-sounds'),
  // Teaching ownership, spoken verdicts, crediting, help and progression come from
  // WORKSPACE_DOCTRINE (adapterContract.ts); this names only the letter-sound facts.
  guidance: workspaceGuidance('The gold-ringed card is the stimulus for the current question, and the picture beside it is its keyword. '
    + 'The child answers OUT LOUD in every mode. '
    + `A letter's NAME is not its sound, and naming the keyword picture is a step toward the sound rather than `
    + 'the sound itself — except where the facts say a short vowel is elicited through its keyword, where saying '
    + 'that word IS the answer. A stop is released once, and a small "uh" after it counts. '
    + `Model a sound whenever it helps, but your model is not the child's answer: wait for them to say it. `
    + 'Your completed feedback is the only record that they produced it, since a sound cannot be read off a '
    + 'transcript. '
    + 'Use demonstrate with the targets "stimulus" or "picture" to mark the card or the picture you are discussing, '
    + 'and [] to clear them. There is no other scene action: you cannot change the letter, replace the picture, '
    + 'write, or answer for the child.'),
  validate: validateDiLetterSoundsData,
  initialState: diLetterSoundsState,
};
