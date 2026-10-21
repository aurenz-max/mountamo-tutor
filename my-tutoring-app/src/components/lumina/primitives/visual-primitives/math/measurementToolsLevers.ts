/**
 * measurement-tools' in-item levers (/add-support-tiers; report qa/eval-reports/measurement-tools-levers-2026-10-09.md),
 * declared once as a lever set (`MEASUREMENT_LEVERS`, `bossLevers.ts`); the type of each is in brackets below.
 * The misses are what `measurementMiss` observes; there is no real-learner evidence. Grades 1-5: every help lever changes
 * the picture, and none writes a number.
 *
 * - reading the ruler (measure, compare's shapes, estimate, convert's measure step): `space_shading` (marks) every other
 *   whole-unit space tinted along the WHOLE ruler, so spaces are counted from the zero mark, not marks; `edge_line`
 *   (marks, once the shape is on the ruler) a dashed line from the shape's right edge down across the ruler;
 *   `half_marks` (marks, estimate) every half mark drawn taller and brighter; `shorter_shape` (easier) a shorter
 *   practice rectangle on the same ruler.
 * - converting (convert's second step): `inch_model` (custom) a picture outside the item, a bar one inch long over a
 *   centimeter scale; `smaller_length` (easier, also on the measure step) a short practice rectangle to measure and
 *   convert (one inch, or five centimeters).
 * - ordering (compare's last item): `order_steps` (legend) wordless bars growing short to long over the list;
 *   `own_lengths` (marks) each button shows the length the learner already measured and had checked for that shape;
 *   `three_shapes` (easier) three practice shapes far apart in length, never listed in order.
 *
 * Leak rules (code): no lever text or scene fact carries a digit (`leverTextLeaks`); a practice item never reuses the
 * item's id, a session shape's label or the item's length, is shorter than the item, keeps the mode, and an ordering is
 * never listed shortest first (`practiceLeaks`). The shading runs the whole ruler and the edge line writes nothing.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { MeasurementToolsChallenge } from './MeasurementTools';
import {
  MEASUREMENT_MISSES_BY_MODE, correctOrder, crossSystem, orderChoices, orderShapes, type MeasurementItem, type MeasurementMiss,
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
function shorterWidth(c: MeasurementToolsChallenge, item: MeasurementItem): number | null {
  const { lesson } = item;
  if (lesson.challengeType === 'convert') {
    // Converting one inch, foot or meter (or five centimeters, about two inches) is the rule on its own.
    if (lesson.unit !== 'centimeters') return c.widthInches > 1 ? 1 : null;
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
export function practiceItem(item: MeasurementItem): MeasurementItem | null {
  if (practiceParent(item.id)) return null;
  const id = `${item.id}${PRACTICE_SUFFIX}`, { lesson } = item;
  if (item.kind === 'shape') {
    const width = shorterWidth(item.challenge, item);
    return width === null ? null : { id, lesson, kind: 'shape', challenge: practiceShape(id, 0, width) };
  }
  const shapes = orderShapes(item, lesson);
  if (shapes.length <= 3 && !ordersClose(shapes)) return null;
  return { id, lesson, kind: 'order', shapes: THREE.map((w, i) => practiceShape(`${id}-${i + 1}`, i, w)) };
}

/** Leak rule for a practice item: never the learner's item, its length or a session shape; an ordering never listed in order. */
export function practiceLeaks(parent: MeasurementItem, practice: MeasurementItem): boolean {
  if (practice.id === parent.id || practice.kind !== parent.kind) return true;
  const { lesson } = parent;
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

/** What the learner's work shows that decides which levers can draw now: the step open, and the shape placed. */
export interface LeverView { convertStep: boolean; onRuler: boolean }

// ── the lever set ───────────────────────────────────────────────────────────

const PRACTICE_DOES = 'It is not graded; the full item comes back after it.';
const READING: readonly MeasurementMiss[] = ['one_over', 'one_short', 'too_long', 'too_short'];
const CONVERTING: readonly MeasurementMiss[] = ['same_number', 'wrong_operation', 'too_small', 'too_large'];
const ORDERING: readonly MeasurementMiss[] = ['longest_first', 'two_swapped', 'out_of_order'];
/** On a shape, reading the ruler (convert's first step included): drawn only while the ruler is on screen. */
const reading = (item: MeasurementItem, view: LeverView) => item.kind === 'shape' && !view.convertStep;
const ordering = (item: MeasurementItem) => item.kind === 'order';
/** The simplify content on a shape (the easier practice), or on the ordering. */
const easierShape = (item: MeasurementItem) => (item.kind === 'shape' ? practiceItem(item) : null);
const EDGE_LINE = {
  when: 'The learner misreads where the shape\'s right edge lands.',
  does: 'Drops a dashed line from the shape\'s right edge straight down across the ruler, so the mark it meets is plain. It writes no number.',
  // Only once the shape is on the ruler: the line drops from where its edge sits on it.
  content: (item: MeasurementItem, view: LeverView) => (reading(item, view) && view.onRuler) || null,
  fact: 'A dashed line drops from the shape\'s right edge straight down across the ruler.',
};
const SHORTER_SHAPE = {
  when: 'This shape is too long to read yet.',
  does: `Opens an easier shape first: a shorter practice rectangle on the same ruler. ${PRACTICE_DOES}`,
  content: easierShape,
};

/**
 * The levers, declared once (`bossLevers.ts`). None is offered on a practice item: the component declares nothing
 * while one is on screen. A lever drawn on one step (the ruler, the conversion) has no content on the other, so it is
 * neither offered nor stated there.
 */
export const MEASUREMENT_LEVERS = leverSet<MeasurementItem, LeverView>({
  modeOf: item => item.lesson.challengeType,
  missesOf: mode => MEASUREMENT_MISSES_BY_MODE[mode as keyof typeof MEASUREMENT_MISSES_BY_MODE] ?? [],
  specs: [
    { id: SPACE_SHADING_LEVER, type: 'marks', answers: ['one_over', 'one_short'],
      when: 'The learner counts the marks instead of the spaces, or starts counting at one.',
      does: 'Tints every other space between whole marks along the whole ruler, from the zero mark to the ruler\'s end, so the '
        + 'spaces are what is counted. It does not stop at the shape.',
      content: (item, view) => reading(item, view) || null,
      fact: 'Every other space between whole marks is tinted along the whole ruler, from the zero mark.' },
    { id: EDGE_LINE_LEVER, type: 'marks', modes: ['measure', 'compare', 'convert'], answers: READING, ...EDGE_LINE },
    { id: EDGE_LINE_LEVER, type: 'marks', modes: ['estimate'], answers: [...READING, 'whole_not_half'], ...EDGE_LINE },
    { id: HALF_MARKS_LEVER, type: 'marks', modes: ['estimate'], answers: ['whole_not_half'],
      when: 'The learner reads the edge to the nearest whole mark.',
      does: 'Draws every half mark on the ruler taller and brighter, so a half between two whole numbers stands out. It writes no number.',
      content: (item, view) => reading(item, view) || null,
      fact: 'Every half mark on the ruler is drawn taller and brighter.' },
    // The inch-over-centimeters picture belongs to that pair only (a within-system picture is not built yet: QUEUE 8.1q).
    { id: INCH_MODEL_LEVER, type: 'custom', modes: ['convert'], carrier: 'shown', answers: CONVERTING,
      why: 'a reference picture of how the two units relate, outside the item: not a solved item (model) and not marks on '
        + 'the item\'s own drawing',
      when: 'The learner keeps the number, converts the wrong way, or misjudges the size.',
      does: 'Shows a picture outside the item: a bar one inch long over a centimeter scale, reaching about two and a half '
        + 'centimeter spaces. It uses neither the item\'s length nor its answer.',
      content: (item, view) => (item.kind === 'shape' && view.convertStep
        && crossSystem(item.lesson.unit, item.lesson.convertToUnit)) || null,
      fact: 'Beside the question is a picture outside the item: a bar one inch long over a centimeter scale, reaching about '
        + 'two and a half centimeter spaces.' },
    { id: SHORTER_SHAPE_LEVER, type: 'easier', modes: ['measure', 'compare'], answers: ['too_long', 'too_short'], ...SHORTER_SHAPE },
    { id: SHORTER_SHAPE_LEVER, type: 'easier', modes: ['estimate'], answers: ['too_long', 'too_short', 'whole_not_half'],
      ...SHORTER_SHAPE },
    { id: SMALLER_LENGTH_LEVER, type: 'easier', modes: ['convert'], answers: ['too_long', 'too_short', ...CONVERTING],
      when: 'This length is too much to measure and convert yet.',
      does: `Opens an easier length first: a short practice rectangle to measure and convert. ${PRACTICE_DOES}`,
      content: easierShape },
    { id: ORDER_STEPS_LEVER, type: 'legend', modes: ['compare'], answers: ['longest_first'],
      when: 'The learner orders from the long end.',
      does: 'Shows wordless bars over the list, growing from short to long the way the order runs: shortest first. It names no shape.',
      content: item => ordering(item) || null,
      fact: 'Over the list are wordless bars growing from short to long: shortest first.' },
    { id: OWN_LENGTHS_LEVER, type: 'marks', modes: ['compare'], answers: ORDERING,
      when: 'The learner cannot tell two close shapes apart by eye.',
      does: 'Writes on each shape\'s button the length the learner measured and had checked for it earlier in this lesson.',
      content: item => ordering(item) || null,
      fact: 'Each shape\'s button shows the length the learner measured for it earlier.' },
    { id: THREE_SHAPES_LEVER, type: 'easier', modes: ['compare'], answers: ['two_swapped', 'out_of_order'],
      when: 'These shapes are too many or too close in length to order yet.',
      does: `Opens an easier set first: three practice shapes far apart in length. ${PRACTICE_DOES}`,
      content: item => (ordering(item) ? practiceItem(item) : null) },
  ],
});
