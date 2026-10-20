/**
 * energy-of-reactions' boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one closed choice
 * the learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. A classify item's reaction is run first. The card is `energyOfReactions.card.ts`; this file holds
 * the content check, the items, the ask and key, the levers and the harness play.
 */
import type { EnergyOfReactionsData } from './EnergyOfReactions';
import { spokenBoss } from '../../../components/live-activity/boss';
import { energyOfReactionsCard } from './energyOfReactions.card';
import { ENERGY_LEVERS, practiceParent, simplerItem } from './energyOfReactionsLevers';
import {
  askOf, energyHarnessAnswers, energyItems, energyKey, energyMode, energySpokenMisses, resolveEnergyModes, thermoReaction,
  type EnergyItem, type EnergyMiss,
} from './energyOfReactionsWorkspace';

/**
 * Reject a lab a mode cannot be asked on: no title, a reaction id the library does not have, or a requested mode with no
 * item. Every item and key is built by code from the library and the diagram and bond tables, so nothing else is
 * trusted from the generator.
 */
export function validateEnergyOfReactionsData(value: unknown): EnergyOfReactionsData {
  const d = value as EnergyOfReactionsData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated energy-of-reactions lab has no title.');
  if (d.reactionIds !== undefined && (!Array.isArray(d.reactionIds) || d.reactionIds.some(id => !thermoReaction(id))))
    throw new Error('A generated energy-of-reactions reaction id is not in the reaction library.');
  const items = energyItems(d);
  for (const mode of resolveEnergyModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The energy-of-reactions ${mode} mode has no item to ask.`);
  }
  return d;
}

export const energyOfReactionsBoss = spokenBoss<EnergyOfReactionsData, EnergyItem, EnergyMiss>({
  card: energyOfReactionsCard,
  validate: validateEnergyOfReactionsData,
  items: energyItems,
  levers: ENERGY_LEVERS,
  speech: {
    ask: askOf,
    key: energyKey,
    misses: energySpokenMisses,
    say: energyHarnessAnswers,
    // A classify item: the reaction runs before there is a reading to answer from.
    before: (item, ctx) => (item.mode === 'classify' && /Not run yet/.test(String(ctx.demand?.thermometer ?? 'Not run yet'))
      ? [{ type: 'choose', label: 'Run the reaction' }] : []),
    modeOf: energyMode,
  },
  drive: {
    component: 'primitives/visual-primitives/chemistry/EnergyOfReactions.tsx',
    instanceId: 'energy-of-reactions',
    defaults: { grade: 'Grade 6', mode: 'classify', topic: 'Exothermic and endothermic reactions' },
    mounted: '[data-pip-object="workspace"]',
    // The simpler practice item (`~practice`) is rebuilt from its parent with the same builder.
    current: ctx => {
      const items = energyItems(ctx.data as EnergyOfReactionsData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full) ?? undefined : full;
    },
  },
});
