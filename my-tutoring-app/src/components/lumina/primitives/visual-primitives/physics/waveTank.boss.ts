/**
 * wave-tank's boss (`components/live-activity/boss.ts`), bespoke because knock_it_down is an experiment: the learner
 * sends waves and settles on paddle settings, and the activity's own check judges them. The card is
 * `waveTank.card.ts`; this file validates a lesson, lists its items, asks one and names the harness.
 */
import type { WaveTankData } from './WaveTank';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { waveTankCard, type WaveMiss } from './waveTank.card';
import { LEVELS, WAVE_TASKS, knockFair, type WaveChallenge } from './waveModel';
import { WAVE_LEVERS, practiceItem, practiceParent } from './waveLevers';

const level = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= LEVELS;

/** One item: a first wave that leaves the tower up, and one setting that can knock it down. */
function validItem(c: WaveChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !(WAVE_TASKS as readonly string[]).includes(c.type)) return false;
  if (typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  if (!c.start || !level(c.start.size) || !level(c.start.speed) || !level(c.sizeCap) || c.sizeCap < c.start.size) return false;
  if (!Number.isInteger(c.need) || !Number.isInteger(c.blocks) || c.blocks < 2) return false;
  return knockFair(c);
}

/** Reject a wave-tank session the workspace cannot run. */
export function validateWaveTankData(value: unknown): WaveTankData {
  const d = value as WaveTankData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated wave tank session has no title.');
  const items = Array.isArray(d.challenges) ? d.challenges : [];
  if (!items.length || items.length > 8 || new Set(items.map(c => c?.id)).size !== items.length || items.some(c => !validItem(c)))
    throw new Error('Generated wave tank session has invalid lesson content.');
  return d;
}

export const waveTankBoss = defineBoss<WaveTankData, WaveChallenge, WaveMiss>({
  card: waveTankCard,
  validate: validateWaveTankData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // An experiment the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: WAVE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/physics/WaveTank.tsx',
    instanceId: 'wave',
    defaults: { grade: 'Grade 4', mode: 'knock_it_down', topic: 'Waves: amplitude, wavelength and energy' },
    mounted: '[data-pip-object="workspace"]',
    // An easier item (`~easier`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const challenges: WaveChallenge[] = ctx.data.challenges ?? [];
      const parent = practiceParent(ctx.itemId, challenges);
      return parent ? practiceItem(parent) ?? undefined : challenges.find(c => c.id === ctx.itemId);
    },
    // The waves move only as the 3D tank (WebGL) runs, which the dry sweep's jsdom cannot draw
    // (journey-sweep-baseline: J1 by design); WaveTank.workspace.test.tsx drives the commit through a stubbed scene.
    play: () => {
      throw new Error('Wave-tank runs a 3D tank, not driven at W1');
    },
  },
});
