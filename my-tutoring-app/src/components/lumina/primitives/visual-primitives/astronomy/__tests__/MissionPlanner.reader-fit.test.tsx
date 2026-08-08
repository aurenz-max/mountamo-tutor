// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for mission-planner — 15A / S7.
 *
 * Pre-fix this primitive had NO channel to a non-reader: no catalog tutoring
 * block and no `useLuminaAI`, so the backend was handed the literal string
 * "No specific scaffolding instructions for this primitive type."
 * (`lumina_tutor.py:385`). The instruction line, the destination names and the
 * travel times are all silent text at K.
 *
 * The component was ALREADY band-aware (`PHASE_INSTRUCTIONS[phase][gradeLevel]`,
 * K-specific destination copy, travel times hidden at K) — the S14 shape. Those
 * gates were running on Gemini's echoed `gradeLevel`, which the generator now
 * overrides; that half is covered in the generator test.
 *
 * Behaviors tsc cannot see: the ORIENT beat fires and withholds a "correct"
 * destination, the instruction line has a spoken twin at K-1, choosing a place
 * is voiced (the tutor's voice IS the destination name), and none of it appears
 * at grade 3.
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
  }),
}));

import MissionPlanner, { type MissionPlannerData } from '../MissionPlanner';

const dest = (id: string, name: string) => ({
  id: id as MissionPlannerData['destinations'][number]['id'],
  name,
  distanceFromSunAU: 1,
  orbitAngleDeg: 90,
  color: '#ccc',
  radiusPx: 5,
  travelDaysDirect: 3,
  description: `About ${name}.`,
  funFact: `${name} is fun.`,
});

const kData = (over: Partial<MissionPlannerData> = {}): MissionPlannerData => ({
  title: "Let's Go to the Moon!",
  description: 'Pick a place in space.',
  gradeLevel: 'K',
  destinations: [dest('moon', 'The Moon'), dest('mars', 'Mars')],
  missionType: 'flyby',
  crewed: false,
  showLaunchWindows: false,
  showTrajectory: false,
  supplyCalculator: false,
  gravityAssistOption: false,
  fuelConstraint: 100,
  missionClock: false,
  hints: ['Pick a planet to visit!'],
  funFact: 'Space is big.',
  ...over,
}) as MissionPlannerData;

const g3Data = () => kData({
  gradeLevel: '3',
  showTrajectory: true,
  missionClock: true,
  supplyCalculator: true,
  crewed: true,
});

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));
const sentWith = (t: string) => sent().filter((m) => m.includes(t));

beforeEach(() => {
  sendTextSpy.mockReset();
  cleanup();
});

describe('MissionPlanner — ORIENT', () => {
  it('fires exactly once on mount', () => {
    render(<MissionPlanner data={kData()} />);
    expect(sentWith('[MISSION_ORIENT]')).toHaveLength(1);
  });

  it('refuses to imply a correct destination', () => {
    render(<MissionPlanner data={kData()} />);
    expect(sentWith('[MISSION_ORIENT]')[0]).toMatch(/NO wrong destination/i);
  });

  it('sends every beat silently', () => {
    render(<MissionPlanner data={kData()} />);
    // Exercise the click-driven beats too. Asserting on mount alone leaves
    // read-aloud and destination-select uncovered — a non-silent read-aloud
    // posts a machine prompt as if the child had typed it.
    fireEvent.click(screen.getByLabelText(/hear what to do/i));
    fireEvent.click(screen.getByRole('button', { name: /Mars/ }));

    for (const tag of ['[MISSION_ORIENT]', '[MISSION_READ_ALOUD]', '[MISSION_DESTINATION_SELECTED]']) {
      expect(sentWith(tag).length).toBeGreaterThan(0);
    }
    for (const c of sendTextSpy.mock.calls) {
      expect((c[1] as { silent?: boolean } | undefined)?.silent).toBe(true);
    }
  });
});

describe('MissionPlanner — the instruction line has a spoken twin at K-1', () => {
  it('offers read-aloud at K and reads the instruction word for word', () => {
    render(<MissionPlanner data={kData()} />);
    const btn = screen.getByLabelText(/hear what to do/i);
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    const msg = sentWith('[MISSION_READ_ALOUD]')[0];
    expect(msg).toContain('Pick a place in space you want to visit!');
    expect(msg).toMatch(/word for word/i);
  });

  it('offers it at grade 1 too', () => {
    render(<MissionPlanner data={kData({ gradeLevel: '1' })} />);
    expect(screen.getByLabelText(/hear what to do/i)).toBeTruthy();
  });

  it('does NOT offer it at grade 3', () => {
    render(<MissionPlanner data={g3Data()} />);
    expect(screen.queryByLabelText(/hear what to do/i)).toBeNull();
  });
});

describe('MissionPlanner — choosing a place is voiced', () => {
  it("says the destination name, because the tutor's voice IS the label", () => {
    render(<MissionPlanner data={kData()} />);
    // "Mars" also appears as a D3 <text> label on the map — click the CARD.
    fireEvent.click(screen.getByRole('button', { name: /Mars/ }));
    const msg = sentWith('[MISSION_DESTINATION_SELECTED]')[0];
    expect(msg).toContain('Mars');
    expect(msg).toMatch(/one thing about it they can picture/i);
  });

  it('never suggests another destination would have been better', () => {
    render(<MissionPlanner data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /The Moon/ }));
    expect(sentWith('[MISSION_DESTINATION_SELECTED]')[0]).toMatch(/Never suggest a different one/i);
  });
});

describe('MissionPlanner — structural', () => {
  it('never nests a button inside a button', () => {
    for (const d of [kData(), g3Data()]) {
      const { container, unmount } = render(<MissionPlanner data={d} />);
      expect(container.querySelectorAll('button button')).toHaveLength(0);
      unmount();
    }
  });

  it('renders the K instruction copy, not a higher rung', () => {
    render(<MissionPlanner data={kData()} />);
    expect(screen.getByText('Pick a place in space you want to visit!')).toBeTruthy();
  });
});
