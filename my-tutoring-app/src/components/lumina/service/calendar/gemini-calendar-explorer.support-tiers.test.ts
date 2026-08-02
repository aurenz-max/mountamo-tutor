/**
 * L3 support tiers for calendar-explorer — SCAFFOLD WITHDRAWAL, in code.
 *
 * The tier is stamped post-parse by `applyCalendarSupportTier`, never mentioned in
 * a prompt, so these pure tests pin the whole generator-side contract:
 *   • what each tier withdraws (headers, month caption, the purple target-day
 *     pre-marking, the strategy hint),
 *   • what NO tier may ever touch (question / month / year / correctAnswer /
 *     targetDayOfWeek — the item itself),
 *   • that an absent tier leaves the payload byte-identical to legacy, and
 *   • that the K band floor beats the tier.
 *
 * Plus the identify-fallback defect regression: the shipped fallback answered
 * "Wednesday", a day NAME, which the grid can never produce.
 */

import { describe, expect, it } from 'vitest';
import {
  applyCalendarSupportTier,
  buildCalendarCountOptions,
  calendarGradeBandFromGrade,
  isCalendarPreReader,
  CALENDAR_NEUTRAL_HINT,
  FALLBACKS,
} from './gemini-calendar-explorer';
import type { CalendarExplorerChallenge } from '../../primitives/visual-primitives/calendar/CalendarExplorer';

// October 2025 has 5 Fridays (3, 10, 17, 24, 31).
const countChallenge = (): CalendarExplorerChallenge => ({
  id: 'c1',
  type: 'count',
  question: 'How many Fridays are in October 2025?',
  month: 10,
  year: 2025,
  correctAnswer: '5',
  options: ['4', '5', '6', '7'],
  hint: 'Look at the Friday column and count each one in October.',
  narration: "Let's count the Fridays in October!",
  targetDayOfWeek: 'Friday',
});

const identifyChallenge = (): CalendarExplorerChallenge => ({
  id: 'c2',
  type: 'identify',
  question: 'What date is the second Tuesday of March 2025?',
  month: 3,
  year: 2025,
  correctAnswer: '11',
  options: ['4', '11', '18', '25'],
  hint: 'Find the Tuesdays in March, then count to the second one.',
  narration: "Let's find the second Tuesday!",
  highlightDates: [11],
});

const patternChallenge = (): CalendarExplorerChallenge => ({
  id: 'c3',
  type: 'pattern',
  question: 'March 3, 2025 is a Monday. What day of the week is March 10, 2025?',
  month: 3,
  year: 2025,
  correctAnswer: 'Monday',
  options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday'],
  hint: 'March 10 is exactly one week after March 3. What stays the same?',
  narration: "Let's find a pattern!",
});

/** Every field that identifies WHICH item was drawn. A tier may not move any of them. */
const itemIdentity = (c: CalendarExplorerChallenge) => ({
  id: c.id,
  type: c.type,
  question: c.question,
  month: c.month,
  year: c.year,
  correctAnswer: c.correctAnswer,
  targetDayOfWeek: c.targetDayOfWeek,
  highlightDates: c.highlightDates,
});

describe('calendar-explorer support tiers — withdrawal ladder', () => {
  it('absent tier leaves the payload byte-identical (no new fields at all)', () => {
    const input = [countChallenge(), identifyChallenge(), patternChallenge()];
    const out = applyCalendarSupportTier(input, undefined, false);

    expect(out).toBe(input); // same reference — nothing was rebuilt
    for (const c of out) {
      expect(c).not.toHaveProperty('showDayHeaders');
      expect(c).not.toHaveProperty('showMonthLabel');
      expect(c).not.toHaveProperty('showTargetDayColumn');
    }
    expect(out[0].hint).toBe('Look at the Friday column and count each one in October.');
    expect(out[0].options).toEqual(['4', '5', '6', '7']);
  });

  it('easy keeps every scaffold and widens the count option spread', () => {
    const [count] = applyCalendarSupportTier([countChallenge()], 'easy', false);
    expect(count.showDayHeaders).toBe(true);
    expect(count.showMonthLabel).toBe(true);
    expect(count.showTargetDayColumn).toBe(true);
    // 5 → [2, 5, 8, 11]: a rough count still discriminates.
    expect(count.options).toEqual(['2', '5', '8', '11']);
    expect(count.options).toContain(count.correctAnswer);
    expect(count.options).toHaveLength(4);
    expect(count.hint).toBe('Look at the Friday column and count each one in October.');
  });

  it('medium withdraws the month caption only, and keeps the legacy adjacent options', () => {
    const [count] = applyCalendarSupportTier([countChallenge()], 'medium', false);
    expect(count.showDayHeaders).toBe(true);
    expect(count.showMonthLabel).toBe(false);
    expect(count.showTargetDayColumn).toBe(true);
    expect(count.options).toEqual(['4', '5', '6', '7']); // untouched
    expect(count.hint).toBe('Look at the Friday column and count each one in October.');
  });

  it('hard withdraws headers, caption, the target-day pre-marking AND the strategy hint', () => {
    const [count] = applyCalendarSupportTier([countChallenge()], 'hard', false);
    expect(count.showDayHeaders).toBe(false);
    expect(count.showMonthLabel).toBe(false);
    expect(count.showTargetDayColumn).toBe(false);
    expect(count.hint).toBe(CALENDAR_NEUTRAL_HINT);
    // The hard hint is stamped in CODE — the LLM never authors it, so it can carry
    // no strategy at all.
    expect(count.hint).not.toMatch(/column|row|count each|one by one|Friday/i);
    // Answer form is untouched: still MC, still 4 adjacent options.
    expect(count.options).toEqual(['4', '5', '6', '7']);
  });

  it('never changes WHICH item was drawn, at any tier', () => {
    const base = [countChallenge(), identifyChallenge(), patternChallenge()];
    const identities = base.map(itemIdentity);
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const out = applyCalendarSupportTier(base.map((c) => ({ ...c })), tier, false);
      // easy rebuilds count options, so compare identity fields only.
      expect(out.map(itemIdentity)).toEqual(identities);
    }
  });

  it('stamps the count-only target-day lever on count challenges only', () => {
    const out = applyCalendarSupportTier(
      [countChallenge(), identifyChallenge(), patternChallenge()],
      'hard',
      false,
    );
    expect(out[0]).toHaveProperty('showTargetDayColumn');
    expect(out[1]).not.toHaveProperty('showTargetDayColumn');
    expect(out[2]).not.toHaveProperty('showTargetDayColumn');
  });

  it('does not widen options for identify/pattern at easy (count-only lever)', () => {
    const out = applyCalendarSupportTier([identifyChallenge(), patternChallenge()], 'easy', false);
    expect(out[0].options).toEqual(['4', '11', '18', '25']);
    expect(out[1].options).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday']);
  });
});

describe('calendar-explorer support tiers — K band floor beats the tier', () => {
  it('holds every orientation scaffold at K even at hard', () => {
    const [count] = applyCalendarSupportTier([countChallenge()], 'hard', true);
    expect(count.showDayHeaders).toBe(true);
    expect(count.showMonthLabel).toBe(true);
    expect(count.showTargetDayColumn).toBe(true);
  });

  it('resolves the pre-reader band from the canonical grade, never from prose', () => {
    expect(isCalendarPreReader({ grade: 'K', gradeLevel: 'elementary' })).toBe(true);
    expect(isCalendarPreReader({ grade: '1', gradeLevel: 'kindergarten' })).toBe(false);
    // No canonical grade → fall back to the raw grade key.
    expect(isCalendarPreReader({ grade: undefined, gradeLevel: 'kindergarten' })).toBe(true);
    expect(isCalendarPreReader({ grade: undefined, gradeLevel: 'elementary' })).toBe(false);
    // The old resolveGradeBand() matched any prose containing a "k" — this must not.
    expect(isCalendarPreReader({ grade: undefined, gradeLevel: 'first grade, keep it simple' })).toBe(false);
  });

  it('derives the emitted gradeBand from the canonical grade, not from prose', () => {
    // A live probe at grade=1 was emitting gradeBand "4-5" — resolveGradeBand()
    // only ever saw gradeContext prose, whose digits it matched blindly. The band
    // is what the component uses to hold the pre-reader floor.
    expect(calendarGradeBandFromGrade('K')).toBe('K');
    expect(calendarGradeBandFromGrade('1')).toBe('1');
    expect(calendarGradeBandFromGrade('2')).toBe('2');
    expect(calendarGradeBandFromGrade('3')).toBe('3');
    expect(calendarGradeBandFromGrade('5')).toBe('4-5');
    expect(calendarGradeBandFromGrade(undefined)).toBeNull();
    expect(calendarGradeBandFromGrade('not-a-grade')).toBeNull();
  });
});

describe('calendar-explorer count options', () => {
  it('narrow mode reproduces the legacy inline builder exactly', () => {
    // The legacy formula from generateCountChallenges, verbatim.
    const legacy = (computedCount: number): string[] => {
      const baseOptions = [
        String(Math.max(1, computedCount - 1)),
        String(computedCount),
        String(computedCount + 1),
        String(computedCount + 2),
      ];
      const uniqueOptions = Array.from(new Set(baseOptions));
      while (uniqueOptions.length < 4) {
        uniqueOptions.push(String(computedCount + uniqueOptions.length));
      }
      return uniqueOptions.slice(0, 4);
    };
    for (let n = 1; n <= 6; n++) {
      expect(buildCalendarCountOptions(n, false)).toEqual(legacy(n));
    }
  });

  it('wide mode clamps at 1 and always keeps the correct answer', () => {
    expect(buildCalendarCountOptions(4, true)).toEqual(['1', '4', '7', '10']);
    expect(buildCalendarCountOptions(5, true)).toEqual(['2', '5', '8', '11']);
    for (let n = 1; n <= 6; n++) {
      const opts = buildCalendarCountOptions(n, true);
      expect(opts).toHaveLength(4);
      expect(new Set(opts).size).toBe(4);
      expect(opts).toContain(String(n));
    }
  });
});

describe('calendar-explorer identify fallback — answerable-class regression', () => {
  it('answers with a DATE, not a day name (a grid click can never yield "Wednesday")', () => {
    const fb = FALLBACKS.identify;
    expect(fb.type).toBe('identify');
    expect(fb.correctAnswer).toMatch(/^\d+$/);
    expect(fb.options).toContain(fb.correctAnswer);
  });

  it('is arithmetically true: 11 IS the second Tuesday of March 2025', () => {
    const fb = FALLBACKS.identify;
    const tuesdays: number[] = [];
    const daysInMonth = new Date(fb.year, fb.month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(fb.year, fb.month - 1, d).getDay() === 2) tuesdays.push(d);
    }
    expect(tuesdays[1]).toBe(Number(fb.correctAnswer));
    expect(fb.highlightDates).toEqual([Number(fb.correctAnswer)]);
  });

  it('keeps the count + pattern fallbacks answerable in their own surfaces', () => {
    expect(FALLBACKS.count.options).toContain(FALLBACKS.count.correctAnswer);
    expect(FALLBACKS.pattern.options).toContain(FALLBACKS.pattern.correctAnswer);
  });
});
