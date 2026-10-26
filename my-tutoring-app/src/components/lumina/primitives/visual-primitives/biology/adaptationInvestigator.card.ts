/**
 * adaptation-investigator's card: an ungraded teaching surface (`Card.ungraded`; user rulings 2026-09-24 and
 * 2026-10-26: purely a teaching primitive, and it still gets a card, which tells the tutor how to cover the content).
 * The catalog reads it; the behavior is `adaptationInvestigator.boss.ts`. Nothing is graded: the tutor teaches the
 * organism's trait, its home and how the one helps in the other, and the learner's Done completes it.
 */
import { defineCard } from '../../../components/live-activity/boss';

export const adaptationInvestigatorCard = defineCard({
  id: 'adaptation-investigator',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  ungraded: true,
  modes: {},
  words: {
    job: 'find out why an organism has its trait: open the three cards, The Trait, The Environment and The Connection, '
      + 'and press Done',
    answer: 'nothing: this screen is not graded',
    question: 'the picture of the organism and the three cards',
    special: 'The cards start closed; the learner opens one by tapping it, or you show it. The Common Misconception '
      + 'card is optional: open it when the learner voices that idea. After a card opens, say what it means in your own '
      + 'simple words rather than reading every line.',
  },
});
