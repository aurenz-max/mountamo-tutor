/**
 * The verifier's contract: off costs nothing, shadow/gate report per-check
 * pass/fail with the expected direction, and every failure path returns
 * `ran: false` instead of throwing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const systemOne = vi.fn();
const typesafeConfigured = vi.fn(() => true);
vi.mock('../manifest/typesafe/typesafeClient', () => ({
  systemOne: (...args: unknown[]) => systemOne(...args),
  typesafeConfigured: () => typesafeConfigured(),
}));

import { HYPOTHESIS_CHECKS, _resetVerifyBreaker, verify, verifyModeFromEnv } from './verify';

const answers = (supported: number, leaks: number) => ({
  model: 'jev-test', ms: 5, usage: { input_tokens: 1, output_tokens: 1 },
  answers: { supported: { type: 'noul', noul: supported }, leaks: { type: 'noul', noul: leaks } },
});

beforeEach(() => {
  _resetVerifyBreaker();
  systemOne.mockReset();
  typesafeConfigured.mockReturnValue(true);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.LUMINA_TYPESAFE_VERIFY;
});

describe('verifyModeFromEnv', () => {
  it('defaults to off and accepts shadow | gate only', () => {
    expect(verifyModeFromEnv()).toBe('off');
    process.env.LUMINA_TYPESAFE_VERIFY = 'shadow';
    expect(verifyModeFromEnv()).toBe('shadow');
    process.env.LUMINA_TYPESAFE_VERIFY = ' GATE ';
    expect(verifyModeFromEnv()).toBe('gate');
    process.env.LUMINA_TYPESAFE_VERIFY = 'on';
    expect(verifyModeFromEnv()).toBe('off');
  });
});

describe('verify', () => {
  it('off makes no call and reports not run', async () => {
    const v = await verify({ x: 1 }, HYPOTHESIS_CHECKS);
    expect(systemOne).not.toHaveBeenCalled();
    expect(v).toMatchObject({ mode: 'off', ran: false, pass: null, checks: [] });
  });

  it('passes when every check lands on its expected side of the threshold', async () => {
    systemOne.mockResolvedValue(answers(0.91, 0.08));
    const v = await verify({ x: 1 }, HYPOTHESIS_CHECKS, { mode: 'shadow', name: 't' });
    expect(v.ran).toBe(true);
    expect(v.pass).toBe(true);
    expect(v.checks.map((c) => [c.id, c.pass])).toEqual([['supported', true], ['leaks', true]]);
    // The Nouls reach TypeSafe keyed by check id, one request.
    expect(systemOne).toHaveBeenCalledTimes(1);
    expect(Object.keys(systemOne.mock.calls[0][1])).toEqual(['supported', 'leaks']);
  });

  it('fails the right check in each direction and names it', async () => {
    systemOne.mockResolvedValueOnce(answers(0.2, 0.05));
    let v = await verify({}, HYPOTHESIS_CHECKS, { mode: 'gate' });
    expect(v.pass).toBe(false);
    expect(v.failed).toEqual(['supported']);
    systemOne.mockResolvedValueOnce(answers(0.9, 0.7));
    v = await verify({}, HYPOTHESIS_CHECKS, { mode: 'gate' });
    expect(v.failed).toEqual(['leaks']);
  });

  it('honours a per-check threshold', async () => {
    systemOne.mockResolvedValue({ model: 'm', ms: 1, usage: { input_tokens: 1, output_tokens: 1 }, answers: { strict: { type: 'noul', noul: 0.7 } } });
    const v = await verify({}, [{ id: 'strict', expect: 'true', threshold: 0.8, instructions: 'q' }], { mode: 'shadow' });
    expect(v.pass).toBe(false);
  });

  it('no key, a thrown error, and a timeout all yield ran:false without throwing', async () => {
    typesafeConfigured.mockReturnValue(false);
    expect(await verify({}, HYPOTHESIS_CHECKS, { mode: 'gate' })).toMatchObject({ ran: false, pass: null, error: expect.stringMatching(/TYPESAFE_API_KEY/) });
    typesafeConfigured.mockReturnValue(true);
    systemOne.mockRejectedValueOnce(new Error('HTTP 529'));
    expect(await verify({}, HYPOTHESIS_CHECKS, { mode: 'gate' })).toMatchObject({ ran: false, pass: null, error: 'HTTP 529' });
    systemOne.mockImplementationOnce((_s: unknown, _q: unknown, o: { signal: AbortSignal }) =>
      new Promise((_, reject) => o.signal.addEventListener('abort', () => reject(new Error('aborted')))));
    const v = await verify({}, HYPOTHESIS_CHECKS, { mode: 'gate', timeoutMs: 40 });
    expect(v.ran).toBe(false);
    expect(v.error).toMatch(/timed out after 40 ms/);
  });

  it('opens the breaker after three failures and skips the next call', async () => {
    systemOne.mockRejectedValue(new Error('down'));
    for (let i = 0; i < 3; i++) await verify({}, HYPOTHESIS_CHECKS, { mode: 'shadow' });
    expect(systemOne).toHaveBeenCalledTimes(3);
    const v = await verify({}, HYPOTHESIS_CHECKS, { mode: 'shadow' });
    expect(systemOne).toHaveBeenCalledTimes(3);
    expect(v.error).toMatch(/circuit open/);
  });
});
