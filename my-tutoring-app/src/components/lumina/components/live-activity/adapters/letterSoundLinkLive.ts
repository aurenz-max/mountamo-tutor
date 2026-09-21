import type { LetterSoundLinkData } from '../../../primitives/visual-primitives/literacy/LetterSoundLink';
import { askFor, buildLetterSoundLinkItems, letterSoundChallengeValid, LETTER_SOUND_LINK_WORKSPACE_MODES }
  from '../../../primitives/visual-primitives/literacy/letterSoundLinkDomain';
import { validateChallengePool, workspaceLessonStart, type LiveActivityAdapter } from './adapterContract';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old:
 *  an isolated sound a child cannot produce, a tap with one usable letter, a
 *  picture that does not read as its word. */
export const validateLetterSoundLinkData = (value: unknown) =>
  validateChallengePool<LetterSoundLinkData>(value, letterSoundChallengeValid, {
    pool: 'Generated letter-sound link has invalid lesson content.',
    item: 'A letter-sound item cannot run in the teaching workspace.' });

function letterSoundLinkState(data: LetterSoundLinkData) {
  const items = buildLetterSoundLinkItems(data.challenges, data.supportTier ?? 'medium');
  return { title: data.title, instruction: items.length ? askFor(items[0]) : '', teachingOwner: 'tutor',
    totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. Two directions are answered out loud and one '
      + 'is answered by tapping a letter; the facts say which. The host records your completed feedback and '
      + 'handles retry and advance.' };
}

export const letterSoundLinkLive: LiveActivityAdapter<LetterSoundLinkData> = {
  tutoring: null,
  teachingOwner: 'tutor',
  // Three directions, three different answer materials — a produced sound, a
  // tapped grapheme and a spoken word — on one workspace. The mixed channel is
  // the point of the primitive, not an accident of packaging.
  modes: LETTER_SOUND_LINK_WORKSPACE_MODES,
  challengeTypes: data => data.challenges.map(c => c.mode),
  bindsTeachingWorkspace: true,
  canAdvance: false, // The dialogue observer owns checked progression.
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Letter-Sound Link', checkbox: 'Letter-sound link', title: 'Link Letters and Sounds',
    lessons: [['see_hear', 'Say the sound a letter makes'],
      ['hear_see', 'Tap the letter that makes a sound'],
      ['keyword_match', 'Say the picture word that starts with a sound']],
  },
  lessonStart: workspaceLessonStart('letter-sound', 'letter-sound-link'),
  guidance: 'You own the teaching conversation. Read the task and the workspace facts, then teach. '
    + 'Where the learner SAYS the answer, judge the audio you hear against the assignment fact and say your '
    + 'verdict naturally; the transcript is noisy supporting context, never the answer. '
    + `A letter's NAME is not its sound. `
    + 'When the answer is right, say so and say that sound or that word back to the child in the same breath, in '
    + 'your own words; praise that names neither is generic and credits nothing. '
    + 'Where the facts give you soundToSay, the learner answers by TAPPING one of two letters. Say that sound, '
    + 'then stop: never say, spell or point out either letter on the screen, and judge nothing you hear — '
    + 'the activity checks the tap and tells you what it was. '
    + 'Where two pictures are on the stage the answer IS one of their names, so naming either picture before the '
    + 'learner answers hands the item over: talk about the sound, or about the picture that does NOT start with '
    + 'it. Where no picture is drawn, its keyword is withheld from you on purpose and appears only once the '
    + 'answer is recorded. '
    + 'Use begin_help before guiding questions, explanations or a demonstration. Where demonstrate is offered, '
    + 'its targets are the ids in workspace.objects and [] clears them; the purple dashed marks are yours and '
    + 'are never the learner answering. Wait for the visible result before saying anything is marked. '
    + 'Marking the picture that starts with this letter\'s sound hands the '
    + 'answer over — mark the other picture to contrast, or the printed letter. There is no other scene action: '
    + 'you cannot change the letter, replace a picture, write, or answer for the child. '
    + 'Teach one step at a time and let them try. The host records your completed feedback, so do not call a '
    + 'recording or progression tool and do not request a replacement activity. '
    + 'No correction cap and no scripted wording.',
  validate: validateLetterSoundLinkData,
  initialState: letterSoundLinkState,
};
