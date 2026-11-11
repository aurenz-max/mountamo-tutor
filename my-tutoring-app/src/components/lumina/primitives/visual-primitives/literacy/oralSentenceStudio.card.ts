/**
 * Oral sentence studio's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `oralSentenceStudio.boss.ts`.
 * Every item is one original spoken sentence using two printed words, judged by the tutor on meaning against the
 * key, so the boss is the spoken preset.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken sentence shows (`oralSentenceSpokenMisses`, handoff 20 Part B), in precedence order. */
export const ORAL_SENTENCE_MISSES = ['words_listed', 'fragment', 'word_missing', 'word_misused', 'off_task'] as const;
/** What a wrong open answer shows, per open mode (handoff H2: no printed words, no code key; the tutor judges). */
export const OPEN_SPEECH_MISSES = {
  ask_question: ['statement', 'other_question', 'one_word'],
  say_why: ['position_only', 'reason_only', 'empty_reason'],
  two_voices: ['one_line', 'narration'],
} as const;
export type SpokenOralSentenceMiss = typeof ORAL_SENTENCE_MISSES[number]
  | typeof OPEN_SPEECH_MISSES[keyof typeof OPEN_SPEECH_MISSES][number];

// `off_task` has no lever by decision: the fix is the task itself (this picture, this step, your own sentence),
// which the tutor asks again (`oralSentenceStudioLevers.ts`).
const SENTENCE = { ...SPOKEN, misses: ORAL_SENTENCE_MISSES, unanswered: ['off_task'] } as const;
// The open modes have no lever yet, by decision: their levers are an /add-support-tiers rung of their own.
const open = <K extends keyof typeof OPEN_SPEECH_MISSES>(mode: K) =>
  ({ ...SPOKEN, misses: OPEN_SPEECH_MISSES[mode], unanswered: OPEN_SPEECH_MISSES[mode] }) as const;

export const oralSentenceStudioCard = defineCard<SpokenOralSentenceMiss>({
  id: 'oral-sentence-studio',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    describe_scene: SENTENCE,
    guided_writing_rehearsal: SENTENCE,
    use_story_words: SENTENCE,
    ask_question: open('ask_question'),
    say_why: open('say_why'),
    two_voices: open('two_voices'),
  },
  words: {
    job: 'say one whole sentence of their own that uses both printed words with their meanings: about the pictured '
      + 'scene, the sentence the class will write for the pictured step that comes now, or a new sentence after '
      + 'hearing a short story; or, with no printed words, ask a question about something hidden in a picture, say '
      + 'whether they agree with a character and why, or say one line for each of two pictured characters',
    answer: 'the spoken sentence, question, opinion or two lines',
    question: 'the directions, the two words with their meanings, the story, the situation or the claim',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
