/**
 * Measurement tools on the shared tutor/JEV teaching workspace (the boss is `measurementTools.boss.ts`).
 *
 * Pure: the component, the boss and any probe read the same items, ask and scene. A session is one item per shape (put
 * it on the ruler, read the length, press Check; convert then changes the checked length to the other unit), and on
 * compare one more item after the shapes: tap them shortest to longest. The activity's own check is the judge, so the
 * tutor is never handed a width, a converted length or the order. What the learner has already had checked right (the
 * measured length on the convert step) is on the screen, so it is a scene fact from then on.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { MeasurementToolsChallenge, MeasurementToolsData } from './MeasurementTools';
import type { MeasurementMiss } from './measurementTools.card';

export { MEASUREMENT_MISSES_BY_MODE, type MeasurementMiss } from './measurementTools.card';

export const INCH_TO_CM = 2.54;

/**
 * The units a session measures and converts in. convert changes the measured length to one other unit: within one
 * system (feet to inches, meters to centimeters: 4.MD.A.1, whole-number multiplication) or across systems (inches and
 * centimeters with 2.54, decimal multiplication; only for an objective that asks for it, e.g. 6.RP.3d). QUEUE 8.1d.
 */
export type LengthUnit = 'inches' | 'centimeters' | 'feet' | 'meters';
export const UNIT_ABBR: Record<LengthUnit, string> = { inches: 'in', centimeters: 'cm', feet: 'ft', meters: 'm' };
const SINGULAR: Record<LengthUnit, string> = { inches: 'inch', centimeters: 'centimeter', feet: 'foot', meters: 'meter' };
/** Each pair as [larger unit, smaller unit, how many of the smaller make one larger]. */
const CONVERSIONS: readonly [LengthUnit, LengthUnit, number][] = [
  ['inches', 'centimeters', INCH_TO_CM], ['feet', 'inches', 12], ['meters', 'centimeters', 100],
];
const pairOf = (from: string, to: string) => CONVERSIONS.find(([a, b]) => (a === from && b === to) || (a === to && b === from));
/** The unit a session converts to when the data names none. */
export const defaultConvertTo = (unit: LengthUnit): LengthUnit =>
  unit === 'inches' ? 'centimeters' : unit === 'centimeters' ? 'inches' : unit === 'feet' ? 'inches' : 'centimeters';
/** Inches and centimeters: the one pair across two systems. */
export const crossSystem = (from: string, to: string) => pairOf(from, to)?.[2] === INCH_TO_CM;
/** "1 foot = 12 inches", the rule the convert step shows when the tier shows it. */
export function conversionRule(from: string, to: string): string {
  const pair = pairOf(from, to);
  return pair ? `1 ${SINGULAR[pair[0]]} = ${pair[2]} ${pair[1]}` : '';
}
/** Changing to the smaller unit multiplies; to the larger, divides. */
export const conversionMultiplies = (from: string, to: string) => pairOf(from, to)?.[0] === from;
/** The compare session's last item: order the measured shapes. */
export const ORDER_ITEM_ID = 'order-shapes';

/** One item, with the session it belongs to (its mode, units and shapes), so the ask needs nothing else. */
export type MeasurementItem = { id: string; lesson: MeasurementLesson } & (
  | { kind: 'shape'; challenge: MeasurementToolsChallenge }
  /** `shapes`: an easier practice ordering's own shapes (a simplify lever); the session's shapes otherwise. */
  | { kind: 'order'; shapes?: MeasurementToolsChallenge[] });

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
    convertToUnit: data.convertToUnit || defaultConvertTo(data.unit),
    precision: data.precision, rulerLengthInches: data.rulerLengthInches, rulerLabels: data.rulerLabels ?? 'whole',
    showConversionFactor: data.showConversionFactor ?? true,
  };
}

/** One item per shape, then the ordering on compare. */
export function measurementItems(lesson: MeasurementLesson): MeasurementItem[] {
  const { challengeType, challenges } = lesson;
  const shapes: MeasurementItem[] = challenges.map(challenge => ({ id: challenge.id, lesson, kind: 'shape', challenge }));
  return challengeType === 'compare' && challenges.length > 1 ? [...shapes, { id: ORDER_ITEM_ID, lesson, kind: 'order' }] : shapes;
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

const singular = (unit: string) => SINGULAR[unit as LengthUnit] ?? unit.replace(/s$/, '');

export function convertValue(value: number, from: string, to: string): number {
  const pair = from === to ? undefined : pairOf(from, to);
  if (!pair) return value;
  return pair[0] === from ? value * pair[2] : value / pair[2];
}

export const measureTolerance = (precision: MeasurementLesson['precision']) => precision === 'half' ? 0.25 : 0.5;
/** Across systems the answer is a decimal, so close counts; within one system it is a whole number, exact to a half. */
export const conversionTolerance = (target: number, exact = false) => exact ? 0.5 : Math.max(0.5, target * 0.1);
const exactPair = (lesson: MeasurementLesson) => !crossSystem(lesson.unit, lesson.convertToUnit);

export function measureCorrect(challenge: MeasurementToolsChallenge, lesson: MeasurementLesson, value: number | null): boolean {
  return value !== null && Number.isFinite(value) && Math.abs(value - challenge.widthInches) <= measureTolerance(lesson.precision);
}

/** The converted length the check accepts, from the measured (true) length. */
export const conversionTarget = (challenge: MeasurementToolsChallenge, lesson: MeasurementLesson) =>
  convertValue(challenge.widthInches, lesson.unit, lesson.convertToUnit);

export function conversionCorrect(challenge: MeasurementToolsChallenge, lesson: MeasurementLesson, value: number | null): boolean {
  if (value === null || !Number.isFinite(value)) return false;
  const target = conversionTarget(challenge, lesson);
  return Math.abs(value - target) <= conversionTolerance(target, exactPair(lesson));
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

/** The ask for one item. Never a length, a converted length or the order. */
export function measurementTask(item: MeasurementItem): string {
  const { lesson } = item;
  const c = shapeOf(item);
  if (!c) return item.kind === 'order' && item.shapes
    ? `Put these ${item.shapes.length} shapes in order from shortest to longest.`
    : `Put the ${lesson.challenges.length} shapes you measured in order from shortest to longest.`;
  const unit = lesson.unit;
  return lesson.challengeType === 'convert'
    ? `Measure the ${c.label} in ${unit}, then change that length to ${lesson.convertToUnit}.`
    : lesson.challengeType === 'estimate'
      ? `Put the ${c.label} on the ruler and find how many ${unit} long it is, to the nearest half ${singular(unit)}.`
      : `Put the ${c.label} on the ruler and find how many ${unit} long it is.`;
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
    if (Math.abs(got - inverse) <= conversionTolerance(inverse, exactPair(lesson))) return 'wrong_operation';
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

/**
 * What is drawn and asked. The shape's length, a converted length and the shortest-to-longest order are never stated.
 * The moves are the card's; the scene says only what this item draws.
 */
export function workspaceScene(item: MeasurementItem, lesson: MeasurementLesson, view: MeasurementView): SceneOf {
  const drawn: Record<string, string | number> = {};
  const c = shapeOf(item);
  if (!c) {
    const shapes = orderShapes(item, lesson);
    drawn.shapes = `${item.kind === 'order' && item.shapes ? `${shapes.length} practice shapes` : `the ${shapes.length} shapes the learner measured`}, `
      + `each drawn to scale, as buttons: ${orderChoices(shapes).map(s => s.label).join(', ')}; their lengths are not written`;
  } else if (view.convertStep) {
    drawn.step = 'convert';
    drawn.shape = `the ${c.label}`;
    drawn.measured = `the learner measured it as ${c.widthInches} ${lesson.unit}, checked right and shown on screen`;
    drawn.conversion = lesson.showConversionFactor
      ? `the screen shows ${conversionRule(lesson.unit, lesson.convertToUnit)}`
      : `the screen does not show how ${lesson.unit} and ${lesson.convertToUnit} relate (left off on purpose at this level)`;
    drawn.accepted = exactPair(lesson) ? 'the exact whole number' : 'an answer close to the exact value, to a whole or a half';
  } else {
    const unit = singular(lesson.unit);
    drawn.step = 'measure';
    drawn.shape = `the ${c.label}, a ${c.shapeType}; its length is not written anywhere`;
    drawn.ruler = `a ruler in ${lesson.unit}, with a mark at every ${lesson.precision === 'half' ? `half ${unit}` : unit}; `
      + RULER_LABELS[lesson.rulerLabels] + '; a shape put on it snaps with its left edge at 0';
    drawn.placed = view.onRuler ? 'on the ruler, its left edge at 0' : 'not on the ruler yet';
  }
  return {
    objects: [],
    facts: { kind: lesson.challengeType, ...drawn, learnerWork: describeMeasurementWork(item, lesson, view) },
  };
}
