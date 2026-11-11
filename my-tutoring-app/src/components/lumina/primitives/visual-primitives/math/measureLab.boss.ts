/**
 * measure-lab's boss, on the spoken preset (`components/live-activity/boss.ts`): fill_level is one sayable choice, said
 * (the tutor judges it against `measureKey`) or tapped (the activity checks the tap), a SAY_OR_SHOW item; a guess then
 * a test, cups poured one at a time and three containers tapped in order have no key, the activity checks them, and
 * they play through `show`. The card is `measureLab.card.ts`; this file validates a lesson, lists its challenges,
 * carries the ask, the key, the lever set and the harness play.
 */
import type { MeasureContainer, MeasureLabChallenge, MeasureLabData } from './MeasureLab';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { MEASURE_LEVERS, practiceItem, practiceParent } from './measureLabLevers';
import { measureLabCard, type MeasureMiss } from './measureLab.card';
import { fillLevelKeyOk, measureAsk, measureHarnessWords, measureKey, measureSpokenMisses } from './measureLabWorkspace';

const CHALLENGE_TYPES = ['balance_predict', 'capacity_predict', 'pour_count', 'order_capacity', 'fill_level'];
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
    case 'fill_level':
      return (c.fillAsk === 'empty_full' ? containerOk(c.container) : (c.containers ?? []).every(containerOk))
        && fillLevelKeyOk(c);
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

/**
 * The bench through its real controls: a guess then the test (both on the scale, or Pour), cups poured one at a time
 * then a number, or the jars tapped in order. A wrong answer is the mode's signature error from `measureMiss`: the
 * lighter guess, the guess that holds less, one cup short, the order reversed. Try again clears the bench, so every
 * program starts from a blank one.
 */
const show = (right: boolean, c: MeasureLabChallenge): DriverInput[] => {
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
};

export const measureLabBoss = spokenBoss<MeasureLabData, MeasureLabChallenge, MeasureMiss>({
  card: measureLabCard,
  validate: validateMeasureLabData,
  items: d => d.challenges,
  levers: MEASURE_LEVERS,
  speech: {
    ask: measureAsk,
    // Only fill_level has a key; the bench checks every other mode.
    key: measureKey,
    misses: measureSpokenMisses,
    say: measureHarnessWords,
    modeOf: c => c.type,
    show: (right, c) => show(right, c),
  },
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
  },
});
