/**
 * The wonder walk's card: how its modes are wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `wonderWalk.boss.ts`.
 *
 * How the child answers is the author's choice per stop (`respond`, `wonderWalkSpoken.ts`); the card says which
 * choices a mode's stops can make. A mode whose answer can be a word, a letter or a number is SAY_OR_SHOW: its `say`
 * and `say-any` stops carry a spoken key, and its shown stops (a sort, a move) carry none and are checked on screen.
 * A mode whose answer is always shown (a move, a place, a track, a card told apart by where it sits) is TAP_ONE.
 */
import type { WonderWalkMiss } from './wonderWalkWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO, TAP_ONE } from '../../../../components/live-activity/boss';

/** What a wrong answer shows (`pickMiss`, `moveMiss`, `stopSpokenMisses`), per stop type. */
export const WHICH_ONE_MISSES: readonly WonderWalkMiss[] = ['repeated_pick', 'looks_like', 'goes_with', 'off_idea'];
export const TAP_MISSES: readonly WonderWalkMiss[] = ['repeated_pick', 'off_by_one', 'miscount', 'reversed'];
export const NUMBER_MISSES: readonly WonderWalkMiss[] = ['repeated_pick', 'off_by_one', 'miscount', 'said_a_part'];
export const MOVE_MISSES: readonly WonderWalkMiss[] = ['off_by_one', 'miscount', 'wrong_sort', 'not_full'];
/** Every math mode can be built as a tap, a number or a move world, so each lists every math miss. */
export const MATH_MISSES: readonly WonderWalkMiss[] = Array.from(new Set([...TAP_MISSES, ...NUMBER_MISSES, ...MOVE_MISSES]));

/** Language stops: a tap names its trap; a sort or a track is wrong as a whole. */
export const WORD_MISSES: readonly WonderWalkMiss[] = ['repeated_pick', 'near_sound', 'meaning', 'look_alike', 'mixed_story', 'not_heard', 'off_idea', 'wrong_sort', 'wrong_order'];
const WORD_MOVES = 'taps a card, a card and then its basket, or cards in order onto the track, then Done';
const MOVES = 'taps a place or a number, or a thing and then where it goes, then Done';

// Levers: every stop carries its own help and simplify levers, authored with it (`service/agent-kit/levers.ts`).
/** Language modes a stop can answer with a picture's name or a letter (said, or tapped). */
const words = { ...SAY_OR_SHOW, misses: WORD_MISSES, moves: WORD_MOVES };
/** Language modes always shown: a track, or cards told apart by where the picture sits or how many it shows. */
const wordsShown = { ...TAP_ONE, misses: WORD_MISSES, moves: WORD_MOVES };
/** Math modes that can end in a number the child says (or taps). */
const math = { ...SAY_OR_SHOW, misses: MATH_MISSES, moves: MOVES };
/** Math modes always shown: comparing places, or making a group by moving things. */
const mathShown = { ...TAP_ONE, misses: MATH_MISSES, moves: MOVES };

export const wonderWalkCard = defineCard<WonderWalkMiss>({
  id: 'wonder-walk',
  grades: ['Kindergarten'],
  audio: SPOKEN_AUDIO,
  levers: true,
  modes: {
    'which-one': { ...SAY_OR_SHOW, misses: WHICH_ONE_MISSES },
    'how-many': math,
    'more-fewer': mathShown,
    'count-out': mathShown,
    'add-take': math,
    parts: mathShown,
    teens: math,
    'sort-count': math,
    'count-on': math,
    rhyme: words, 'first-sound': words, 'last-sound': words, 'middle-sound': words, syllables: words, blend: words,
    'change-sound': words, 'letter-name': words, 'letter-sound': words, 'spell-word': wordsShown, 'word-kinds': words,
    'one-many': wordsShown, 'where-is': wordsShown, 'story-detail': words, 'story-order': wordsShown,
  },
  words: {
    job: 'look and listen, then say, tap or move the answer',
    answer: 'the picture, number, letter, word, group, sort or order',
    question: 'the narration, the idea, the ask and what each place holds',
    special: 'Say the narration, then the ask; after a miss, return to the idea. Math: tell the story with its parts, not the total; '
      + 'never say or count the answer; as the child moves things, have them count aloud; never say when to stop. '
      + 'Language: name each card plainly; say sounds as saySounds writes them; never name a letter card to find or stress one card’s sound. '
      + 'If any fitting word counts, invite the child’s own word first.',
  },
});
