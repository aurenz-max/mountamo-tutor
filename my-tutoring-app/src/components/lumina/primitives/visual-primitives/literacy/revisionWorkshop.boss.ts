/**
 * revision-workshop's boss (`components/live-activity/boss.ts`), bespoke because every item is typed or ordered and the
 * activity checks it: the card is `revisionWorkshop.card.ts`; this file validates a lesson, lists its items (marked
 * sentences to revise, or one draft to put in order), asks one, carries the lever set and plays the harness.
 */
import type { RevisionWorkshopData } from './RevisionWorkshop';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { revisionWorkshopCard, type RevisionMiss } from './revisionWorkshop.card';
import { REVISION_LEVERS } from './revisionWorkshopLevers';
import { revisionItems, type RevisionItem } from './revisionSteps';

/** Every target must sit in the draft (it is marked there), and reorganize needs 3+ sentences to order. */
export function validateRevisionWorkshopData(value: unknown): RevisionWorkshopData {
  const d = value as RevisionWorkshopData;
  if (!d || typeof d.title !== 'string' || typeof d.draft !== 'string' || !Array.isArray(d.targets))
    throw new Error('Generated revision workshop has invalid lesson content.');
  const items = revisionItems(d);
  if (!items.length) throw new Error('A revision lesson needs sentences to revise.');
  if (d.targets.some(t => !d.draft.includes(t.originalText.trim()))) throw new Error('A revision target is not in the draft.');
  return d;
}

const askOf = (item: RevisionItem) => item.ask;
const choose = (label: string): DriverInput => ({ type: 'choose', label });

export const revisionWorkshopBoss = defineBoss<RevisionWorkshopData, RevisionItem, RevisionMiss>({
  card: revisionWorkshopCard,
  validate: validateRevisionWorkshopData,
  items: revisionItems,
  ask: askOf,
  // Typed revisions and orders the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, askOf(item), null),
  levers: REVISION_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/literacy/RevisionWorkshop.tsx',
    instanceId: 'revisions',
    defaults: { grade: 'Grade 5', mode: 'reorganize', topic: 'A day at the beach' },
    mounted: '[data-pip-object="workspace"]',
    // reorganize through its real sentence cards: the targets' order passes in code; wrong is the last sentence first.
    // Try again keeps the order, so a later try clears it first. A typed revision is checked by the shared writing
    // judge (a model), so the dry journey cannot commit it; RevisionWorkshop.workspace.test.tsx drives the commits with
    // a stubbed judge (journey-sweep baseline: J1-drivable, by design).
    play: (right, item, ctx) => {
      if (item.skill !== 'reorganize') throw new Error('revision-workshop typed revisions are judged by the writing judge, not driven at W1');
      const ids = item.sentences.map(s => s.id);
      const order = right ? ids : [...ids.slice(-1), ...ids.slice(0, -1)];
      const placed = Number(ctx.demand?.sentencesPlaced ?? 0) > 0;
      return [...(placed ? [choose('Clear')] : []), ...order.map(id => choose(`sentence ${id}`)), choose("I'm done!")];
    },
  },
});
