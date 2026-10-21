/**
 * digital-skills-sim's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `digitalSkillsSim.boss.ts`.
 * Every mode is one item at a time, one action on screen the activity checks in code: click taps a picture, drag moves
 * a picture into a box, type presses keys. A bespoke boss: the modes mix a tap, a drag and keys.
 */
import type { SkillMode } from './digitalSkillsWorkspace';
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong action shows (`skillMiss`, `TeachingAttempt.miss`), from where the press was let go or the key pressed:
 * - click: `wrong_picture` another picture clicked; `missed_picture` a click on no picture;
 * - drag: `wrong_box` dropped into another box; `let_go_outside` let go outside every box;
 * - type: `mirror_letter` b for d or p for q on a small letter; `neighbour_key` a key touching the right one;
 *   `wrong_key` any other key.
 */
export type ClickMiss = 'wrong_picture' | 'missed_picture';
export type DragMiss = 'wrong_box' | 'let_go_outside';
export type TypeMiss = 'neighbour_key' | 'mirror_letter' | 'wrong_key';
export type SkillMiss = ClickMiss | DragMiss | TypeMiss;
export const SKILL_MISSES: Record<SkillMode, readonly SkillMiss[]> = {
  click: ['wrong_picture', 'missed_picture'],
  drag: ['wrong_box', 'let_go_outside'],
  type: ['neighbour_key', 'mirror_letter', 'wrong_key'],
};

export const digitalSkillsSimCard = defineCard<SkillMiss>({
  id: 'digital-skills-sim',
  grades: ['Kindergarten', 'Grade 1'],
  // Every mode publishes levers (`digitalSkillsLevers.ts`); every miss is answered by a help lever first.
  modes: {
    click: { ...TAP_ONE, misses: SKILL_MISSES.click,
      moves: 'clicks or taps one picture in the play area' },
    drag: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time', misses: SKILL_MISSES.drag,
      moves: 'presses on the picture, holds, moves it and lets go over a box' },
    type: { answer: 'type', judge: 'activity', flow: 'one-at-a-time', misses: SKILL_MISSES.type,
      moves: 'presses keys on the on-screen keyboard of capital letters (or a real keyboard), a word\'s letters in order' },
  },
  words: {
    job: 'use a mouse and keyboard: click the picture the ask names, drag a picture into the box the ask names, or find '
      + 'and press a letter, or a short word\'s letters, on a keyboard of capital letters',
    answer: 'the picture they click, the box they drop the picture into, or the keys they press',
    question: 'the ask, the name of every picture and box, and the letter or word on the card',
  },
  levers: true,
});
