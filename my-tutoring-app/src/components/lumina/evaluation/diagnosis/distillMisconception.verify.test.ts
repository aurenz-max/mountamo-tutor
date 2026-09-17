/**
 * The distiller with the TypeSafe verifier attached: off leaves the result
 * untouched, shadow attaches the verdict, gate turns a failed hypothesis into an
 * honest abstain that keeps the rejected text for the bench.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../service/geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
const verify = vi.fn();
vi.mock('../../service/typesafe/verify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../service/typesafe/verify')>();
  return { ...actual, verify: (...args: unknown[]) => verify(...args) };
});

import { ai } from '../../service/geminiClient';
import { distillMisconception } from './distillMisconception';

const evidence = {
  challengeSummary: 'Say the value of the 4 in 342.',
  expected: 'forty',
  observed: 'four',
  priorAttempts: [{ challenge: 'Say the value of the 4 in 426.', observed: 'four' }, { challenge: 'Say the value of the 4 in 849.', observed: 'four' }],
};
const written = { abstain: false, misconceptionText: 'The student says the bare digit as its value regardless of its place.', confidence: 'high', reason: '', teachingImplication: 'Pair the same digit in two places.', checkNext: 'A fresh number with the digit in the tens place.' };
const ran = (pass: boolean, mode: 'shadow' | 'gate', failed: string[] = []) => ({ mode, ran: true, pass, failed, ms: 3, checks: [{ id: 'supported', p: pass ? 0.9 : 0.2, expect: 'true', threshold: 0.5, pass }, { id: 'leaks', p: 0.05, expect: 'false', threshold: 0.5, pass: true }] });

beforeEach(() => {
  vi.mocked(ai.models.generateContent).mockReset();
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify(written) } as never);
  verify.mockReset();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('distillMisconception + verifier', () => {
  it('off: the verifier reports not run and the diagnosis is delivered as written, no verification field', async () => {
    verify.mockResolvedValue({ mode: 'off', ran: false, pass: null, checks: [], failed: [], ms: 0 });
    const r = await distillMisconception(evidence, { score: 40, success: false });
    expect(r.abstain).toBe(false);
    expect(r).not.toHaveProperty('verification');
    // The verifier saw the hypothesis and the evidence it must be judged against.
    const [state, checks] = verify.mock.calls[0];
    expect(state).toMatchObject({ hypothesis: written.misconceptionText, evidence: { correctOutcome: 'forty', studentDid: 'four' } });
    expect(checks.map((c: { id: string }) => c.id)).toEqual(['supported', 'leaks']);
  });

  it('shadow: a failed verdict is attached but the hypothesis still ships', async () => {
    verify.mockResolvedValue(ran(false, 'shadow', ['supported']));
    const r = await distillMisconception(evidence, { score: 40, success: false });
    expect(r.abstain).toBe(false);
    expect(r.verification).toMatchObject({ mode: 'shadow', pass: false, failed: ['supported'] });
  });

  it('gate: a failed verdict becomes an abstain that keeps the rejected text for the bench', async () => {
    verify.mockResolvedValue(ran(false, 'gate', ['supported']));
    const r = await distillMisconception(evidence, { score: 40, success: false });
    expect(r.abstain).toBe(true);
    if (r.abstain) {
      expect(r.reason).toMatch(/Verifier rejected the hypothesis \(supported\)/);
      expect(r.rejectedText).toBe(written.misconceptionText);
      expect(r.verification?.pass).toBe(false);
    }
  });

  it('gate: a passing verdict delivers the hypothesis with the verdict attached', async () => {
    verify.mockResolvedValue(ran(true, 'gate'));
    const r = await distillMisconception(evidence, { score: 40, success: false });
    expect(r.abstain).toBe(false);
    expect(r.verification?.pass).toBe(true);
  });

  it('never calls the verifier when the distiller itself abstains', async () => {
    vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify({ ...written, abstain: true, misconceptionText: '', reason: 'single slip' }) } as never);
    const r = await distillMisconception(evidence, { score: 40, success: false });
    expect(r.abstain).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });
});
