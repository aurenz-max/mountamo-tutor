/**
 * Story ribbon's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `storyRibbon.boss.ts`.
 * Every item is one spoken account the tutor judges against the key: the three pictured events told in order (the
 * tense modes in that time), or one story moment connected to another experience. The picture cards are a planning
 * board and are never graded, so the boss is the spoken preset.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken account shows (`storyRibbonSpokenMisses`, handoff 20 Part B), per mode. */
export const STORY_RIBBON_MISSES = {
  tell_connected_account: ['labels_listed', 'events_missing', 'out_of_order'],
  tell_present_account: ['labels_listed', 'events_missing', 'out_of_order', 'tense_drift'],
  tell_future_account: ['labels_listed', 'events_missing', 'out_of_order', 'tense_drift'],
  tell_past_account: ['labels_listed', 'events_missing', 'out_of_order', 'tense_drift'],
  story_to_experience: ['event_only', 'no_connection'],
} as const;
export type SpokenStoryRibbonMiss = typeof STORY_RIBBON_MISSES[keyof typeof STORY_RIBBON_MISSES][number];

// No lever for the wrong order (any order cue is the answer) or for tense drift (a time model would be new
// capability), by decision (`storyRibbonLevers.ts`).
const TENSE = { ...SPOKEN, misses: STORY_RIBBON_MISSES.tell_past_account, unanswered: ['out_of_order', 'tense_drift'] } as const;

export const storyRibbonCard = defineCard<SpokenStoryRibbonMiss>({
  id: 'story-ribbon',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    tell_connected_account: { ...SPOKEN, misses: STORY_RIBBON_MISSES.tell_connected_account, unanswered: ['out_of_order'] },
    tell_present_account: TENSE,
    tell_future_account: TENSE,
    tell_past_account: TENSE,
    story_to_experience: { ...SPOKEN, misses: STORY_RIBBON_MISSES.story_to_experience },
  },
  words: {
    job: 'tell a short picture story out loud: all three pictured events in order in their own words (the tense modes '
      + 'in that time), or one story moment and how it connects to something they did, saw, heard about or imagined',
    answer: 'the spoken story',
    question: 'the directions',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
