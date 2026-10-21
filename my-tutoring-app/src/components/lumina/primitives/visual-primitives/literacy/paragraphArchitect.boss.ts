/**
 * paragraph-architect's boss (`components/live-activity/boss.ts`), bespoke because every item is typed or built and the
 * activity checks it: the card is `paragraphArchitect.card.ts`; this file validates a lesson, lists its items (writing
 * steps, or paragraphs of sentence cards), asks one, carries the lever set and plays the harness.
 */
import type { ParagraphArchitectData } from './ParagraphArchitect';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { paragraphArchitectCard, type ParagraphMiss, type WritingMiss } from './paragraphArchitect.card';
import { PARAGRAPH_LEVERS, isBuildItem, type ParagraphArchitectItem } from './paragraphArchitectLevers';
import { askFor, fewerCardsFor, fewerParent, paragraphItemsOf, paragraphsFrom } from './paragraphBuild';
import { blankParent, blankPractice, stagesFor } from './writingStages';

const KINDS = ['informational', 'narrative', 'opinion'];

/** A writing payload needs a topic and a paragraph type; a build payload needs every paragraph to pass the card gate. */
export function validateParagraphArchitectData(value: unknown): ParagraphArchitectData {
  const d = value as ParagraphArchitectData;
  if (!d || typeof d.title !== 'string') throw new Error('Generated paragraph architect has invalid lesson content.');
  if (d.task === 'paragraph_build') {
    if (!Array.isArray(d.paragraphs) || !d.paragraphs.length || d.paragraphs.length > 8
        || paragraphsFrom(d.paragraphs).length !== d.paragraphs.length)
      throw new Error('A paragraph builder set cannot be asked.');
    return d;
  }
  if (!KINDS.includes(d.paragraphType) || typeof d.topic !== 'string' || !d.topic.trim())
    throw new Error('A writing lesson needs a topic and a paragraph type.');
  return d;
}

/** The lesson's items: its paragraphs of cards, or its writing steps. */
export const paragraphArchitectItems = (d: ParagraphArchitectData): ParagraphArchitectItem[] =>
  (d.task === 'paragraph_build' ? paragraphItemsOf(d) : stagesFor(d));

const askOf = (item: ParagraphArchitectItem) => (isBuildItem(item) ? askFor(item) : item.ask);
const choose = (label: string): DriverInput => ({ type: 'choose', label });

export const paragraphArchitectBoss = defineBoss<ParagraphArchitectData, ParagraphArchitectItem, WritingMiss | ParagraphMiss>({
  card: paragraphArchitectCard,
  validate: validateParagraphArchitectData,
  items: paragraphArchitectItems,
  ask: askOf,
  // Typed sentences and built paragraphs the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, askOf(item), null),
  levers: PARAGRAPH_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/literacy/ParagraphArchitect.tsx',
    instanceId: 'paragraphs',
    defaults: { grade: 'Grade 2', mode: 'build_paragraph', topic: 'Informative paragraphs about animals' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the practice item a simplify lever opened (`~fewer`, `~blank`), rebuilt from its parent.
    current: ctx => {
      const id = String(ctx.itemId ?? ''), parentId = blankParent(fewerParent(id));
      const parent = paragraphArchitectItems(ctx.data as ParagraphArchitectData).find(i => i.id === parentId);
      if (!parent || parentId === id) return parent;
      return (isBuildItem(parent) ? fewerCardsFor(parent) : blankPractice(parent)) ?? undefined;
    },
    // build_paragraph through its real cards: topic, two facts, closing for a pass; the closing first for a wrong one.
    // Try again keeps the paragraph, so a later try clears it first. A writing step's sentence is checked by the
    // shared writing judge (a model), so the dry journey cannot commit it; OlderModes.workspace.test.tsx drives the
    // commits with a stubbed judge (journey-sweep baseline: J1-drivable, by design).
    play: (right, item, ctx) => {
      if (!isBuildItem(item)) throw new Error('paragraph-architect writing steps are judged by the writing judge, not driven at W1');
      const id = (role: string, n = 0) => item.cards.filter(c => c.role === role)[n].id;
      const order = right ? [id('topic'), id('detail'), id('detail', 1), id('closing')]
        : [id('closing'), id('detail'), id('detail', 1), id('topic')];
      const placed = Number(ctx.demand?.sentencesPlaced ?? 0) > 0;
      return [...(placed ? [choose('Clear')] : []), ...order.map(c => choose(`card ${c}`)), choose("I'm done!")];
    },
  },
});
