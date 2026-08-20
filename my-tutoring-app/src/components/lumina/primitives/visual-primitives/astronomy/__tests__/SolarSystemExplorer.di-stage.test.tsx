// @vitest-environment jsdom
/**
 * SolarSystemExplorer STAGE behaviour under the judged loop.
 *
 * REPLACES `SolarSystemExplorer.eval-loop.test.tsx` (the tap-to-answer loop,
 * L0→L1 2026-08-08) — every intent that suite pinned is re-based here onto the
 * DI surface, none deleted unreplaced:
 *
 *   click era pin                          → judged-surface pin
 *   ─────────────────────────────────────────────────────────────────────
 *   "no commit affordance until chosen"    → NO commit affordance EXISTS
 *   "a tap SELECTS — it does not answer"   → a tap LOOKS — it never commits
 *   "answer never in the DOM until settled"→ reveal gated on `revealHeld`;
 *                                            identify labels withheld (the
 *                                            answer leak is in PIXELS here)
 *   "submits evidence when finished"       → `onFinished` → submitResult
 *   "explore untouched w/o challenges"     → unchanged, still pinned
 *   "focusBody never pre-selects into Q1"  → judged face ignores focusBody
 *
 * The runner is mocked at the seam (it has its own suite); the pack has its
 * own pure suite (`SolarSystemExplorer.di-script.test.ts`). What is under test
 * here is the STAGE: spotlight gated on `onPresentStimulus`, labels withheld
 * during identify, reveal on `revealHeld` (18b — never `currentSolved`).
 *
 * Still NOT covered — jsdom is blind to it: whether the moving `<g>` targets
 * are hittable in a real browser ([[feedback_svg-g-unclickable-jsdom-blind]]).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import type { SolarItem } from '../solarSystemScript';

const runnerState = vi.hoisted(() => ({
  index: 0,
  running: true,
  revealHeld: false,
  hearStimulus: vi.fn(),
  submitGestureAttempt: vi.fn(),
  options: null as null | {
    pack: { items: SolarItem[] };
    onFinished: (summary: unknown) => void;
    onAffirmed?: (item: SolarItem) => void;
    onItemOpened?: (item: SolarItem, index: number) => void;
    onPresentStimulus?: (item: SolarItem, index: number) => void;
    stimulus?: { when?: (item: SolarItem) => boolean };
  },
}));

vi.mock('../../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: typeof runnerState.options) => {
    runnerState.options = options;
    const item = options?.pack.items[runnerState.index] ?? null;
    return {
      running: runnerState.running,
      preparing: false,
      stage: 'asking',
      statusLine: 'status',
      currentIndex: runnerState.index,
      currentItem: item,
      solvedIds: new Set<string>(),
      currentSolved: false,
      canAttempt: runnerState.running && item != null,
      summary: null,
      micState: 'armed',
      tutorSpeaking: false,
      cuedItemId: item?.id ?? null,
      revealHeld: runnerState.revealHeld,
      armStillness: vi.fn(),
      clearStillness: vi.fn(),
      cancelListening: undefined,
      start: vi.fn(),
      hearStimulus: runnerState.hearStimulus,
      stimulusTapped: false,
      submitGestureAttempt: runnerState.submitGestureAttempt,
      isAwaitingGesture: () => false,
      loop: {},
    };
  },
}));

vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({ isConnected: true, sendText: vi.fn() }),
}));

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));

const submitResultSpy = vi.fn();
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: submitResultSpy,
    hasSubmitted: false,
    submittedResult: null,
    resetAttempt: vi.fn(),
    elapsedMs: 1234,
  }),
  useEvaluationContext: () => null,
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
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
    { id: 'ssc-1', type: 'order_from_sun', facet: 'closest', answerBodyIds: ['mercury'] },
    { id: 'ssc-2', type: 'compare_attribute', facet: 'biggest', answerBodyIds: ['jupiter'] },
    { id: 'ssc-3', type: 'identify', facet: 'name', answerBodyIds: ['earth'] },
  ],
  ...over,
});

const tap = (container: HTMLElement, id: string) =>
  fireEvent.click(container.querySelector(`[data-body-id="${id}"]`)!);

const svgTexts = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent ?? '');

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
  submitResultSpy.mockClear();
  runnerState.index = 0;
  runnerState.running = true;
  runnerState.revealHeld = false;
  runnerState.options = null;
  runnerState.hearStimulus.mockClear();
  runnerState.submitGestureAttempt.mockClear();
});

describe('solar-system-explorer — the judged stage', () => {
  it('builds the judged items and shows NO commit affordance anywhere', () => {
    render(<SolarSystemExplorer data={data()} />);
    expect(runnerState.options?.pack.items).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /^Answer:/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Next|Finish|Check/ })).toBeNull();
    expect(screen.getByText('CHALLENGE')).toBeTruthy();
    expect(screen.getByText('Say it out loud')).toBeTruthy();
  });

  it('a tap is LOOKING — it opens the research card and never commits anything', () => {
    const { container } = render(<SolarSystemExplorer data={data()} />);
    tap(container, 'jupiter');
    // The card is the model's own reference material on a non-identify item…
    expect(screen.getByText('Jupiter is a planet.')).toBeTruthy();
    // …and nothing was submitted, judged, or spoken on our behalf.
    expect(runnerState.submitGestureAttempt).not.toHaveBeenCalled();
    expect(submitResultSpy).not.toHaveBeenCalled();
    expect(sendTextSpy).not.toHaveBeenCalled();
  });

  it('the research card is withheld while an IDENTIFY item is open — it prints the answer', () => {
    runnerState.index = 2; // the identify item
    const { container } = render(<SolarSystemExplorer data={data()} />);
    tap(container, 'earth');
    expect(screen.queryByText('Earth is a planet.')).toBeNull();
  });

  it('⭐ identify withholds every body LABEL — the answer leak is in pixels', () => {
    runnerState.index = 2;
    const { container } = render(<SolarSystemExplorer data={data()} />);
    expect(svgTexts(container)).not.toContain('Earth');
    expect(svgTexts(container)).not.toContain('Jupiter');
  });

  it('labels render normally on non-identify items — the model is the instrument', () => {
    runnerState.index = 0; // order item
    const { container } = render(<SolarSystemExplorer data={data()} />);
    expect(svgTexts(container)).toContain('Mercury');
  });

  it('the identify spotlight paints ONLY after the runner presents the stimulus', () => {
    runnerState.index = 2;
    const { container, rerender } = render(<SolarSystemExplorer data={data()} />);
    const halo = () => container.querySelector('[data-body-id="earth"] circle[stroke-dasharray="6 3"]');
    expect(halo()).toBeNull();
    const item = runnerState.options!.pack.items[2];
    // The runner's stimulus policy claims identify owns a timed stimulus.
    expect(runnerState.options!.stimulus?.when?.(item)).toBe(true);
    act(() => runnerState.options!.onPresentStimulus!(item, 2));
    rerender(<SolarSystemExplorer data={data()} />);
    expect(halo()).not.toBeNull();
  });

  it('order/compare items own no timed stimulus — the whole sky is already the stimulus', () => {
    render(<SolarSystemExplorer data={data()} />);
    const items = runnerState.options!.pack.items;
    expect(runnerState.options!.stimulus?.when?.(items[0])).toBe(false);
    expect(runnerState.options!.stimulus?.when?.(items[1])).toBe(false);
  });

  it('⭐ the reveal renders behind revealHeld, never before (18b)', () => {
    const { container, rerender } = render(<SolarSystemExplorer data={data()} />);
    const items = runnerState.options!.pack.items;
    // Before any affirmation: no reveal panel, no emerald ring.
    expect(container.querySelector('circle[stroke="#34d399"]')).toBeNull();

    act(() => runnerState.options!.onAffirmed!(items[0]));
    rerender(<SolarSystemExplorer data={data()} />);
    // Payload set, but the hold is not open yet — still nothing on screen.
    expect(container.querySelector('circle[stroke="#34d399"]')).toBeNull();

    runnerState.revealHeld = true;
    rerender(<SolarSystemExplorer data={data()} />);
    expect(container.querySelector('[data-body-id="mercury"] circle[stroke="#34d399"]')).not.toBeNull();
    // The reveal panel names the answer (distinct from the svg label).
    expect(container.querySelector('.text-emerald-300')?.textContent).toBe('Mercury');
  });

  it('submits evidence with the skill it measured when the run finishes', () => {
    render(<SolarSystemExplorer data={data()} />);
    act(() => runnerState.options!.onFinished({
      outcomes: [
        { id: 'order:closest', solved: true, corrections: 0, score: 100, seconds: 4 },
        { id: 'compare:biggest', solved: true, corrections: 1, score: 67, seconds: 9 },
        { id: 'identify:earth', solved: false, corrections: 2, score: 0, seconds: 12 },
      ],
      solvedCount: 2,
      firstTryCount: 1,
      attemptsCount: 6,
      accuracy: 56,
      passed: false,
      hearTaps: 1,
      observations: [],
    }));
    expect(submitResultSpy).toHaveBeenCalledTimes(1);
    const [passed, score, metrics] = submitResultSpy.mock.calls[0];
    expect(passed).toBe(false);
    expect(score).toBe(56);
    expect(metrics).toMatchObject({
      type: 'solar-system-explorer',
      totalChallenges: 3,
      correctChallenges: 2,
      totalAttempts: 6,
      accuracy: 56,
    });
    // The evidence has to carry WHICH skill it measures, or IRT cannot use it.
    expect(['identify', 'order_from_sun', 'compare_attribute']).toContain(metrics.evalMode);
  });

  it('does not pre-select focusBody into a judged session', () => {
    render(<SolarSystemExplorer data={data({ focusBody: 'mercury' })} />);
    expect(screen.queryByText('Mercury is a planet.')).toBeNull();
  });

  it('tap-to-hear re-speaks the question through the runner, at every band', () => {
    render(<SolarSystemExplorer data={data({ gradeLevel: 'K' })} />);
    fireEvent.click(screen.getByRole('button', { name: /hear the question again/i }));
    expect(runnerState.hearStimulus).toHaveBeenCalledTimes(1);
  });

  it('unbuildable challenges degrade to free exploration, never to a broken ask', () => {
    render(<SolarSystemExplorer data={data({
      challenges: [{ id: 'x', type: 'order_from_sun', facet: 'closest', answerBodyIds: ['jupiter'] }],
    })} />);
    // The declared key disagrees with the sky → the item drops → explore face.
    expect(screen.getByText('EXPLORE')).toBeTruthy();
  });
});

describe('solar-system-explorer — the explore face survives untouched', () => {
  it('runs as the explorer when no challenges are sent, focusBody pre-selected', () => {
    render(<SolarSystemExplorer data={{ ...data(), challenges: [], focusBody: 'earth' }} />);
    expect(screen.getByText('EXPLORE')).toBeTruthy();
    expect(screen.getByText('Earth is a planet.')).toBeTruthy();
    // The judged chrome is nowhere.
    expect(screen.queryByText('Say it out loud')).toBeNull();
  });

  it('keeps the ORIENT / BODY_SELECTED voice beats', () => {
    render(<SolarSystemExplorer data={{ ...data(), challenges: [], focusBody: 'earth' }} />);
    const sent = sendTextSpy.mock.calls.map((c) => String(c[0]));
    expect(sent.some((m) => m.includes('[SOLAR_ORIENT]'))).toBe(true);
    expect(sent.some((m) => m.includes('[SOLAR_BODY_SELECTED]'))).toBe(true);
  });
});
