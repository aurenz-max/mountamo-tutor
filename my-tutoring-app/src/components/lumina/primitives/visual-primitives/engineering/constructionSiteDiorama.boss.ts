/**
 * construction-site-diorama's boss (`components/live-activity/boss.ts`), bespoke because the answer is a load built
 * scoop by scoop on the 3D site and checked when the truck is sent: the card is `constructionSiteDiorama.card.ts`;
 * this file validates a lesson, lists its loads, asks one and names the harness.
 */
import type { ConstructionSiteDioramaData } from './ConstructionSiteDiorama';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { constructionSiteDioramaCard, type ConstructionMiss } from './constructionSiteDiorama.card';
import { CONSTRUCTION_TASKS, MATERIALS, type ConstructionChallenge } from './constructionModel';

/** A load the workspace can run: an id, a known material, a whole count, a consistent limit on a tons ask. */
function validLoad(c: ConstructionChallenge | undefined): boolean {
  return !!c && typeof c.id === 'string' && !!c.id && (CONSTRUCTION_TASKS as readonly string[]).includes(c.type)
    && (MATERIALS as readonly string[]).includes(c.material)
    && Number.isInteger(c.target) && c.target >= 1
    && !(c.units === 'tons' && (!c.scoopTons || c.capacityTons !== c.target * c.scoopTons))
    && typeof c.instruction === 'string' && !!c.instruction.trim();
}

/** Reject a work site the workspace cannot run: every load needs an id, an instruction, a material and a count. */
export function validateConstructionSiteDioramaData(value: unknown): ConstructionSiteDioramaData {
  const d = value as ConstructionSiteDioramaData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated work site has no title.');
  const loads = Array.isArray(d.challenges) ? d.challenges : [];
  if (!loads.length || loads.length > 12 || new Set(loads.map(c => c?.id)).size !== loads.length || !loads.every(validLoad))
    throw new Error('Generated work site has invalid lesson content.');
  return d;
}

export const constructionSiteDioramaBoss = defineBoss<ConstructionSiteDioramaData, ConstructionChallenge, ConstructionMiss>({
  card: constructionSiteDioramaCard,
  validate: validateConstructionSiteDioramaData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A load the activity checks when the truck is sent: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  drive: {
    component: 'primitives/visual-primitives/engineering/ConstructionSiteDiorama.tsx',
    instanceId: 'site',
    defaults: { grade: 'Grade 1', mode: 'load_truck', topic: 'Loading a dump truck with an excavator' },
    mounted: '[data-construction-scene]',
    // Every scoop is a tap on a mesh of the 3D site (WebGL), which the dry sweep's jsdom cannot draw
    // (journey-sweep-baseline: J1 by design); ConstructionSiteDiorama.workspace.test.tsx drives the commit through a
    // stubbed scene, the browser drive through the canvas.
    play: () => { throw new Error('Construction-site-diorama load_truck is taps on the 3D site, not driven at W1'); },
  },
});
