/**
 * story-planner's boss (`components/live-activity/boss.ts`), bespoke because every item is picked, ordered or typed and
 * the activity checks it: the card is `storyPlanner.card.ts`; this file validates a lesson, lists its items (a picture
 * plan and the story's events at K-1, or one planning card per element at grade 2+), asks one, carries the lever set and
 * plays the harness.
 */
import type { StoryPlannerData } from './StoryPlanner';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { storyPlannerCard, type StoryMiss } from './storyPlanner.card';
import { STORY_LEVERS } from './storyPlannerLevers';
import { askFor, splitPictureOption, storyItems, type StoryItem } from './storySteps';

/** A plan needs a story idea and cards to fill (or pictures to pick). */
export function validateStoryPlannerData(value: unknown): StoryPlannerData {
  const d = value as StoryPlannerData;
  if (!d || typeof d.title !== 'string' || typeof d.writingPrompt !== 'string' || !d.writingPrompt.trim())
    throw new Error('Generated story planner has invalid lesson content.');
  if (!storyItems(d).length) throw new Error('A story plan needs cards to fill.');
  return d;
}

const choose = (label: string): DriverInput => ({ type: 'choose', label });
const caption = (text: string) => splitPictureOption(text).label;

export const storyPlannerBoss = defineBoss<StoryPlannerData, StoryItem, StoryMiss>({
  card: storyPlannerCard,
  validate: validateStoryPlannerData,
  items: storyItems,
  ask: askFor,
  // Picks, orders and typed cards the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, askFor(item), null),
  levers: STORY_LEVERS,
  stepOf: item => item.kind,
  drive: {
    component: 'primitives/visual-primitives/literacy/StoryPlanner.tsx',
    instanceId: 'story',
    defaults: { grade: 'Grade 1', mode: 'story_structure', topic: 'A lost puppy' },
    mounted: '[data-pip-object="workspace"]',
    // K-1 through its real pictures: one tap per card (every picture passes, so the plan has no wrong input), then the
    // events in generated order (right) or the last event first (wrong); try again keeps the order, so a later try
    // clears it first. Grade 2+ cards are checked by the shared writing judge (a model), so the dry journey cannot
    // commit them; StoryPlanner.workspace.test.tsx drives them with a stubbed judge (journey-sweep baseline:
    // J1-drivable, by design).
    play: (right, item, ctx) => {
      if (item.kind === 'plan') return right ? item.cards.map(c => choose(caption(c.choices[0]))) : [];
      if (item.kind !== 'order') throw new Error('story-planner cards are judged by the writing judge, not driven at W1');
      const events = item.events.map(e => caption(e.text));
      const order = right ? events : [...events.slice(-1), ...events.slice(0, -1)];
      const placed = ctx.demand?.placed !== undefined && ctx.demand.placed !== 'nothing placed';
      return [...(placed ? [choose('Clear')] : []), ...order.map(choose), choose("I'm done!")];
    },
  },
});
