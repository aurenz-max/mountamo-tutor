/**
 * practice-studio's card: how it is wired to the live tutor (`components/live-activity/boss.ts`). The catalog reads it;
 * the behavior is `practiceStudio.boss.ts`. One mode (USER 2026-11-08: a general agent primitive, mixed only): the
 * author agent picks each item's answer surface and its displays. A tap surface (choose, categorize, order, make, set,
 * point) is judged by the activity's own check, so no key reaches the tutor. A `teach` item (2026-11-13,
 * `service/agent-kit/teachSurface.ts`) is answered out loud: the tutor plays a character who holds a wrong idea and
 * judges the child's explanation against a meaning key, so the mode is SAY_OR_SHOW, like wonder-walk's.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../../components/live-activity/boss';
import type { SurfaceMiss } from '../../../../service/agent-kit/surfaces';

/** `SURFACE_MISSES` in `service/agent-kit/surfaces.ts`, written out: a card imports no behavior (`boss.test`). */
const MISSES: readonly SurfaceMiss[] = ['wrong_choice', 'misplaced', 'out_of_order', 'off_goal', 'agreed_with_character', 'read_back', 'named_only', 'opposite_idea'];

export const PRACTICE_MODES = ['practice'] as const;
export type PracticeStudioMode = typeof PRACTICE_MODES[number];

export const practiceStudioCard = defineCard<SurfaceMiss>({
  id: 'practice-studio',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  audio: SPOKEN_AUDIO,
  // Levers: every item carries its own help and simplify levers, authored with it (`service/agent-kit/levers.ts`).
  levers: true,
  modes: {
    practice: {
      ...SAY_OR_SHOW,
      // The kit's surface misses (`SURFACE_MISSES` in `service/agent-kit/surfaces.ts`: the tap misses, then the teach
      // misses the spoken-miss observer names); a card holds facts only.
      misses: MISSES,
      moves: 'taps one card to choose it, or a card then a box to sort it, or cards into numbered boxes in order, or pieces onto a tray, or marks on a picture to change it; then Check. A teach item is said, not tapped',
    },
  },
  words: {
    job: 'answer a short item built for this lesson: choose a card, sort the cards into boxes, put the cards in order, put pieces on a tray to meet a goal, or change a picture until it is right, then press Check; or, on a teach item, explain an idea out loud to a character who has it wrong',
    answer: 'the cards as the learner chose, sorted or ordered them, the pieces on the tray, the picture as the learner left it, or what the learner said to the character',
    question: 'the prompt, what is shown above the cards (a picture, a graph, a number line, a table or a short text), and the cards; on a teach item, the character and what it thinks',
    special: 'Short sentences, everyday words. Read the prompt and any short text aloud. Describe what the picture or graph shows '
      + 'without saying which card is right. After a miss, say the hint shown and invite one more look. On a tray or a picture the learner changes, more than one answer is right: never name the pieces to use or where to cut. '
      + 'On a teach item you ARE the character: say its wrong idea in its voice, keep it until the explanation means the key, press back with the scene\'s lines when a try is thin, never say the idea before it is credited, then say in character that you get it now.',
  },
});
