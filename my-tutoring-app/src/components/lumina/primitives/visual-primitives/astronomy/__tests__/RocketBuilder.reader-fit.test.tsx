// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for rocket-builder — item 15A / S3.
 *
 * The core act was ALREADY K-fit: tap a part, it lands on the rocket, press
 * launch, watch. Rule 2 passed before this slice. What failed was everything
 * around it — and `data.gradeLevel` was read in exactly ONE place in the whole
 * component: to print a literal "GRADE K" developer badge at the child.
 *
 * Behaviors tsc cannot see:
 *  - the ORIENT beat fires on mount; every tagged send is silent
 *  - tapping a part speaks its name (the tutor IS the label for a non-reader)
 *  - part cards are picture-primary at K-1, and the "500 kg • 50 kN thrust"
 *    spec line is absent from the DOM — not merely CSS-hidden
 *  - mass/thrust/TWR/budget panels, the staging control, the flight-profile
 *    chart, the attempt ledger and the km readouts are gone at K-1
 *  - the TWR failure prose ("(TWR: 0.85)") never reaches a pre-reader
 *  - Grade 3 keeps all of it
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    resetAttempt: vi.fn(),
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import RocketBuilder, { type RocketBuilderData, type RocketComponent } from '../RocketBuilder';

const TITLE = 'Build Your First Rocket!';
const DESCRIPTION = 'Rockets are made of parts. Put some together and launch!';

/** Verbatim from /api/lumina/eval-test?componentId=rocket-builder&grade=K. */
const K_PARTS: RocketComponent[] = [
  { id: 'cap-1', name: 'Small Capsule', type: 'capsule', massKg: 500, widthUnits: 2, heightUnits: 2, color: '#E74C3C', description: 'Where the astronaut sits' },
  { id: 'tank-1', name: 'Small Fuel Tank', type: 'fuel_tank', massKg: 100, propellantMassKg: 400, widthUnits: 2, heightUnits: 3, color: '#3498DB', description: 'Holds the fuel' },
  { id: 'eng-1', name: 'Small Engine', type: 'engine', massKg: 200, thrustKN: 50, specificImpulse: 300, burnTimeSeconds: 120, widthUnits: 2, heightUnits: 2, color: '#F39C12', description: 'Pushes the rocket up' },
];

const kData = (over: Partial<RocketBuilderData> = {}): RocketBuilderData => ({
  title: TITLE,
  description: DESCRIPTION,
  gradeLevel: 'K',
  availableComponents: K_PARTS,
  maxStages: 1,
  targetAltitudeKm: 15,
  targetOrbit: false,
  showTWR: false,
  showFuelGauge: false,
  showForces: false,
  atmosphereModel: 'simple',
  guidedMode: true,
  simulationSpeed: 50,
  learningFocus: 'Students will discover that rockets are made of different parts.',
  hints: ['Tap a part to send it to your rocket!', 'Every rocket needs an engine!'],
  ...over,
});

const g3Data = (over: Partial<RocketBuilderData> = {}): RocketBuilderData => ({
  ...kData(),
  gradeLevel: '3',
  maxStages: 3,
  targetAltitudeKm: 100,
  showTWR: true,
  showFuelGauge: true,
  ...over,
});

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('RocketBuilder @ PRE — the tutor is the only channel', () => {
  it('fires an ORIENT beat on mount so a non-reader is told the task', () => {
    render(<RocketBuilder data={kData()} />);
    const orient = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ROCKET_ORIENT]'));
    expect(orient).toBeDefined();
    expect(String(orient![0])).toMatch(/pre-reader who cannot read any text/);
  });

  it('tells the tutor not to hand over the required parts in the ORIENT beat', () => {
    render(<RocketBuilder data={kData()} />);
    const orient = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ROCKET_ORIENT]'))!;
    expect(String(orient[0])).toMatch(/[Dd]o NOT list which parts they need/);
  });

  it('sends every tagged trigger silently — a machine prompt is not child chat', () => {
    render(<RocketBuilder data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Small Engine' }));
    expect(sendTextSpy.mock.calls.length).toBeGreaterThan(1);
    for (const call of sendTextSpy.mock.calls) {
      expect(call[1]).toMatchObject({ silent: true });
    }
  });

  it('speaks the part name on tap — the tutor IS the label for a non-reader', () => {
    render(<RocketBuilder data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Small Engine' }));

    const call = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ROCKET_PART_ADDED]'));
    expect(call).toBeDefined();
    expect(String(call![0])).toContain('Small Engine');
    expect(String(call![0])).toMatch(/do not list numbers/i);
  });

  it('reads the title and description aloud verbatim on tap', () => {
    render(<RocketBuilder data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByLabelText(/read this to me/i));

    const call = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ROCKET_READ_ALOUD]'))!;
    expect(String(call[0])).toContain(TITLE);
    expect(String(call[0])).toContain(DESCRIPTION);
    expect(call[1]).toMatchObject({ silent: true });
  });

  it('gives the hint a spoken twin instead of a disclosure to read', () => {
    render(<RocketBuilder data={kData()} />);
    expect(screen.queryByText(/need a hint\?/i)).toBeNull();

    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /tell me what to do/i }));
    const call = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ROCKET_READ_ALOUD]'))!;
    expect(String(call[0])).toContain('Every rocket needs an engine!');
  });
});

describe('RocketBuilder @ PRE — pictures are the answer surface (rule 3)', () => {
  it('gives every part an accessible name so the tap target is identifiable', () => {
    render(<RocketBuilder data={kData()} />);
    for (const p of K_PARTS) {
      expect(screen.getByRole('button', { name: p.name })).toBeTruthy();
    }
  });

  it('removes the "500 kg • 50 kN thrust" spec line from the DOM at K', () => {
    const { container } = render(<RocketBuilder data={kData()} />);
    const text = container.textContent || '';
    expect(text).not.toMatch(/\bkg\b/);
    expect(text).not.toMatch(/\bkN\b/);
    expect(text).not.toMatch(/thrust/i);
  });

  it('shows no units or ratios anywhere in the rendered text at K', () => {
    const { container } = render(<RocketBuilder data={kData()} />);
    const text = container.textContent || '';
    expect(text).not.toMatch(/\bkm\b/);
    expect(text).not.toMatch(/\$/);
    expect(text).not.toMatch(/Thrust\/Weight/);
  });

  it('replaces the raw type slug with child words for the part groups', () => {
    render(<RocketBuilder data={kData()} />);
    // "fuel_tanks" / "capsules" are developer vocabulary, not child words.
    expect(screen.queryByText(/fuel_tank/i)).toBeNull();
    expect(screen.queryByText(/capsules/i)).toBeNull();
    expect(screen.getByText('Where you sit')).toBeTruthy();
    expect(screen.getByText('Pushers')).toBeTruthy();
  });

  it('still adds the part on a single tap — the K-fit core act is untouched', () => {
    const { container } = render(<RocketBuilder data={kData()} />);
    const before = container.querySelectorAll('svg').length;
    fireEvent.click(screen.getByRole('button', { name: 'Small Engine' }));
    // The rocket SVG is still rendered and no error boundary tripped.
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(before);
  });
});

describe('RocketBuilder @ PRE — no adult chrome (rule 7)', () => {
  const CHROME: [string, RegExp][] = [
    ['the GRADE developer badge', /GRADE K/],
    ['the domain badge', /BUILD & LAUNCH/],
    ['the component library header', /Component Library/],
    ['the staging control', /Add Stage/],
    ['the stage counter', /stages/],
    ['the mission altitude', /Mission Objective/],
    ['the total mass panel', /Total Mass/],
    ['the total thrust panel', /Total Thrust/],
    ['the flight profile chart', /Flight Profile/],
    ['the staging ledger', /Staging Events/],
    ['the attempt ledger', /Attempt #/],
    ['the teacher-facing learning focus', /Learning Focus/],
    ['the flight results header', /Flight Results/],
  ];

  it.each(CHROME)('removes %s from the DOM at K', (_label, pattern) => {
    render(<RocketBuilder data={kData()} />);
    expect(screen.queryByText(pattern)).toBeNull();
  });

  it('gates by conditional render, not CSS — nothing is left for a screen reader', () => {
    const { container } = render(<RocketBuilder data={kData()} />);
    expect(container.querySelectorAll('.hidden')).toHaveLength(0);
  });

  it('has no typing path at K (rule 6)', () => {
    const { container } = render(<RocketBuilder data={kData()} />);
    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(0);
  });

  it('labels Reset with a picture and an accessible name, not the word', () => {
    render(<RocketBuilder data={kData()} />);
    expect(screen.queryByText('Reset')).toBeNull();
    expect(screen.getByRole('button', { name: /start over/i })).toBeTruthy();
  });
});

describe('RocketBuilder @ Grade 3 — the ladder is not flattened (control)', () => {
  it('keeps the specs on every part card', () => {
    const { container } = render(<RocketBuilder data={g3Data()} />);
    const text = container.textContent || '';
    expect(text).toMatch(/\bkg\b/);
    expect(text).toMatch(/\bkN thrust\b/);
  });

  it('keeps the instrument panels and the staging control', () => {
    render(<RocketBuilder data={g3Data()} />);
    expect(screen.getByText(/Total Mass/)).toBeTruthy();
    expect(screen.getByText(/Total Thrust/)).toBeTruthy();
    expect(screen.getByText(/Thrust\/Weight/)).toBeTruthy();
    expect(screen.getByText(/Add Stage/)).toBeTruthy();
    expect(screen.getByText(/Mission Objective/)).toBeTruthy();
  });

  it('keeps the GRADE badge, hint disclosure and learning focus', () => {
    render(<RocketBuilder data={g3Data()} />);
    expect(screen.getByText(/GRADE 3/)).toBeTruthy();
    expect(screen.getByText(/need a hint\?/i)).toBeTruthy();
    expect(screen.getByText(/Learning Focus/)).toBeTruthy();
  });

  it('still fires ORIENT, addressed to a reader rather than a pre-reader', () => {
    render(<RocketBuilder data={g3Data()} />);
    const orient = sendTextSpy.mock.calls.find(c => String(c[0]).includes('[ROCKET_ORIENT]'))!;
    expect(String(orient[0])).toMatch(/stack stages/);
    expect(String(orient[0])).not.toMatch(/pre-reader/);
  });
});
