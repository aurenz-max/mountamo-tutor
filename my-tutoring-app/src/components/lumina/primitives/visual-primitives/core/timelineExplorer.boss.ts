/**
 * timeline-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): every mode is SAY_OR_SHOW, split
 * per item. A choice item (identify, date) has a key (`timelineKey`): the learner says a choice (the tutor judges it) or
 * taps it and presses Check Answer (the activity checks it). A card item (order, cause_effect) has no key, gets the
 * gesture assignment, and plays through `show`. Before the first item the learner reads the timeline: every event
 * opened, then Begin the questions. The card is `timelineExplorer.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { TimelineExplorerData } from './TimelineExplorer';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss, hasText } from '../../../components/live-activity/boss';
import { timelineExplorerCard, type TimelineMiss } from './timelineExplorer.card';
import { TIMELINE_LEVERS, practiceParent, simplerItem } from './timelineExplorerLevers';
import {
  askOf, asCheck, deckFor, deckOf, emptyWork, movesTo, optionLabel, resolveKinds, sessionPlan, timelineChecks, timelineHarnessAnswers,
  timelineKey, timelineSpokenMisses, titleOf, validTimelineItem, type TimelineCheck,
} from './timelineExplorerWorkspace';

/**
 * Reject a timeline a mode cannot be asked on: no title, fewer than five events, a stored item code could not have
 * built from these events (every key comes from the events' time order or their led-to links), or a session with no
 * item of a requested kind.
 */
export function validateTimelineExplorerData(value: unknown): TimelineExplorerData {
  const d = value as TimelineExplorerData;
  if (!d || !hasText(d.title)) throw new Error('Generated timeline has invalid lesson content.');
  if (!Array.isArray(d.events) || d.events.length < 5) throw new Error('Generated timeline has too few events.');
  const deck = deckOf(d.events);
  if (Array.isArray(d.items) && d.items.some(i => !validTimelineItem(deck, i))) throw new Error('A generated timeline item is not one code can key.');
  const items = timelineChecks(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated timeline items repeat an id.');
  // cause_effect falls back to a date item when the events have too few links; every other kind must appear.
  for (const kind of Array.from(new Set(sessionPlan(resolveKinds(d))))) {
    if (kind === 'cause_effect' ? !items.some(i => i.kind === 'cause_effect' || i.kind === 'date') : !items.some(i => i.kind === kind)) {
      throw new Error(`The timeline-explorer ${kind} items could not be built.`);
    }
  }
  return d;
}

/** While the timeline is being read (the scene is not ready): open every event, then Begin the questions. */
const readFirst = (c: TimelineCheck, ctx: JourneyContext): DriverInput[] => (ctx.demand?.presentation !== 'ready'
  ? [...c.events.map((_, i): DriverInput => ({ type: 'choose', label: `Event ${i + 1}` })), { type: 'choose', label: 'Begin the questions' }]
  : []);

const check: DriverInput = { type: 'check' };

export const timelineExplorerBoss = spokenBoss<TimelineExplorerData, TimelineCheck, TimelineMiss>({
  card: timelineExplorerCard,
  validate: validateTimelineExplorerData,
  items: timelineChecks,
  levers: TIMELINE_LEVERS,
  speech: {
    ask: c => askOf(deckFor(c.events), c),
    // A card item (order, cause_effect) has no key: the activity checks the cards.
    key: timelineKey,
    misses: c => (c.kind === 'identify' || c.kind === 'date' ? timelineSpokenMisses(deckFor(c.events), c) : []),
    // The key's own words, or the nearest wrong choice.
    say: c => {
      const deck = deckFor(c.events), { correct, plainWrong } = timelineHarnessAnswers(deck, c);
      if (c.kind !== 'identify' && c.kind !== 'date') throw new Error(`timeline-explorer ${c.kind}: a card item is not said`);
      return { correct: optionLabel(deck, c, correct.choice!), plainWrong: optionLabel(deck, c, plainWrong.choice!) };
    },
    before: readFirst,
    modeOf: c => c.mode,
    // A card item through its real controls: Move <title> up from the starting order, then Check Order; or each Cause:
    // then its Effect:, then Check Matches. A wrong answer is two neighbouring cards swapped, or two causes' effects swapped.
    show: (right, c, ctx) => {
      const deck = deckFor(c.events), answers = timelineHarnessAnswers(deck, c), work = right ? answers.correct : answers.plainWrong;
      if (c.kind === 'order') {
        return [...readFirst(c, ctx), ...movesTo(deck, emptyWork(c).order, work.order).map((label): DriverInput => ({ type: 'choose', label })), check];
      }
      if (c.kind !== 'cause_effect') throw new Error(`timeline-explorer ${c.kind}: a choice item is said or tapped, not shown`);
      return [...readFirst(c, ctx), ...c.causes.flatMap((cause): DriverInput[] => [{ type: 'choose', label: `Cause: ${titleOf(deck, cause)}` },
        { type: 'choose', label: `Effect: ${titleOf(deck, work.pairs[cause])}` }]), check];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/core/TimelineExplorer.tsx',
    instanceId: 'timeline-explorer',
    defaults: { grade: 'Grade 4', mode: 'order', topic: 'The road to American independence, 1765-1783' },
    mounted: '[data-pip-object="workspace"]',
    probes: { mounted: { selector: '[aria-label="Event 1"], [data-pip-object="workspace"]' } },
    // The session item, or the simpler practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const items = timelineChecks(ctx.data as TimelineExplorerData);
      const parent = practiceParent(String(ctx.itemId ?? ''));
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      if (!parent || !full) return full;
      const easier = simplerItem(deckFor(full.events), full, items);
      return easier ? asCheck(easier, full.mode, full.events) : undefined;
    },
  },
});
