// @vitest-environment jsdom
/**
 * Reader-fit for propulsion-lab's scripted path (no tutor session): the ask is text a K-2 reader cannot decode, so a
 * "read the question to me" button sends it to the tutor verbatim with an answer-free "what to do", and never the
 * answer. On the workspace path the tutor reads the task itself and the button is hidden
 * (PropulsionLab.workspace.test.tsx).
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

import PropulsionLab, { type PropulsionLabData } from '../PropulsionLab';
import { askOf, keyOf, type PredictItem } from '../propulsionWorkspace';

const ITEM: PredictItem = { id: 'predict-1', mode: 'predict', place: 'space', thrusters: [{ engine: 'propeller', blast: 'left', size: 3 }], named: true };
const data = (): PropulsionLabData => ({ title: 'Push and Go', gradeBand: '1-2', challengeTypes: ['predict'], items: [ITEM] });
const sent = () => sendTextSpy.mock.calls.map(c => String(c[0]));

beforeEach(() => { cleanup(); sendTextSpy.mockClear(); });

describe('PropulsionLab reader-fit (young-learner read-aloud)', () => {
  it('the question button reads the ask verbatim with an answer-free ask, never the answer', () => {
    render(<PropulsionLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the question to me/i }));
    const msg = sent().find(m => m.includes(askOf(ITEM)) && /\[READ_CHALLENGE\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/then answer/i);
    expect(msg).not.toContain(keyOf(ITEM));
  });
});
