/**
 * Interactive book's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `interactiveBook.boss.ts`.
 * read-focus-word is one spoken word (the glowing word of a book sentence, read aloud), judged by the tutor against the
 * key. find-feature is one tap on a printed part of the page (title, author's name, heading, picture caption, page
 * number), checked by the activity: its answer is WHICH printed element it is, a position, like pointing at a real
 * book; reading the part's words aloud would be a different skill.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a checked wrong tap on find-feature shows (`interactiveBookMiss`): the kind of the other printed part tapped
 * (`tapped_title`, `tapped_author` on the cover; `tapped_heading`, `tapped_caption`, `tapped_page_number` on a page).
 */
export type InteractiveBookMiss = 'tapped_title' | 'tapped_author' | 'tapped_heading' | 'tapped_caption' | 'tapped_page_number';
/** What a wrong spoken read of the glowing word shows (`interactiveBookSpokenMisses`). */
export type SpokenInteractiveBookMiss = 'said_lead_in' | 'context_guess';

export const INTERACTIVE_BOOK_MISSES = {
  'find-feature': ['tapped_title', 'tapped_author', 'tapped_heading', 'tapped_caption', 'tapped_page_number'],
  'read-focus-word': ['said_lead_in', 'context_guess'],
} as const satisfies Record<string, readonly (InteractiveBookMiss | SpokenInteractiveBookMiss)[]>;

const moves = 'may tap the speaker to hear the question again';

export const interactiveBookCard = defineCard<InteractiveBookMiss | SpokenInteractiveBookMiss>({
  id: 'interactive-book',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    'find-feature': { ...TAP_ONE, moves, misses: INTERACTIVE_BOOK_MISSES['find-feature'] },
    // The lead-in said back: any help would read the word or point past the lead to it.
    'read-focus-word': { ...SPOKEN, moves, misses: INTERACTIVE_BOOK_MISSES['read-focus-word'], unanswered: ['said_lead_in'] },
  },
  words: {
    job: 'tap the named printed part of a picture book (title, author\'s name, heading, picture caption, page number), '
      + 'or read one glowing word of a book sentence aloud',
    answer: 'the answer',
    question: 'the part named and the sentence up to the glowing word',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
