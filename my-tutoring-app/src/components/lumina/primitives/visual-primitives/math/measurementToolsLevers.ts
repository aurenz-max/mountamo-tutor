/**
 * measurement-tools' in-item levers (/add-support-tiers; report qa/eval-reports/measurement-tools-levers-2026-10-09.md).
 * The misses are what `measurementMiss` observes; there is no real-learner evidence. Grades 1-5: every help lever changes
 * the picture, and none writes a number.
 *
 * - reading the ruler (measure, compare's shapes, estimate, convert's measure step): `space_shading` (help) every other
 *   whole-unit space tinted along the WHOLE ruler, so spaces are counted from the zero mark, not marks; `edge_line` (help)
 *   a dashed line from the shape's right edge down across the ruler; `half_marks` (help, estimate) every half mark drawn
 *   taller and brighter; `shorter_shape` (simplify) a shorter practice rectangle on the same ruler.
 * - converting (convert's second step): `inch_model` (help) a picture outside the item, a bar one inch long over a
 *   centimeter scale; `smaller_length` (simplify, also on the measure step) a short practice rectangle to measure and
 *   convert (one inch, or five centimeters).
 * - ordering (compare's last item): `order_steps` (help) wordless bars growing short to long over the list;
 *   `own_lengths` (help) each button shows the length the learner already measured and had checked for that shape;
 *   `three_shapes` (simplify) three practice shapes far apart in length, never listed in order.
 *
 * Leak rules (code): no lever text or scene fact carries a digit (`leverTextLeaks`); a practice item never reuses the
 * item's id, a session shape's label or the item's length, is shorter than the item, keeps the mode, and an ordering is
 * never listed shortest first (`practiceLeaks`). The shading runs the whole ruler and the edge line writes nothing.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { MeasurementToolsChallenge } from './MeasurementTools';
import {
  correctOrder, orderChoices, orderShapes,
  type MeasurementItem, type MeasurementLesson, type MeasurementMiss,
} from './measurementToolsWorkspace';

export const SPACE_SHADING_LEVER = 'space_shading';
export const EDGE_LINE_LEVER = 'edge_line';
export const HALF_MARKS_LEVER = 'half_marks';
export const SHORTER_SHAPE_LEVER = 'shorter_shape';
export const INCH_MODEL_LEVER = 'inch_model';
export const SMALLER_LENGTH_LEVER = 'smaller_length';
export const ORDER_STEPS_LEVER = 'order_steps';
export const OWN_LENGTHS_LEVER = 'own_lengths';
export const THREE_SHAPES_LEVER = 'three_shapes';

export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';
export const practiceParent = (id: string | null | undefined): string | null =>
  id && id.endsWith(PRACTICE_SUFFIX) ? id.slice(0, -PRACTICE_SUFFIX.length) : null;

/** Practice colours no session draws (the session's pool is blue, red, green, purple, amber, sky). */
const PRACTICE_COLORS: ReadonlyArray<readonly [string, string]> = [
  ['Pink', 'rgba(236,72,153,0.35)'], ['Orange', 'rgba(249,115,22,0.35)'], ['Gray', 'rgba(148,163,184,0.35)'],
];
const practiceShape = (id: string, colour: number, widthInches: number): MeasurementToolsChallenge => ({
  id, shapeType: 'rectangle', widthInches, heightInches: 1, color: PRACTICE_COLORS[colour][1],
  label: `${PRACTICE_COLORS[colour][0]} Rectangle`, hint: 'Line the left edge up with 0, then read where the right edge lands.',
});

/** The length a shape's simplify practice uses, or null when nothing shorter keeps the mode. */
function shorterWidth(c: MeasurementToolsChallenge, lesson: MeasurementLesson): number | null {
  if (lesson.challengeType === 'convert') {
    // Converting one inch (or five centimeters, about two inches) is the rule on its own.
    if (lesson.unit === 'inches') return c.widthInches > 1 ? 1 : null;
    return c.widthInches > 5 ? 5 : null;
  }
  // Estimate keeps the half: one and a half. The others count fewer whole spaces.
  if (lesson.challengeType === 'estimate') return c.widthInches > 2 ? 1.5 : null;
  return c.widthInches >= 5 ? 3 : c.widthInches >= 3 ? 2 : null;
}

/** Ordering practice widths: far apart, listed middle, longest, shortest (never in order). */
const THREE = [6, 10, 2];
const ordersClose = (shapes: MeasurementToolsChallenge[]) => {
  const w = shapes.map(s => s.widthInches).sort((a, b) => a - b);
  return w.some((x, i) => i > 0 && x - w[i - 1] <= 1);
};

/** The easier item a simplify lever opens on this item, or null. */
export function practiceItem(item: MeasurementItem, lesson: MeasurementLesson): MeasurementItem | null {
  if (practiceParent(item.id)) return null;
  const id = `${item.id}${PRACTICE_SUFFIX}`;
  if (item.kind === 'shape') {
    const width = shorterWidth(item.challenge, lesson);
    return width === null ? null : { id, kind: 'shape', challenge: practiceShape(id, 0, width) };
  }
  const shapes = orderShapes(item, lesson);
  if (shapes.length <= 3 && !ordersClose(shapes)) return null;
  return { id, kind: 'order', shapes: THREE.map((w, i) => practiceShape(`${id}-${i + 1}`, i, w)) };
}

/** Leak rule for a practice item: never the learner's item, its length or a session shape; an ordering never listed in order. */
export function practiceLeaks(parent: MeasurementItem, practice: MeasurementItem, lesson: MeasurementLesson): boolean {
  if (practice.id === parent.id || practice.kind !== parent.kind) return true;
  const sessionLabels = lesson.challenges.map(c => c.label);
  if (practice.kind === 'shape' && parent.kind === 'shape') {
    const p = practice.challenge, c = parent.challenge;
    return sessionLabels.includes(p.label) || p.widthInches >= c.widthInches
      || (lesson.challengeType === 'estimate') !== (p.widthInches % 1 !== 0);
  }
  const shapes = orderShapes(practice, lesson);
  if (practice.kind !== 'order' || !practice.shapes || shapes.some(s => sessionLabels.includes(s.label))) return true;
  const listed = orderChoices(shapes).map(s => s.id);
  return listed.join() === correctOrder(shapes).join() || new Set(shapes.map(s => s.widthInches)).size !== shapes.length;
}

/** Leak rule for the help levers' words: no digit (no length, no factor, no count). */
export const leverTextLeaks = (text: string) => /\d/.test(text);

/** What the learner's work shows that decides which levers can draw now. */
export interface LeverView { convertStep: boolean }

export function measurementLevers(item: MeasurementItem | null, lesson: MeasurementLesson, pulled: readonly string[],
  view: LeverView): WorkspaceLever[] {
  if (!item || practiceParent(item.id)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly MeasurementMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const practice = practiceItem(item, lesson);
  const practiceNote = 'It is not graded; the full item comes back after it.';
  if (item.kind === 'order') return [
    lever(ORDER_STEPS_LEVER, 'help', ['longest_first'], 'The learner orders from the long end.',
      'Shows wordless bars over the list, growing from short to long the way the order runs: shortest first. It names no shape.'),
    lever(OWN_LENGTHS_LEVER, 'help', ['two_swapped', 'out_of_order', 'longest_first'],
      'The learner cannot tell two close shapes apart by eye.',
      'Writes on each shape\'s button the length the learner measured and had checked for it earlier in this lesson.'),
    ...(practice ? [lever(THREE_SHAPES_LEVER, 'simplify', ['two_swapped', 'out_of_order'],
      'These shapes are too many or too close in length to order yet.',
      `Opens an easier set first: three practice shapes far apart in length. ${practiceNote}`)] : []),
  ];
  const convert = lesson.challengeType === 'convert';
  const simplify = practice ? [convert
    ? lever(SMALLER_LENGTH_LEVER, 'simplify', ['too_long', 'too_short', 'same_number', 'wrong_operation', 'too_small', 'too_large'],
      'This length is too much to measure and convert yet.',
      `Opens an easier length first: a short practice rectangle to measure and convert. ${practiceNote}`)
    : lever(SHORTER_SHAPE_LEVER, 'simplify',
      lesson.challengeType === 'estimate' ? ['too_long', 'too_short', 'whole_not_half'] : ['too_long', 'too_short'],
      'This shape is too long to read yet.',
      `Opens an easier shape first: a shorter practice rectangle on the same ruler. ${practiceNote}`)] : [];
  if (convert && view.convertStep) return [
    lever(INCH_MODEL_LEVER, 'help', ['same_number', 'wrong_operation', 'too_small', 'too_large'],
      'The learner keeps the number, converts the wrong way, or misjudges the size.',
      'Shows a picture outside the item: a bar one inch long over a centimeter scale, reaching about two and a half '
        + 'centimeter spaces. It uses neither the item\'s length nor its answer.'),
    ...simplify,
  ];
  const estimate = lesson.challengeType === 'estimate';
  return [
    lever(SPACE_SHADING_LEVER, 'help', ['one_over', 'one_short'],
      'The learner counts the marks instead of the spaces, or starts counting at one.',
      'Tints every other space between whole marks along the whole ruler, from the zero mark to the ruler\'s end, so the '
        + 'spaces are what is counted. It does not stop at the shape.'),
    lever(EDGE_LINE_LEVER, 'help', ['one_over', 'one_short', 'too_long', 'too_short', ...(estimate ? ['whole_not_half' as const] : [])],
      'The learner misreads where the shape\'s right edge lands.',
      'Drops a dashed line from the shape\'s right edge straight down across the ruler, so the mark it meets is plain. It writes no number.'),
    ...(estimate ? [lever(HALF_MARKS_LEVER, 'help', ['whole_not_half'],
      'The learner reads the edge to the nearest whole mark.',
      'Draws every half mark on the ruler taller and brighter, so a half between two whole numbers stands out. It writes no number.')] : []),
    ...simplify,
  ];
}

/** What the pulled help levers put on screen, for the tutor and JEV. Pictures only: no digit, no answer. */
export function leverFacts(item: MeasurementItem | null, pulled: readonly string[], view: LeverView): string {
  if (!item || practiceParent(item.id)) return '';
  const on = (id: string) => pulled.includes(id);
  if (item.kind === 'order') return [
    on(ORDER_STEPS_LEVER) && 'Over the list are wordless bars growing from short to long: shortest first.',
    on(OWN_LENGTHS_LEVER) && 'Each shape\'s button shows the length the learner measured for it earlier.',
  ].filter((s): s is string => !!s).join(' ');
  return [
    !view.convertStep && on(SPACE_SHADING_LEVER) && 'Every other space between whole marks is tinted along the whole ruler, from the zero mark.',
    !view.convertStep && on(EDGE_LINE_LEVER) && 'A dashed line drops from the shape\'s right edge straight down across the ruler.',
    !view.convertStep && on(HALF_MARKS_LEVER) && 'Every half mark on the ruler is drawn taller and brighter.',
    view.convertStep && on(INCH_MODEL_LEVER) && 'Beside the question is a picture outside the item: a bar one inch long over a '
      + 'centimeter scale, reaching about two and a half centimeter spaces.',
  ].filter((s): s is string => !!s).join(' ');
}
