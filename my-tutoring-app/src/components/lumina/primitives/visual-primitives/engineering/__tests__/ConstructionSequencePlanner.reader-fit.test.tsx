// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for construction-sequence-planner's
 * young-learner read-aloud wiring. The project intro, the ordering task, the
 * post-attempt feedback/hint, and the critical-path explanation are all
 * load-bearing text a K–2 reader cannot decode. The fix gives each a 🔊
 * LuminaReadAloud / ReadMeButton routing to a NON-silent sendText — the
 * read-aloud IS the tutor speaking the words verbatim.
 *
 * These are the behaviors tsc can't verify: the buttons render, and a tap sends
 * the right read-this-aloud message (with the correct tag). The ordering-task
 * button stays answer-free (it never names the build order). External hooks are
 * mocked to drive pure component logic.
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

import ConstructionSequencePlanner, {
  type ConstructionSequencePlannerData,
} from '../ConstructionSequencePlanner';

const TITLE = 'Build a Cozy House';
const DESC = 'We are going to build a cozy little house, one job at a time.';

// No task dependencies → the "looks good" hint path is deterministic regardless
// of the randomized starting order, and there is no single correct build order
// for the answer-free task button to accidentally leak.
const data = (): ConstructionSequencePlannerData => ({
  title: TITLE,
  description: DESC,
  tasks: [
    { id: 'found', name: 'Pour Foundation', duration: 3, icon: '🧱', description: 'Lay the base.', dependencies: [], category: 'foundation' },
    { id: 'walls', name: 'Build Walls', duration: 4, icon: '🏠', description: 'Raise the walls.', dependencies: [], category: 'structural' },
    { id: 'roof', name: 'Add Roof', duration: 2, icon: '🔺', description: 'Cap the top.', dependencies: [], category: 'finishing' },
  ],
  projectType: 'house',
  gradeLevel: '2',
  targetWeeks: 100,
  parallelAllowed: true,
  challenges: [],
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('ConstructionSequencePlanner reader-fit (young-learner read-aloud)', () => {
  it('intro: a 🔊 reads the project title + description verbatim', () => {
    render(<ConstructionSequencePlanner data={data()} />);
    sendTextSpy.mockClear(); // drop the [INTRO] connect message (isConnected mocked true)
    fireEvent.click(screen.getByRole('button', { name: /read the project introduction to me/i }));
    const msg = sentMessages().find((m) => /\[READ_INTRO\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(DESC);
    expect(msg).toContain(TITLE);
  });

  it('sequence: the ordering task 🔊 reads the instruction + an answer-free ask (never the build order)', () => {
    render(<ConstructionSequencePlanner data={data()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read the task to me/i }));
    const msg = sentMessages().find((m) => /\[READ_SEQUENCE\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/drag the tasks up and down to put them in the order/i);
    // Answer-safe: the task replay must not name any task in an ordering.
    expect(msg).not.toContain('Pour Foundation');
    expect(msg).not.toContain('Build Walls');
  });

  it('feedback: after a hint, the feedback 🔊 reads the revealed feedback verbatim', () => {
    render(<ConstructionSequencePlanner data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /hint/i })); // reveals the feedback banner
    sendTextSpy.mockClear(); // drop the silent [HINT_REQUESTED] message
    fireEvent.click(screen.getByRole('button', { name: /read the feedback to me/i }));
    const msg = sentMessages().find((m) => /\[READ_FEEDBACK\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain('Your sequence looks good');
  });

  it('critical path: the explanation 🔊 reads the critical-path text verbatim', () => {
    render(<ConstructionSequencePlanner data={data()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read the critical path explanation to me/i }));
    const msg = sentMessages().find((m) => /\[READ_CRITICAL_PATH\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/longest chain of tasks that can't be done in parallel/i);
  });
});
