import type { DiWordReadingData } from '../../../primitives/visual-primitives/direct-instruction/DiWordReading';
import { askFor, buildWordReadingItems, wordReadingChallengeValid, DI_WORD_READING_WORKSPACE_MODES }
  from '../../../primitives/visual-primitives/direct-instruction/diWordReadingDomain';
import { workspaceGuidance, validateChallengePool, workspaceLessonStart, type LiveActivityAdapter } from './adapterContract';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old. */
export const validateDiWordReadingData = (value: unknown) =>
  validateChallengePool<DiWordReadingData>(value, wordReadingChallengeValid, {
    pool: 'Generated word reading has invalid lesson content.',
    item: 'A word-reading item cannot run in the teaching workspace.' });

function diWordReadingState(data: DiWordReadingData) {
  const items = buildWordReadingItems(data.challenges);
  return { title: data.title, instruction: askFor(items[0]), teachingOwner: 'tutor',
    totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. The child reads the printed word out loud; '
      + 'judge what you hear and say so naturally. The host records your completed feedback and handles retry '
      + 'and advance.' };
}

export const diWordReadingLive: LiveActivityAdapter<DiWordReadingData> = {
  tutoring: null,
  teachingOwner: 'tutor',
  // All four task identities are the same act — meet the printed word, read it
  // aloud — so they bind to one workspace rather than to four. What differs is
  // what the tutor may DO: an irregular sight word must not be sounded out, and
  // the scene enforces that by publishing no letter targets for one.
  modes: DI_WORD_READING_WORKSPACE_MODES,
  challengeTypes: data => data.challenges.map(c => c.challengeType),
  bindsTeachingWorkspace: true,
  canAdvance: false, // The dialogue observer owns checked progression.
  // The catalog entry scopes this pack to kindergarten and grade 1 decoding.
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Word Reading', checkbox: 'Word reading', title: 'Read Words Out Loud',
    lessons: [['cvc_reading', 'Blend and read a short-vowel word'],
      ['read_word', 'Read the printed word'],
      ['sight_word', 'Read a sight word we know by heart'],
      ['word_reading_review', 'Review words we have learned']],
  },
  lessonStart: workspaceLessonStart('word-reading', 'di-word-reading'),
  // Teaching ownership, spoken verdicts, crediting, help and progression come from
  // WORKSPACE_DOCTRINE (adapterContract.ts); this names only the word-reading facts.
  // No example sentence anywhere below: a quoted sentence in this position becomes
  // the tutor's whole script (the letter-sounds finding). Length is also a hard
  // gate — `live_activity_tools.parse_activity_spec` caps guidance at 2000
  // characters and closes the socket with `Invalid activity offer` above it.
  guidance: workspaceGuidance('The gold-ringed card shows ONE printed word, and reading it off the screen is the whole skill. '
    + 'Give the child a chance to read it first; a word you model is not their read, so hand it back and wait. '
    + 'Never name a word still to come: the facts are there so you can judge, not supply. '
    + 'A different word is wrong however close it sounds — a rhyme or a homophone still gets a correction. '
    + 'Blending slowly and then saying the whole word IS a correct read; separate sounds with no whole word is '
    + 'unfinished. Spelling with letter names is not reading. '
    + 'The facts say whether the word is decodable or an irregular sight word. A decodable word may be blended '
    + 'from its printed letters; an irregular one is recalled whole, and sounding it out teaches the wrong '
    + 'thing — its letters are not marking targets. '
    + 'Use demonstrate with the target "word", or a letter target from workspace.objects on a decodable word, '
    + 'and [] to clear. There is no other scene action: you cannot change the word, add a picture, write, or '
    + 'answer for the child.'),
  validate: validateDiWordReadingData,
  initialState: diWordReadingState,
};
