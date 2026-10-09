/**
 * Measurement tools on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same items, assignment and scene. A session is one item per shape (put
 * it on the ruler, read the length, press Check; convert then changes the checked length to the other unit), and on
 * compare one more item after the shapes: tap them shortest to longest. The activity's own check is the judge, so the
 * tutor is never handed a width, a converted length or the order. What the learner has already had checked right (the
 * measured length on the convert step) is on the screen, so it is a scene fact from then on.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { MeasurementToolsChallenge, MeasurementToolsData } from './MeasurementTools';

export const INCH_TO_CM = 2.54;
/** The compare session's last item: order the measured shapes. */
export const ORDER_ITEM_ID = 'order-shapes';

export type MeasurementItem =
  | { id: string; kind: 'shape'; challenge: MeasurementToolsChallenge }
  /** `shapes`: an easier practice ordering's own shapes (a simplify lever); the session's shapes otherwise. */
  | { id: string; kind: 'order'; shapes?: MeasurementToolsChallenge[] };

/** The shapes an ordering item asks about. */
export const orderShapes = (item: MeasurementItem, lesson: MeasurementLesson): MeasurementToolsChallenge[] =>
  item.kind === 'order' ? item.shapes ?? lesson.challenges : [];

/** What every item reads from the session. */
export interface MeasurementLesson {
  challengeType: MeasurementToolsData['challengeType'];
  challenges: MeasurementToolsChallenge[];
  unit: MeasurementToolsData['unit'];
  convertToUnit: MeasurementToolsData['unit'];
  precision: MeasurementToolsData['precision'];
  rulerLengthInches: number;
  rulerLabels: NonNullable<MeasurementToolsData['rulerLabels']>;
  showConversionFactor: boolean;
}

export function lessonOf(data: MeasurementToolsData): MeasurementLesson {
  return {
    challengeType: data.challengeType, challenges: data.challenges, unit: data.unit,
    convertToUnit: data.convertToUnit || (data.unit === 'inches' ? 'centimeters' : 'inches'),
    precision: data.precision, rulerLengthInches: data.rulerLengthInches, rulerLabels: data.rulerLabels ?? 'whole',
    showConversionFactor: data.showConversionFactor ?? true,
  };
}

/** One item per shape, then the ordering on compare. */
export function measurementItems(challengeType: MeasurementToolsData['challengeType'],
  challenges: MeasurementToolsChallenge[]): MeasurementItem[] {
  const shapes: MeasurementItem[] = challenges.map(challenge => ({ id: challenge.id, kind: 'shape', challenge }));
  return challengeType === 'compare' && challenges.length > 1 ? [...shapes, { id: ORDER_ITEM_ID, kind: 'order' }] : shapes;
}

/**
 * The order the compare buttons are listed in: the session's own order, unless that is already shortest to longest
 * (older generations sorted the shapes), when the first moves to the end. Never the answer.
 */
export function orderChoices(challenges: MeasurementToolsChallenge[]): MeasurementToolsChallenge[] {
  const ascending = challenges.every((c, i) => i === 0 || challenges[i - 1].widthInches <= c.widthInches);
  return ascending && challenges.length > 1 ? [...challenges.slice(1), challenges[0]] : challenges;
}

export const correctOrder = (challenges: MeasurementToolsChallenge[]): string[] =>
  [...challenges].sort((a, b) => a.widthInches - b.widthInches).map(c => c.id);

const singular = (unit: string) => unit === 'inches' ? 'inch' : unit.replace(/s$/, '');

export function convertValue(value: number, from: string, to: string): number {
  if (from === to) return value;
  if (from === 'inches' && to === 'centimeters') return value * INCH_TO_CM;
  if (from === 'centimeters' && to === 'inches') return value / INCH_TO_CM;
  return value;
}

export const measureTolerance = (precision: MeasurementLesson['precision']) => precision === 'half' ? 0.25 : 0.5;
export const conversionTolerance = (target: number) => Math.max(0.5, target * 0.1);

export function measureCorrect(challenge: MeasurementToolsChallenge, lesson: MeasurementLesson, value: number | null): boolean {
  return value !== null && Number.isFinite(value) && Math.abs(value - challenge.widthInches) <= measureTolerance(lesson.precision);
}

/** The converted length the check accepts, from the measured (true) length. */
export const conversionTarget = (challenge: MeasurementToolsChallenge, lesson: MeasurementLesson) =>
  convertValue(challenge.widthInches, lesson.unit, lesson.convertToUnit);

export function conversionCorrect(challenge: MeasurementToolsChallenge, lesson: MeasurementLesson, value: number | null): boolean {
  if (value === null || !Number.isFinite(value)) return false;
  const target = conversionTarget(challenge, lesson);
  return Math.abs(value - target) <= conversionTolerance(target);
}

export function orderCorrect(shapes: MeasurementToolsChallenge[], order: readonly string[]): boolean {
  const want = correctOrder(shapes);
  return order.length === want.length && order.every((id, i) => id === want[i]);
}

export interface MeasurementView {
  /** The shape sits on the ruler, its left edge at 0. */
  onRuler: boolean;
  /** The length entered on the measure step; null while the box is empty. */
  measure: number | null;
  /** convert: the measured length was checked right and the conversion is open. */
  convertStep: boolean;
  /** The converted length entered; null while the box is empty. */
  converted: number | null;
  /** compare: shape ids in the order tapped. */
  order: readonly string[];
}

export const EMPTY_VIEW: MeasurementView = { onRuler: false, measure: null, convertStep: false, converted: null, order: [] };

const shapeOf = (item: MeasurementItem) => item.kind === 'shape' ? item.challenge : null;
const labelOf = (shapes: MeasurementToolsChallenge[], id: string) => shapes.find(c => c.id === id)?.label ?? id;

export function workspaceAssignment(item: MeasurementItem, lesson: MeasurementLesson): TeachingAssignment {
  const c = shapeOf(item);
  if (!c) return { id: item.id, response: 'gesture', task: item.kind === 'order' && item.shapes
    ? `Put these ${item.shapes.length} shapes in order from shortest to longest.`
    : `Put the ${lesson.challenges.length} shapes you measured in order from shortest to longest.` };
  const unit = lesson.unit;
  const task = lesson.challengeType === 'convert'
    ? `Measure the ${c.label} in ${unit}, then change that length to ${lesson.convertToUnit}.`
    : lesson.challengeType === 'estimate'
      ? `Put the ${c.label} on the ruler and find how many ${unit} long it is, to the nearest half ${singular(unit)}.`
      : `Put the ${c.label} on the ruler and find how many ${unit} long it is.`;
  return { id: item.id, task, response: 'gesture' };
}

/** The learner's work in their own terms, never the key. */
export function describeMeasurementWork(item: MeasurementItem, lesson: MeasurementLesson, view: MeasurementView): string {
  if (item.kind === 'order') {
    const shapes = orderShapes(item, lesson);
    if (!view.order.length) return 'No shape tapped yet';
    const all = view.order.length >= shapes.length ? '' : ' (not all yet)';
    return `Tapped shortest to longest: ${view.order.map(id => labelOf(shapes, id)).join(', ')}${all}`;
  }
  if (view.convertStep) {
    const measured = `Measured ${item.challenge.widthInches} ${lesson.unit}`;
    return view.converted === null ? `${measured}; no conversion entered yet` : `${measured}; converted to ${view.converted} ${lesson.convertToUnit}`;
  }
  if (!view.onRuler) return 'Not on the ruler yet';
  return view.measure === null ? 'On the ruler; no length entered yet' : `On the ruler; answered ${view.measure} ${lesson.unit}`;
}

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads:
 * - reading the ruler (every mode's shapes): `one_over` / `one_short` (a whole unit off: the marks counted instead of
 *   the spaces, or a start at 1), `whole_not_half` (estimate only: a whole number half a unit off, the edge read to
 *   the nearest whole mark; no direction, so the miss and the answer do not give the length away), `too_long` /
 *   `too_short` (further off);
 * - converting: `same_number` (the measured number kept, not converted), `wrong_operation` (the other way: divided
 *   for multiply or multiplied for divide), `too_small` / `too_large` (the right way, wrong size);
 * - ordering (compare's last item): `longest_first` (the whole order reversed), `two_swapped` (two side by side
 *   swapped), `out_of_order`.
 */
export type MeasurementMiss = 'one_over' | 'one_short' | 'whole_not_half' | 'too_long' | 'too_short'
  | 'same_number' | 'wrong_operation' | 'too_small' | 'too_large'
  | 'longest_first' | 'two_swapped' | 'out_of_order';

export function measurementMiss(item: MeasurementItem | null, lesson: MeasurementLesson, view: MeasurementView): MeasurementMiss | undefined {
  if (!item) return undefined;
  if (item.kind === 'order') {
    const want = correctOrder(orderShapes(item, lesson)), got = view.order;
    if (got.length !== want.length || got.every((id, i) => id === want[i])) return undefined;
    if (got.every((id, i) => id === want[want.length - 1 - i])) return 'longest_first';
    const off = got.map((id, i) => id !== want[i] ? i : -1).filter(i => i >= 0);
    return off.length === 2 && off[1] - off[0] === 1 ? 'two_swapped' : 'out_of_order';
  }
  const c = item.challenge;
  if (view.convertStep) {
    const got = view.converted;
    if (got === null || conversionCorrect(c, lesson, got)) return undefined;
    if (Math.abs(got - c.widthInches) < 0.05) return 'same_number';
    const inverse = convertValue(c.widthInches, lesson.convertToUnit, lesson.unit);
    if (Math.abs(got - inverse) <= conversionTolerance(inverse)) return 'wrong_operation';
    return got < conversionTarget(c, lesson) ? 'too_small' : 'too_large';
  }
  const got = view.measure;
  if (got === null || measureCorrect(c, lesson, got)) return undefined;
  const d = Math.round((got - c.widthInches) * 100) / 100;
  if (lesson.challengeType === 'estimate' && Math.abs(d) === 0.5) return 'whole_not_half';
  if (Math.abs(d) === 1) return d > 0 ? 'one_over' : 'one_short';
  return d > 0 ? 'too_long' : 'too_short';
}

const RULER_LABELS: Record<MeasurementLesson['rulerLabels'], string> = {
  all: 'every mark is numbered, the halves too',
  whole: 'every whole number is written',
  sparse: 'only the even numbers are written, so the learner counts the marks in between',
};

/** What is drawn and asked. The shape's length, a converted length and the shortest-to-longest order are never stated. */
export function workspaceScene(item: MeasurementItem, lesson: MeasurementLesson, view: MeasurementView): WorkspaceScene {
  const drawn: Record<string, string | number> = {};
  const c = shapeOf(item);
  if (!c) {
    const shapes = orderShapes(item, lesson);
    drawn.shapes = `${item.kind === 'order' && item.shapes ? `${shapes.length} practice shapes` : `the ${shapes.length} shapes the learner measured`}, `
      + `each drawn to scale, as buttons: ${orderChoices(shapes).map(s => s.label).join(', ')}; their lengths are not written`;
    drawn.howToAnswer = 'tap the shortest shape first, then the next shortest, until all are tapped, then press Check Order; '
      + 'Reset Order clears the taps';
  } else if (view.convertStep) {
    drawn.step = 'convert';
    drawn.shape = `the ${c.label}`;
    drawn.measured = `the learner measured it as ${c.widthInches} ${lesson.unit}, checked right and shown on screen`;
    drawn.conversion = lesson.showConversionFactor
      ? `the screen shows 1 inch = ${INCH_TO_CM} centimeters`
      : 'the screen does not show how inches and centimeters relate (left off on purpose at this level)';
    drawn.howToAnswer = `type the length in ${lesson.convertToUnit} or set it with − and +, then press Check Conversion; `
      + 'an answer close to the exact value, to a whole or a half, is accepted';
  } else {
    const unit = singular(lesson.unit);
    drawn.step = 'measure';
    drawn.shape = `the ${c.label}, a ${c.shapeType}; its length is not written anywhere`;
    drawn.ruler = `a ruler in ${lesson.unit}, with a mark at every ${lesson.precision === 'half' ? `half ${unit}` : unit}; `
      + RULER_LABELS[lesson.rulerLabels];
    drawn.placed = view.onRuler ? 'on the ruler, its left edge at 0' : 'not on the ruler yet';
    drawn.howToAnswer = 'press Put it on the ruler (or drag the shape onto the ruler); it snaps with its left edge at 0. '
      + `Then type the length in ${lesson.unit} or set it with − and +, and press Check Answer`;
  }
  return {
    objects: [],
    facts: {
      kind: lesson.challengeType, ...drawn,
      learnerWork: describeMeasurementWork(item, lesson, view),
      constraints: 'The learner answers on the screen; the activity checks the answer itself. '
        + 'You cannot place, type, tap or check for the learner.',
    },
  };
}
