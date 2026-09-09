import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import {
  generateCalendarExplorer,
  resolveTodayFraming,
  buildTodayFrameChallenges,
} from './gemini-calendar-explorer';

const generateContent = vi.mocked(ai.models.generateContent);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Independent weekday truth — never the generator's own helper. */
const weekdayOf = (day: number, month: number, year: number) =>
  DAYS[new Date(year, month - 1, day).getDay()];

function contextFor(intent: string): GenerationContext {
  return {
    componentId: 'calendar-explorer',
    instanceId: 'calendar-explorer-test',
    topic: 'Using Calendars',
    gradeLevel: 'kindergarten',
    gradeContext: 'Kindergarten students',
    grade: 'K',
    intent,
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: 'identify',
    raw: { targetEvalMode: 'identify' },
  } as GenerationContext;
}

describe('CalendarExplorer today framing', () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.useFakeTimers();
    // A Thursday, mid-month, so yesterday and tomorrow are both on the same grid.
    vi.setSystemTime(new Date(2026, 2, 12));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the answer form from the objective and leaves date lookups alone', () => {
    expect(resolveTodayFraming("Identify today's day of the week on a calendar")).toEqual({
      relatives: ['today'],
      form: 'day-name',
    });
    expect(resolveTodayFraming('Point to yesterday and tomorrow on a calendar')).toEqual({
      relatives: ['yesterday', 'tomorrow'],
      form: 'date',
    });
    // The finding's own wrong question — still the LLM date-lookup path.
    expect(resolveTodayFraming('What date is the third Wednesday of March 2025?')).toBeNull();
    expect(resolveTodayFraming('Count the Tuesdays in a month')).toBeNull();
  });

  it("asks TIME001-02-B against the marked day, with no model call at all", async () => {
    generateContent.mockImplementation(() => {
      throw new Error('a today-framed identify session must not call the model');
    });

    const data = await generateCalendarExplorer(
      contextFor("Identify today's day of the week on a calendar"),
    );

    expect(data.challenges.length).toBeGreaterThanOrEqual(3);
    expect(generateContent).not.toHaveBeenCalled();
    for (const ch of data.challenges) {
      expect(ch.type).toBe('identify');
      expect(ch.todayDate).toBeGreaterThan(0);
      expect(ch.question.toLowerCase()).toContain('today');
      // The key is the weekday of the marked day, checked against the calendar itself.
      expect(ch.correctAnswer).toBe(weekdayOf(ch.todayDate!, ch.month, ch.year));
      expect(ch.options).toContain(ch.correctAnswer);
      expect(ch.options.length).toBe(4);
      expect(new Set(ch.options).size).toBe(4);
      // Nothing on screen may print the answer before the child reads the column.
      expect(ch.question).not.toContain(ch.correctAnswer);
      expect(ch.hint).not.toContain(ch.correctAnswer);
    }
    // The first frame is the child's real today; the rest differ, so five items are five
    // questions rather than one asked five times.
    expect(data.challenges[0].todayDate).toBe(12);
    expect(new Set(data.challenges.map((c) => c.correctAnswer)).size).toBeGreaterThan(1);
  });

  it('points at yesterday and tomorrow for TIME001-02-C, inside the drawn month', () => {
    const framing = resolveTodayFraming('Point to yesterday and tomorrow on a calendar')!;
    const challenges = buildTodayFrameChallenges(framing, 5, new Date(2026, 2, 12));

    expect(challenges.length).toBe(5);
    const asked = challenges.map((c) => c.question.toLowerCase());
    expect(asked.some((q) => q.includes('yesterday'))).toBe(true);
    expect(asked.some((q) => q.includes('tomorrow'))).toBe(true);

    for (const ch of challenges) {
      const answer = Number(ch.correctAnswer);
      const offset = /yesterday/i.test(ch.question) ? -1 : 1;
      expect(answer).toBe(ch.todayDate! + offset);
      // One month is drawn, so a neighbour off the grid is unanswerable.
      expect(answer).toBeGreaterThanOrEqual(1);
      expect(answer).toBeLessThanOrEqual(31);
      expect(ch.options).toContain(ch.correctAnswer);
      // A date answer is given by clicking the grid, so the star must not sit on it.
      expect(answer).not.toBe(ch.todayDate);
    }
  });

  it('keeps a month-end today off the edge when neighbours are asked', () => {
    const framing = resolveTodayFraming('Point to tomorrow on a calendar')!;
    // March 31 — "tomorrow" would fall in April, which the grid never draws.
    const challenges = buildTodayFrameChallenges(framing, 3, new Date(2026, 2, 31));
    expect(challenges.length).toBeGreaterThan(0);
    for (const ch of challenges) {
      expect(ch.todayDate).toBeLessThanOrEqual(30);
      expect(Number(ch.correctAnswer)).toBeLessThanOrEqual(31);
    }
  });
});
