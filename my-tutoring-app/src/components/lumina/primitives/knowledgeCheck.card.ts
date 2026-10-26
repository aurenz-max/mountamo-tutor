/**
 * knowledge-check's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `knowledgeCheck.boss.ts`.
 * The four modes are Bloom tiers over the same item kinds, so every mode is wired alike and by STEP: an item is one
 * question, and how it is answered depends on its kind (`knowledgeCheckStep`, published as the scene's `kind`):
 *   - `said`: true or false, a choice from a spoken menu, a partner, a group, a missing word, what a card shows, how
 *     many; the tutor judges the words against the key;
 *   - `touched`: a menu in symbols, or a sign in a printed number sentence; the activity checks the touch;
 *   - `said_or_worked`: a multiple-choice or true/false problem worked on its own surface, or answered aloud;
 *   - `worked`: a problem that cannot be asked aloud (an ordering), worked on its own surface and checked there.
 */
import type { KnowledgeCheckMiss, SpokenKnowledgeCheckMiss } from './knowledgeCheckWorkspace';
import { defineCard, OFF_BY, SAY_OR_SHOW, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../components/live-activity/boss';

type Miss = KnowledgeCheckMiss | SpokenKnowledgeCheckMiss;

/** Every miss a check or the spoken-miss observer names, in any mode: a touched or spoken choice reuses the same ids. */
export const KNOWLEDGE_CHECK_MISSES = ['one_less', 'one_more', 'other_number', 'other_choice', 'sign_token',
  'other_number_token', 'opposite_verdict', 'two_choices', 'said_card_back', 'other_bank_word', 'said_start', ...OFF_BY,
] as const satisfies readonly Miss[];

/**
 * No lever answers these, by decision: two_choices (a hedge between the key and a near choice; greying a far one does
 * not settle it), said_card_back (no answer was given; the tutor asks again), opposite_verdict (a true/false is already
 * the smallest judgement), and the kinds with no lever built yet: point_to (sign_token, other_number_token), blank
 * (other_bank_word), how_many (said_start and the counts).
 */
const UNANSWERED = ['two_choices', 'said_card_back', 'opposite_verdict', 'sign_token', 'other_number_token',
  'other_bank_word', 'said_start', ...OFF_BY] as const satisfies readonly Miss[];

const STEPS = {
  said: SPOKEN,
  touched: { ...TAP_ONE, moves: 'touches one choice set in symbols, or one sign in the printed number sentence' },
  said_or_worked: { ...SAY_OR_SHOW, moves: 'says the answer, or works the problem on the screen' },
  worked: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
    moves: 'works the problem on the screen with its own controls (puts cards in order, picks a choice)' },
} as const;

const MODE = { steps: STEPS, misses: KNOWLEDGE_CHECK_MISSES, unanswered: UNANSWERED };

export const knowledgeCheckCard = defineCard<Miss>({
  id: 'knowledge-check',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
    'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
  modes: { recall: MODE, apply: MODE, analyze: MODE, evaluate: MODE },
  words: {
    job: 'answer the closing questions of the lesson, one at a time',
    answer: 'their answer',
    question: 'the question and every choice, partner, group or word-bank word printed with it',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
