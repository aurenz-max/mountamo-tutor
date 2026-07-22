// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for hydraulics-lab's young-learner
 * read-aloud wiring. The lab is a physics-judged mission board — its load-bearing
 * text (overview, the mission brief + goal, the on-request hint, and the
 * post-solve "why it worked" explanation) is prose a K–2 reader cannot decode.
 * The fix gives each a 🔊 LuminaReadAloud / ReadMeButton routing to a NON-silent
 * sendText — the read-aloud IS the tutor speaking the words verbatim.
 *
 * These are the behaviors tsc can't verify: the buttons render, and a tap sends
 * the right read-this-aloud message (the mission ask is answer-free — it never
 * names the winning slider configuration). External hooks are mocked to drive
 * pure component logic. Solve-card / zone / debrief 🔊s are gated behind the
 * canvas physics engine (no 2D context in jsdom), so they are not driven here;
 * they reuse the same readBlockAloud + LuminaReadAloud pattern proven below.
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

import HydraulicsLab, {
  type HydraulicsLabData,
  type HydraulicsMission,
} from '../HydraulicsLab';

const OVERVIEW = 'We will use squishy water power to lift very heavy things!';
const MISSION_TITLE = 'First Big Lift';
const MISSION_BRIEF = 'The big digger needs to scoop up a pile of dirt. Push down on the pump until the bucket lifts!';
const HINT = 'Slide the pump handle all the way down to push harder.';
const EXPLAIN = 'You pushed on the small piston and the fluid carried that push to the big one.';

const mission = (): HydraulicsMission => ({
  id: 'm1',
  machineLabel: 'Excavator Bucket',
  title: MISSION_TITLE,
  brief: MISSION_BRIEF,
  loadWeight: 150,
  controls: {
    inputForce: { initial: 0 },
    smallDiameter: { initial: 4, locked: true },
    largeDiameter: { initial: 12, locked: true },
  },
  successHint: HINT,
  explainOnSolve: EXPLAIN,
});

const data = (): HydraulicsLabData => ({
  title: 'Water Power Lab',
  description: 'Lift heavy loads with water power.',
  overview: OVERVIEW,
  scenario: 'excavator',
  scenarioName: 'Digger Power',
  realWorldContext: 'construction site',
  gradeBand: '3-5',
  missions: [mission()],
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('HydraulicsLab reader-fit (young-learner read-aloud)', () => {
  it('the overview 🔊 in the header reads the overview verbatim', () => {
    render(<HydraulicsLab data={data()} />);
    const btn = screen.getByRole('button', { name: /read the overview to me/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(sentMessages().some((m) => m.includes(OVERVIEW) && /\[READ_OVERVIEW\]/.test(m))).toBe(true);
  });

  it('the mission 🔊 reads the mission brief + an answer-free ask (never the winning setup)', () => {
    render(<HydraulicsLab data={data()} />);
    const btn = screen.getByRole('button', { name: /read the mission to me/i });
    fireEvent.click(btn);
    const msg = sentMessages().find((m) => /\[READ_MISSION\]/.test(m));
    expect(msg).toBeTruthy();
    // Reads the mission title + brief verbatim…
    expect(msg).toContain(MISSION_TITLE);
    expect(msg).toContain(MISSION_BRIEF);
    // …and tells them what to do, answer-free — never names the winning numbers.
    expect(msg).toMatch(/until the load lifts/i);
    expect(msg).not.toMatch(/diameter|cm|newton|\bN\b/i);
  });

  it('after asking for a hint, the hint 🔊 appears and reads the hint verbatim', () => {
    render(<HydraulicsLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /stuck\? get a hint/i }));
    sendTextSpy.mockClear(); // drop the silent [HINT_REQUESTED] message
    const btn = screen.getByRole('button', { name: /read the hint to me/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(sentMessages().some((m) => m.includes(HINT) && /\[READ_HINT\]/.test(m))).toBe(true);
  });
});
