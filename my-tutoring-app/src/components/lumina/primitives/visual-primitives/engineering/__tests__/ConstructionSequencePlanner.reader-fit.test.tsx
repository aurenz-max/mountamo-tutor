// @vitest-environment jsdom
/**
 * Reader-fit for construction-sequence-planner's scripted path (no live tutor): the task and the job card names are
 * load-bearing text a K-2 reader cannot decode, so "Read the task to me" sends the ask and the cards, in the order they
 * are shown (never a working order), to a NON-silent sendText. On a sequence item the cards' needs are the task, so the
 * read-aloud never says what a job needs.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, resetAttempt: vi.fn(), submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

import ConstructionSequencePlanner, { type ConstructionSequencePlannerData } from '../ConstructionSequencePlanner';
import { buildOrder, type CspItem } from '../constructionSequenceWorkspace';

const SEQ: CspItem = { id: 'sequence-1', mode: 'sequence', project: 'house', jobs: [
  { id: 'roof', name: 'Put on the roof', icon: '🏠', weeks: 1, needs: ['frame'] },
  { id: 'dig', name: 'Dig the base', icon: '⛏️', weeks: 1, needs: [] },
  { id: 'frame', name: 'Frame the walls', icon: '🔨', weeks: 1, needs: ['dig'] },
] };
const data = (): ConstructionSequencePlannerData => ({ title: 'Build a Cozy House', description: 'Plan the jobs.', challengeTypes: ['sequence'], items: [SEQ] });
const sent = () => sendTextSpy.mock.calls.map(c => String(c[0]));

beforeEach(() => { cleanup(); sendTextSpy.mockClear(); });

describe('ConstructionSequencePlanner reader-fit (scripted path)', () => {
  it('the task read-aloud reads the ask and the cards in the shown order, never a need or the build order', () => {
    render(<ConstructionSequencePlanner data={data()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read the task to me/i }));
    const msg = sent().find(m => /\[READ_CHALLENGE\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/Put the jobs in the order they must happen/);
    expect(msg).toContain('The job cards: Put on the roof, Dig the base, Frame the walls.');
    expect(msg).not.toMatch(/needs/i);
    const key = buildOrder(SEQ).map(id => SEQ.jobs.find(j => j.id === id)!.name).join(', ');
    expect(msg).not.toContain(key);
  });

  it('a wrong plan builds up to where it stops, and two misses show a plan that works', () => {
    render(<ConstructionSequencePlanner data={data()} />);
    for (const name of ['Put on the roof', 'Dig the base', 'Frame the walls']) fireEvent.click(screen.getByRole('button', { name }));
    fireEvent.click(screen.getByRole('button', { name: /check and build/i }));
    expect(screen.getByText(/stopped at job 1, "Put on the roof"/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /check and build/i }));
    expect(screen.getByText(/A plan that works/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /next|finish/i })).toBeTruthy();
  });
});
