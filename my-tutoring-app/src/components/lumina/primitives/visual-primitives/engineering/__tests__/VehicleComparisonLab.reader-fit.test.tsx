// @vitest-environment jsdom
/**
 * Reader-fit for vehicle-comparison-lab's scripted path (no tutor session): the ask is text a K-2 reader cannot
 * decode, so a "read the question to me" button sends it to the tutor verbatim with an answer-free "what to do", and
 * never the answer. The table shows each vehicle's own silhouette and no leader before an answer. On the workspace
 * path the tutor reads the task itself and the button is hidden (VehicleComparisonLab.workspace.test.tsx).
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

import VehicleComparisonLab, { type VehicleComparisonLabData } from '../VehicleComparisonLab';
import { askOf, keyName, type LeaderItem } from '../vehicleComparisonWorkspace';

const ITEM: LeaderItem = {
  id: 'metric_leader-1', mode: 'metric_leader', metric: 'topSpeed', columns: ['topSpeed'], units: { topSpeed: 'km/h' },
  rows: [
    { id: 'bus', name: 'School Bus', category: 'land', values: { topSpeed: 90 } },
    { id: 'bike', name: 'Bicycle', category: 'land', values: { topSpeed: 25 } },
    { id: 'train', name: 'Metro Train', category: 'land', values: { topSpeed: 80 } },
    { id: 'car', name: 'Family Car', category: 'land', values: { topSpeed: 160 } },
  ],
};
const data = (): VehicleComparisonLabData => ({
  title: 'Ways to School', instructions: 'Read the table to answer.', topicFocus: 'Ways to travel to school', vehicles: [],
  comparisonMetrics: ['topSpeed'], gradeBand: 'K-2', challengeTypes: ['metric_leader'], items: [ITEM],
});
const sent = () => sendTextSpy.mock.calls.map(c => String(c[0]));

beforeEach(() => { cleanup(); sendTextSpy.mockClear(); });

describe('VehicleComparisonLab reader-fit (young-learner read-aloud)', () => {
  it('the question button reads the ask verbatim with an answer-free ask, never the answer', () => {
    render(<VehicleComparisonLab data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the question to me/i }));
    const msg = sent().find(m => m.includes(askOf(ITEM)) && /\[READ_CHALLENGE\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/then choose/i);
    expect(msg).not.toContain(keyName(ITEM));
  });

  it('draws each vehicle class and marks no leader until an answer, then shows the reason', () => {
    const { container } = render(<VehicleComparisonLab data={data()} />);
    for (const kind of ['bus', 'bicycle', 'train', 'car']) {
      expect(container.querySelector(`[data-vehicle-visual-kind="${kind}"]`)).toBeTruthy();
    }
    expect(container.textContent).not.toMatch(/leads/);
    fireEvent.click(screen.getByRole('button', { name: 'Family Car' }));
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }));
    expect(container.textContent).toMatch(/Family Car leads the Top speed column with 160 km\/h/);
  });
});
