/**
 * volcano-island's boss (`components/live-activity/boss.ts`), bespoke because kitchen_volcano is a build (volcano B's
 * mix) with a tapped claim: the activity's own check judges. The card is `volcanoIsland.card.ts`; this file validates a
 * lesson, lists its items, asks one and names the harness.
 */
import type { VolcanoIslandData } from './VolcanoIsland';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { volcanoIslandCard, type VolcanoMiss } from './volcanoIsland.card';
import { VOLCANO_LEVERS, practiceItem, practiceParent } from './volcanoLevers';
import { MAGMAS, magmaFair, type Magma } from './magmaModel';
import { LAYER_WORDS } from './layersModel';
import { SIZE, fewestWalls } from './villageModel';
import { rockFair } from './rockModel';
import { MAX_AMOUNT, MIN_AMOUNT, VOLCANO_TASKS, type Mix, type VolcanoChallenge } from './volcanoModel';

const amount = (n: unknown) => Number.isInteger(n) && (n as number) >= MIN_AMOUNT && (n as number) <= MAX_AMOUNT;
const knownMix = (m: Mix | undefined) => !!m && amount(m.soda) && amount(m.vinegar);

/** One item: a known mix for A, an amount to change that has room to change. */
function validItem(c: VolcanoChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !(VOLCANO_TASKS as readonly string[]).includes(c.type)) return false;
  if (typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  if (c.type === 'cool_the_rock') {
    const places = ['underground', 'surface', 'sea'];
    const sample = (s: { cooling: string; gassy: boolean }) => !!s && places.includes(s.cooling) && typeof s.gassy === 'boolean';
    return Array.isArray(c.tested) && c.tested.length >= 2 && c.tested.length <= 4 && c.tested.every(sample) && sample(c.mystery)
      && Array.isArray(c.places) && c.places.every(p => places.includes(p)) && rockFair(c);
  }
  if (c.type === 'save_the_village') {
    const cells = SIZE * SIZE;
    if (!Array.isArray(c.heights) || c.heights.length !== cells || c.heights.some(h => !Number.isFinite(h))) return false;
    if (!Array.isArray(c.village) || !c.village.length || c.village.some(v => !Number.isInteger(v) || v < 0 || v >= cells)) return false;
    if (!Number.isInteger(c.crater) || !Number.isInteger(c.volume) || c.volume < 2 || !Number.isInteger(c.maxWalls) || c.maxWalls < 1) return false;
    const fix = fewestWalls(c, c.maxWalls);
    return !!fix && fix.length >= 1;
  }
  if (c.type === 'layers_over_time') {
    const kinds = Object.keys(LAYER_WORDS);
    return Array.isArray(c.layers) && c.layers.length >= 2 && c.layers.length <= 4 && c.layers.every(l => kinds.includes(l.kind))
      && new Set(c.layers.map(l => l.id)).size === c.layers.length && kinds.includes(c.newKind) && c.newKind !== 'soil'
      && typeof c.dike === 'boolean';
  }
  if (c.type === 'runny_or_sticky') {
    const known = (m: Magma) => !!m && MAGMAS.some(k => k.key === m.key && k.thick === m.thick && k.gas === m.gas);
    return Array.isArray(c.tested) && c.tested.length >= 2 && c.tested.length <= 3 && [...c.tested, c.mystery].every(known)
      && Array.isArray(c.outcomes) && magmaFair(c);
  }
  return knownMix(c.a) && (c.change === 'soda' || c.change === 'vinegar') && typeof c.lockOther === 'boolean';
}

/** Reject a volcano session the workspace cannot run. */
export function validateVolcanoIslandData(value: unknown): VolcanoIslandData {
  const d = value as VolcanoIslandData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated volcano session has no title.');
  const items = Array.isArray(d.challenges) ? d.challenges : [];
  if (!items.length || items.length > 12 || new Set(items.map(c => c?.id)).size !== items.length || items.some(c => !validItem(c)))
    throw new Error('Generated volcano session has invalid lesson content.');
  return d;
}

export const volcanoIslandBoss = defineBoss<VolcanoIslandData, VolcanoChallenge, VolcanoMiss>({
  card: volcanoIslandCard,
  validate: validateVolcanoIslandData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A test the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: VOLCANO_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/physics/VolcanoIsland.tsx',
    instanceId: 'volcano',
    defaults: { grade: 'Grade 1', mode: 'kitchen_volcano', topic: 'Baking soda volcanoes: a fair test' },
    mounted: '[data-pip-object="workspace"]',
    // An easier item (`~easier`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const challenges: VolcanoChallenge[] = ctx.data.challenges ?? [];
      const parent = practiceParent(ctx.itemId, challenges);
      return parent ? practiceItem(parent) ?? undefined : challenges.find(c => c.id === ctx.itemId);
    },
    // The foam rises only as the 3D table (WebGL) runs, which the dry sweep's jsdom cannot draw
    // (journey-sweep-baseline: J1 by design); VolcanoIsland.workspace.test.tsx drives the commit through a stubbed scene.
    play: () => {
      throw new Error('Volcano-island runs a 3D table, not driven at W1');
    },
  },
});
