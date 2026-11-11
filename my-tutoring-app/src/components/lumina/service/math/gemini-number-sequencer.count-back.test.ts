/**
 * K count-back window (math-k audit, COUNT001-02-H and OPS001-03-A): a K lesson that names counting back gets
 * backward count-from runs that reach 0, and the generator reads the objective's own window through
 * `resolveObjectiveRange` (mocked here), keeping the band default when none is named.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
vi.mock('../objectiveNumberWindow', () => ({ resolveObjectiveRange: vi.fn() }));

import { ai } from '../geminiClient';
import { resolveObjectiveRange } from '../objectiveNumberWindow';
import { generateNumberSequencer, lessonNamesCountingBack, countBackRun } from './gemini-number-sequencer';
import { sequencerChallengeValid } from '../../primitives/visual-primitives/math/numberSequencerDomain';
import type { NumberSequencerChallenge } from '../../primitives/visual-primitives/math/NumberSequencer';

const generateContent = vi.mocked(ai.models.generateContent);
const resolveRange = vi.mocked(resolveObjectiveRange);

function kContext(opts: { topic: string; objective?: string; targetEvalMode?: string; numberRange?: { min: number; max: number } }): GenerationContext {
  return {
    componentId: 'number-sequencer',
    instanceId: 'ns-count-back',
    topic: opts.topic,
    gradeLevel: 'kindergarten',
    gradeContext: 'kindergarten students',
    grade: 'K',
    intent: opts.topic,
    objective: { text: opts.objective },
    scope: { topic: opts.topic, intent: opts.topic },
    targetEvalMode: opts.targetEvalMode,
    raw: { targetEvalMode: opts.targetEvalMode, intent: opts.topic, ...(opts.numberRange ? { numberRange: opts.numberRange } : {}) },
  } as GenerationContext;
}

const model = (challenges: Array<Record<string, unknown>>) => ({
  text: JSON.stringify({ title: 'Count', description: 'd', gradeBand: 'K', showNumberLine: true, showDotArrays: true, challenges }),
}) as never;

const forward = (id: string, start: number) => ({
  id, type: 'count-from', instruction: `Count on from ${start}!`, sequence: [start],
  correctAnswers: [start + 1, start + 2, start + 3], startNumber: start, direction: 'forward', rangeMin: start, rangeMax: start + 3,
});

describe('lessonNamesCountingBack', () => {
  it('reads count back, backward and count down; not a forward-only lesson', () => {
    expect(lessonNamesCountingBack('Count backwards from 10 to 0 using concrete objects')).toBe(true);
    expect(lessonNamesCountingBack('Count forward and backward within 5 fluently')).toBe(true);
    expect(lessonNamesCountingBack('Count down to blast off')).toBe(true);
    expect(lessonNamesCountingBack('Count forward from a given number')).toBe(false);
  });
});

describe('countBackRun', () => {
  it('ends exactly on its floor, descends by one, and passes the key gate with zero', () => {
    const run = countBackRun(0, 5, 'r');
    expect(run.startNumber).toBe(5);
    expect(run.correctAnswers).toEqual([4, 3, 2, 1, 0]);
    expect(run.rangeMin).toBe(0);
    expect(sequencerChallengeValid(run)).toBe(true);
  });
});

describe('K count-back generation', () => {
  beforeEach(() => { generateContent.mockReset(); resolveRange.mockReset(); });

  it('a count-back-to-0 objective: the window drops to 0 and the session counts 10 down to 0', async () => {
    resolveRange.mockResolvedValueOnce({ min: 0, max: 10 });
    generateContent.mockResolvedValueOnce(model([forward('a', 2), forward('b', 4), forward('c', 6)]));
    const data = await generateNumberSequencer(kContext({
      topic: 'Counting backwards from 10 to 0',
      objective: 'Count backwards from 10 to 0 using concrete objects and number lines',
      targetEvalMode: 'count_from',
    }));
    const req = resolveRange.mock.calls[0][0];
    expect(req.bandDefault).toEqual({ min: 0, max: 20 });
    expect(req.capacity).toEqual({ min: 0, max: 120 });
    const back = (data.challenges as NumberSequencerChallenge[]).filter((c) => c.direction === 'backward');
    expect(back.some((c) => c.correctAnswers[c.correctAnswers.length - 1] === 0)).toBe(true);
    expect(back.some((c) => c.startNumber === 10)).toBe(true);
    for (const c of data.challenges as NumberSequencerChallenge[]) {
      expect(sequencerChallengeValid(c)).toBe(true);
      for (const v of [...c.correctAnswers, c.startNumber ?? 0]) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of [...c.correctAnswers, c.startNumber ?? 0]) expect(v).toBeLessThanOrEqual(10);
    }
    // The prompt no longer says forward only.
    const prompt = String((generateContent.mock.calls[0][0] as { contents: string }).contents);
    expect(prompt).toContain('COUNTING BACK');
  });

  it('a model countdown that ends on 0 survives: no more clamping to 1', async () => {
    resolveRange.mockResolvedValueOnce({ min: 0, max: 10 });
    generateContent.mockResolvedValueOnce(model([
      { id: 'z', type: 'count-from', instruction: 'Count back from 4!', sequence: [4], correctAnswers: [3, 2, 1, 0],
        startNumber: 4, direction: 'backward', rangeMin: 0, rangeMax: 4 },
    ]));
    const data = await generateNumberSequencer(kContext({ topic: 'Count back from 10 to 0', targetEvalMode: 'count_from' }));
    const z = (data.challenges as NumberSequencerChallenge[]).find((c) => c.id === 'z');
    expect(z?.correctAnswers).toEqual([3, 2, 1, 0]);
  });

  it('a model run of 10 down to 0 (ten answers, past the gate of six) is split into 10..5 and 5..0, not dropped', async () => {
    resolveRange.mockResolvedValueOnce({ min: 0, max: 10 });
    generateContent.mockResolvedValueOnce(model([
      { id: 'all', type: 'count-from', instruction: 'Count back from 10!', sequence: [10], correctAnswers: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
        startNumber: 10, direction: 'backward', rangeMin: 0, rangeMax: 10 },
    ]));
    const data = await generateNumberSequencer(kContext({ topic: 'Count back from 10 to 0', targetEvalMode: 'count_from' }));
    const pieces = (data.challenges as NumberSequencerChallenge[]).filter((c) => c.id.startsWith('all-'));
    expect(pieces.map((c) => [c.startNumber, c.correctAnswers])).toEqual([[10, [9, 8, 7, 6, 5]], [5, [4, 3, 2, 1, 0]]]);
    expect(data.challenges.length).toBeGreaterThanOrEqual(2);
  });

  it('forward and backward within 5: the objective window 0-5 bounds every value, forward runs may stay', async () => {
    resolveRange.mockResolvedValueOnce({ min: 0, max: 5 });
    generateContent.mockResolvedValueOnce(model([forward('a', 1)]));
    const data = await generateNumberSequencer(kContext({ topic: 'Count forward and backward within 5', targetEvalMode: 'count_from' }));
    const all = data.challenges as NumberSequencerChallenge[];
    expect(all.some((c) => c.direction === 'backward' && c.correctAnswers.includes(0))).toBe(true);
    for (const c of all) for (const v of [...c.correctAnswers, c.startNumber ?? 0]) expect(v).toBeLessThanOrEqual(5);
  });

  it('forward and backward within 5, model counted only back: a forward run is guaranteed, back-only lessons get none', async () => {
    const backOnly = () => model([2, 3, 4, 5, 1].map((start) => ({
      id: `b${start}`, type: 'count-from', instruction: `Count back from ${start}!`, sequence: [start],
      correctAnswers: Array.from({ length: start }, (_, i) => start - 1 - i), startNumber: start, direction: 'backward',
      rangeMin: 0, rangeMax: start })));
    resolveRange.mockResolvedValueOnce({ min: 0, max: 5 });
    generateContent.mockResolvedValueOnce(backOnly());
    const both = (await generateNumberSequencer(kContext({ topic: 'Count forward and backward within 5', targetEvalMode: 'count_from' })))
      .challenges as NumberSequencerChallenge[];
    expect(both.some((c) => c.direction === 'forward')).toBe(true);
    expect(both.some((c) => c.direction === 'backward' && c.correctAnswers.at(-1) === 0)).toBe(true);
    for (const c of both) expect(sequencerChallengeValid(c)).toBe(true);

    resolveRange.mockResolvedValueOnce({ min: 0, max: 5 });
    generateContent.mockResolvedValueOnce(backOnly());
    const back = (await generateNumberSequencer(kContext({ topic: 'Count backwards from 5 to 0', targetEvalMode: 'count_from' })))
      .challenges as NumberSequencerChallenge[];
    expect(back.every((c) => c.direction === 'backward')).toBe(true);
  });

  it('no range named and no counting back: band default 1-20 stays, forward only, no count-back runs', async () => {
    resolveRange.mockResolvedValueOnce(null);
    generateContent.mockResolvedValueOnce(model([forward('a', 3), forward('b', 9), forward('c', 14)]));
    const data = await generateNumberSequencer(kContext({ topic: 'Counting forward from a number', targetEvalMode: 'count_from' }));
    expect(resolveRange.mock.calls[0][0].bandDefault).toEqual({ min: 1, max: 20 });
    expect((data.challenges as NumberSequencerChallenge[]).every((c) => c.direction === 'forward')).toBe(true);
    const prompt = String((generateContent.mock.calls[0][0] as { contents: string }).contents);
    expect(prompt).not.toContain('COUNTING BACK');
  });

  it('explicit config.numberRange wins and skips the resolver', async () => {
    generateContent.mockResolvedValueOnce(model([forward('a', 3)]));
    await generateNumberSequencer(kContext({ topic: 'Counting', targetEvalMode: 'count_from', numberRange: { min: 1, max: 10 } }));
    expect(resolveRange).not.toHaveBeenCalled();
  });

  it('a pinned mode without count-from gets no count-back run added', async () => {
    resolveRange.mockResolvedValueOnce({ min: 0, max: 10 });
    generateContent.mockResolvedValueOnce(model([
      { id: 'b1', type: 'before-after', instruction: 'What comes before 4?', sequence: [null, 4], correctAnswers: [3], rangeMin: 3, rangeMax: 4 },
      { id: 'b2', type: 'before-after', instruction: 'What comes before 7?', sequence: [null, 7], correctAnswers: [6], rangeMin: 6, rangeMax: 7 },
      { id: 'b3', type: 'before-after', instruction: 'What comes before 1?', sequence: [null, 1], correctAnswers: [0], rangeMin: 0, rangeMax: 1 },
    ]));
    const data = await generateNumberSequencer(kContext({ topic: 'Count back from 10 to 0', targetEvalMode: 'before_after' }));
    const all = data.challenges as NumberSequencerChallenge[];
    expect(all.every((c) => c.type === 'before-after')).toBe(true);
    // Zero is a legal key now.
    expect(all.find((c) => c.id === 'b3')?.correctAnswers).toEqual([0]);
  });
});
