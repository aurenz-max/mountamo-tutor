// @vitest-environment jsdom
/**
 * Reader-fit for orbit-mechanics-lab at K-1, re-based on the 2026-10-16 rebuild (scripted path, no tutor runtime).
 *
 * Item 15A / S2 made K a served grade: the task must be a tap on pictures, with no slider, number or unit, and a
 * read-aloud for the question. The rebuild keeps that and adds the 10-15 rules: nothing flies before the answer is
 * checked, and the first answer is the scored one (no retry-until-right).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true, activePrimitiveId: null }),
}));
const submitResultSpy = vi.fn();
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: submitResultSpy, hasSubmitted: false, resetAttempt: vi.fn(), submittedResult: null, elapsedMs: 0 }),
}));
vi.mock('../../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

import OrbitMechanicsLab, { type OrbitMechanicsLabData } from '../OrbitMechanicsLab';
import { pushLabel, tapKey, type SpeedItem } from '../orbitWorkspace';

const SPEED: SpeedItem[] = [
  { id: 'pick_speed-1', mode: 'pick_speed', height: 1.7, ask: 'circle', pushes: [{ f: 1.6 }, { f: 1 }, { f: 0.55 }] },
  { id: 'pick_speed-2', mode: 'pick_speed', height: 1.7, ask: 'away', pushes: [{ f: 0.6 }, { f: 1.55 }] },
];
const kData = (over: Partial<OrbitMechanicsLabData> = {}): OrbitMechanicsLabData =>
  ({ title: 'Rocket Around Earth', overview: 'Send the rocket.', gradeLevel: 'K', challengeTypes: ['pick_speed'], items: SPEED, ...over });

beforeEach(() => { cleanup(); sendTextSpy.mockClear(); submitResultSpy.mockClear(); });

describe('OrbitMechanicsLab @ PRE', () => {
  it('is a tap on push pictures: no slider, no text input, no number or unit on screen', () => {
    const { container } = render(<OrbitMechanicsLab data={kData()} />);
    expect(container.querySelector('input')).toBeNull();
    for (const p of SPEED[0].pushes.map((_, i) => pushLabel(SPEED[0], i))) expect(screen.getByRole('button', { name: p })).toBeTruthy();
    // The push buttons carry pictures, not words.
    expect(screen.getByRole('button', { name: 'Medium push' }).textContent).toBe('');
    expect(container.textContent).not.toMatch(/\d+\s*(km|kN|m\/s|°)|item \d of/);
    expect(container.querySelector('[data-asked="circle"]')).not.toBeNull();
  });

  it('reads the question aloud on tap, with no answer in the message', () => {
    render(<OrbitMechanicsLab data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Read the question to me' }));
    const msg = String(sendTextSpy.mock.calls.at(-1)?.[0]);
    expect(msg).toMatch(/\[READ_CHALLENGE\].*go around and around Earth in a circle/);
    expect(msg).not.toMatch(/medium|middle|second/i);
  });

  it('nothing flies before the check; a wrong push flies, says what it did, and does not submit', () => {
    const { container } = render(<OrbitMechanicsLab data={kData()} />);
    expect(container.querySelector('[data-flight]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Small push' }));
    expect(container.querySelector('[data-flight]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Launch and check/ }));
    expect(container.querySelector('[data-flight="crash"]')).not.toBeNull();
    expect(container.textContent).toMatch(/falls back down to Earth/);
    expect(submitResultSpy).not.toHaveBeenCalled();
  });

  it('the first answer is the scored one: a wrong then right item counts as wrong', () => {
    render(<OrbitMechanicsLab data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Small push' }));
    fireEvent.click(screen.getByRole('button', { name: /Launch and check/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Medium push' }));
    fireEvent.click(screen.getByRole('button', { name: /Launch and check/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(tapKey(SPEED[1])).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Huge push' }));
    fireEvent.click(screen.getByRole('button', { name: /Launch and check/ }));
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    expect(submitResultSpy).toHaveBeenCalledOnce();
    const [, score, , extra] = submitResultSpy.mock.calls[0];
    const results = (extra as { challengeResults: Array<{ correct: boolean; attempts: number }> }).challengeResults;
    expect(results[0]).toMatchObject({ correct: true, attempts: 2 });
    expect(score).toBe(50);
  });

  it('a legacy payload (thrust, rocket, challenge; no items) still builds code items by grade', () => {
    const legacy = { title: 'Orbit Seeker', gradeLevel: '3', rocket: { massKg: 3000 }, challenge: { type: 'reach_orbit' } } as unknown as OrbitMechanicsLabData;
    const { container } = render(<OrbitMechanicsLab data={legacy} />);
    expect(container.textContent).toMatch(/Pick the push · item 1 of 6/);
  });
});
