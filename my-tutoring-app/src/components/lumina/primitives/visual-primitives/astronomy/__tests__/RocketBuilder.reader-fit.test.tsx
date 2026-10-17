// @vitest-environment jsdom
/**
 * Reader-fit for rocket-builder at K-1, re-based on the 2026-10-16 rebuild (scripted path, no tutor runtime).
 *
 * Item 15A / S3 made K a served grade and stripped the developer chrome a pre-reader cannot read (kg, kN, a ratio, a
 * GRADE badge, the flight chart). The rebuild keeps that and adds the 10-15 rules: no Thrust/Weight panel or ratio
 * anywhere, nothing launches before the answer is checked, and the first answer is the scored one.
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

import RocketBuilder, { type RocketBuilderData } from '../RocketBuilder';
import type { LiftItem } from '../rocketWorkspace';

// Lifts (push 7 > weight 5), then stays (push 4 < weight 5).
const LIFT: LiftItem[] = [
  { id: 'can_it_lift-1', mode: 'can_it_lift', rocket: { color: 'red', parts: [{ kind: 'engine', push: 7, weight: 1 }, { kind: 'tank', weight: 2 }, { kind: 'capsule', weight: 2 }] } },
  { id: 'can_it_lift-2', mode: 'can_it_lift', rocket: { color: 'red', parts: [{ kind: 'engine', push: 4, weight: 2 }, { kind: 'tank', weight: 2 }, { kind: 'capsule', weight: 1 }] } },
];
const kData = (over: Partial<RocketBuilderData> = {}): RocketBuilderData =>
  ({ title: 'Ready for Lift-Off?', overview: 'Predict.', gradeLevel: 'K', challengeTypes: ['can_it_lift'], items: LIFT, ...over });

beforeEach(() => { cleanup(); sendTextSpy.mockClear(); submitResultSpy.mockClear(); });

describe('RocketBuilder @ PRE', () => {
  it('is a yes-or-no tap on a drawn rocket: no input, no unit, no ratio, no total', () => {
    const { container } = render(<RocketBuilder data={kData()} />);
    expect(container.querySelector('input')).toBeNull();
    expect(screen.getByRole('button', { name: 'Yes, it lifts off' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No, it stays on the pad' })).toBeTruthy();
    expect(container.textContent).not.toMatch(/\bkg\b|\bkN\b|\bkm\b|thrust|weight ratio|TWR|GRADE K|item \d of/i);
    // Blocks and arrows are drawn per part; no number sits beside them until the count lever is pulled.
    expect(container.querySelectorAll('[data-weight]').length).toBe(3);
    expect(container.querySelector('[data-push="7"]')).not.toBeNull();
    expect(container.querySelector('[data-count]')).toBeNull();
  });

  it('reads the question aloud on tap, with no answer in the message', () => {
    render(<RocketBuilder data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Read the question to me' }));
    const msg = String(sendTextSpy.mock.calls.at(-1)?.[0]);
    expect(msg).toMatch(/\[READ_CHALLENGE\].*lift off the launch pad/);
    expect(msg).not.toMatch(/\byes\b|stays|more than|push/i);
  });

  it('nothing launches before the check; a wrong answer reveals (two choices) and does not submit yet', () => {
    const { container } = render(<RocketBuilder data={kData()} />);
    expect(container.querySelector('[data-launch="up"], [data-launch="stays"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'No, it stays on the pad' }));
    expect(container.querySelector('[data-launch="up"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Check Answer/ }));
    expect(container.querySelector('[data-launch="up"]')).not.toBeNull();
    expect(container.textContent).toMatch(/push is more than its weight/);
    expect(submitResultSpy).not.toHaveBeenCalled();
  });

  it('the first answer is the scored one', () => {
    render(<RocketBuilder data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'No, it stays on the pad' }));
    fireEvent.click(screen.getByRole('button', { name: /Check Answer/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    fireEvent.click(screen.getByRole('button', { name: 'No, it stays on the pad' }));
    fireEvent.click(screen.getByRole('button', { name: /Check Answer/ }));
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    expect(submitResultSpy).toHaveBeenCalledOnce();
    const [, score] = submitResultSpy.mock.calls[0];
    expect(score).toBe(50);
  });

  it('a legacy payload (parts library, target altitude; no items) still builds code items by grade', () => {
    const legacy = { title: 'Space Launch', gradeLevel: '3', availableComponents: [{ id: 'e', type: 'engine' }], targetAltitudeKm: 100 } as unknown as RocketBuilderData;
    const { container } = render(<RocketBuilder data={legacy} />);
    expect(container.textContent).toMatch(/Will it lift off\? · item 1 of 6/);
  });
});
