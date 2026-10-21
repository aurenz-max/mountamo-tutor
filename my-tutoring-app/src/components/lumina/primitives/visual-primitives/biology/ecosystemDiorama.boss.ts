/**
 * ecosystem-diorama's boss (`components/live-activity/boss.ts`), bespoke because every mode is an experiment in the 3D
 * island tank that the activity checks: the card is `ecosystemDiorama.card.ts`; this file validates a lesson, lists its
 * items, asks one and names the harness.
 */
import type { EcosystemDioramaData } from './EcosystemDiorama';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { ecosystemDioramaCard, type EcosystemMiss } from './ecosystemDiorama.card';
import { COVERS, ECOSYSTEM_TASKS, LOG_DAYS, warmthAt, type EcosystemChallenge } from './ecosystemModel';
import { ANIMALS, SEASONS, WEATHERS, mostCommon } from './ecosystemLife';

const isLog = (days: unknown) => Array.isArray(days) && days.length === LOG_DAYS && days.every(d => (WEATHERS as readonly string[]).includes(d));

/** Whether one item carries what its task needs, and its key agrees with the world model. */
function validItem(c: EcosystemChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !(ECOSYSTEM_TASKS as readonly string[]).includes(c.type)) return false;
  if (typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
  switch (c.type) {
    case 'sun_test':
      return !!c.left?.name && !!c.right?.name && (warmthAt(c.left, 1) > warmthAt(c.right, 1) ? 'left' : 'right') === c.warmer;
    case 'season_from_log':
      return (SEASONS as readonly string[]).includes(c.season) && isLog(c.days) && mostCommon(c.days) != null;
    case 'compare_logs':
      return !!c.a?.label && !!c.b?.label && isLog(c.a.days) && isLog(c.b.days) && (c.answer === 'a' || c.answer === 'b') && !!c.ask;
    case 'plant_needs':
      return !!c.plant && !!c.start && ['sun', 'hut'].includes(c.start.spot) && Array.isArray(c.start.extras);
    case 'season_behavior':
      return Array.isArray(c.animals) && c.animals.length > 0 && c.animals.every(a => (ANIMALS as readonly string[]).includes(a));
    case 'keep_it_cool':
      return !!c.thing && Array.isArray(c.covers) && c.covers.length > 0 && c.covers.every(x => (COVERS as readonly string[]).includes(x));
  }
}

/** Reject an island tank the workspace cannot run. */
export function validateEcosystemDioramaData(value: unknown): EcosystemDioramaData {
  const d = value as EcosystemDioramaData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated island tank has no title.');
  const items = Array.isArray(d.challenges) ? d.challenges : [];
  if (!items.length || items.length > 12 || new Set(items.map(c => c?.id)).size !== items.length || items.some(c => !validItem(c)))
    throw new Error('Generated island tank has invalid lesson content.');
  return d;
}

export const ecosystemDioramaBoss = defineBoss<EcosystemDioramaData, EcosystemChallenge, EcosystemMiss>({
  card: ecosystemDioramaCard,
  validate: validateEcosystemDioramaData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // An experiment the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  drive: {
    component: 'primitives/visual-primitives/biology/EcosystemDiorama.tsx',
    instanceId: 'tank',
    defaults: { grade: 'Kindergarten', mode: 'sun_test', topic: 'The sun warms things up' },
    mounted: '[data-pip-object="workspace"]',
    // The guess, the sun drag and the reading are taps and a drag on meshes of the 3D tank (WebGL), which the dry
    // sweep's jsdom cannot draw (journey-sweep-baseline: J1 by design); EcosystemDiorama.workspace.test.tsx and
    // EcosystemDiorama.modes.workspace.test.tsx drive every mode's commit through a stubbed scene.
    play: () => {
      throw new Error('Ecosystem-diorama is taps and a sun drag on the 3D tank, not driven at W1');
    },
  },
});
