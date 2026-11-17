/**
 * agent-canvas's card: how it is wired to the live tutor (`components/live-activity/boss.ts`). The catalog reads it;
 * the behavior is `agentCanvas.boss.ts`. One mode (a general agent primitive): the author writes the program the
 * child operates, and the program's own goal check judges it on Check, so no key reaches the tutor for a shown canvas.
 * A canvas whose program reports one sayable answer (`lumina.answer`) is also answered out loud and the tutor judges
 * the words against that key (2026-11-15), so the mode is SAY_OR_SHOW, like practice-studio's.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../../components/live-activity/boss';

export const CANVAS_MODES = ['canvas'] as const;
export type AgentCanvasMode = typeof CANVAS_MODES[number];

/**
 * The misses a canvas can name. Shown: its program reports only whether the goal is met, not why it is not. Said: the
 * wrong answers its program listed as misrules, in order (`MISRULE_IDS` in `service/agent-kit/canvas/canvasSpoken.ts`,
 * written out: a card imports no behavior).
 */
export const CANVAS_MISSES = ['goal_unmet', 'misrule_first', 'misrule_second', 'misrule_third'] as const;
export type CanvasMiss = typeof CANVAS_MISSES[number];

export const agentCanvasCard = defineCard<CanvasMiss>({
  id: 'agent-canvas',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  audio: SPOKEN_AUDIO,
  modes: {
    canvas: {
      ...SAY_OR_SHOW,
      misses: CANVAS_MISSES,
      // No lever yet: a canvas carries no help or simpler version of itself.
      unanswered: CANVAS_MISSES,
      moves: 'drags, places, connects and sets things inside the canvas, runs it with the canvas\'s own Test or Launch button when it has one, then presses Check. When the task has a key, the answer can be said instead',
    },
  },
  words: {
    job: 'operate a small interactive canvas built for this lesson (drag, place, connect, set, run) until it does what the prompt asks, then press Check; on a canvas with one sayable answer, say the answer or show it',
    answer: 'the canvas as the learner left it, or what the learner said',
    question: 'the prompt, and the canvas: its picture, its controls and the readouts it shows',
    special: 'Short sentences, everyday words. Read the prompt aloud. Talk about what the canvas shows now and what changed when the '
      + 'learner moved something. More than one finished canvas can be right: never say what to set or where to put a thing. '
      + 'After a miss, ask what the learner sees and invite one change.',
  },
});
