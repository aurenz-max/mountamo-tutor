/**
 * opinion-builder's boss (`components/live-activity/boss.ts`), bespoke because every item is typed or built and the
 * activity checks it: the card is `opinionBuilder.card.ts`; this file validates a lesson, lists its items (writing
 * steps, or questions with cards for either side), asks one, carries the lever set and plays the harness.
 */
import type { OpinionBuilderData } from './OpinionBuilder';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { opinionBuilderCard, type OpinionMiss } from './opinionBuilder.card';
import type { WritingMiss } from './paragraphArchitect.card';
import { OPINION_LEVERS, isBuildItem, type OpinionBuilderItem } from './opinionBuilderLevers';
import { askFor, oneSideFor, opinionItemsOf, opinionWritingPayload, opinionsFrom, sideParent } from './opinionBuild';
import { blankParent, blankPractice, stagesFor } from './writingStages';

/** A writing payload needs a question and a framework; a build payload needs every question to pass the card gate. */
export function validateOpinionBuilderData(value: unknown): OpinionBuilderData {
  const d = value as OpinionBuilderData;
  if (!d || typeof d.title !== 'string') throw new Error('Generated opinion builder has invalid lesson content.');
  if (d.task === 'opinion_build') {
    if (!Array.isArray(d.opinions) || !d.opinions.length || d.opinions.length > 6 || opinionsFrom(d.opinions).length !== d.opinions.length)
      throw new Error('An opinion builder set cannot be asked.');
    return d;
  }
  if (!['oreo', 'cer'].includes(d.framework) || typeof d.prompt !== 'string' || !d.prompt.trim())
    throw new Error('An opinion lesson needs a question and a framework.');
  return d;
}

/** The lesson's items: its questions with cards, or its writing steps. */
export const opinionBuilderItems = (d: OpinionBuilderData): OpinionBuilderItem[] =>
  (d.task === 'opinion_build' ? opinionItemsOf(d) : stagesFor(opinionWritingPayload(d)));

const askOf = (item: OpinionBuilderItem) => (isBuildItem(item) ? askFor(item) : item.ask);
const choose = (label: string): DriverInput => ({ type: 'choose', label });

export const opinionBuilderBoss = defineBoss<OpinionBuilderData, OpinionBuilderItem, WritingMiss | OpinionMiss>({
  card: opinionBuilderCard,
  validate: validateOpinionBuilderData,
  items: opinionBuilderItems,
  ask: askOf,
  // Typed sentences and built answers the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, askOf(item), null),
  levers: OPINION_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/literacy/OpinionBuilder.tsx',
    instanceId: 'opinions',
    defaults: { grade: 'Grade 3', mode: 'build_opinion', topic: 'Opinions about school and home' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the practice item a simplify lever opened (`~side`, `~blank`), rebuilt from its parent.
    current: ctx => {
      const id = String(ctx.itemId ?? ''), parentId = blankParent(sideParent(id));
      const parent = opinionBuilderItems(ctx.data as OpinionBuilderData).find(i => i.id === parentId);
      if (!parent || parentId === id) return parent;
      return (isBuildItem(parent) ? oneSideFor(parent) : blankPractice(parent)) ?? undefined;
    },
    // build_opinion through its real cards: the yes side's opinion, reason, example, restatement for a pass; the
    // restatement first for a wrong one. Try again keeps the answer, so a later try clears it first. OREO and CER
    // sentences are checked by the shared writing judge (a model), so the dry journey cannot commit them;
    // OpinionBuild.workspace.test.tsx drives the commits with a stubbed judge (journey-sweep baseline: J1-drivable, by design).
    play: (right, item, ctx) => {
      if (!isBuildItem(item)) throw new Error('opinion-builder writing steps are judged by the writing judge, not driven at W1');
      const id = (role: string) => item.cards.find(c => c.role === role && c.side === 'yes')!.id;
      const order = right ? [id('opinion'), id('reason'), id('example'), id('restate')]
        : [id('restate'), id('reason'), id('example'), id('opinion')];
      const placed = Number(ctx.demand?.cardsPlaced ?? 0) > 0;
      return [...(placed ? [choose('Clear')] : []), ...order.map(c => choose(`card ${c}`)), choose("I'm done!")];
    },
  },
});
