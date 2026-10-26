/**
 * curator-brief's card: the lesson's opening screen, an ungraded teaching surface (`Card.ungraded`, user ruling
 * 2026-10-26: it still gets a card, which tells the tutor how to cover the content). The catalog reads it; the behavior
 * is `curatorBrief.boss.ts`. Nothing is graded: the tutor opens the lesson in three short beats, the learner may tap
 * an "I wonder" choice, and Start works as Done.
 */
import { defineCard } from '../components/live-activity/boss';

export const curatorBriefCard = defineCard({
  id: 'curator-brief',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
    'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  ungraded: true,
  modes: {},
  words: {
    job: 'hear what the lesson is about, tap an "I wonder" choice if they like, and press Start',
    answer: 'nothing: this screen is not graded',
    question: 'the picture, the three captions (the hook, the big idea, what the learner will do today), the lesson '
      + 'steps and the "I wonder" choices',
    special: 'This is the first screen of the lesson and your first words to the learner, so it is also your greeting. '
      + 'The three captions are three beats of about one sentence each, in that order. A tapped "I wonder" choice is '
      + 'curiosity with no right answer. The picture arrives a few seconds in and sets the scene only. Start works as '
      + 'Done on this screen.',
  },
});
