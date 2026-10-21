/**
 * story-planner's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `storyPlanner.boss.ts`.
 * Every mode plans a story in the same steps, chosen by grade, not by mode: at K-1 `plan` (one picture per card; every
 * picture is a fair creative pick, so the item passes once each card has one) then `order` (tap the story's events into
 * order, checked in code against the generated order); at grade 2 and up `write` (one typed card per story element,
 * checked in code for length and repeats, then by the shared writing judge for answering its question for this story).
 * The item's kind names its step. Every item is checked by the activity: a bespoke boss.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`writeShapeMiss`, then the judge's verdict; `orderMiss`): write: `too_short` (under three
 * words), `repeat` (a card already written), `not_sense`, `wrong_job` (it does not answer the card's question);
 * order: `wrong_order`. A plan item has no miss: every picture passes.
 */
export type StoryMiss = 'too_short' | 'repeat' | 'not_sense' | 'wrong_job' | 'wrong_order';
export const STORY_MISSES: readonly StoryMiss[] = ['too_short', 'repeat', 'not_sense', 'wrong_job', 'wrong_order'];

const STEPS = {
  plan: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time',
    moves: 'taps one picture for each card; one tap picks it and opens the next card' },
  write: { answer: 'type', judge: 'activity', flow: 'one-at-a-time',
    moves: 'types an idea for this planning card in the box, then presses "I\'m done!"' },
  // One whole order is checked at once, never a board: with two or three events, "how many are right" names the order.
  order: { answer: 'tap', judge: 'activity', flow: 'one-at-a-time',
    moves: 'taps the events into numbered slots (tapping a placed event takes it back), then presses "I\'m done!"' },
} as const;
const WRITE_MISSES: readonly StoryMiss[] = ['too_short', 'repeat', 'not_sense', 'wrong_job'];
// repeat needs no lever: the check's words say to write something new.
const UNANSWERED: readonly StoryMiss[] = ['repeat'];

export const storyPlannerCard = defineCard<StoryMiss>({
  id: 'story-planner',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // The write and order steps publish levers (`storyPlannerLevers.ts`); a plan item has none. Only story_structure
  // names wrong_order: its lessons are the K-1 picture band that orders events; the others are typed cards at grade 2+.
  modes: {
    story_structure: { steps: STEPS, misses: STORY_MISSES, unanswered: UNANSWERED },
    character_setting: { steps: STEPS, misses: WRITE_MISSES, unanswered: UNANSWERED },
    conflict_resolution: { steps: STEPS, misses: WRITE_MISSES, unanswered: UNANSWERED },
    theme_craft: { steps: STEPS, misses: WRITE_MISSES, unanswered: UNANSWERED },
  },
  words: {
    job: 'plan a story: pick a picture for each story card and put the story\'s events in order, or write one idea on '
      + 'each planning card (character, setting, problem, ...) that answers its question for this story',
    answer: 'the learner\'s picks, order or card',
    question: 'the story idea, each card\'s question, the words under every picture and every event',
  },
  levers: true,
});
