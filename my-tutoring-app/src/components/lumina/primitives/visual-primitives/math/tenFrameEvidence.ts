import { numberWordFor } from './countingBoardScript';
import { TEEN_TEN, teenTotalFor, type SplitVerdict, type TenFrameItem, type TenFrameItemKind } from './tenFrameScript';

/** What the learner produced on one judged attempt, and what was on screen besides the frame. */
export interface TenFrameResponse {
  heard?: string | null;
  /** Gesture items at commit: counters on the frame (placement modes) or counters turned yellow (split, decompose_teen). */
  onFrame?: number;
  /** `split` only: the code verdict on the committed pair. */
  splitVerdict?: SplitVerdict | null;
  /** add / subtract: the equation with a question mark was printed (readers, easiest support). */
  equationShown?: boolean;
  /** build / make_ten / build_teen: the running count of counters on the frame was printed. */
  countShown?: boolean;
  /** subitize: how many times the learner asked to see the counters again on this item. */
  reshows?: number;
}

const n = (v: number) => `${numberWordFor(v)} (${v})`;
const counters = (v: number) => `${v} ${v === 1 ? 'counter' : 'counters'}`;

/** The task and key of one item, stated from its own fields. Facts only; no error is named. */
export function tenFrameTask(item: TenFrameItem, response: Pick<TenFrameResponse, 'equationShown' | 'countShown' | 'reshows'> = {}) {
  const frame = item.capacity === 20 ? 'a double frame of 20' : 'a frame of 10';
  const count = response.countShown ? ' A running count of the counters on the frame was on screen.' : '';
  switch (item.kind) {
    case 'build':
      return { challenge: `An empty ${frame.slice(2)}; the tutor asked for ${counters(item.answer)} and the learner places them.${count}`,
        expected: `${counters(item.answer)} on the frame.` };
    case 'subitize': {
      const again = response.reshows ? ` The learner asked to see them again ${response.reshows === 1 ? 'once' : `${response.reshows} times`}.` : '';
      return { challenge: `${counters(item.answer)} filled in frame order on ${frame}, shown briefly and then hidden; say how many without counting one by one.${again}`,
        expected: n(item.answer) };
    }
    case 'make_ten':
      return item.answerKind === 'gesture'
        ? { challenge: `${counters(item.shown)} on ${frame}; the learner taps empty boxes until the frame is full.${count}`,
          expected: `${item.answer} more placed, filling the frame.` }
        : { challenge: `${counters(item.shown)} on ${frame}; say how many more counters fill the frame.${count}`, expected: `${n(item.answer)} more` };
    case 'split':
      return { challenge: `${item.answer} red counters on ${frame}; turn some yellow to make two groups`
        + ((item.splitOrdinal ?? 1) > 1 ? `, a pair not yet shown for ${item.answer} this session.` : '.'),
      expected: 'Both colours on the frame, and a pair not already shown for this total while an unshown pair remains.' };
    case 'build_teen':
      return { challenge: `A double frame with the top frame full (ten counters); place more counters to make ${teenTotalFor(item)}.${count}`,
        expected: `${item.answer} more placed beside the ten (${teenTotalFor(item)} on the frames).` };
    case 'decompose_teen':
      return { challenge: `${item.answer} red counters scattered over a double frame; turn exactly ten of them yellow.`,
        expected: `Ten yellow and ${item.answer - TEEN_TEN} left red.` };
    case 'add':
      return { challenge: `An empty ${frame.slice(2)}; the tutor said ${item.addend1} plus ${item.addend2}; the learner may place counters, then says how many altogether.`
        + (response.equationShown ? ` "${item.addend1} + ${item.addend2} = ?" was printed on screen.` : ''), expected: `${n(item.answer)} altogether` };
    case 'subtract':
      return { challenge: `${counters(item.shown)} on ${frame}; the tutor said to take away ${item.removed}; the learner may take counters off, then says how many are left.`
        + (response.equationShown ? ` "${item.shown} − ${item.removed} = ?" was printed on screen.` : ''), expected: `${n(item.answer)} left` };
  }
}

/** One observation for the runner: the task and what the learner said, placed or turned yellow. */
export function tenFrameObservation(item: TenFrameItem, response: TenFrameResponse) {
  const onFrame = response.onFrame ?? 0;
  let observed: string;
  if (item.answerKind === 'voice') {
    observed = response.heard?.trim() ? `Said "${response.heard.trim()}".` : 'No transcript; the tutor judged the spoken answer wrong.';
  } else if (item.kind === 'split') {
    const tail = response.splitVerdict === 'empty_part' ? ', leaving one colour with no counters.'
      : response.splitVerdict === 'repeat' ? `, a pair already shown for ${item.answer} this session.` : '.';
    observed = `Left ${item.answer - onFrame} red and turned ${onFrame} yellow${tail}`;
  } else if (item.kind === 'decompose_teen') {
    observed = `Turned ${onFrame} yellow and left ${item.answer - onFrame} red.`;
  } else if (item.kind === 'build_teen') {
    observed = `Placed ${onFrame - item.shown} more beside the ten (${onFrame} on the frames).`;
  } else if (item.kind === 'make_ten') {
    observed = `Placed ${onFrame - item.shown} more and stopped with ${item.capacity - onFrame} ${item.capacity - onFrame === 1 ? 'box' : 'boxes'} empty.`;
  } else {
    observed = `Placed ${counters(onFrame)}.`;
  }
  return { ...tenFrameTask(item, response), observed };
}

const EXPECTED: Record<TenFrameItemKind, string> = {
  build: 'Exactly the number of counters asked for, placed on the frame.',
  subitize: 'The number of counters flashed, recognised without counting one by one.',
  make_ten: 'How many more counters fill the frame: the frame size minus the counters shown.',
  split: 'Two non-empty colour groups, a different pair each time the same total is asked again.',
  build_teen: 'The ones beside the given ten: the teen number minus ten.',
  decompose_teen: 'Exactly ten counters turned yellow.',
  add: 'The number altogether: the first number plus the second.',
  subtract: 'The number left: the start minus the number taken away.',
};

const SESSION: Record<TenFrameItemKind, string> = {
  build: 'the tutor asks for a number and the learner places that many counters on an empty frame',
  subitize: 'counters flash on the frame and hide, and the learner says how many they saw',
  make_ten: 'some counters are on the frame and the learner finds how many more fill it',
  split: 'a group of red counters is on the frame and the learner turns some yellow to make two groups, a different way each time',
  build_teen: 'the top frame is full and the learner places the ones to make a teen number',
  decompose_teen: 'a teen group is scattered over two frames and the learner turns ten of them yellow',
  add: 'the tutor says an addition and the learner says how many altogether',
  subtract: 'the tutor says a take-away and the learner says how many are left',
};

/**
 * The session and its correct outcome, stated per kind for the distiller. The runner's `judgedRunEvidence`
 * adds the item count, the correction policy, the first-response share and the kept phases; this only says
 * what a session of these items IS and what a right answer on it is.
 */
export function tenFrameEvidenceSummary(items: readonly Pick<TenFrameItem, 'kind'>[]): { task: string; expected: string } {
  const modes = Array.from(new Set(items.map((item) => item.kind)));
  return {
    task: `Ten frame (${modes.join(', ')}), ${items.length} items: ${modes.map((kind) => SESSION[kind]).join('; ')}.`,
    expected: modes.map((kind) => EXPECTED[kind]).join(' '),
  };
}
