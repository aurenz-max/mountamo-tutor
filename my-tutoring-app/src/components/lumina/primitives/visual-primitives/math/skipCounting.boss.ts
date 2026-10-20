/**
 * skip-counting-runner's boss, on the spoken preset (`components/live-activity/boss.ts`): predict, find the skip
 * value, multiplication and a one-gap fill missing ask for one number, said (the tutor judges it against the key) or
 * typed and checked (the activity checks it), SAY_OR_SHOW items; count along and a fill missing item with two or more
 * gaps have no key, the runner checks each tap or typed number, and they play through `show`. The card is
 * `skipCounting.card.ts`; this file holds the content check, the items, the ask and key, the levers and the harness.
 */
import type { SkipCountingRunnerData } from './SkipCountingRunner';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { skipCountingCard, type SkipCountingMiss } from './skipCounting.card';
import { SKIP_LEVERS, practiceItem, practiceParent } from './skipCountingLevers';
import {
  gapsOf, jumpsTo, linePositions, nextLanding, openingSpots, skipGiven, skipHarnessInputs, skipHarnessWords, skipItems, skipKey,
  skipSpokenMisses, type SkipItem,
} from './skipCountingWorkspace';

const TYPES = ['count_along', 'predict', 'fill_missing', 'find_skip_value', 'connect_multiplication'];

/** Reject a lesson whose line or challenges the runner's own check cannot answer. */
export function validateSkipCountingRunnerData(value: unknown): SkipCountingRunnerData {
  const d = value as SkipCountingRunnerData;
  const line = d && { skipValue: d.skipValue, startFrom: d.startFrom ?? 0, endAt: d.endAt, direction: d.direction ?? 'forward' };
  if (!line || !Number.isInteger(line.skipValue) || line.skipValue < 1 || !Number.isFinite(line.endAt)
      || linePositions(line).length < 3) throw new Error('Generated skip counting runner has an invalid number line.');
  return validateChallengePool<SkipCountingRunnerData>(value, c => {
    if (!c || !TYPES.includes(c.type) || typeof c.instruction !== 'string' || !c.instruction.trim()) return false;
    // An item on its own line (find_skip_value) is checked on that line, which must draw three landings.
    const own = c.line;
    if (own && (!Number.isInteger(own.skipValue) || own.skipValue < 1 || linePositions(own).length < 3)) return false;
    const ln = own ?? line;
    const spots = openingSpots(ln, c), at = spots[spots.length - 1];
    switch (c.type) {
      case 'count_along': case 'predict': return nextLanding(ln, at) !== null;
      case 'fill_missing': return gapsOf(c, ln).length > 0;
      case 'find_skip_value': return true;
      case 'connect_multiplication': return jumpsTo(ln, at) >= 1;
      default: return false;
    }
  }, { pool: 'Generated skip counting runner has invalid lesson content.', item: 'A skip-counting challenge cannot be answered as generated.' });
}

export const skipCountingBoss = spokenBoss<SkipCountingRunnerData, SkipItem, SkipCountingMiss>({
  card: skipCountingCard,
  validate: validateSkipCountingRunnerData,
  items: skipItems,
  levers: SKIP_LEVERS,
  speech: {
    ask: c => c.instruction,
    // count_along and a fill_missing item with two or more gaps have no key: the runner checks them.
    key: skipKey,
    given: skipGiven,
    misses: skipSpokenMisses,
    say: skipHarnessWords,
    modeOf: c => c.type,
    // The keyless items through their real controls, from the current work (Try again keeps the landings made and the
    // gaps filled, which the scene publishes as `at` and `filled`): each next tick then Check (wrong: a tick two jumps
    // ahead), or each gap typed and Checked (wrong: one more than the first open gap).
    show: (right, c, ctx) => {
      const at = Number(ctx.demand?.at);
      const filledText = String(ctx.demand?.filled ?? '').trim();
      const filled = filledText ? filledText.split(',').map(s => Number(s.trim())).filter(Number.isFinite) : [];
      return skipHarnessInputs(c, c.line, !right, { at: Number.isFinite(at) ? at : undefined, filled }) as DriverInput[];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/SkipCountingRunner.tsx',
    instanceId: 'skip',
    defaults: { grade: 'Grade 2', mode: 'count_along', topic: 'Skip counting by 5s on a number line' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice count a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as SkipCountingRunnerData;
      const all = skipItems(data);
      const parent = practiceParent(ctx.itemId, all);
      return parent ? practiceItem(parent, { challenges: all, showOptions: data.showOptions, supportTier: data.supportTier }) ?? undefined
        : all.find(c => c.id === ctx.itemId);
    },
  },
});
