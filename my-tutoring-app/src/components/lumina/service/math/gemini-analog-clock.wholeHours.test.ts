/**
 * An o'clock lesson keeps every time on the hour (math-k audit 2026-11-10: TIME001-03-C, -E, -F). The K
 * grid is half hours, so before this an o'clock lesson could show :30 faces and :30 options. The lesson
 * is read by a schema call (resolveWholeHours); a lesson that does not say o'clock keeps its grid.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
vi.mock('../itemSpace', async (orig) => ({
  ...(await orig<typeof import('../itemSpace')>()),
  resolveItemSpace: vi.fn(async (_lesson: string, _grade: string, ids: string[]) => ids[0]),
}));

import { ai } from '../geminiClient';
import { generateAnalogClock } from './gemini-analog-clock';

const generateContent = vi.mocked(ai.models.generateContent);
let wholeHours = true;
let wholeHourCalls = 0;
let mockType = 'read';

function ctxFor(mode: string, difficulty?: string, topic = "Telling time to the hour"): GenerationContext {
  return {
    componentId: 'analog-clock', instanceId: 'clock-whole-hours', topic,
    gradeLevel: 'kindergarten', gradeContext: 'kindergarten students', grade: 'K',
    intent: topic, objective: { text: topic },
    scope: { topic, objectiveText: topic } as GenerationContext['scope'],
    targetEvalMode: mode, raw: { targetEvalMode: mode, difficulty },
  } as GenerationContext;
}

beforeEach(() => {
  wholeHourCalls = 0;
  generateContent.mockReset();
  generateContent.mockImplementation(async (req: unknown) => {
    const contents = String((req as { contents: string }).contents);
    if (contents.includes('keeps every time on the hour')) {
      wholeHourCalls += 1;
      return { text: JSON.stringify({ wholeHoursOnly: wholeHours }) } as never;
    }
    // The generated path: the model picks half hours, as the K grid allowed.
    return {
      text: JSON.stringify({
        title: 'Clock', gradeBand: 'K',
        challenges: [[3, 30], [7, 0], [9, 30], [2, 30], [11, 0]].map(([h, m], i) => ({
          id: `c${i + 1}`, type: mockType, instruction: `Set the clock to ${h}:${m === 0 ? '00' : m}.`,
          targetHour: h, targetMinute: m, hint: 'The long hand points down at the 6.',
        })),
      }),
    } as never;
  });
});

const minutesIn = (opt?: string) => (opt ? Number(opt.split(':')[1]) : 0);

describe("analog-clock whole-hour window", () => {
  for (const mode of ['read', 'match', 'set_time']) {
    for (const difficulty of [undefined, 'easy', 'hard']) {
      it(`${mode} ${difficulty ?? 'no tier'}: o'clock lesson -> minute 0 only, options on the hour`, async () => {
        wholeHours = true;
        mockType = mode;
        const data = await generateAnalogClock(ctxFor(mode, difficulty));
        expect(data.challenges.every((c) => c.type === mode)).toBe(true);
        expect(wholeHourCalls).toBe(1);
        expect(data.challenges.length).toBeGreaterThanOrEqual(4);
        for (const c of data.challenges) {
          expect(c.targetMinute).toBe(0);
          for (const o of [c.option0, c.option1, c.option2, c.option3]) expect(minutesIn(o)).toBe(0);
          if (c.type === 'set_time') expect(c.instruction).toMatch(/:00\.$/);
          if (c.type === 'read' || c.type === 'match') {
            expect([c.option0, c.option1, c.option2, c.option3][c.correctOptionIndex!]).toBe(`${c.targetHour}:00`);
          }
        }
        expect(data.gradeBand).toBe('K');
        expect(new Set(data.challenges.map((c) => c.targetHour)).size).toBeGreaterThanOrEqual(4);
      });
    }
  }

  it('a lesson that is not about o\'clock keeps the K half-hour grid', async () => {
    wholeHours = false;
    mockType = 'read';
    const data = await generateAnalogClock(ctxFor('read', undefined, 'Telling time to the half hour'));
    expect(data.challenges.map((c) => c.targetMinute)).toEqual([30, 0, 30, 30, 0]);
  });

  it('K clock-part modes do not ask', async () => {
    wholeHours = true;
    mockType = 'hand_name';
    await generateAnalogClock(ctxFor('hand_name'));
    expect(wholeHourCalls).toBe(0);
  });
});
