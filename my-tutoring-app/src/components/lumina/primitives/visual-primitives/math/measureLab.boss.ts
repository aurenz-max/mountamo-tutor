/**
 * measure-lab's boss (`components/live-activity/boss.ts`), bespoke because a guess then a test, cups poured one at a
 * time and three containers tapped in order are not one tap: the card is `measureLab.card.ts`; this file validates a
 * lesson, lists its challenges, asks one, carries the lever set and plays the harness.
 */
import type { MeasureContainer, MeasureLabChallenge, MeasureLabData } from './MeasureLab';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { MEASURE_LEVERS, practiceItem, practiceParent } from './measureLabLevers';
import { measureLabCard, type MeasureMiss } from './measureLab.card';

const CHALLENGE_TYPES = ['balance_predict', 'capacity_predict', 'pour_count', 'order_capacity'];
const SHAPES = ['tall', 'wide', 'round'];
const containerOk = (c: MeasureContainer | undefined) => !!c && typeof c.id === 'string' && !!c.id && typeof c.name === 'string'
  && SHAPES.includes(c.shape) && Number.isInteger(c.capacity) && c.capacity > 0;

/** Each type needs the material its own check reads, or it mounts unanswerable. */
function answerable(c: MeasureLabChallenge): boolean {
  switch (c.type) {
    case 'balance_predict':
      return !!c.left && !!c.right && c.left.id !== c.right.id && c.left.weight !== c.right.weight
        && (c.expectedChoice === c.left.id || c.expectedChoice === c.right.id);
    case 'capacity_predict':
      return containerOk(c.containerA) && containerOk(c.containerB) && c.containerA!.id !== c.containerB!.id
        && c.containerA!.capacity !== c.containerB!.capacity
        && (c.expectedChoice === c.containerA!.id || c.expectedChoice === c.containerB!.id);
    case 'pour_count':
      return containerOk(c.container) && c.expectedCount === c.container!.capacity
        && Array.isArray(c.options) && c.options.includes(c.expectedCount!);
    default: {
      const ids = (c.containers ?? []).map(j => j?.id);
      return ids.length >= 2 && (c.containers ?? []).every(containerOk) && new Set(ids).size === ids.length
        && (c.expectedOrder ?? []).length === ids.length && (c.expectedOrder ?? []).every(id => ids.includes(id));
    }
  }
}

/** Reject a measuring lesson whose challenges cannot be attempted. */
export function validateMeasureLabData(value: unknown): MeasureLabData {
  const d = value as MeasureLabData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.prompt !== 'string' || !c.prompt.trim()))
    throw new Error('Generated measure lab has invalid lesson content.');
  for (const c of d.challenges)
    if (!answerable(c)) throw new Error(`A measure-lab ${c.type} challenge cannot be answered as generated.`);
  return d;
}

const choose = (label: string): DriverInput => ({ type: 'choose', label });

export const measureLabBoss = defineBoss<MeasureLabData, MeasureLabChallenge, MeasureMiss>({
  card: measureLabCard,
  validate: validateMeasureLabData,
  items: d => d.challenges,
  ask: c => c.prompt,
  // Every answer is on the bench and the activity checks it: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.prompt, null),
  levers: MEASURE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/MeasureLab.tsx',
    instanceId: 'measure',
    defaults: { grade: 'Kindergarten', mode: 'balance_predict', topic: 'Heavier and lighter' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier item a simplify lever opened (`~smaller`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as MeasureLabData).challenges ?? [];
      const parent = practiceParent(ctx.itemId, all);
      return parent ? practiceItem(parent) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
    // Every type through its real controls: a guess then the test (both on the scale, or Pour), cups poured one at a
    // time then a number, or the jars tapped in order. A wrong answer is the mode's signature error from
    // `measureMiss`: the lighter guess, the guess that holds less, one cup short, the order reversed. Try again clears
    // the bench, so every program starts from a blank one.
    play: (right, c) => {
      if (c.type === 'balance_predict') {
        const guess = [c.left!, c.right!].find(o => (o.id === c.expectedChoice) === right)!;
        return [choose(guess.name), choose(`Put ${c.left!.name} on`), choose(`Put ${c.right!.name} on`)];
      }
      if (c.type === 'capacity_predict') {
        const guess = [c.containerA!, c.containerB!].find(x => (x.id === c.expectedChoice) === right)!;
        return [choose(guess.name), choose(`Pour ${c.unitName || 'cups'} into both`)];
      }
      if (c.type === 'pour_count') {
        const want = c.expectedCount!, options = c.options ?? [];
        const pick = right ? want : options.includes(want - 1) ? want - 1 : options.find(n => n !== want);
        if (pick === undefined) throw new Error('measure-lab pour_count: no wrong number offered');
        return [...Array.from({ length: c.container!.capacity }, () => choose('Pour one in')), choose(String(pick))];
      }
      const byId = new Map((c.containers ?? []).map(j => [j.id, j.name]));
      const ids = right ? c.expectedOrder ?? [] : [...(c.expectedOrder ?? [])].reverse();
      return ids.map(id => choose(String(byId.get(id))));
    },
  },
});
