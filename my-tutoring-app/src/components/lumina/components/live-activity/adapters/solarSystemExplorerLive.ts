import type { SolarSystemExplorerData } from '../../../primitives/visual-primitives/astronomy/SolarSystemExplorer';
import { itemsFromChallenges, type SolarBand, type SolarItem } from '../../../primitives/visual-primitives/astronomy/solarSystemScript';
import { solarAssignment } from '../../../primitives/visual-primitives/astronomy/solarSystemWorkspace';
import { solarPracticeItem } from '../../../primitives/visual-primitives/astronomy/solarSystemLevers';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const RUNGS: readonly SolarBand[] = ['K', '1', '2', '3', '4', '5'];

const rungOf = (data: SolarSystemExplorerData): SolarBand =>
  RUNGS.includes(data.gradeLevel as SolarBand) ? data.gradeLevel as SolarBand : '3';

/** The judged items, built exactly as the component builds them. */
export function solarItems(data: SolarSystemExplorerData): SolarItem[] {
  return itemsFromChallenges(data.challenges ?? [], { bodies: data.bodies ?? [], rung: rungOf(data) }).items;
}

/** The journey's current item: a session item, or a simplify lever's easier item rebuilt from its parent. */
export function solarJourneyItem(data: SolarSystemExplorerData, itemId: string | null | undefined): SolarItem | undefined {
  const items = solarItems(data);
  return items.find(i => i.id === itemId)
    ?? solarPracticeItem(itemId ?? undefined, items, { bodies: data.bodies ?? [], rung: rungOf(data) }) ?? undefined;
}

/** Reject a sky with nothing askable: the build gates drop an unknown body, a pair too close to see, a
 *  facet above the band. A payload with no challenges is the ungraded exploration orrery, which the
 *  workspace does not run. */
export function validateSolarSystemExplorerData(value: unknown): SolarSystemExplorerData {
  const d = value as SolarSystemExplorerData;
  if (!d || !Array.isArray(d.bodies) || !d.bodies.length) throw new Error('Generated solar system has invalid lesson content.');
  if (!solarItems(d).length) throw new Error('No solar system challenge can be asked.');
  return d;
}

/** What the live adapter needs from the sky; the catalog's `teachingWorkspace` declares the rest. */
export const solarSystemExplorerLiveDomain: WorkspaceDomain<SolarSystemExplorerData> = {
  validate: validateSolarSystemExplorerData,
  initialState: data => {
    const items = solarItems(data);
    return workspaceOpening({ title: data.title || 'Solar System', task: solarAssignment(items[0]).task, total: items.length });
  },
};
