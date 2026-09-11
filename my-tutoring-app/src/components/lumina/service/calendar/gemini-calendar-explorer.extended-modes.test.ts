import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { CALENDAR_CATALOG } from '../manifest/catalog/calendar';
import {
  buildDayOffsetChallenges,
  buildIntervalCountChallenges,
  buildMarkEventChallenges,
  buildMonthSequenceChallenges,
  generateCalendarExplorer,
} from './gemini-calendar-explorer';

const generateContent = vi.mocked(ai.models.generateContent);

const contextFor = (targetEvalMode: string): GenerationContext => ({
  componentId: 'calendar-explorer',
  instanceId: `calendar-${targetEvalMode}-test`,
  topic: 'Calendar routines',
  gradeLevel: 'kindergarten',
  gradeContext: 'Kindergarten students',
  grade: 'K',
  intent: targetEvalMode,
  objective: { text: targetEvalMode },
  scope: {} as GenerationContext['scope'],
  targetEvalMode,
  raw: { targetEvalMode },
});

describe('calendar-explorer extended code-owned modes', () => {
  beforeEach(() => generateContent.mockReset());

  it('registers every challenge identity with the intended beta and answer modality', () => {
    const entry = CALENDAR_CATALOG.find((candidate) => candidate.id === 'calendar-explorer')!;
    const modes = new Map((entry.evalModes ?? []).map((mode) => [mode.evalMode, mode]));
    expect(Array.from(modes.keys())).toEqual([
      'identify',
      'mark_events',
      'day_sequence',
      'count',
      'month_sequence',
      'day_offset',
      'interval_count',
      'pattern',
    ]);
    expect(modes.get('mark_events')).toMatchObject({ beta: -1, challengeTypes: ['mark_events'] });
    expect(modes.get('month_sequence')).toMatchObject({
      beta: 0.5,
      challengeTypes: ['month_sequence'],
      affordances: { answers: ['spoken'] },
    });
    expect(modes.get('day_offset')).toMatchObject({ beta: 1, challengeTypes: ['day_offset'] });
    expect(modes.get('interval_count')).toMatchObject({ beta: 1.25, challengeTypes: ['interval_count'] });
  });

  it('counts forward 1-7 days with correct weekday wraparound', () => {
    const challenges = buildDayOffsetChallenges(1, 5);
    expect(challenges.map((challenge) => [
      challenge.startDay,
      challenge.offsetDays,
      challenge.correctAnswer,
    ])).toEqual([
      ['Monday', 1, 'Tuesday'],
      ['Wednesday', 2, 'Friday'],
      ['Friday', 3, 'Monday'],
      ['Sunday', 5, 'Friday'],
      ['Tuesday', 7, 'Tuesday'],
    ]);
    expect(challenges.every((challenge) => challenge.options.includes(challenge.correctAnswer))).toBe(true);
  });

  it('builds a cumulative event-marking calendar without marking the current answer early', () => {
    const challenges = buildMarkEventChallenges(2, 2024, 4, 5);
    expect(challenges).toHaveLength(5);
    expect(challenges.every((challenge) => challenge.month === 2 && challenge.year === 2024)).toBe(true);
    challenges.forEach((challenge, index) => {
      const answer = Number(challenge.correctAnswer);
      expect(answer).toBeGreaterThanOrEqual(1);
      expect(answer).toBeLessThanOrEqual(29);
      expect(challenge.markedDates).toHaveLength(index);
      expect(challenge.markedDates).not.toContain(answer);
      expect(challenge.highlightDates).toEqual([answer]);
    });
  });

  it('states and scores exclusive versus inclusive interval conventions exactly', () => {
    const challenges = buildIntervalCountChallenges(3, 2025, 4, 4);
    expect(challenges.map((challenge) => challenge.countConvention)).toEqual([
      'between', 'inclusive', 'between', 'inclusive',
    ]);
    for (const challenge of challenges) {
      const span = challenge.intervalEndDate! - challenge.intervalStartDate!;
      const expected = challenge.countConvention === 'between' ? span - 1 : span + 1;
      expect(challenge.markedDates).toEqual([
        challenge.intervalStartDate,
        challenge.intervalEndDate,
      ]);
      expect(challenge.correctAnswer).toBe(String(expected));
      expect(challenge.options).toContain(String(expected));
      expect(challenge.question).toMatch(
        challenge.countConvention === 'between' ? /Do not count/ : /Count both/,
      );
    }
  });

  it('builds at least five linked month successors and wraps December to January', () => {
    const challenges = buildMonthSequenceChallenges(10, 5);
    expect(challenges.map((challenge) => [challenge.currentMonth, challenge.expectedMonth])).toEqual([
      ['November', 'December'],
      ['December', 'January'],
      ['January', 'February'],
      ['February', 'March'],
      ['March', 'April'],
    ]);
  });

  it.each(['day_offset', 'mark_events', 'interval_count', 'month_sequence']) (
    'serves pinned %s without calling Gemini',
    async (targetEvalMode) => {
      const data = await generateCalendarExplorer(contextFor(targetEvalMode));
      expect(data.challenges.length).toBeGreaterThanOrEqual(5);
      expect(data.challenges.every((challenge) => challenge.type === targetEvalMode)).toBe(true);
      expect(generateContent).not.toHaveBeenCalled();
    },
  );
});
