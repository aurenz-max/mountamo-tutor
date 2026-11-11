import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from './geminiClient';
import { resolveObjectiveRange } from './objectiveNumberWindow';

const reply = (body: unknown) =>
  (ai.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ text: JSON.stringify(body) });

const base = {
  topic: 'Writing numbers',
  objectiveText: 'Write numerals 0 to 20',
  gradeLevel: 'kindergarten',
  quantity: 'the numerals the child traces',
  bandDefault: { min: 0, max: 9 },
  capacity: { min: 0, max: 20 },
  logPrefix: 'test',
};

describe('resolveObjectiveRange', () => {
  beforeEach(() => { (ai.models.generateContent as ReturnType<typeof vi.fn>).mockReset(); });

  it('raises a K window past the band default to what the objective names', async () => {
    reply({ hasExplicitScope: true, min: 0, max: 20 });
    expect(await resolveObjectiveRange(base)).toEqual({ min: 0, max: 20 });
  });

  it('keeps a floor (compare 11-20)', async () => {
    reply({ hasExplicitScope: true, min: 11, max: 20 });
    expect(await resolveObjectiveRange({ ...base, bandDefault: { min: 1, max: 10 }, capacity: { min: 1, max: 20 } }))
      .toEqual({ min: 11, max: 20 });
  });

  it('returns null when no range is named, so the band default stands', async () => {
    reply({ hasExplicitScope: false, min: 0, max: 20 });
    expect(await resolveObjectiveRange(base)).toBeNull();
  });

  it('clamps to capacity and swaps a reversed range', async () => {
    reply({ hasExplicitScope: true, min: 50, max: 3 });
    expect(await resolveObjectiveRange(base)).toEqual({ min: 3, max: 20 });
  });

  it('returns null for a range equal to the band default or too narrow', async () => {
    reply({ hasExplicitScope: true, min: 0, max: 9 });
    expect(await resolveObjectiveRange(base)).toBeNull();
    reply({ hasExplicitScope: true, min: 5, max: 6 });
    expect(await resolveObjectiveRange(base)).toBeNull();
  });

  it('returns null on a model failure', async () => {
    (ai.models.generateContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('down'));
    expect(await resolveObjectiveRange(base)).toBeNull();
  });
});
