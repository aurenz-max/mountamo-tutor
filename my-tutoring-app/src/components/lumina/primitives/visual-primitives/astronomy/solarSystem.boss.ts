/**
 * solar-system-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one spoken
 * planet name the tutor judges against its key. The card is `solarSystem.card.ts`; this file holds the content check,
 * the items, the ask and key, the levers and the harness play.
 */
import type { SolarSystemExplorerData } from './SolarSystemExplorer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { solarSystemCard } from './solarSystem.card';
import { SOLAR_LEVERS, solarPracticeItem } from './solarSystemLevers';
import {
  askFor, itemsFromChallenges, solarHarnessAnswers, solarKey, solarSpokenMisses,
  type SolarBand, type SolarItem, type SpokenSolarMiss,
} from './solarSystemDomain';

const RUNGS: readonly SolarBand[] = ['K', '1', '2', '3', '4', '5'];

/** The band the build gates read: the lesson's grade, Grade 3 when it names none. */
export const solarRungOf = (data: Pick<SolarSystemExplorerData, 'gradeLevel'>): SolarBand =>
  (RUNGS.includes(data.gradeLevel as SolarBand) ? data.gradeLevel as SolarBand : '3');

/** The session's items, built exactly as the component builds them. */
export function solarItems(data: SolarSystemExplorerData): SolarItem[] {
  return itemsFromChallenges(data.challenges ?? [],
    { bodies: data.bodies ?? [], rung: solarRungOf(data), tier: data.supportTier ?? 'medium' }).items;
}

/** Reject a sky with nothing askable: the build gates drop an unknown body, a pair too close to see, a facet above the
 *  band. A payload with no challenges is the ungraded exploration orrery, which the workspace does not run. */
export function validateSolarSystemExplorerData(value: unknown): SolarSystemExplorerData {
  const d = value as SolarSystemExplorerData;
  if (!d || !Array.isArray(d.bodies) || !d.bodies.length) throw new Error('Generated solar system has invalid lesson content.');
  if (!solarItems(d).length) throw new Error('No solar system challenge can be asked.');
  return d;
}

export const solarSystemBoss = spokenBoss<SolarSystemExplorerData, SolarItem, SpokenSolarMiss>({
  card: solarSystemCard,
  validate: validateSolarSystemExplorerData,
  items: solarItems,
  levers: SOLAR_LEVERS,
  speech: {
    ask: askFor,
    key: solarKey,
    misses: solarSpokenMisses,
    say: solarHarnessAnswers,
  },
  drive: {
    component: 'primitives/visual-primitives/astronomy/SolarSystemExplorer.tsx',
    instanceId: 'solar',
    defaults: { grade: 'Grade 2', mode: 'identify', topic: 'The planets of our solar system' },
    mounted: '[data-pip-object="stimulus"]',
    // The session item, or a simplify lever's easier item (`~simpler`, solarSystemLevers.ts) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as SolarSystemExplorerData;
      const items = solarItems(data);
      return items.find(i => i.id === ctx.itemId)
        ?? solarPracticeItem(ctx.itemId ?? undefined, items, { bodies: data.bodies ?? [], rung: solarRungOf(data) }) ?? undefined;
    },
  },
});
