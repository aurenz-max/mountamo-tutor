/**
 * measurement-tools' boss (`components/live-activity/boss.ts`), bespoke because a shape put on the ruler and its length
 * typed (then converted, or the shapes ordered) is not one tap: the card is `measurementTools.card.ts`; this file
 * validates a lesson, lists its items (one per shape, plus compare's ordering), asks one, carries the lever set and
 * plays the harness.
 */
import type { MeasurementToolsData } from './MeasurementTools';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { convertValue, lessonOf, measurementItems, measurementTask, type MeasurementItem } from './measurementToolsWorkspace';
import { MEASUREMENT_LEVERS, practiceItem, practiceParent } from './measurementToolsLevers';
import { measurementToolsCard, type MeasurementMiss } from './measurementTools.card';

const MODES = ['measure', 'compare', 'estimate', 'convert'];

/** Reject a ruler session whose shapes cannot be measured: every width must sit on the ruler, and compare needs distinct widths. */
export function validateMeasurementToolsData(value: unknown): MeasurementToolsData {
  const d = value as MeasurementToolsData;
  if (!d || typeof d.title !== 'string' || !MODES.includes(d.challengeType) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 11
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || !(d.rulerLengthInches > 0) || !['inches', 'centimeters', 'feet', 'meters'].includes(d.unit))
    throw new Error('Generated measurement tools session has invalid lesson content.');
  for (const c of d.challenges)
    if (!c || typeof c.id !== 'string' || !c.id || typeof c.label !== 'string' || !c.label.trim()
        || !(c.widthInches > 0) || c.widthInches > d.rulerLengthInches)
      throw new Error('A measurement-tools shape cannot be measured on its ruler as generated.');
  if (d.challengeType === 'compare' && new Set(d.challenges.map(c => c.widthInches)).size !== d.challenges.length)
    throw new Error('A measurement-tools compare session needs shapes of different lengths.');
  return d;
}

/** The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): MeasurementItem | undefined {
  const items = measurementItems(lessonOf(ctx.data as MeasurementToolsData));
  const parentId = practiceParent(ctx.itemId);
  const parent = parentId ? items.find(i => i.id === parentId) : undefined;
  return parent ? practiceItem(parent) ?? undefined : items.find(i => i.id === ctx.itemId);
}

const choose = (label: string): DriverInput => ({ type: 'choose', label });

/**
 * Every mode through its real controls: Put it on the ruler, the length typed into its box, Check Answer; convert then
 * types the converted length and presses Check Conversion; compare's last item taps the shapes shortest to longest. A
 * wrong answer is the mode's signature error from `measurementMiss`: one unit over (measure, compare), the whole number
 * above the half (estimate), the measured number kept (convert), the order reversed. Try again on a conversion keeps
 * the checked measurement (the scene's `step` says which step is open).
 */
function play(right: boolean, item: MeasurementItem, ctx: JourneyContext): DriverInput[] {
  const { lesson } = item;
  if (item.kind === 'order') {
    const sorted = [...(item.shapes ?? lesson.challenges)].sort((a, b) => a.widthInches - b.widthInches).map(s => s.label);
    return [...(right ? sorted : sorted.reverse()).map(choose), choose('Check Order')];
  }
  const c = item.challenge;
  const measure = (value: number): DriverInput[] => [
    ...(String(ctx.demand?.placed ?? '').startsWith('on the ruler') ? [] : [choose('Put it on the ruler')]),
    { type: 'write', label: `Length in ${lesson.unit}`, text: String(value) }, choose('Check Answer')];
  if (lesson.challengeType === 'convert') {
    const exact = convertValue(c.widthInches, lesson.unit, lesson.convertToUnit);
    const converted = right ? Math.round(exact * 10) / 10 : c.widthInches;
    const convert: DriverInput[] = [{ type: 'write', label: `Length in ${lesson.convertToUnit}`, text: String(converted) },
      choose('Check Conversion')];
    return ctx.demand?.step === 'convert' ? convert : [...measure(c.widthInches), ...convert];
  }
  if (right) return measure(c.widthInches);
  return measure(c.widthInches + (lesson.challengeType === 'estimate' ? 0.5 : 1));
}

export const measurementToolsBoss = defineBoss<MeasurementToolsData, MeasurementItem, MeasurementMiss>({
  card: measurementToolsCard,
  validate: validateMeasurementToolsData,
  items: d => measurementItems(lessonOf(d)),
  ask: c => measurementTask(c),
  // A length typed, a conversion typed, an order tapped, all checked by the activity: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, measurementTask(c), null),
  levers: MEASUREMENT_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/MeasurementTools.tsx',
    instanceId: 'ruler',
    defaults: { grade: 'Grade 2', mode: 'measure', topic: 'Measuring length with a ruler' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    play,
  },
});
