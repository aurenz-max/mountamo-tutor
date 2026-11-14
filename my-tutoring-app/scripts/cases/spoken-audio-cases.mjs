// Spoken-answer cases where what the learner SAID and what the transcript SAYS can differ. Gold is the spoken
// answer. Used by decisions-audio-bench.mjs to ask whether sending the learner's audio to gemini-decision-1
// grades better than the transcript alone. `said` is plain text, or { ups } (Microsoft phone set) for a held phoneme the synthesizer
// would otherwise spell out. Every clip is synthetic adult speech (Windows SAPI), not a child's voice.
const count = { task: 'How many fish are on the board?', expectedAnswer: '5' };
const letterS = { task: 'What sound does the letter s make?', expectedAnswer: 'the sound /s/ (sss), not the letter name' };
const letterM = { task: 'What sound does the letter m make?', expectedAnswer: 'the sound /m/ (mmm), not the letter name' };
const fact = { task: 'What is two plus one?', expectedAnswer: '3' };
const worth = { task: 'What are those four ten-sticks worth altogether?', expectedAnswer: '40' };
const word = { task: 'What word is this? Read it out loud.', expectedAnswer: 'cat' };
const sentence = { task: 'Read the sentence: The cat sat on the mat.', expectedAnswer: 'The cat sat on the mat. Every word, in order.' };
const shape = { task: 'What is the name of the shape inside the gold ring?', expectedAnswer: 'triangle' };

const S = { ups: 'S S S S S S' }, M = { ups: 'M M M M M M' };

// [name, item, said, transcript, label]   transcript === said: a clean control.
export const AUDIO_CASES = [
  ['five_clean', count, 'five', 'five', true],
  ['five_as_clock', count, 'five', "It's 5:00.", true],
  ['five_as_hive', count, 'five', 'hive', true],
  ['five_as_nine', count, 'five', 'nine', true],
  ['four_as_five', count, 'four', 'five', false],
  ['six_as_fix', count, 'six', 'fix', false],
  ['s_sound_as_s', letterS, S, 's', true],
  ['s_name_as_s', letterS, 'ess', 's', false],
  ['s_sound_as_yes', letterS, S, 'yes', true],
  ['s_name_clean', letterS, 'ess', 'ess', false],
  ['m_sound_as_m', letterM, M, 'm', true],
  ['m_name_as_m', letterM, 'em', 'm', false],
  ['m_sound_as_hmm', letterM, M, 'hmm', true],
  ['three_as_tree', fact, 'three', 'tree', true],
  ['two_as_three', fact, 'two', 'three', false],
  ['forty_as_fourteen', worth, 'forty', 'fourteen', true],
  ['fourteen_as_forty', worth, 'fourteen', 'forty', false],
  ['cat_as_cut', word, 'cat', 'cut', true],
  ['cot_as_cat', word, 'cot', 'cat', false],
  ['sentence_skip_as_full', sentence, 'the cat sat on mat', 'the cat sat on the mat', false],
  ['sentence_full_as_skip', sentence, 'the cat sat on the mat', 'the cat sat on mat', true],
  ['triangle_as_try_angle', shape, 'triangle', 'try angle', true],
  ['rectangle_as_triangle', shape, 'rectangle', 'triangle', false],
  ['silence_as_five', count, null, 'five', false],
];

/** A tutor reply that says nothing about which answer it heard, so the transcript and the audio are the only evidence. */
export const NEUTRAL_TUTOR = 'Okay, thank you for telling me.';
export const VOICES = ['Microsoft Zira Desktop', 'Microsoft David Desktop'];
