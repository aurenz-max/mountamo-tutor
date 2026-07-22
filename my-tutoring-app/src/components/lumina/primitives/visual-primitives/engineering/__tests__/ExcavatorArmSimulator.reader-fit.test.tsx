// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for excavator-arm-simulator's young-learner
 * read-aloud wiring. The Dig Site job board carries load-bearing prose a K–2
 * reader cannot decode — the site intro, each job brief (the spine), the on-request
 * hint, and the post-attempt feedback/solve explanations. The fix gives each a 🔊
 * LuminaReadAloud / ReadMeButton routing to a NON-silent sendText — the read-aloud
 * IS the tutor speaking the words verbatim, never the (which-joint-angle) solution.
 *
 * These are the behaviors tsc can't verify: the buttons render, and a tap sends the
 * right read-this-aloud message. External hooks are mocked to drive pure component
 * logic. The canvas-gated placements (solve card, pipe strike, out-of-fuel, debrief)
 * depend on dig geometry and are not driveable in jsdom — they are wired identically
 * to the reachable placements and verified by tsc + review (see report).
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

import ExcavatorArmSimulator, { type ExcavatorArmSimulatorData } from '../ExcavatorArmSimulator';

const DESC = 'Drive a real digging machine to finish jobs on a busy building site.';
const BRIEF = 'Scoop up the dirt and load it into the big red truck to finish this job.';
const HINT = 'Push the bucket deep into the dirt before you scoop, then swing over the truck.';

const data = (): ExcavatorArmSimulatorData => ({
  title: 'Dig Site Job Board',
  description: DESC,
  boomLength: 100,
  stickLength: 80,
  bucketSize: 10,
  jointControl: 'drag',
  showAngles: true,
  showReach: false,
  terrainProfile: [
    { x: 0, height: 10 },
    { x: 800, height: 10 },
  ],
  materialLayers: [
    { type: 'topsoil', color: '#8B7355', depth: 0, hardness: 2 },
  ],
  minBoomAngle: -30,
  maxBoomAngle: 90,
  minStickAngle: -120,
  maxStickAngle: 30,
  minBucketAngle: -90,
  maxBucketAngle: 90,
  theme: 'cartoon',
  excavatorColor: '#F59E0B',
  // Words-only re-theming of the first job so the fixture controls the strings.
  missionThemes: [
    { brief: BRIEF, successHint: HINT },
  ],
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('ExcavatorArmSimulator reader-fit (young-learner read-aloud)', () => {
  it('intro: a 🔊 reads the site description verbatim', () => {
    render(<ExcavatorArmSimulator data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /^read this to me$/i }));
    const msg = sentMessages().find((m) => /\[READ_INTRO\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(DESC);
  });

  it('job: the ReadMeButton reads the current job brief + an answer-free ask', () => {
    render(<ExcavatorArmSimulator data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the job to me/i }));
    const msg = sentMessages().find((m) => /\[READ_JOB\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(BRIEF);
    expect(msg).toMatch(/move the boom/i);
  });

  it('hint: after revealing the hint, its 🔊 reads the hint verbatim', () => {
    render(<ExcavatorArmSimulator data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /stuck\? get a hint/i }));
    sendTextSpy.mockClear(); // drop the silent [HINT_REQUESTED] tutor message
    fireEvent.click(screen.getByRole('button', { name: /read the hint to me/i }));
    const msg = sentMessages().find((m) => /\[READ_HINT\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(HINT);
  });
});
