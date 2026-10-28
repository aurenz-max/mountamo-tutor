/**
 * analog-clock set_time_ampm: set the hands to an event's time and say whether it is a.m. or p.m.
 * (curriculum design review math-g2-2026-10-27, brief 4; MEAS002-04-b).
 *
 * Code owns every item: the event decides the period, the printed time never carries it. The tier picks
 * the events: easy the plain ones on the hour or half hour (breakfast, dinner, bedtime), medium any event
 * on the five-minute grid before :40, hard the times children confuse (lunch just after 12, waking at
 * 6:45 beside dinner at 6:45, bedtime after 7), minutes up to :55. No noon or midnight on the hour.
 */
import type { ClockChallenge } from '../../primitives/visual-primitives/math/AnalogClock';

export type Period = 'am' | 'pm';

interface ClockEvent {
  /** Said before "is at": "School lunch". */
  name: string;
  period: Period;
  /** Earliest and latest time, in minutes after midnight (24-hour), inclusive. */
  from: number;
  to: number;
  /** Plain events go to the easy tier. */
  plain?: boolean;
  /** Times children confuse: just after noon, early morning beside early evening. */
  confusable?: boolean;
}

const t = (h: number, m = 0) => h * 60 + m;

export const CLOCK_EVENTS: readonly ClockEvent[] = [
  { name: 'Wake-up time', period: 'am', from: t(6), to: t(7, 30), plain: true, confusable: true },
  { name: 'Breakfast', period: 'am', from: t(7), to: t(8, 15), plain: true },
  { name: 'The school bus comes', period: 'am', from: t(7, 15), to: t(8, 30) },
  { name: 'Morning recess', period: 'am', from: t(9, 45), to: t(10, 45) },
  { name: 'The library opens', period: 'am', from: t(9), to: t(10) },
  { name: 'School lunch', period: 'pm', from: t(12, 5), to: t(12, 45), confusable: true },
  { name: 'Afternoon recess', period: 'pm', from: t(13, 30), to: t(14, 30) },
  { name: 'School is over', period: 'pm', from: t(14, 45), to: t(15, 30) },
  { name: 'Soccer practice', period: 'pm', from: t(16), to: t(17, 15) },
  { name: 'Dinner', period: 'pm', from: t(17, 30), to: t(18, 45), plain: true, confusable: true },
  { name: 'Bath time', period: 'pm', from: t(19), to: t(19, 45) },
  { name: 'Bedtime', period: 'pm', from: t(19, 30), to: t(20, 45), plain: true, confusable: true },
];

const pick = <T>(xs: readonly T[], rand: () => number) => xs[Math.floor(rand() * xs.length)];

/** The 12-hour dial reading of a 24-hour minute count. */
export const dialOf = (mins: number) => ({ hour: Math.floor(mins / 60) % 12 || 12, minute: mins % 60 });
export const hhmm = (hour: number, minute: number) => `${hour}:${String(minute).padStart(2, '0')}`;

/** The instruction: the event and the time, never "a.m.", "p.m.", "morning" or "night" beyond the event's own name. */
export const ampmInstruction = (name: string, hour: number, minute: number) =>
  `${name} is at ${hhmm(hour, minute)}. Set the clock, then choose a.m. or p.m.`;

/** Times an event can take at a tier: the five-minute grid, narrowed by tier. */
function timesFor(e: ClockEvent, tier: 'easy' | 'medium' | 'hard' | null): number[] {
  const out: number[] = [];
  for (let m = e.from; m <= e.to; m += 5) {
    const minute = m % 60;
    if (m % 720 === 0) continue; // noon and midnight on the hour are out
    if (tier === 'easy' && minute % 30 !== 0) continue;
    if (tier === 'medium' && minute >= 40) continue;
    out.push(m);
  }
  return out;
}

/**
 * A session of `count` items with both periods, events distinct where the table allows, each item's
 * time a fresh draw from its event's window.
 */
export function buildAmPmSession(
  tier: 'easy' | 'medium' | 'hard' | null, count = 5, rand: () => number = Math.random,
): ClockChallenge[] {
  const usable = CLOCK_EVENTS.filter((e) => timesFor(e, tier).length > 0 && (tier !== 'easy' || e.plain));
  const hard = tier === 'hard';
  // Hard leads with the confusable events, then fills from the rest.
  const ordered = [...usable].sort(() => rand() - 0.5)
    .sort((a, b) => (hard ? Number(!!b.confusable) - Number(!!a.confusable) : 0));
  const am = ordered.filter((e) => e.period === 'am'), pm = ordered.filter((e) => e.period === 'pm');
  const chosen: ClockEvent[] = [];
  // Both periods, then alternate fill without repeating an event until the table runs out.
  for (let i = 0; chosen.length < count && i < 40; i++) {
    const side = i % 2 === 0 ? pm : am;
    const e = side[Math.floor(i / 2) % Math.max(1, side.length)];
    if (e && (!chosen.includes(e) || chosen.length >= usable.length)) chosen.push(e);
  }
  const items = chosen.slice(0, count).sort(() => rand() - 0.5);
  const seen = new Set<string>();
  return items.map((e, i) => {
    let mins = pick(timesFor(e, tier), rand);
    for (let guard = 0; guard < 10 && seen.has(hhmm(dialOf(mins).hour, dialOf(mins).minute)); guard++) mins = pick(timesFor(e, tier), rand);
    const { hour, minute } = dialOf(mins);
    seen.add(hhmm(hour, minute));
    return {
      id: `clock-${i + 1}`,
      type: 'set_time_ampm',
      instruction: ampmInstruction(e.name, hour, minute),
      targetHour: hour,
      targetMinute: minute,
      period: e.period,
      event: e.name,
      hint: '',
      itemSpace: { space: 'clock-ampm', structure: `${e.period}|${e.confusable ? 'confusable' : 'plain'}|${minute % 30 === 0 ? 'half' : minute % 15 === 0 ? 'quarter' : 'five'}`, beta: 0 },
    } as ClockChallenge;
  });
}
