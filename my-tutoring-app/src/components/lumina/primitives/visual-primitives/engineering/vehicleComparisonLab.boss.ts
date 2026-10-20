/**
 * vehicle-comparison-lab's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one vehicle
 * (with a column on evidence_choice) the learner says (the tutor judges the words against the key) or taps and checks
 * (the activity judges the tap), a SAY_OR_SHOW card. The card is `vehicleComparisonLab.card.ts`; this file holds the
 * content check, the items, the ask and key, the levers and the harness play.
 */
import type { VehicleComparisonLabData } from './VehicleComparisonLab';
import { spokenBoss } from '../../../components/live-activity/boss';
import { vehicleComparisonLabCard } from './vehicleComparisonLab.card';
import { practiceParent, simplerItem, VEHICLE_LEVERS } from './vehicleComparisonLevers';
import {
  askOf, keyName, METRIC_NAME, resolveVehicleModes, rowById, validVehicleItem, vehicleHarnessAnswers, vehicleItems, vehicleKey,
  vehicleSpokenMisses, type VehicleItem, type VehicleMiss, type VehicleWork,
} from './vehicleComparisonWorkspace';

/**
 * Reject a lab a mode cannot be asked on: no title, a stored item code could not have built (every key is computed
 * from the numbers in the item's own table, so nothing else is trusted), or a requested mode with no item.
 */
export function validateVehicleComparisonData(value: unknown): VehicleComparisonLabData {
  const d = value as VehicleComparisonLabData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated vehicle lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validVehicleItem(i))) throw new Error('A generated vehicle item is not one code can key.');
  const items = vehicleItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated vehicle items repeat an id.');
  for (const mode of resolveVehicleModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The vehicle-comparison ${mode} mode has no item.`);
  }
  return d;
}

/** The journey's spoken answers: the key, or the work that shows the mode's first-listed miss, said as a learner would. */
const harnessWords = (item: VehicleItem) => {
  const said = (w: VehicleWork) => {
    const name = rowById(item, w.vehicle)?.name ?? keyName(item);
    return item.mode === 'evidence_choice' && w.evidence ? `${name}, because of ${METRIC_NAME[w.evidence]}` : name;
  };
  const { correct, plainWrong } = vehicleHarnessAnswers(item);
  return { correct: said(correct), plainWrong: said(plainWrong) };
};

export const vehicleComparisonLabBoss = spokenBoss<VehicleComparisonLabData, VehicleItem, VehicleMiss>({
  card: vehicleComparisonLabCard,
  validate: validateVehicleComparisonData,
  items: vehicleItems,
  levers: VEHICLE_LEVERS,
  speech: {
    ask: askOf,
    key: vehicleKey,
    misses: vehicleSpokenMisses,
    say: harnessWords,
    modeOf: item => item.mode,
  },
  drive: {
    component: 'primitives/visual-primitives/engineering/VehicleComparisonLab.tsx',
    instanceId: 'vehicle-comparison-lab',
    defaults: { grade: 'Grade 4', mode: 'evidence_choice', topic: 'Comparing vehicles that move people and goods by speed, capacity and range' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the simpler practice item (`~simpler`) rebuilt from its parent with the same builder.
    current: ctx => {
      const items = vehicleItems(ctx.data as VehicleComparisonLabData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full) ?? undefined : full;
    },
  },
});
