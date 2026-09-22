import type { DiSentenceReadingData } from '../../../primitives/visual-primitives/direct-instruction/DiSentenceReading';
import { askFor, buildSentenceReadingItems, sentenceReadingChallengeValid, DI_SENTENCE_READING_WORKSPACE_MODES }
  from '../../../primitives/visual-primitives/direct-instruction/diSentenceReadingDomain';
import { workspaceGuidance, validateChallengePool, workspaceLessonStart, type LiveActivityAdapter } from './adapterContract';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old. */
export const validateDiSentenceReadingData = (value: unknown) =>
  validateChallengePool<DiSentenceReadingData>(value, sentenceReadingChallengeValid, {
    pool: 'Generated sentence reading has invalid lesson content.',
    item: 'A sentence-reading item cannot run in the teaching workspace.' });

function diSentenceReadingState(data: DiSentenceReadingData) {
  const items = buildSentenceReadingItems(data.challenges);
  return { title: data.title, instruction: askFor(), teachingOwner: 'tutor',
    totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. The child reads the printed sentence out loud; '
      + 'judge what you hear and say so naturally. The host records your completed feedback and handles retry '
      + 'and advance.' };
}

export const diSentenceReadingLive: LiveActivityAdapter<DiSentenceReadingData> = {
  tutoring: null,
  teachingOwner: 'tutor',
  // All four task identities are the same act — read the printed sentence
  // aloud, judged word by word — so they bind to one workspace rather than to
  // four. What differs between them is which sentences are drawn, not how a
  // read is judged.
  modes: DI_SENTENCE_READING_WORKSPACE_MODES,
  bindsTeachingWorkspace: true,
  canAdvance: false, // The dialogue observer owns checked progression.
  // The catalog entry scopes this pack to kindergarten and grade 1 connected-text reading.
  grades: ['Kindergarten', 'Grade 1'],
  copy: {
    label: 'Sentence Reading', checkbox: 'Sentence reading', title: 'Read Sentences Out Loud',
    lessons: [['decodable_sentence', 'Read a sentence built entirely of sound-it-out words'],
      ['read_sentence', 'Read the printed sentence aloud'],
      ['sentence_review', 'Review sentences of the kind already taught'],
      ['sight_phrase_sentence', 'Read a sentence dense in sight words']],
  },
  lessonStart: workspaceLessonStart('sentence-reading', 'di-sentence-reading'),
  // Teaching ownership, spoken verdicts, crediting, help and progression come from
  // WORKSPACE_DOCTRINE (adapterContract.ts); this names only the sentence-reading facts.
  // Length is a hard gate — `live_activity_tools.parse_activity_spec` caps guidance at
  // 2000 characters and closes the socket with `Invalid activity offer` above it.
  guidance: workspaceGuidance('The gold-ringed card shows ONE printed sentence, and reading it aloud, every word '
    + 'in order, is the whole skill. Modeling it once before the child reads — "Listen: ..." — is legitimate '
    + 'teaching, not a leak: the sentence is already on their screen. '
    + 'A word skipped, added, or read as a different word is a miss however small, but catching and fixing their '
    + 'own slip mid-read still counts as an accurate read. Judge accuracy, never speed: slow, effortful '
    + 'sounding-out that lands on the right words is correct. A different word is wrong however close it sounds. '
    + 'Use demonstrate with the target "sentence" to point at it while you teach, and [] to clear. There is no '
    + 'other scene action: you cannot change the sentence, add a picture, write, or answer for the child.'),
  validate: validateDiSentenceReadingData,
  initialState: diSentenceReadingState,
};
