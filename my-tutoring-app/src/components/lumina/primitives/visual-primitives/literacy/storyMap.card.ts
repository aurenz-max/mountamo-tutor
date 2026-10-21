/**
 * story-map's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `storyMap.boss.ts`.
 * Every mode maps one story in steps, the items of the lesson: `identify` (tap every character and the setting, a
 * board), `sequence` (place every event card on the arc, a board) and, at Grade 4 and up when the story has a conflict,
 * `analyze` (tap one kind of conflict). The mode only sets the arc's parts; the activity checks every step.
 */
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`storyMapMiss`, `TeachingAttempt.miss`, handoff 20), from the work the check reads. Drawn
 * from the old catalog's commonStruggles ("confusing parts", "missing elements", "wrong sequence"):
 * - identify, first that applies: `picked_not_in_story` (a printed name that is not in the story), `missed_character`
 *   (left out a character), `wrong_setting` (a setting that is not the story's);
 * - sequence: `one_part` (every card in one part), `reversed` (each wrong card in the mirror part: a beginning event
 *   at the end), `next_part` (each wrong card one part away), `far_part` (a card two or more parts away);
 * - analyze: `inside_outside` (a conflict inside the character for one outside it, or the reverse), `other_outside`
 *   (another outside force: a person, nature or society).
 */
export type StoryMapMiss = 'picked_not_in_story' | 'missed_character' | 'wrong_setting'
  | 'one_part' | 'reversed' | 'next_part' | 'far_part'
  | 'inside_outside' | 'other_outside';
export const IDENTIFY_MISSES: readonly StoryMapMiss[] = ['picked_not_in_story', 'missed_character', 'wrong_setting'];
export const SEQUENCE_MISSES: readonly StoryMapMiss[] = ['one_part', 'reversed', 'next_part', 'far_part'];
export const ANALYZE_MISSES: readonly StoryMapMiss[] = ['inside_outside', 'other_outside'];
const MAP_MISSES = [...IDENTIFY_MISSES, ...SEQUENCE_MISSES];
const MAP_AND_CONFLICT_MISSES = [...MAP_MISSES, ...ANALYZE_MISSES];

/** The steps, keyed by the step name the scene publishes as `kind`. The analyze step is asked at Grade 4 and up when
 *  the story has a conflict, which the plot diagram and the hero's journey are written for. */
const STEPS = {
  identify: { answer: 'tap', judge: 'activity', flow: 'board',
    moves: 'taps every printed name that is a character in the story and one setting, then presses Check Answers' },
  sequence: { answer: 'manipulate', judge: 'activity', flow: 'board',
    moves: 'taps an event card, then a part of the story arc to place it (a placed card can be moved or taken off), and '
      + 'with every card placed presses Check Sequence' },
  analyze: { ...TAP_ONE, moves: 'taps one kind of conflict, then presses Check Answer' },
} as const;
const MAP_STEPS = { identify: STEPS.identify, sequence: STEPS.sequence };

export const storyMapCard = defineCard<StoryMapMiss>({
  id: 'story-map',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every step publishes levers (`storyMapLevers.ts`); every miss is answered by a lever on its step.
  modes: {
    bme: { steps: MAP_STEPS, misses: MAP_MISSES },
    story_mountain: { steps: MAP_STEPS, misses: MAP_MISSES },
    plot_diagram: { steps: STEPS, misses: MAP_AND_CONFLICT_MISSES },
    heros_journey: { steps: STEPS, misses: MAP_AND_CONFLICT_MISSES },
  },
  words: {
    job: 'map a story: pick its characters and its setting, place each event card in its part of the story arc, and '
      + 'from Grade 4 name the kind of conflict the main character faces',
    answer: 'the learner\'s picks and placements',
    question: 'the story, the printed names and settings, the event cards, the parts of the arc and the conflict choices',
  },
  levers: true,
});
