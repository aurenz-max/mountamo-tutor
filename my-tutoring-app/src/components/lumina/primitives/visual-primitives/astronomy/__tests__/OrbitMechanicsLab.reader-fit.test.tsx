// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for orbit-mechanics-lab — item 15A / S2.
 *
 * Queued as WRONG-BAND ("floor it to grade 2"), rejected by user ruling: if the
 * curator routes a primitive at a grade, make it work there. A live K
 * topic-trace did select this primitive, so the floor would have deleted real
 * supply. These are the behaviors tsc cannot see:
 *
 *  - the ORIENT beat fires on mount, so a non-reader is told what to do
 *  - read-aloud taps send the on-screen words verbatim, and every tagged send
 *    is silent (a system trigger, not a message posted as if the child typed it)
 *  - the thrust slider (kN) and angle slider (degrees) are GONE at K-1 and
 *    replaced by three tappable pictures — one tap chooses AND flies
 *  - adult chrome (mass in kg, altitude/velocity readouts, TWR, the milestone
 *    ledger, "Set thrust and angle, then launch!") is absent from the DOM at
 *    K-1, not merely CSS-hidden, and still present at Grade 3
 *  - the pre-reader never meets the disabled "Need More Thrust!" dead end
 *
 * External hooks are mocked to drive pure component logic.
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
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import OrbitMechanicsLab, { buildOrbitPathD, type OrbitMechanicsLabData } from '../OrbitMechanicsLab';
import {
  orbitStep,
  initialLaunchState,
  calculateOrbitalElements,
  speedChoicesFor,
  type OrbitCraftConfig,
} from '../../../../service/astronomy/orbitPhysics';

const TITLE = 'Merry-Go-Round Space Rocket';
const DESCRIPTION = 'Things go around and around like a merry-go-round in space!';

/**
 * The real K rung the generator emits, taken verbatim from
 * /api/lumina/eval-test?componentId=orbit-mechanics-lab&grade=K.
 */
const kData = (over: Partial<OrbitMechanicsLabData> = {}): OrbitMechanicsLabData => ({
  title: TITLE,
  description: DESCRIPTION,
  gradeLevel: 'K',
  centralBody: 'earth',
  centralBodyRadius: 50,
  rocket: { massKg: 2000, propellantMassKg: 1200, name: 'Star Hopper' },
  thrustOptions: { minKN: 14, maxKN: 49, defaultKN: 26, stepKN: 5 },
  showOrbitPath: true,
  showVelocityVector: false,
  showApogeePerigee: false,
  showOrbitalPeriod: false,
  showTWR: false,
  showFuelGauge: false,
  gravityVisualization: 'none',
  allowLaunch: true,
  allowBurns: false,
  burnMode: 'direction_picker',
  hints: ['Press a picture to send your rocket!', 'Watch it fly around Earth!'],
  funFact: 'The Moon is always orbiting around Earth, just like your rocket!',
  ...over,
});

/** Grade 3 control — the ladder must NOT be flattened by the K work. */
const g3Data = (over: Partial<OrbitMechanicsLabData> = {}): OrbitMechanicsLabData => ({
  ...kData(),
  title: 'Orbit Seeker',
  gradeLevel: '3',
  rocket: { massKg: 3000, propellantMassKg: 1800, name: 'Orbit Seeker' },
  thrustOptions: { minKN: 21, maxKN: 74, defaultKN: 38, stepKN: 5 },
  showVelocityVector: true,
  showApogeePerigee: true,
  showTWR: true,
  showFuelGauge: true,
  gravityVisualization: 'field_lines',
  allowBurns: true,
  ...over,
});

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
  submitResultSpy.mockClear();
  // Physics is proved in orbitPhysics' own tests; keep the render deterministic.
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

describe('OrbitMechanicsLab @ PRE — the tutor is the only channel', () => {
  it('fires an ORIENT beat on mount so a non-reader is told the task', () => {
    render(<OrbitMechanicsLab data={kData()} />);
    const orient = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ORBIT_ORIENT]'));
    expect(orient).toBeDefined();
    expect(String(orient![0])).toMatch(/pre-reader who cannot read any text/);
  });

  it('tells the tutor not to name the right picture in the ORIENT beat', () => {
    render(<OrbitMechanicsLab data={kData()} />);
    const orient = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ORBIT_ORIENT]'))!;
    expect(String(orient[0])).toMatch(/[Nn]ever tell them which picture to pick/);
  });

  it('sends every tagged trigger silently — a machine prompt is not child chat', () => {
    render(<OrbitMechanicsLab data={kData()} />);
    for (const call of sendTextSpy.mock.calls) {
      expect(call[1]).toMatchObject({ silent: true });
    }
  });

  it('reads the title, description AND goal aloud verbatim on tap', () => {
    render(<OrbitMechanicsLab data={kData({
      challenge: { type: 'reach_altitude', description: 'Send it around!', successMessage: 'You did it!' },
    })} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByLabelText(/read this to me/i));

    const call = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ORBIT_READ_ALOUD]'));
    expect(call).toBeDefined();
    expect(String(call![0])).toContain(TITLE);
    expect(String(call![0])).toContain(DESCRIPTION);
    expect(String(call![0])).toContain('Send it around!');
    expect(call![1]).toMatchObject({ silent: true });
  });

  it('gives the hint a spoken twin instead of a disclosure to read', () => {
    render(<OrbitMechanicsLab data={kData()} />);
    expect(screen.queryByText(/need a hint\?/i)).toBeNull();

    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /tell me what to do/i }));
    const call = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ORBIT_READ_ALOUD]'))!;
    expect(String(call[0])).toContain('Press a picture to send your rocket!');
  });
});

describe('OrbitMechanicsLab @ PRE — tap = choose (rule 2)', () => {
  it('replaces both numeric sliders with three tappable pictures', () => {
    render(<OrbitMechanicsLab data={kData()} />);
    expect(screen.getByRole('button', { name: /slow/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /medium/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /super fast/i })).toBeTruthy();
  });

  it('has NO range slider anywhere at K — thrust in kN and angle in degrees are gone', () => {
    const { container } = render(<OrbitMechanicsLab data={kData()} />);
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(0);
  });

  it('has no text input at K (rule 6 — no typing)', () => {
    const { container } = render(<OrbitMechanicsLab data={kData()} />);
    expect(container.querySelectorAll('input[type="text"], textarea, select')).toHaveLength(0);
  });

  it('one tap both chooses the speed and flies it — no separate Launch step', () => {
    render(<OrbitMechanicsLab data={kData()} />);
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /medium/i }));

    // Flight started: the choices give way to the single way back.
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /medium/i })).toBeNull();
  });

  it('never shows the disabled "Need More Thrust!" dead end to a pre-reader', () => {
    render(<OrbitMechanicsLab data={kData()} />);
    expect(screen.queryByText(/need more thrust/i)).toBeNull();
    // and the too-slow picture is still tappable, so the failure is SEEN
    const slow = screen.getByRole('button', { name: /slow/i }) as HTMLButtonElement;
    expect(slow.disabled).toBe(false);
  });

  it('keeps the visible interactive element count within the PRE budget (rule 4)', () => {
    const { container } = render(<OrbitMechanicsLab data={kData({
      challenge: { type: 'reach_altitude', description: 'Send it around!', successMessage: 'Yes!' },
    })} />);
    const interactive = container.querySelectorAll('button, input, select, textarea, [role="button"]');
    expect(interactive.length).toBeLessThanOrEqual(5);
  });
});

describe('OrbitMechanicsLab @ PRE — no adult chrome (rule 7)', () => {
  const CHROME = [
    /Launch Settings/i,
    /Set thrust and angle/i,
    /Thrust\/Weight/i,
    /Flight Data/i,
    /Milestones/i,
    /Max Altitude/i,
    /Reached Space/i,
    /Stable Orbit/i,
    /Star Hopper Stats/i,
    /ORBIT LAB/i,
  ];

  it.each(CHROME)('removes %s from the DOM entirely at K', (pattern) => {
    render(<OrbitMechanicsLab data={kData()} />);
    expect(screen.queryByText(pattern)).toBeNull();
  });

  it('shows no units anywhere in the rendered text at K', () => {
    const { container } = render(<OrbitMechanicsLab data={kData()} />);
    const text = container.textContent || '';
    expect(text).not.toMatch(/\bkN\b/);
    expect(text).not.toMatch(/\bkm\b/);
    expect(text).not.toMatch(/\bm\/s\b/);
    expect(text).not.toMatch(/\bkg\b/);
    expect(text).not.toMatch(/°/);
  });

  it('gates chrome by conditional render, not CSS — nothing is left for a screen reader', () => {
    const { container } = render(<OrbitMechanicsLab data={kData()} />);
    expect(container.querySelectorAll('.hidden')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Altitude/);
  });

  it('shows a picture, not the word CRASHED, when the rocket comes down', () => {
    render(<OrbitMechanicsLab data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /slow/i }));
    expect(screen.queryByText('CRASHED!')).toBeNull();
  });
});

/**
 * `showOrbitPath` sat on the data interface, was set by the generator at every
 * grade, and NOTHING read it — so the catalog's Kindergarten rung
 * ("showOrbitPath only") promised a feature that did not exist. It matters most
 * at K: drawing the closed loop is what makes "goes around and around" legible
 * in the first second instead of after a full 100-minute lap.
 *
 * The branch only fires mid-flight, so it is exercised through the exported
 * builder against a state flown by the real physics.
 */
describe('OrbitMechanicsLab — showOrbitPath is actually implemented', () => {
  const CFG: OrbitCraftConfig = {
    bodyRadiusKm: 6371,
    surfaceGravity: 9.81,
    rocketMassKg: 2000,
    propellantMassKg: 1200,
    thrustKN: speedChoicesFor(2000, 9.81).find(c => c.id === 'justRight')!.thrustKN,
    launchAngle: 90,
  };
  const identity = (x: number, y: number) => ({ x, y });

  /** Fly the "just right" choice until it is coasting in a closed orbit. */
  const inOrbitState = () => {
    let s = initialLaunchState(CFG);
    for (let i = 0; i < 40000; i++) {
      s = orbitStep(s, 1, s.isLaunching, CFG);
      if (!s.isLaunching && calculateOrbitalElements(s, CFG).isInOrbit) return s;
    }
    throw new Error('never reached orbit');
  };

  it('draws a closed path once the rocket is in orbit', () => {
    const d = buildOrbitPathD(true, inOrbitState(), CFG, identity);
    expect(d).toBeTruthy();
    expect(d!.length).toBeGreaterThan(50);
    expect(d).toMatch(/Z$/); // closed loop, not an open arc
  });

  it('honours showOrbitPath: false — the flag is read, not ignored', () => {
    expect(buildOrbitPathD(false, inOrbitState(), CFG, identity)).toBeNull();
  });

  it('draws nothing on the launch pad, so no phantom loop appears before launch', () => {
    expect(buildOrbitPathD(true, initialLaunchState(CFG), CFG, identity)).toBeNull();
    expect(buildOrbitPathD(true, null, CFG, identity)).toBeNull();
  });

  it('draws nothing after a crash', () => {
    const crashed = { ...inOrbitState(), hasCrashed: true };
    expect(buildOrbitPathD(true, crashed, CFG, identity)).toBeNull();
  });

  it('maps through the caller world→screen transform rather than raw world km', () => {
    const s = inOrbitState();
    const raw = buildOrbitPathD(true, s, CFG, identity)!;
    const shifted = buildOrbitPathD(true, s, CFG, (x, y) => ({ x: x + 1000, y: y + 1000 }))!;
    expect(shifted).not.toEqual(raw);
  });
});

describe('OrbitMechanicsLab @ Grade 3 — the ladder is not flattened (control)', () => {
  it('keeps both numeric sliders', () => {
    const { container } = render(<OrbitMechanicsLab data={g3Data()} />);
    expect(container.querySelectorAll('input[type="range"]').length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT show the pre-reader speed pictures', () => {
    render(<OrbitMechanicsLab data={g3Data()} />);
    expect(screen.queryByRole('button', { name: /medium/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /super fast/i })).toBeNull();
  });

  it('keeps the instrument panels a grade 3 student can read', () => {
    render(<OrbitMechanicsLab data={g3Data()} />);
    expect(screen.getByText(/Flight Data/i)).toBeTruthy();
    expect(screen.getByText(/Milestones/i)).toBeTruthy();
    expect(screen.getByText(/Orbit Seeker Stats/i)).toBeTruthy();
    expect(screen.getByText(/Set thrust and angle/i)).toBeTruthy();
  });

  it('keeps the hint disclosure and the domain badge', () => {
    render(<OrbitMechanicsLab data={g3Data()} />);
    expect(screen.getByText(/need a hint\?/i)).toBeTruthy();
    expect(screen.getByText(/ORBIT LAB/i)).toBeTruthy();
  });

  it('still fires ORIENT, addressed to a reader rather than a pre-reader', () => {
    render(<OrbitMechanicsLab data={g3Data()} />);
    const orient = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ORBIT_ORIENT]'))!;
    expect(String(orient[0])).toMatch(/thrust and launch angle/);
    expect(String(orient[0])).not.toMatch(/pre-reader/);
  });
});
