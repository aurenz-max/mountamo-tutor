// @vitest-environment jsdom
/**
 * Reader-fit for flight-forces-explorer's scripted path (no tutor session): the ask is text a K-2 reader cannot
 * decode, so a "read the question to me" button sends it to the tutor verbatim with an answer-free "what to do", and
 * never the answer. On the workspace path the tutor reads the task itself and the button is hidden
 * (FlightForcesExplorer.workspace.test.tsx).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import FlightForcesExplorer, { type FlightForcesExplorerData } from '../FlightForcesExplorer';
import { askOf, keyLabel, type PredictItem } from '../flightForcesWorkspace';

const ITEM: PredictItem = { id: 'predict-1', mode: 'predict', aircraft: 'cessna', change: 'load_water', asked: 'height', named: true, later: false };
const data = (): FlightForcesExplorerData => ({ title: 'Flying Machines', gradeBand: '1-2', challengeTypes: ['predict'], items: [ITEM] });
const sent = () => sendTextSpy.mock.calls.map(c => String(c[0]));

beforeEach(() => { cleanup(); sendTextSpy.mockClear(); });

describe('FlightForcesExplorer reader-fit (young-learner read-aloud)', () => {
  it('the question button reads the ask verbatim with an answer-free ask, never the answer', () => {
    render(<FlightForcesExplorer data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the question to me/i }));
    const msg = sent().find(m => m.includes(askOf(ITEM)) && /\[READ_CHALLENGE\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/then answer/i);
    expect(msg).not.toContain(keyLabel(ITEM, 'height'));
  });
});
