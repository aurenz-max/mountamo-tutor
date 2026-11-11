/**
 * agent-canvas's card: how it is wired to the live tutor (`components/live-activity/boss.ts`). The catalog reads it;
 * the behavior is `agentCanvas.boss.ts`. One mode (a general agent primitive): the author agent writes the program the
 * child operates, and the program's own goal check judges it on Check, so no key reaches the tutor.
 */
import { defineCard, TAP_ONE } from '../../../../components/live-activity/boss';

export const CANVAS_MODES = ['canvas'] as const;
export type AgentCanvasMode = typeof CANVAS_MODES[number];

/** The one miss a canvas can name: its program reports only whether the goal is met, not why it is not. */
export const CANVAS_MISSES = ['goal_unmet'] as const;
export type CanvasMiss = typeof CANVAS_MISSES[number];

export const agentCanvasCard = defineCard<CanvasMiss>({
  id: 'agent-canvas',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    canvas: {
      ...TAP_ONE,
      misses: CANVAS_MISSES,
      // No lever yet: a canvas carries no help or simpler version of itself.
      unanswered: CANVAS_MISSES,
      moves: 'drags, places, connects and sets things inside the canvas, runs it with the canvas\'s own Test or Launch button when it has one, then presses Check',
    },
  },
  words: {
    job: 'operate a small interactive canvas built for this lesson (drag, place, connect, set, run) until it does what the prompt asks, then press Check',
    answer: 'the canvas as the learner left it',
    question: 'the prompt, and the canvas: its picture, its controls and the readouts it shows',
    special: 'Short sentences, everyday words. Read the prompt aloud. Talk about what the canvas shows now and what changed when the '
      + 'learner moved something. More than one finished canvas can be right: never say what to set or where to put a thing. '
      + 'After a miss, ask what the learner sees and invite one change.',
  },
});
