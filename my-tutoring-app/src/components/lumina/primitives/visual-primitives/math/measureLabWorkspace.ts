/**
 * Measure lab on the shared tutor/JEV teaching workspace (the boss is `measureLab.boss.ts`).
 *
 * Pure: the component and any probe read the same scene. Every challenge is answered on the screen (a tapped guess,
 * then the test; a tapped count; three jars tapped in order) and checked by the activity's own check, so the tutor
 * is never handed a weight, a capacity, the winner, the count or the order. What the test shows once it has run
 * (which pan went down, how many cups each container took) is drawn on the screen, so it is a scene fact from then on.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { ContainerShape, MeasureLabChallenge } from './MeasureLab';
import type { MeasureMiss } from './measureLab.card';

export { MEASURE_MISSES_BY_MODE, type MeasureMiss } from './measureLab.card';

export interface MeasureView {
  /** The id the learner guessed (balance_predict, capacity_predict); fill_level: 'empty' | 'full', or the container
   *  id tapped. */
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
/** The shape in words, and its drawn size where an easier practice item draws it larger or smaller. */
const shapeWords = (c?: { shape: ContainerShape; scale?: number }) => !c ? ''
  : SHAPE_WORDS[c.shape] + ((c.scale ?? 1) > 1 ? ', drawn large' : (c.scale ?? 1) < 1 ? ', drawn small' : '');

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

/**
 * fill_level's key, re-derived from the levels code drew: empty or full from the one container's water, or the id of
 * the identical container with more (or less) water. Null when the item has no single answer (a tie, mixed shapes).
 */
export function fillLevelKey(c: MeasureLabChallenge): string | null {
  if (c.type !== 'fill_level') return null;
  if (c.fillAsk === 'empty_full') {
    const k = c.container;
    if (!k) return null;
    return (k.filled ?? 0) === 0 ? 'empty' : (k.filled ?? 0) >= k.capacity ? 'full' : null;
  }
  const [a, b] = c.containers ?? [];
  if (!a || !b || (c.containers ?? []).length !== 2 || a.shape !== b.shape || a.capacity !== b.capacity) return null;
  const fa = a.filled ?? 0, fb = b.filled ?? 0;
  if (fa === fb || (c.fillAsk !== 'more' && c.fillAsk !== 'less')) return null;
  return (fa > fb) === (c.fillAsk === 'more') ? a.id : b.id;
}

/** The stored key agrees with the levels drawn. */
export const fillLevelKeyOk = (c: MeasureLabChallenge) => { const k = fillLevelKey(c); return k !== null && k === c.expectedChoice; };

// ── fill_level, said or tapped (SAY_OR_SHOW) ─────────────────────────────────

const fillPair = (c: MeasureLabChallenge) => {
  const [a, b] = c.containers ?? [];
  return a && b ? { a, b } : null;
};

/**
 * What the learner is asked. Every item but fill_level is asked its own prompt. fill_level's more-or-less ask names
 * both containers, the menu a spoken answer chooses from; empty or full already says both words.
 */
export function measureAsk(c: MeasureLabChallenge): string {
  const pair = c.type === 'fill_level' && c.fillAsk !== 'empty_full' ? fillPair(c) : null;
  return pair ? `${c.prompt.replace(/\?\s*$/, '')}: the ${pair.a.name} or the ${pair.b.name}?` : c.prompt;
}

/** The key a spoken fill_level answer is judged against: a menu the ask says in full. Null on every other mode. */
export function measureKey(c: MeasureLabChallenge): SpokenKey | null {
  if (c.type !== 'fill_level' || !fillLevelKeyOk(c)) return null;
  if (c.fillAsk === 'empty_full') {
    const word = c.expectedChoice as 'empty' | 'full', other = word === 'empty' ? 'full' : 'empty';
    return { answer: word, alsoAccept: [`it is ${word}`, `it's ${word}`], menu: ['empty', 'full'],
      signatureError: `"${other}" is wrong.` };
  }
  const pair = fillPair(c)!;
  const [key, other] = pair.a.id === c.expectedChoice ? [pair.a, pair.b] : [pair.b, pair.a];
  const side = key.name.split(' ')[0];
  return { answer: `the ${key.name}`, alsoAccept: [key.name, `the ${side} one`, side], menu: [`the ${pair.a.name}`, `the ${pair.b.name}`],
    signatureError: `The ${other.name} is wrong: it has ${c.fillAsk === 'more' ? 'less' : 'more'} water.` };
}

/** A spoken fill_level answer's known wrong answer, with the tap's id (`measureMiss`). */
export function measureSpokenMisses(c: MeasureLabChallenge): KnownMiss[] {
  if (!measureKey(c)) return [];
  if (c.fillAsk === 'empty_full') {
    const other = c.expectedChoice === 'empty' ? 'full' : 'empty';
    return [{ id: 'mixed_empty_full', pattern: `The container is ${c.expectedChoice}, but the learner says ${other}.`, examples: [other] }];
  }
  const pair = fillPair(c)!;
  const other = pair.a.id === c.expectedChoice ? pair.b : pair.a;
  return [{ id: 'picked_opposite', pattern: `The learner names the ${other.name}, which has ${c.fillAsk === 'more' ? 'less' : 'more'} water.`,
    examples: [`the ${other.name}`] }];
}

/** The journey's spoken answers: the key's own words, or the other menu word. */
export function measureHarnessWords(c: MeasureLabChallenge): { correct: string; plainWrong: string } {
  const key = measureKey(c)!;
  return { correct: key.answer, plainWrong: key.menu!.find(w => w !== key.answer)! };
}

/** The learner's work in their own terms, never the key. */
export function describeMeasureWork(challenge: MeasureLabChallenge, view: MeasureView): string {
  switch (challenge.type) {
    case 'fill_level':
      if (!view.prediction) return 'No choice yet';
      return challenge.fillAsk === 'empty_full' ? `Chose: ${view.prediction}`
        : `Tapped the ${nameOf(challenge, view.prediction)} as having ${challenge.fillAsk} water`;
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

/** What a wrong answer shows (`TeachingAttempt.miss`), from the work the check reads; the list is the card's. */
export function measureMiss(challenge: MeasureLabChallenge | null, view: MeasureView): MeasureMiss | undefined {
  if (!challenge) return undefined;
  switch (challenge.type) {
    case 'fill_level':
      if (!view.prediction || view.prediction === challenge.expectedChoice) return undefined;
      return challenge.fillAsk === 'empty_full' ? 'mixed_empty_full' : 'picked_opposite';
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
    case 'capacity_predict':
    case 'fill_level': return view.prediction !== null && view.prediction === challenge.expectedChoice;
    case 'pour_count': return view.chosenCount !== null && view.chosenCount === challenge.expectedCount;
    default: {
      const want = challenge.expectedOrder ?? [];
      return view.order.length === want.length && view.order.every((id, i) => id === want[i]);
    }
  }
}

/** What is drawn and asked. Weights, capacities, water levels and the count are never stated before the test shows them. */
export function workspaceScene(challenge: MeasureLabChallenge, view: MeasureView): SceneOf {
  const drawn: Record<string, string | number> = {};
  const unit = challenge.unitName || 'cups';
  if (challenge.type === 'balance_predict') {
    drawn.objects = `the ${challenge.left?.name} on the left, the ${challenge.right?.name} on the right; no weights are shown`;
    drawn.scale = view.placed.left && view.placed.right
      ? `both on; the ${challenge.left && challenge.right && challenge.left.weight > challenge.right.weight ? 'left' : 'right'} pan went down`
      : view.placed.left || view.placed.right ? 'one object on, the beam still level' : 'empty and level';
  } else if (challenge.type === 'capacity_predict') {
    const a = challenge.containerA, b = challenge.containerB;
    drawn.containers = `the ${a?.name} (${shapeWords(a)}) on the left, the ${b?.name} (${shapeWords(b)}) `
      + 'on the right; how much each holds is not shown';
    drawn.pouredWith = unit;
    if (a && b && capacityTested(challenge, view))
      drawn.afterPouring = `the left one took ${view.poured[a.id]} ${unit}, the right one took ${view.poured[b.id]} ${unit}`;
  } else if (challenge.type === 'fill_level') {
    if (challenge.fillAsk === 'empty_full') {
      drawn.container = `the ${challenge.container?.name} (${shapeWords(challenge.container)}), with water drawn inside; `
        + 'how much is not given';
      drawn.choices = 'Empty | Full';
    } else {
      const [a, b] = challenge.containers ?? [];
      drawn.containers = `two identical containers (${shapeWords(a)}), the ${a?.name} and the ${b?.name}, each with `
        + 'water drawn inside; the amounts are not given';
      drawn.question = `which one has ${challenge.fillAsk} water`;
    }
  } else if (challenge.type === 'pour_count') {
    const c = challenge.container;
    drawn.container = `the ${c?.name} (${shapeWords(c)}), empty to start`;
    drawn.pouredWith = unit;
    drawn.level = pourFull(challenge, view) ? 'full' : c && view.poured[c.id] ? 'partly filled' : 'empty';
  } else {
    const jars = challenge.containers ?? [];
    drawn.jars = `${jars.length} identical containers (${jars.map(j => j.name).join(', ')}), each with a different amount `
      + 'of water drawn inside; the amounts are not given';
  }
  return {
    objects: [],
    facts: {
      kind: challenge.type, ...drawn,
      learnerWork: describeMeasureWork(challenge, view),
    },
  };
}
