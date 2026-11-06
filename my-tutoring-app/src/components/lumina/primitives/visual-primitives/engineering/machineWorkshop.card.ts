/**
 * machine-workshop's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `machineWorkshop.boss.ts`.
 * spin_to_push is a build on a 2D workbench the activity checks: one machine at a time, no key reaches the tutor.
 *
 * User 11-05: the tutor opened with "find the missing part" and never said what the tool is for or how the machine
 * has to move. Most learners have never seen a crank or a cam, so the tutor teaches the goal and the two motions
 * first, describes the parts by what they look like, and only then hands over.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`), from `machineMiss` in `machineModel.ts`: `wrong_pair` (a rod on
 * a wheel with no peg, a follower on a round wheel, a rack on a wheel with no teeth), `one_way_only` (gear and rack: it
 * pushes one way and runs out), `rod_too_short` (the rod jams on that crank), `stroke_too_small`, `stroke_too_big`,
 * `too_weak` (a bigger crank fits but cannot push hard enough).
 */
export const MACHINE_MISSES_BY_MODE = {
  spin_to_push: ['wrong_pair', 'one_way_only', 'rod_too_short', 'stroke_too_small', 'stroke_too_big', 'too_weak'],
} as const;
export type MachineMiss = typeof MACHINE_MISSES_BY_MODE[keyof typeof MACHINE_MISSES_BY_MODE][number];

export const machineWorkshopCard = defineCard<MachineMiss>({
  id: 'machine-workshop',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    spin_to_push: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      misses: MACHINE_MISSES_BY_MODE.spin_to_push,
      // No levers yet (/add-support-tiers): every miss is answered by the run itself until then.
      unanswered: MACHINE_MISSES_BY_MODE.spin_to_push,
      moves: 'taps a part for the spinning wheel and a part to join it to the working end, presses Run and watches what '
        + 'the machine does, tries as many ideas as it likes, and presses "I\'m done!" when it works' },
  },
  words: {
    job: 'make a real machine work by finding how to turn spinning into up-and-down: the machine\'s wheel already spins '
      + 'round and round, its working end (a needle, a pump, a saw blade, a stamp, a toy bird) has to go up and down, and '
      + 'the part between them is missing',
    answer: 'the two parts fitted in the empty slot',
    question: 'what the machine is for, how its wheel moves and how its working end has to move, what each tray part '
      + 'looks like, what is fitted, and what each run did',
    special: 'Teach before you ask. On each new machine, first say in two or three short sentences what the machine is '
      + 'for, that its wheel spins round and round on its own, and that its working end has to go up and down, so the '
      + 'missing part must change spinning into up-and-down; point at the wheel, then the working end. Then describe the '
      + 'tray parts by what they look like (the facts list them) and invite one idea to test with Run. After a run, say '
      + 'what moved and what stayed still. Never say which parts to pick or which two go together.',
  },
});
