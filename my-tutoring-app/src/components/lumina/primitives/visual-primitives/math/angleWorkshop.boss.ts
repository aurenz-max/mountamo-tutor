/**
 * angle-workshop's boss (`components/live-activity/boss.ts`), bespoke because the modes mix a typed number, a tapped
 * relationship and a built angle, every one checked by the activity: the card is `angleWorkshop.card.ts`; this file
 * validates a lesson, lists its challenges, asks one, carries the lever set and plays the harness.
 */
import type { AngleWorkshopChallenge, AngleWorkshopData } from './AngleWorkshop';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { angleWorkshopHarnessInputs, fitsTarget, passingOpening } from './angleWorkshopWorkspace';
import { ANGLE_LEVERS, practiceFor, practiceParent } from './angleWorkshopLevers';
import { angleWorkshopCard, type AngleMiss } from './angleWorkshop.card';

const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
const RELATIONS = ['complementary', 'supplementary', 'vertical', 'adjacent'];

/** Whether the activity's own check can be answered as generated: each mode needs the material its check reads. */
function answerable(c: AngleWorkshopChallenge): boolean {
  if (!c || typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  switch (c.type) {
    case 'make_angle':
      // An opening the step buttons reach must pass, and a range must sit inside 0..180.
      return (c.targetKind !== 'range' || (num(c.targetMin) && num(c.targetMax) && c.targetMin! >= 5 && c.targetMin! < c.targetMax! && c.targetMax! <= 180))
        && fitsTarget(c, passingOpening(c));
    case 'classify_pairs':
      return RELATIONS.includes(c.expectedRelationship ?? '') && c.relationship === c.expectedRelationship;
    case 'measure': case 'solve_unknown': case 'solve_algebraic': case 'transversal':
      return num(c.expectedAnswer) && num(c.tolerance) && c.tolerance > 0;
    default:
      return false;
  }
}

/** Reject an angle lesson whose challenges cannot be attempted. */
export const validateAngleWorkshopData = (value: unknown): AngleWorkshopData => validateChallengePool<AngleWorkshopData>(
  value, answerable,
  { pool: 'Generated angle workshop has invalid lesson content.', item: 'An angle-workshop challenge cannot be answered as generated.' });

/** The session item, or the easier practice item a simplify lever opened, rebuilt from its parent. */
function currentItem(data: AngleWorkshopData, itemId: string | null): AngleWorkshopChallenge | undefined {
  const all = data.challenges ?? [];
  const parent = practiceParent(itemId, all);
  return parent ? practiceFor(parent) ?? undefined : all.find(c => c.id === itemId);
}

export const angleWorkshopBoss = defineBoss<AngleWorkshopData, AngleWorkshopChallenge, AngleMiss>({
  card: angleWorkshopCard,
  validate: validateAngleWorkshopData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // Every answer is on screen and the activity checks it: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: ANGLE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/AngleWorkshop.tsx',
    instanceId: 'angles',
    defaults: { grade: 'Grade 4', mode: 'make_angle', topic: 'Acute, right, obtuse and straight angles' },
    mounted: '[data-pip-object="workspace"]',
    current: ctx => currentItem(ctx.data as AngleWorkshopData, ctx.itemId),
    // Every mode through its real controls: make_angle starts over, turns the ray with Open wider and presses I'm done!
    // (wrong: an angle of another kind, or outside the range); measure places the protractor and types; the solving
    // modes type; classify taps a relationship; then Check.
    play: (right, c, ctx) => angleWorkshopHarnessInputs(c, !right, ctx.demand),
  },
});
