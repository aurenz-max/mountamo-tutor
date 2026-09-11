import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import {
  buildDaySequenceChallenges,
  DAY_SEQUENCE_TURN_COUNT,
  generateCalendarExplorer,
} from './gemini-calendar-explorer';

const generateContent = vi.mocked(ai.models.generateContent);

const context: GenerationContext = {
  componentId: 'calendar-explorer',
  instanceId: 'calendar-day-sequence-test',
  topic: 'Days of the week',
  gradeLevel: 'kindergarten',
  gradeContext: 'Kindergarten students',
  grade: 'K',
  intent: 'Recite the days of the week in order',
  objective: { text: 'Recite days of the week in order using songs or rhymes' },
  scope: {} as GenerationContext['scope'],
  targetEvalMode: 'day_sequence',
  raw: { targetEvalMode: 'day_sequence' },
};

describe('calendar-explorer day_sequence generator', () => {
  beforeEach(() => generateContent.mockReset());

  it('builds at least five linked successor turns and wraps Saturday to Sunday', () => {
    const challenges = buildDaySequenceChallenges(4, DAY_SEQUENCE_TURN_COUNT);
    expect(challenges).toHaveLength(5);
    expect(challenges.map((challenge) => [challenge.currentDay, challenge.expectedDay])).toEqual([
      ['Thursday', 'Friday'],
      ['Friday', 'Saturday'],
      ['Saturday', 'Sunday'],
      ['Sunday', 'Monday'],
      ['Monday', 'Tuesday'],
    ]);
    for (let i = 1; i < challenges.length; i += 1) {
      expect(challenges[i].currentDay).toBe(challenges[i - 1].expectedDay);
    }
  });

  it('chooses the production start randomly', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(6 / 7);
    expect(buildDaySequenceChallenges()[0].currentDay).toBe('Saturday');
    random.mockRestore();
  });

  it('serves a pinned spoken chain without calling Gemini', async () => {
    generateContent.mockResolvedValue({ text: '{"modes":["day_sequence"]}' } as never);
    const data = await generateCalendarExplorer(context);
    expect(data.challenges).toHaveLength(5);
    expect(data.challenges.every((challenge) => challenge.type === 'day_sequence')).toBe(true);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('routes an unpinned recitation intent into the spoken mode', async () => {
    generateContent.mockResolvedValue({ text: '{"modes":["day_sequence"]}' } as never);
    const data = await generateCalendarExplorer({
      ...context,
      targetEvalMode: undefined,
      raw: {},
    });
    expect(generateContent).toHaveBeenCalledTimes(1); // resolver only
    expect(data.challenges).toHaveLength(5);
    expect(data.challenges.every((challenge) => challenge.type === 'day_sequence')).toBe(true);
  });
});
