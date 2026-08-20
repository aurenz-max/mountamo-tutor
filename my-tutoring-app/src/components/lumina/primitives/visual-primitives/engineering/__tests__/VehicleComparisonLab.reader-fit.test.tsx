// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for vehicle-comparison-lab's young-learner
 * read-aloud wiring. Every load-bearing string here (instructions, challenge
 * scenario, post-answer explanation) is text a K–2 reader cannot decode; the fix
 * gives each a 🔊 LuminaReadAloud / ReadMeButton that routes to a NON-silent
 * sendText — the read-aloud IS the tutor speaking the words verbatim.
 *
 * These are the behaviors tsc can't verify: the buttons render, and a tap sends
 * the right read-this-aloud message (scenario is answer-free; explanation is
 * post-answer so revealing is fine). External hooks are mocked to drive pure
 * component logic.
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
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import VehicleComparisonLab, {
  type VehicleComparisonLabData,
  type ComparisonVehicle,
} from '../VehicleComparisonLab';

const metric = (value: number, unit: string) => ({ value, unit, display: `${value} ${unit}` });

const vehicle = (id: string, name: string, category: ComparisonVehicle['category'], speed = 90): ComparisonVehicle => ({
  id,
  name,
  category,
  imagePrompt: `${name} photo`,
  metrics: {
    topSpeed: metric(speed, 'km/h'),
    weight: metric(10000, 'kg'),
    passengerCapacity: metric(50, 'pax'),
    range: metric(450, 'km'),
    fuelType: 'diesel',
    yearIntroduced: 1990,
    costPerTrip: null,
    co2PerPassengerKm: null,
  },
  funFact: `${name} is fun!`,
});

const INSTRUCTIONS = "Let's explore how different machines move! Click the vehicles.";
const SCENARIO = 'Getting to school with your friends.';
const EXPLANATION = 'The school bus is best because it can fit all 50 friends at once!';

const data = (): VehicleComparisonLabData => ({
  title: 'Super Cool Vehicle Races',
  instructions: INSTRUCTIONS,
  topicFocus: 'Ways to travel to school',
  vehicles: [
    vehicle('bus', 'School Bus', 'land'),
    vehicle('bike', 'Bicycle', 'land', 25),
  ],
  comparisonMetrics: ['topSpeed', 'passengerCapacity', 'weight'],
  chartType: 'bar',
  challengeType: 'evidence_choice',
  challenges: [
    {
      id: 'school-trip',
      type: 'evidence_choice',
      scenario: SCENARIO,
      constraints: { passengers: 50, distance: 5, maxTime: null },
      bestVehicleId: 'bus',
      explanation: EXPLANATION,
      acceptableAlternatives: [],
      bestEvidenceMetric: 'passengerCapacity',
      acceptableEvidenceMetrics: [],
    },
  ],
  surprisingFacts: [{ fact: 'A bicycle is the most efficient vehicle ever!', vehicleIds: ['bike'] }],
  gradeBand: 'K-2',
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('VehicleComparisonLab reader-fit (young-learner read-aloud)', () => {
  it('gates the comparison values behind a prediction and reveals the animated evidence on run', () => {
    render(<VehicleComparisonLab data={data()} />);
    expect(screen.queryByText('90 km/h')).toBeNull();
    const run = screen.getByRole('button', { name: /run the comparison/i });
    expect(run.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /^school bus$/i }));
    expect(run.hasAttribute('disabled')).toBe(false);
    fireEvent.click(run);

    expect(screen.getByText('90 km/h')).toBeTruthy();
    expect(screen.getByText(/school bus leads this test/i)).toBeTruthy();
  });

  it('the instructions 🔊 button is present in the header and reads the instructions verbatim', () => {
    render(<VehicleComparisonLab data={data()} />);
    const btn = screen.getByRole('button', { name: /read the instructions to me/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(sentMessages().some((m) => m.includes(INSTRUCTIONS) && /\[READ_INSTRUCTIONS\]/.test(m))).toBe(true);
  });

  it('the challenge scenario 🔊 reads the scenario verbatim and states the constraint ask (answer-free)', () => {
    render(<VehicleComparisonLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /2\. evidence missions/i }));
    const btn = screen.getByRole('button', { name: /read the challenge to me/i });
    fireEvent.click(btn);
    const msg = sentMessages().find((m) => m.includes(SCENARIO));
    expect(msg).toBeTruthy();
    // States the ask (carry 50 passengers, 5 km) so a non-reader knows what to do…
    expect(msg).toMatch(/50 passengers/);
    expect(msg).toMatch(/5 kilometers/);
    // …but never names the answer vehicle.
    expect(msg).not.toMatch(/school bus/i);
  });

  it('after answering, the explanation 🔊 button appears and reads the explanation verbatim', () => {
    render(<VehicleComparisonLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /2\. evidence missions/i }));
    // The redesigned mission requires both a vehicle and the visible evidence.
    fireEvent.click(screen.getByRole('button', { name: /school bus/i }));
    fireEvent.click(screen.getByRole('button', { name: /passenger capacity/i }));
    fireEvent.click(screen.getByRole('button', { name: /check vehicle \+ evidence/i }));
    const btn = screen.getByRole('button', { name: /^read this to me$/i });
    expect(btn).toBeTruthy();
    sendTextSpy.mockClear();
    fireEvent.click(btn);
    expect(sentMessages().some((m) => m.includes(EXPLANATION) && /\[READ_EXPLANATION\]/.test(m))).toBe(true);
  });

  it('metric-leader mode shows the named values and grades a vehicle choice without a separate evidence pick', () => {
    const base = data();
    const metricLeaderData: VehicleComparisonLabData = {
      ...base,
      challengeType: 'metric_leader',
      challenges: [{
        ...base.challenges[0],
        type: 'metric_leader',
        scenario: 'Which vehicle has the greatest top speed?',
        bestVehicleId: 'bus',
        bestEvidenceMetric: 'topSpeed',
      }],
    };

    render(<VehicleComparisonLab data={metricLeaderData} />);
    fireEvent.click(screen.getByRole('button', { name: /2\. evidence missions/i }));

    expect(screen.getByText('90 km/h')).toBeTruthy();
    expect(screen.getByText('25 km/h')).toBeTruthy();
    expect(screen.queryByText(/which evidence best supports/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /school bus/i }));
    fireEvent.click(screen.getByRole('button', { name: /^check vehicle$/i }));
    expect(screen.getByText(/you found the metric leader/i)).toBeTruthy();
  });

  it('renders specific land vehicle identities instead of one category-level car', () => {
    const visualData = data();
    visualData.vehicles = [
      vehicle('bus', 'School Bus', 'land'),
      vehicle('bike', 'Bicycle', 'land', 25),
      vehicle('car', 'Family Car', 'land', 70),
      vehicle('train', 'Metro Train', 'land', 80),
    ];

    const { container } = render(<VehicleComparisonLab data={visualData} />);
    for (const kind of ['bus', 'bicycle', 'car', 'train']) {
      expect(container.querySelector(`[data-vehicle-visual-kind="${kind}"]`)).toBeTruthy();
    }
  });

  it('replaces an incorrect route hero with the best vehicle after correction', () => {
    render(<VehicleComparisonLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /2\. evidence missions/i }));
    fireEvent.click(screen.getByRole('button', { name: /bicycle/i }));

    expect(screen.getByTestId('mission-route-vehicle').getAttribute('data-vehicle-id')).toBe('bike');
    expect(screen.getByTestId('mission-route-vehicle').textContent).toMatch(/your pick/i);

    fireEvent.click(screen.getByRole('button', { name: /passenger capacity/i }));
    fireEvent.click(screen.getByRole('button', { name: /check vehicle \+ evidence/i }));

    expect(screen.getByTestId('mission-route-vehicle').getAttribute('data-vehicle-id')).toBe('bus');
    expect(screen.getByTestId('mission-route-vehicle').textContent).toMatch(/best fit.*school bus/i);
  });
});
