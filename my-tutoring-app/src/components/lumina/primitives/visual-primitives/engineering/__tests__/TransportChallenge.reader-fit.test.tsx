// @vitest-environment jsdom
/**
 * Reader-fit for transport-challenge's scripted path (no workspace tutor): the job's text is long for a grade 3
 * reader, so a read-the-job button asks the tutor to read it aloud. Answer-safety: it reads the ask (the job, its
 * limits and the question) and an answer-free instruction, never the vehicle that answers. The workspace path hides
 * it (TransportChallenge.workspace.test.tsx), where the tutor reads the task from the packet instead.
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
  useEvaluationContext: () => null,
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import TransportChallenge, { type TransportChallengeData } from '../TransportChallenge';
import { askOf, keyVehicle, type TransportItem } from '../transportWorkspace';

const ITEM: TransportItem = {
  id: 'single_constraint-1', mode: 'single_constraint', title: 'Get the team to the big game', origin: 'Riverside', destination: 'Stadium',
  load: { kind: 'people', amount: 44, name: 'fans' }, limits: [{ type: 'budget', max: 140 }], shows: ['budget', 'time', 'co2'],
  vehicles: [
    { id: 'car', name: 'Car', emoji: '🚗', capacity: 4, cost: 15, hours: 1, co2: 5 },
    { id: 'minivan', name: 'Minivan', emoji: '🚐', capacity: 8, cost: 25, hours: 1, co2: 8 },
    { id: 'shuttle', name: 'Shuttle', emoji: '🚎', capacity: 12, cost: 30, hours: 1, co2: 9 },
  ],
};
const data = (): TransportChallengeData => ({ title: 'Transport Challenge', description: 'Plan the jobs.', challengeTypes: ['single_constraint'], items: [ITEM] });
const sent = () => sendTextSpy.mock.calls.map(c => String(c[0]));

beforeEach(() => { cleanup(); sendTextSpy.mockClear(); });

describe('TransportChallenge reader-fit (scripted path)', () => {
  it('the read-the-job button reads the ask and an answer-free instruction, never the answer', () => {
    render(<TransportChallenge data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the job to me/i }));
    const msg = sent().find(m => /\[READ_CHALLENGE\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(askOf(ITEM));
    expect(keyVehicle(ITEM)!.name).toBe('Shuttle');
    expect(msg).not.toMatch(/shuttle/i);
  });

  it('two wrong picks reveal the answer with every vehicle\'s totals, and only then', () => {
    render(<TransportChallenge data={data()} />);
    expect(document.querySelector('[data-compare]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Minivan' }));
    fireEvent.click(screen.getByRole('button', { name: /check my pick/i }));
    expect(document.querySelector('[data-run="minivan"]')).not.toBeNull();
    expect(document.querySelector('[data-compare]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Car' }));
    fireEvent.click(screen.getByRole('button', { name: /check my pick/i }));
    expect(document.querySelector('[data-compare]')).not.toBeNull();
    expect(screen.getByText(/The shuttle makes 4 trips/)).toBeTruthy();
  });
});
