/**
 * analog-clock's boss, on the spoken preset (`components/live-activity/boss.ts`): read, match, elapsed and hand_name are
 * said (the tutor judges the words against the key) or picked or touched and checked (the activity checks it),
 * SAY_OR_SHOW items; hear_time (a face picked and checked), count_face and set_time have no key, the activity checks
 * them, and they play through `show`. The card is `analogClock.card.ts`; this file holds the content check, the items,
 * the ask and key, the levers and the harness play.
 */
import type { AnalogClockData, ClockChallenge } from './AnalogClock';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { analogClockCard, type ClockMiss } from './analogClock.card';
import { CLOCK_LEVERS, practiceItem, practiceParent } from './analogClockLevers';
import { clockAsk, clockHarnessWords, clockItems, clockKey, clockOptions, clockSpokenMisses } from './analogClockWorkspace';

const CHALLENGE_TYPES = ['read', 'set_time', 'set_time_ampm', 'match', 'elapsed', 'hand_name', 'count_face', 'hear_time'];
const CHOICE_TYPES = ['read', 'match', 'elapsed', 'hear_time'];
const hourOk = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 12;
const minuteOk = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 59;

/** Reject a clock lesson whose challenges cannot be attempted. */
export function validateAnalogClockData(value: unknown): AnalogClockData {
  const d = value as AnalogClockData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim() || !hourOk(c.targetHour) || !minuteOk(c.targetMinute)))
    throw new Error('Generated analog clock has invalid lesson content.');
  // Each type needs the material its own check reads, or it mounts unanswerable.
  for (const c of d.challenges) {
    const n = clockOptions(c).length;
    const ok = CHOICE_TYPES.includes(c.type)
      ? n >= 2 && Number.isInteger(c.correctOptionIndex) && c.correctOptionIndex! >= 0 && c.correctOptionIndex! < n
      : c.type === 'hand_name' ? c.targetHand === 'hour' || c.targetHand === 'minute'
      : true;
    if (!ok) throw new Error(`An analog-clock ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

const check: DriverInput = { type: 'check' };

export const analogClockBoss = spokenBoss<AnalogClockData, ClockChallenge, ClockMiss>({
  card: analogClockCard,
  validate: validateAnalogClockData,
  items: clockItems,
  levers: CLOCK_LEVERS,
  speech: {
    ask: clockAsk,
    // hear_time, count_face and set_time have no key: the activity checks them.
    key: clockKey,
    misses: clockSpokenMisses,
    say: clockHarnessWords,
    modeOf: c => c.type,
    // The shown items through their real controls. A wrong face is another face whose words do not hold the right one's.
    // count_face has no wrong check: a number out of order restarts the count, so the wrong play is empty. set_time
    // moves the hands by dragging the dial or the bar under it; the driver has no drag input (contract G2).
    show: (right, c) => {
      if (c.type === 'set_time' || c.type === 'set_time_ampm') throw new Error('analog-clock set_time: the hands move by drag (dial or time bar); the driver has no drag input');
      if (c.type === 'count_face') {
        if (!right) return [];
        return [...Array.from({ length: 12 }, (_, i): DriverInput => ({ type: 'touch', target: `number-${i + 1}` })), check];
      }
      const options = clockOptions(c), key = options[c.correctOptionIndex ?? -1] ?? '';
      const at = right ? c.correctOptionIndex ?? -1 : options.findIndex((o, i) => i !== c.correctOptionIndex && !o.includes(key));
      if (at < 0 || !options[at]) throw new Error(`analog-clock ${c.type}: no ${right ? 'right' : 'wrong'} face`);
      return [{ type: 'choose', label: `Clock face ${at + 1}` }, check];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/math/AnalogClock.tsx',
    instanceId: 'clock',
    defaults: { grade: 'Grade 1', mode: 'read', topic: 'Telling time to the hour and half hour' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const items = clockItems(ctx.data as AnalogClockData);
      const parent = practiceParent(ctx.itemId, items);
      return parent ? practiceItem(parent) ?? undefined : items.find(c => c.id === ctx.itemId);
    },
  },
});
