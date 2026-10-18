import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'gemini-spend-'));
process.env.LUMINA_SPEND_DIR = dir;

const load = async () => {
  vi.resetModules();
  return import('./spendMeter');
};

function fakeClient(usage = { promptTokenCount: 1_000_000, candidatesTokenCount: 100_000 }) {
  const calls: string[] = [];
  return {
    calls,
    models: {
      generateContent: async (p: { model: string }) => { calls.push(p.model); return { text: 'ok', usageMetadata: usage }; },
      generateContentStream: async (p: { model: string }) => {
        calls.push(p.model);
        return (async function* () { yield { text: 'a' }; yield { text: 'b', usageMetadata: usage }; })();
      },
    },
  };
}

describe('spendMeter', () => {
  const env = { ...process.env };
  beforeEach(() => { writeFileSync(join(dir, `${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())}.jsonl`), ''); });
  afterEach(() => { process.env = { ...env, LUMINA_SPEND_DIR: dir }; });

  it('prices Flash, Lite and cached input from usageMetadata', async () => {
    const { priceCall } = await load();
    expect(priceCall('gemini-flash-latest', { promptTokenCount: 1e6, candidatesTokenCount: 1e6 })).toBeCloseTo(4.5);
    expect(priceCall('gemini-flash-lite-latest', { promptTokenCount: 1e6, candidatesTokenCount: 1e6 })).toBeCloseTo(2.8);
    expect(priceCall('gemini-3.8-flash', { promptTokenCount: 1e6, cachedContentTokenCount: 1e6 })).toBeCloseTo(0.075);
    expect(priceCall('gemini-flash-latest', { promptTokenCount: 0, candidatesTokenCount: 1e6, thoughtsTokenCount: 1e6 })).toBeCloseTo(7.5);
  });

  it('records every call and refuses an agent call once the automated cap is spent', async () => {
    process.env.LUMINA_AGENT = '1';
    process.env.LUMINA_AGENT_DAILY_USD = '1';
    const { meterClient, spentToday, GeminiBudgetError } = await load();
    const ai = meterClient(fakeClient());
    await ai.models.generateContent({ model: 'gemini-flash-latest' }); // $0.75 + $0.375 = $1.125
    expect(spentToday().agent).toBeCloseTo(1.125);
    await expect(ai.models.generateContent({ model: 'gemini-flash-latest' })).rejects.toBeInstanceOf(GeminiBudgetError);
    expect(ai.calls).toHaveLength(1); // the refused call never reached the client
  });

  it('never caps the app by default, and counts a test route as automated', async () => {
    delete process.env.LUMINA_AGENT;
    process.env.LUMINA_AGENT_DAILY_USD = '1';
    const { meterClient, withSpendSource, spentToday, GeminiBudgetError } = await load();
    const ai = meterClient(fakeClient());
    for (let i = 0; i < 3; i++) await ai.models.generateContent({ model: 'gemini-flash-latest' });
    expect(spentToday().app).toBeCloseTo(3.375);
    await withSpendSource('harness', 'fact-file', () => ai.models.generateContent({ model: 'gemini-flash-latest' }));
    await expect(withSpendSource('harness', 'fact-file', () => ai.models.generateContent({ model: 'gemini-flash-latest' })))
      .rejects.toBeInstanceOf(GeminiBudgetError);
    await ai.models.generateContent({ model: 'gemini-flash-latest' }); // the app still runs
  });

  it('meters a stream from its last chunk and reads lines other processes wrote', async () => {
    process.env.LUMINA_AGENT = '1';
    const { meterClient, spentToday, pstDate } = await load();
    const ai = meterClient(fakeClient());
    const chunks: string[] = [];
    for await (const c of await ai.models.generateContentStream({ model: 'gemini-flash-lite-latest' })) chunks.push((c as { text: string }).text);
    expect(chunks).toEqual(['a', 'b']);
    expect(spentToday().agent).toBeCloseTo(0.55);
    const file = join(dir, `${pstDate()}.jsonl`);
    writeFileSync(file, readFileSync(file, 'utf8') + JSON.stringify({ source: 'harness', usd: 2 }) + '\n');
    expect(spentToday().harness).toBeCloseTo(2);
  });
});
