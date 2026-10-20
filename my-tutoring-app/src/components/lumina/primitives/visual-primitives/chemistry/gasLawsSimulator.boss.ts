/**
 * gas-laws-simulator's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one closed choice
 * the learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. The card is `gasLawsSimulator.card.ts`; this file holds the content check, the items, the ask and
 * key, the levers and the harness play.
 */
import type { GasLawsSimulatorData } from './GasLawsSimulator';
import { spokenBoss } from '../../../components/live-activity/boss';
import { gasLawsSimulatorCard } from './gasLawsSimulator.card';
import { GAS_LEVERS, practiceParent, simplerItem } from './gasLawsLevers';
import {
  askOf, gasHarnessAnswers, gasItems, gasKey, gasMode, gasSpokenMisses, resolveGasModes, validGasItem,
  type GasItem, type GasLawsMiss,
} from './gasLawsWorkspace';

/**
 * Reject a lab a mode cannot be asked on: no title, a stored item code could not have built (its key is computed from
 * the container, the state before and the changes, so nothing else is trusted), or a requested mode with no item.
 */
export function validateGasLawsData(value: unknown): GasLawsSimulatorData {
  const d = value as GasLawsSimulatorData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated gas laws lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validGasItem(i))) throw new Error('A generated gas-laws item is not one code can key.');
  const items = gasItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated gas-laws items repeat an id.');
  for (const mode of resolveGasModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The gas-laws ${mode} mode has no item.`);
  }
  return d;
}

export const gasLawsSimulatorBoss = spokenBoss<GasLawsSimulatorData, GasItem, GasLawsMiss>({
  card: gasLawsSimulatorCard,
  validate: validateGasLawsData,
  items: gasItems,
  levers: GAS_LEVERS,
  speech: {
    ask: askOf,
    key: gasKey,
    misses: gasSpokenMisses,
    say: gasHarnessAnswers,
    modeOf: gasMode,
  },
  drive: {
    component: 'primitives/visual-primitives/chemistry/GasLawsSimulator.tsx',
    instanceId: 'gas-laws-simulator',
    defaults: { grade: 'Grade 10', mode: 'observe', topic: 'Gas laws: pressure, volume and temperature' },
    mounted: '[data-pip-object="workspace"]',
    // The simpler practice item (`~simpler`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const items = gasItems(ctx.data as GasLawsSimulatorData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full) ?? undefined : full;
    },
  },
});
