// @vitest-environment jsdom
/**
 * The tap-to-answer loop — solar-system-explorer L0→L1, 2026-08-08.
 *
 * Behaviour tsc cannot see: that a tap SELECTS rather than answers, that a
 * miss with tries left leaves the item open, that the answer is nowhere in the
 * DOM until it is settled, and that finishing actually submits evidence.
 *
 * NOT covered here — jsdom is blind to it: whether the moving `<g>` targets are
 * hittable in a real browser. That is what the transparent hit `<circle>` is
 * for ([[feedback_svg-g-unclickable-jsdom-blind]]) and it needs a Chrome drive.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
const submitResultSpy = vi.fn();
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: submitResultSpy,
    hasSubmitted: false,
    resetAttempt: vi.fn(),
    elapsedMs: 1234,
  }),
  // PhaseSummaryPanel renders on completion and reaches for this.
  useEvaluationContext: () => null,
}));

import SolarSystemExplorer, {
  type SolarSystemExplorerData,
  type CelestialBody,
} from '../SolarSystemExplorer';

const body = (id: string, name: string, distanceAu: number, radiusKm: number): CelestialBody => ({
  id, name, type: 'planet', color: '#888', radiusKm, distanceAu,
  orbitalPeriodDays: distanceAu * 365, rotationPeriodHours: 24, moons: 1,
  description: `${name} is a planet.`,
  textureGradient: 'radial-gradient(circle, #888 0%, #444 100%)', temperatureC: 0,
});

const BODIES: CelestialBody[] = [
  { ...body('sun', 'Sun', 0, 696000), type: 'star', orbitalPeriodDays: 0 },
  body('mercury', 'Mercury', 0.39, 2440),
  body('earth', 'Earth', 1.0, 6371),
  body('jupiter', 'Jupiter', 5.2, 69911),
];

const data = (over: Partial<SolarSystemExplorerData> = {}): SolarSystemExplorerData => ({
  title: 'Our Solar System',
  description: 'Explore the planets.',
  bodies: BODIES,
  gradeLevel: '3',
  instanceId: 'sse-test',
  challenges: [
    {
      id: 'ssc-1', type: 'order_from_sun',
      prompt: 'Tap the planet closest to the Sun.',
      answerBodyIds: ['mercury'],
      hint: 'Start at the Sun and move outwards.',
      explanation: 'Mercury orbits closest to the Sun.',
    },
    {
      id: 'ssc-2', type: 'compare_attribute',
      prompt: 'Tap the biggest planet.',
      answerBodyIds: ['jupiter'],
      hint: 'Compare the circle sizes.',
      explanation: 'Jupiter is the biggest planet here.',
    },
  ],
  ...over,
});

const tap = (container: HTMLElement, id: string) =>
  fireEvent.click(container.querySelector(`[data-body-id="${id}"]`)!);

const confirm = () => fireEvent.click(screen.getByRole('button', { name: /^Answer:/ }));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
  submitResultSpy.mockClear();
});

describe('solar-system-explorer — the tap-to-answer loop', () => {
  it('shows the question and NO commit affordance until something is chosen', () => {
    render(<SolarSystemExplorer data={data()} />);
    expect(screen.getByText('Tap the planet closest to the Sun.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Answer:/ })).toBeNull();
    expect(screen.getByText(/Tap a body in the model/i)).toBeTruthy();
  });

  it('a tap SELECTS — it does not answer', () => {
    const { container } = render(<SolarSystemExplorer data={data()} />);
    tap(container, 'jupiter'); // the WRONG body for question 1
    expect(screen.getByRole('button', { name: /^Answer: Jupiter/ })).toBeTruthy();
    // Nothing scored, nothing said about being wrong.
    expect(screen.queryByText(/Start at the Sun/i)).toBeNull();
    expect(submitResultSpy).not.toHaveBeenCalled();
  });

  it('never has the answer in the DOM before the item is settled', () => {
    const { container } = render(<SolarSystemExplorer data={data()} />);
    // "Mercury" may appear as an orbit LABEL — that is the model, not the key.
    // What must be absent is the explanation naming it as the answer.
    expect(screen.queryByText(/Mercury orbits closest/i)).toBeNull();
    tap(container, 'earth');
    confirm();
    expect(screen.queryByText(/Mercury orbits closest/i)).toBeNull();
    // A miss must not reveal by elimination either.
    expect(container.querySelector('[data-body-id="mercury"] circle[stroke="#34d399"]')).toBeNull();
  });

  it('a miss with tries left leaves the item OPEN and re-armable', () => {
    const { container } = render(<SolarSystemExplorer data={data()} />);
    tap(container, 'earth');
    confirm();
    expect(screen.getByText(/Start at the Sun and move outwards/i)).toBeTruthy();
    // Not settled: no Next.
    expect(screen.queryByRole('button', { name: /Next|Finish/ })).toBeNull();
    // The next tap retires the hint and brings the commit button back — this is
    // the retry path, and it was a lockout in the first cut.
    tap(container, 'mercury');
    expect(screen.queryByText(/Start at the Sun and move outwards/i)).toBeNull();
    expect(screen.getByRole('button', { name: /^Answer: Mercury/ })).toBeTruthy();
  });

  it('scores a correct tap and offers the way forward', () => {
    const { container } = render(<SolarSystemExplorer data={data()} />);
    tap(container, 'mercury');
    confirm();
    expect(screen.getByText('Mercury orbits closest to the Sun.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Next/ })).toBeTruthy();
    expect(sendTextSpy.mock.calls.some(([m]) => String(m).includes('[SOLAR_ANSWER_CORRECT]'))).toBe(true);
  });

  it('reveals only after the third miss, and marks it wrong', () => {
    const { container } = render(<SolarSystemExplorer data={data()} />);
    for (const id of ['earth', 'jupiter', 'sun']) {
      tap(container, id);
      confirm();
    }
    expect(screen.getByText('Mercury orbits closest to the Sun.')).toBeTruthy();
    expect(container.querySelector('[data-body-id="mercury"] circle[stroke="#34d399"]')).not.toBeNull();
    expect(sendTextSpy.mock.calls.some(([m]) => String(m).includes('[SOLAR_ANSWER_REVEAL]'))).toBe(true);
  });

  it('submits evidence when the last item is finished', () => {
    const { container } = render(<SolarSystemExplorer data={data()} />);
    tap(container, 'mercury');
    confirm();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));

    expect(screen.getByText('Tap the biggest planet.')).toBeTruthy();
    // The reset must clear the previous pick, or item 2 starts pre-answered.
    expect(screen.queryByRole('button', { name: /^Answer:/ })).toBeNull();

    tap(container, 'jupiter');
    confirm();
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));

    expect(submitResultSpy).toHaveBeenCalledTimes(1);
    const [passed, score, metrics] = submitResultSpy.mock.calls[0];
    expect(passed).toBe(true);
    expect(score).toBe(100);
    expect(metrics).toMatchObject({
      type: 'solar-system-explorer',
      totalChallenges: 2,
      correctChallenges: 2,
      totalAttempts: 2,
      accuracy: 100,
    });
    // The evidence has to carry WHICH skill it measures, or IRT cannot use it.
    expect(['order_from_sun', 'compare_attribute']).toContain(metrics.evalMode);
  });

  it('scores a part-right session honestly', () => {
    const { container } = render(<SolarSystemExplorer data={data()} />);
    for (const id of ['earth', 'jupiter', 'sun']) { tap(container, id); confirm(); }
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    tap(container, 'jupiter');
    confirm();
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));

    const [passed, score, metrics] = submitResultSpy.mock.calls[0];
    expect(score).toBe(50);
    expect(passed).toBe(false);
    expect(metrics).toMatchObject({ correctChallenges: 1, totalAttempts: 4 });
  });

  it('leaves the pure explorer untouched when no challenges are sent', () => {
    render(<SolarSystemExplorer data={{ ...data(), challenges: [], focusBody: 'earth' }} />);
    expect(screen.getByText('EXPLORE')).toBeTruthy();
    expect(screen.queryByText(/Tap the planet closest/)).toBeNull();
    // focusBody still pre-selects in explore mode — it only had to stop doing
    // that during a question.
    expect(screen.getByText('Earth is a planet.')).toBeTruthy();
  });

  it('does not pre-select focusBody into question 1', () => {
    render(<SolarSystemExplorer data={data({ focusBody: 'mercury' })} />);
    expect(screen.queryByRole('button', { name: /^Answer:/ })).toBeNull();
  });
});
