// @vitest-environment jsdom
/**
 * Reader-fit for mission-planner's K-1 story (`MissionStory.tsx`), re-based on the 2026-10-16 rebuild.
 *
 * Item 15A / S7 gave this primitive a tutor channel for a non-reader (ORIENT, a spoken twin of the instruction line, the
 * chosen place voiced). The 10-16 ruling makes K-1 an ungraded story: those beats now live on the story, and it never
 * submits a score. Grades 2-5 are the graded planner on its boss; their checks are bound mounts in
 * MissionPlanner.workspace.test.tsx.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true, activePrimitiveId: null }),
}));
const submitResultSpy = vi.fn();
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: submitResultSpy, hasSubmitted: false, resetAttempt: vi.fn(), submittedResult: null, elapsedMs: 0 }),
}));
vi.mock('../../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

import MissionPlanner, { type MissionPlannerData } from '../MissionPlanner';
import type { FartherItem } from '../missionWorkspace';

const kData = (over: Partial<MissionPlannerData> = {}): MissionPlannerData =>
  ({ title: 'Fly to Space!', overview: 'Pick a place.', gradeLevel: 'K', challengeTypes: [], items: [], story: { places: ['moon', 'mars'] }, ...over });

// Farthest: Saturn; then closest: the Moon.
const FAR: FartherItem[] = [
  { id: 'farther_closer-1', mode: 'farther_closer', ask: 'far', places: ['mars', 'saturn'] },
  { id: 'farther_closer-2', mode: 'farther_closer', ask: 'near', places: ['jupiter', 'moon'] },
];
const g3 = (over: Partial<MissionPlannerData> = {}): MissionPlannerData =>
  ({ title: 'Mission Control', overview: 'Plan.', gradeLevel: '3', challengeTypes: ['farther_closer'], items: FAR, ...over });

beforeEach(() => { cleanup(); sendTextSpy.mockClear(); submitResultSpy.mockClear(); });

describe('MissionPlanner @ K-1: the ungraded story', () => {
  it('orients the tutor once, without a right answer', () => {
    render(<MissionPlanner data={kData()} />);
    const orient = sendTextSpy.mock.calls.map(c => String(c[0])).filter(m => m.includes('[MISSION_ORIENT]'));
    expect(orient).toHaveLength(1);
    expect(orient[0]).toMatch(/Nothing here is right or wrong/);
  });

  it('is pictures and taps: no number, no Check, no score', () => {
    vi.useFakeTimers();
    const { container } = render(<MissionPlanner data={kData()} />);
    expect(container.textContent).not.toMatch(/\d/);
    expect(screen.queryByRole('button', { name: /Check/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mars' }));
    expect(String(sendTextSpy.mock.calls.at(-1)?.[0])).toMatch(/\[MISSION_DESTINATION_SELECTED\].*Mars.*Any place is a fine choice/);
    fireEvent.click(screen.getByRole('button', { name: 'Water' }));
    fireEvent.click(screen.getByRole('button', { name: /Fly!/ }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(container.textContent).toMatch(/many, many months/);
    expect(container.textContent).not.toMatch(/\d/);
    expect(submitResultSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Fly somewhere else/ }));
    expect(screen.getByRole('button', { name: 'The Moon' })).toBeTruthy();
    vi.useRealTimers();
  });

  it('reads the line aloud on tap', () => {
    render(<MissionPlanner data={kData({ gradeLevel: '1' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Read it to me' }));
    expect(String(sendTextSpy.mock.calls.at(-1)?.[0])).toMatch(/\[MISSION_READ_ALOUD\].*Pick a place/);
  });

  it('a K payload with items still gets the story (K-1 is never graded)', () => {
    render(<MissionPlanner data={g3({ gradeLevel: 'K' })} />);
    expect(screen.queryByRole('button', { name: /Check/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'The Moon' })).toBeTruthy();
  });
});
