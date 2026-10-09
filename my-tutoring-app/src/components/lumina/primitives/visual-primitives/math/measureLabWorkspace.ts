/**
 * Measure lab on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. Every challenge is answered on the
 * screen (a tapped guess, then the test; a tapped count; three jars tapped in order) and checked by the
 * activity's own check, so the tutor is never handed a weight, a capacity, the winner, the count or the order.
 * What the test shows once it has run (which pan went down, how many cups each container took) is drawn on the
 * screen, so it is a scene fact from then on.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { ContainerShape, MeasureLabChallenge } from './MeasureLab';

export function workspaceAssignment(challenge: MeasureLabChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.prompt, response: 'gesture' };
}

export interface MeasureView {
  /** The id the learner guessed (balance_predict, capacity_predict). */
  prediction: string | null;
  placed: { left: boolean; right: boolean };
  /** Cups poured, per container id. */
  poured: Readonly<Record<string, number>>;
  /** order_capacity: container ids in the order tapped. */
  order: readonly string[];
  /** pour_count: the number chosen. */
  chosenCount: number | null;
}

export const EMPTY_VIEW: MeasureView = { prediction: null, placed: { left: false, right: false }, poured: {}, order: [], chosenCount: null };

const SHAPE_WORDS: Record<ContainerShape, string> = { tall: 'tall and narrow', wide: 'wide and short', round: 'round' };

const nameOf = (challenge: MeasureLabChallenge, id: string | null): string => {
  if (!id) return '';
  const all = [challenge.left, challenge.right, challenge.containerA, challenge.containerB, challenge.container,
    ...(challenge.containers ?? [])];
  return all.find(x => x?.id === id)?.name ?? id;
};

const capacityTested = (c: MeasureLabChallenge, view: MeasureView) =>
  !!c.containerA && !!c.containerB && view.poured[c.containerA.id] !== undefined && view.poured[c.containerB.id] !== undefined;

const pourFull = (c: MeasureLabChallenge, view: MeasureView) =>
  !!c.container && (view.poured[c.container.id] ?? 0) >= c.container.capacity;

/** The learner's work in their own terms, never the key. */
export function describeMeasureWork(challenge: MeasureLabChallenge, view: MeasureView): string {
  switch (challenge.type) {
    case 'balance_predict': {
      if (!view.prediction) return 'No guess yet';
      const on = [view.placed.left && challenge.left?.name, view.placed.right && challenge.right?.name].filter(Boolean);
      const scale = on.length === 2 ? 'put both on the scale' : on.length ? `put the ${on[0]} on the scale` : 'nothing on the scale yet';
      return `Guessed the ${nameOf(challenge, view.prediction)} is heavier; ${scale}`;
    }
    case 'capacity_predict':
      if (!view.prediction) return 'No guess yet';
      return `Guessed the ${nameOf(challenge, view.prediction)} holds more; ${capacityTested(challenge, view) ? 'filled both' : 'not filled yet'}`;
    case 'pour_count': {
      // No number of cups poured: once it is full, that number is the answer.
      const pouring = pourFull(challenge, view) ? 'Filled it' : challenge.container && view.poured[challenge.container.id] ? 'Pouring, not full yet' : 'Nothing poured yet';
      return view.chosenCount === null ? pouring : `${pouring}, then chose ${view.chosenCount}`;
    }
    default:
      return view.order.length
        ? `Tapped in order: ${view.order.map(id => nameOf(challenge, id)).join(', ')}${view.order.length < (challenge.containers?.length ?? 3) ? ' (not all yet)' : ''}`
        : 'No jar tapped yet';
  }
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads:
 * - balance_predict: `picked_lighter` (the guess was the lighter object);
 * - capacity_predict: `tall_means_more` (guessed the tall narrow one, which holds less), `picked_less`;
 * - pour_count: `one_short` / `one_over` (off by one cup), `too_few` / `too_many`;
 * - order_capacity: `most_to_least` (the whole order reversed), `two_swapped` (two jars side by side swapped),
 *   `out_of_order`.
 */
export type MeasureMiss = 'picked_lighter' | 'tall_means_more' | 'picked_less'
  | 'one_short' | 'one_over' | 'too_few' | 'too_many'
  | 'most_to_least' | 'two_swapped' | 'out_of_order';

export function measureMiss(challenge: MeasureLabChallenge | null, view: MeasureView): MeasureMiss | undefined {
  if (!challenge) return undefined;
  switch (challenge.type) {
    case 'balance_predict':
      return view.prediction && view.prediction !== challenge.expectedChoice ? 'picked_lighter' : undefined;
    case 'capacity_predict': {
      if (!view.prediction || view.prediction === challenge.expectedChoice) return undefined;
      const picked = [challenge.containerA, challenge.containerB].find(c => c?.id === view.prediction);
      return picked?.shape === 'tall' ? 'tall_means_more' : 'picked_less';
    }
    case 'pour_count': {
      const got = view.chosenCount, want = challenge.expectedCount;
      if (got === null || want === undefined || got === want) return undefined;
      if (got === want - 1) return 'one_short';
      if (got === want + 1) return 'one_over';
      return got < want ? 'too_few' : 'too_many';
    }
    default: {
      const want = challenge.expectedOrder ?? [], got = view.order;
      if (got.length !== want.length || got.every((id, i) => id === want[i])) return undefined;
      if (got.every((id, i) => id === want[want.length - 1 - i])) return 'most_to_least';
      const off = got.map((id, i) => id !== want[i] ? i : -1).filter(i => i >= 0);
      return off.length === 2 && off[1] - off[0] === 1 ? 'two_swapped' : 'out_of_order';
    }
  }
}

/** The activity's own check, as the component runs it. */
export function measureCorrect(challenge: MeasureLabChallenge, view: MeasureView): boolean {
  switch (challenge.type) {
    case 'balance_predict':
    case 'capacity_predict': return view.prediction !== null && view.prediction === challenge.expectedChoice;
    case 'pour_count': return view.chosenCount !== null && view.chosenCount === challenge.expectedCount;
    default: {
      const want = challenge.expectedOrder ?? [];
      return view.order.length === want.length && view.order.every((id, i) => id === want[i]);
    }
  }
}

/** What is drawn and asked. Weights, capacities, water levels and the count are never stated before the test shows them. */
export function workspaceScene(challenge: MeasureLabChallenge, view: MeasureView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  const unit = challenge.unitName || 'cups';
  if (challenge.type === 'balance_predict') {
    drawn.objects = `the ${challenge.left?.name} on the left, the ${challenge.right?.name} on the right; no weights are shown`;
    drawn.howToAnswer = 'first tap the one you think is heavier, then put each on the pan balance; once both are on, '
      + 'the scale tips and the activity checks the guess';
    drawn.scale = view.placed.left && view.placed.right
      ? `both on; the ${challenge.left && challenge.right && challenge.left.weight > challenge.right.weight ? 'left' : 'right'} pan went down`
      : view.placed.left || view.placed.right ? 'one object on, the beam still level' : 'empty and level';
  } else if (challenge.type === 'capacity_predict') {
    const a = challenge.containerA, b = challenge.containerB;
    drawn.containers = `the ${a?.name} (${a ? SHAPE_WORDS[a.shape] : ''}) on the left, the ${b?.name} (${b ? SHAPE_WORDS[b.shape] : ''}) `
      + 'on the right; how much each holds is not shown';
    drawn.howToAnswer = `first tap the one you think holds more, then press Pour to fill both with ${unit}; the activity checks the guess`;
    if (a && b && capacityTested(challenge, view))
      drawn.afterPouring = `the left one took ${view.poured[a.id]} ${unit}, the right one took ${view.poured[b.id]} ${unit}`;
  } else if (challenge.type === 'pour_count') {
    const c = challenge.container;
    drawn.container = `the ${c?.name} (${c ? SHAPE_WORDS[c.shape] : ''}), empty to start`;
    drawn.howToAnswer = `tap a ${unit.replace(/s$/, '')} to pour it in, one at a time; when it is full, number buttons `
      + 'appear and the learner taps how many it took';
    drawn.level = pourFull(challenge, view) ? 'full' : c && view.poured[c.id] ? 'partly filled' : 'empty';
  } else {
    const jars = challenge.containers ?? [];
    drawn.jars = `${jars.length} identical containers (${jars.map(j => j.name).join(', ')}), each with a different amount `
      + 'of water drawn inside; the amounts are not given';
    drawn.howToAnswer = 'tap the containers from the least water to the most; tapping a chosen one takes it out; '
      + 'the activity checks when all are tapped';
  }
  return {
    objects: [],
    facts: {
      kind: challenge.type, ...drawn,
      learnerWork: describeMeasureWork(challenge, view),
      constraints: 'The learner answers on the screen by tapping; the activity runs the test and checks the work itself. '
        + 'You cannot tap, place or pour for the learner.',
    },
  };
}
