import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { resolveTeenWindow, teenSweep } from './teenWindow';

const generateContent = vi.mocked(ai.models.generateContent);

describe('resolveTeenWindow — schema-backed language translation', () => {
  beforeEach(() => generateContent.mockReset());

  it('uses Flash Lite schema output to translate arbitrary objective prose', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ min: 11, max: 15 }) } as never);

    await expect(resolveTeenWindow({
      topic: 'Counting to 15',
      objectiveText: 'Build collections no greater than fifteen as one ten and further ones',
      intent: 'Compose every teen quantity within that ceiling',
    }, 'Kindergarten')).resolves.toEqual({ start: 11, end: 15 });

    const call = generateContent.mock.calls[0][0] as any;
    expect(call.model).toBe('gemini-flash-lite-latest');
    expect(call.config.temperature).toBe(0);
    expect(call.config.responseMimeType).toBe('application/json');
    expect(call.config.responseSchema.required).toEqual(['min', 'max']);
    expect(String(call.contents)).toContain('no greater than fifteen');
  });

  it('accepts a schema-resolved exact singleton objective', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ min: 14, max: 14 }) } as never);
    await expect(resolveTeenWindow({ topic: 'Compose fourteen' }, 'Kindergarten'))
      .resolves.toEqual({ start: 14, end: 14 });
  });

  it('clamps schema output to the primitive contract', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ min: 3, max: 40 }) } as never);
    await expect(resolveTeenWindow({ topic: 'Teen numbers' }, 'Kindergarten'))
      .resolves.toEqual({ start: 11, end: 19 });
  });

  it('falls back to the full legal range when translation fails', async () => {
    generateContent.mockRejectedValueOnce(new Error('resolver unavailable'));
    await expect(resolveTeenWindow({ topic: 'Teen numbers' }, 'Kindergarten'))
      .resolves.toEqual({ start: 11, end: 19 });
  });
});

describe('teenSweep', () => {
  it('spreads a counting-to-15 session instead of repeating fifteen', () => {
    expect(teenSweep({ start: 11, end: 15 }, 7))
      .toEqual([11, 12, 13, 14, 15, 11, 12]);
  });
});
