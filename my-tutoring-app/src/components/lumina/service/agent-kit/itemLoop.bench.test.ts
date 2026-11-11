import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent } } }));
// The review settings decide the calls; whether Chromium exists on this host does not.
vi.mock('node:fs', async importOriginal => ({ ...(await importOriginal<typeof import('node:fs')>()), existsSync: () => false }));

import { readDraft, runItemBench, type ItemLoopSpec } from './itemLoop';

const RAW = { tier: 'medium', surface: 'choose', prompt: 'Which digit is in the tens place of 42?', options: [{ id: 'a', label: '4' }, { id: 'b', label: '2' }, { id: 'c', label: '6' }], key: 'a', why: 'tens' };
const spec: ItemLoopSpec = { tag: 'T', prompt: 'p', grade: 'grade 1', tiers: ['medium'], minItems: 1, idPrefix: 't', seed: 7 };
const reply = (json: unknown) => ({ text: JSON.stringify(json), usageMetadata: {} });
const textOf = (req: { contents: Array<{ parts: Array<{ text?: string }> }> }) => req.contents[req.contents.length - 1].parts.map(p => p.text ?? '').join(' ');

describe('runItemBench', () => {
  let writes = 0;
  beforeEach(() => {
    generateContent.mockReset();
    writes = 0;
    const shownKey = readDraft(RAW, 't-1', 7).item.options.findIndex(o => o.id === 'a') + 1;
    generateContent.mockImplementation(async (req: { contents: Array<{ parts: Array<{ text?: string }> }> }) => {
      const text = textOf(req);
      if (text.includes('You are checking a learning item')) return reply({ answer: shownKey, difficulty_for_grade: 'easy', shortcut: null, issues: null });
      if (text.includes('If nothing needs changing')) return reply({ unchanged: true });
      if (req.contents.length === 1) { writes++; return reply({ title: 'T', idea: 'I', items: [RAW] }); }
      return reply(RAW);
    });
  });

  it('writes once and applies each setting to that draft', async () => {
    const runs = await runItemBench(spec, ['draft', 'self', 'solver', 'full']);
    expect(writes).toBe(1);

    const roundsOf = (id: string) => (runs.find(r => r.id === id)?.result?.items[0].rounds);
    expect(roundsOf('draft')).toBe(0);
    expect(roundsOf('self')).toBe(1); // it looked, and found nothing to change
    expect(roundsOf('solver')).toBe(0); // the solver's "easy" is recorded, not revised against
    expect(roundsOf('full')).toBe(2); // the same "easy" sends it back

    const solverNote = runs.find(r => r.id === 'solver')!.result!.items[0].look;
    expect(solverNote.solved.difficulty).toBe('easy');
    expect(solverNote.advisory).toEqual([]);
    expect(runs.find(r => r.id === 'draft')!.result!.debug.costUsd).toBe(0);
  });

  it('asks once more when the first write is not valid JSON, and gives up after that', async () => {
    const good = generateContent.getMockImplementation()!;
    let bad = 1;
    generateContent.mockImplementation(async (req: { contents: Array<{ parts: Array<{ text?: string }> }> }) =>
      (req.contents.length === 1 && !textOf(req).includes('You are checking a learning item') && bad-- > 0 ? { text: '{title: oops', usageMetadata: {} } : good(req)));
    const [run] = await runItemBench(spec, ['draft']);
    expect(run.result?.items).toHaveLength(1);
    expect(textOf(generateContent.mock.calls[1][0])).toContain('every key in double quotes');

    generateContent.mockImplementation(async () => ({ text: '{title: oops', usageMetadata: {} }));
    await expect(runItemBench(spec, ['draft'])).rejects.toThrow();
  });

  it('runs no solver on the settings without one', async () => {
    await runItemBench(spec, ['draft', 'self']);
    const prompts = generateContent.mock.calls.map(([req]) => textOf(req));
    expect(prompts.some(p => p.includes('You are checking a learning item'))).toBe(false);
  });
});
