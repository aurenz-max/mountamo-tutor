// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for vehicle-design-studio's young-learner
 * read-aloud wiring. Every load-bearing string here (the studio intro, the
 * challenge mission + its constraints, the post-test design tips, and the static
 * engineering-design guidance) is text a 2–3 grade reader can barely decode; the
 * fix gives each a 🔊 LuminaReadAloud / ReadMeButton that routes to a NON-silent
 * sendText — the read-aloud IS the tutor speaking the words verbatim.
 *
 * These are the behaviors tsc can't verify: the buttons render, and a tap sends
 * the right read-this-aloud message (the mission ask is answer-free — it never
 * names the winning parts). External hooks are mocked to drive pure component
 * logic.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import VehicleDesignStudio, { type VehicleDesignStudioData } from '../VehicleDesignStudio';

const DESCRIPTION = 'Build your very own race car and test how fast it can go!';
const MISSION_DESC = 'Make a car that is light and speedy so it can win the big race.';
const TIP = 'Your car is too wobbly! Add a stabilizer to keep it steady.';

const data = (): VehicleDesignStudioData => ({
  title: 'My Race Car Studio',
  description: DESCRIPTION,
  domain: 'land',
  partsPalette: {
    bodies: [
      { id: 'light', name: 'Light Frame', weight: 40, dragCoefficient: 0.3, capacity: 1, cost: 100, imagePrompt: 'a light frame' },
      { id: 'heavy', name: 'Heavy Frame', weight: 120, dragCoefficient: 0.5, capacity: 4, cost: 200, imagePrompt: 'a heavy frame' },
    ],
    propulsion: [
      { id: 'motor', name: 'Zippy Motor', thrustOutput: 500, fuelEfficiency: 60, weight: 30, cost: 150, requires: 'ground' },
    ],
    controls: [
      { id: 'fin', name: 'Stabilizer Fin', stabilityBonus: 20, dragPenalty: 0.1, weight: 10, cost: 50 },
    ],
  },
  constraints: {
    maxWeight: null, maxCost: null, minRange: null, minSpeed: null, minCapacity: null, requiredDomain: null,
  },
  designTips: [
    { condition: 'true', tip: TIP },
  ],
  challenges: [
    {
      name: 'Speed Racer',
      description: MISSION_DESC,
      constraints: { maxWeight: 100, maxCost: null, minRange: null, minSpeed: 80, minCapacity: null, requiredDomain: null },
      targetMetric: 'topSpeed',
      difficulty: 2,
    },
  ],
  gradeBand: '2-3',
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('VehicleDesignStudio reader-fit (young-learner read-aloud)', () => {
  it('the intro 🔊 button reads the studio description verbatim', () => {
    render(<VehicleDesignStudio data={data()} />);
    const btn = screen.getByRole('button', { name: /read the introduction to me/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(sentMessages().some((m) => m.includes(DESCRIPTION) && /\[READ_DESCRIPTION\]/.test(m))).toBe(true);
  });

  it('the challenge mission 🔊 reads the mission verbatim and states an answer-free ask (constraints, no winning parts)', () => {
    render(<VehicleDesignStudio data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /speed racer/i })); // activate the challenge
    const btn = screen.getByRole('button', { name: /read the mission to me/i });
    fireEvent.click(btn);
    const msg = sentMessages().find((m) => m.includes(MISSION_DESC));
    expect(msg).toBeTruthy();
    // States the ask (constraints in kid words) so a young reader knows what to do…
    expect(msg).toMatch(/100 kilograms/);
    expect(msg).toMatch(/80 kilometers per hour/);
    // …but never names the winning parts.
    expect(msg).not.toMatch(/light frame/i);
    expect(msg).not.toMatch(/zippy motor/i);
    expect(msg).toMatch(/\[READ_MISSION\]/);
  });

  it('after a test, the active-tip 🔊 reads the tip verbatim', () => {
    vi.useFakeTimers();
    try {
      render(<VehicleDesignStudio data={data()} />);
      // Build a testable design: pick a body + propulsion, then Test Design.
      fireEvent.click(screen.getByRole('button', { name: /light frame/i }));
      fireEvent.click(screen.getByRole('button', { name: /zippy motor/i }));
      fireEvent.click(screen.getByRole('button', { name: /test design/i }));
      // The simulation animation runs a 90-frame timer (25ms each); advance it.
      act(() => { vi.advanceTimersByTime(90 * 25 + 50); });
      sendTextSpy.mockClear(); // drop the silent post-test analysis message
      const btn = screen.getByRole('button', { name: /read this tip to me/i });
      fireEvent.click(btn);
      expect(sentMessages().some((m) => m.includes(TIP) && /\[READ_TIP\]/.test(m))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('the engineering-design-tips 🔊 reads the static guidance verbatim', () => {
    render(<VehicleDesignStudio data={data()} />);
    const btn = screen.getByRole('button', { name: /read the design tips to me/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(sentMessages().some((m) =>
      /\[READ_DESIGN_TIPS\]/.test(m) && /change one thing at a time/i.test(m) && /trade-offs are real/i.test(m)
    )).toBe(true);
  });
});
