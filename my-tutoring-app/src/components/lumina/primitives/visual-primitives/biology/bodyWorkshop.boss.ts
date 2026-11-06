/**
 * body-workshop's boss (`components/live-activity/boss.ts`), bespoke because deliver_oxygen is a build: the learner
 * taps body parts into a row, breathes through it, and the activity's own check judges it. The card is
 * `bodyWorkshop.card.ts`; this file validates a lesson, lists its items, asks one and names the harness.
 */
import type { BodyWorkshopData } from './BodyWorkshop';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { bodyWorkshopCard, type BodyWorkshopMiss } from './bodyWorkshop.card';
import { BODY_PARTS, BODY_TASKS, flowErrors, type BodyChallenge, type BodyPart } from './bodyModel';
import { atlasAnimal, fidelityErrors, jobFor } from './bodyAtlas';
import { BODY_LEVERS, practiceBody, practiceParentId } from './bodyLevers';

/** One item: a real animal whose real path is buildable from the bench. */
function validItem(c: BodyChallenge): boolean {
  if (!c || typeof c.id !== 'string' || !c.id || !(BODY_TASKS as readonly string[]).includes(c.type)) return false;
  if (typeof c.instruction !== 'string' || !c.instruction.trim() || typeof c.intro !== 'string' || !c.intro.trim()) return false;
  if (c.goal !== 'into_body' && c.goal !== 'to_muscle') return false;
  const a = atlasAnimal(c.animal);
  const job = jobFor(c.animal, c.type);
  if (!a || !job || !Array.isArray(c.bench) || c.bench.some(p => !(BODY_PARTS as readonly string[]).includes(p))) return false;
  if (c.type === 'deliver_oxygen' ? c.medium !== a.medium : c.medium !== 'outside_food') return false;
  // Some real path flows, is the animal's, and can be built from the bench.
  return job.paths[c.goal].some(p => !flowErrors(c.type, c.goal, c.medium, p).length
    && !fidelityErrors(a, c.type, c.goal, p).length && p.every(x => c.bench.includes(x)));
}

/** Reject a body workshop session the workspace cannot run. */
export function validateBodyWorkshopData(value: unknown): BodyWorkshopData {
  const d = value as BodyWorkshopData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated body workshop session has no title.');
  const items = Array.isArray(d.challenges) ? d.challenges : [];
  if (!items.length || items.length > 6 || new Set(items.map(c => c?.id)).size !== items.length || items.some(c => !validItem(c)))
    throw new Error('Generated body workshop session has invalid lesson content.');
  return d;
}

/** The harness's taps: clear the row (Try again keeps it), then a real path (right) or that path with its last part
 *  left off (wrong; a one-part path gets the stomach instead), then the check. */
export function bodyHarnessInputs(c: BodyChallenge, wrong: boolean) {
  const path: BodyPart[] = [...(jobFor(c.animal, c.type)!.paths[c.goal][0])];
  const taps: BodyPart[] = !wrong ? path : path.length > 1 ? path.slice(0, -1) : ['stomach'];
  return [{ type: 'touch' as const, target: 'clear-row' }, ...taps.map(p => ({ type: 'touch' as const, target: `part-${p}` })),
    { type: 'choose' as const, label: "I'm done!" }];
}

export const bodyWorkshopBoss = defineBoss<BodyWorkshopData, BodyChallenge, BodyWorkshopMiss>({
  card: bodyWorkshopCard,
  validate: validateBodyWorkshopData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A build the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: BODY_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/biology/BodyWorkshop.tsx',
    instanceId: 'body',
    defaults: { grade: 'Grade 4', mode: 'deliver_oxygen', topic: 'How animals get oxygen to their bodies' },
    mounted: '[data-pip-object="workspace"]',
    // The session animal, or the practice animal a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const items = (ctx.data as BodyWorkshopData).challenges ?? [];
      const parent = practiceParentId(ctx.itemId);
      return parent ? practiceBody(items.find(c => c.id === parent)) ?? undefined : items.find(c => c.id === ctx.itemId);
    },
    play: (right, item) => bodyHarnessInputs(item, !right),
  },
});
