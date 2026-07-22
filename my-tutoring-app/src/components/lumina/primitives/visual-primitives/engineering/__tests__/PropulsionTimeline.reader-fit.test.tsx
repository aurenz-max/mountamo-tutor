// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for propulsion-timeline's young-learner
 * read-aloud wiring. Every phase carries load-bearing narration a K–2 reader
 * cannot decode — the milestone story (explore), the ordering task + clue
 * (sequence), and the phase intros (connect/speed). The fix gives each a 🔊
 * LuminaReadAloud / ReadMeButton routing to a NON-silent sendText — the
 * read-aloud IS the tutor speaking the words verbatim.
 *
 * These are the behaviors tsc can't verify: the buttons render, and a tap sends
 * the right read-this-aloud message. External hooks are mocked to drive pure
 * component logic.
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

import PropulsionTimeline, { type PropulsionTimelineData } from '../PropulsionTimeline';

const M_DESC = 'The first powered airplane lifted off the ground for twelve whole seconds.';
const M_SIG = 'It proved that people could really fly.';
const HINT = 'Think about which invention had to come first.';

const data = (): PropulsionTimelineData => ({
  title: 'How We Move Through Time',
  timeRange: { startYear: 1900, endYear: 2000 },
  milestones: [
    {
      id: 'flyer',
      year: 1903,
      name: 'Wright Flyer',
      vehicle: 'Wright Flyer',
      domain: 'air',
      topSpeed: '48 km/h',
      description: M_DESC,
      significance: M_SIG,
      imagePrompt: 'a wooden biplane',
      enabledBy: null,
      enabledNext: 'jet',
    },
    {
      id: 'jet',
      year: 1958,
      name: 'Jet Airliner',
      vehicle: 'Boeing 707',
      domain: 'air',
      topSpeed: '960 km/h',
      description: 'A jet plane that carried many people fast.',
      significance: 'It made flying across the world normal.',
      imagePrompt: 'a jet airliner',
      enabledBy: 'flyer',
      enabledNext: null,
    },
  ],
  eras: [
    { name: 'Early Flight', startYear: 1900, endYear: 1950, color: '#38bdf8', description: 'first planes', dominantTransport: 'propeller planes' },
  ],
  speedRecords: [
    { year: 1903, speed: 48, vehicle: 'Wright Flyer', domain: 'air' },
    { year: 1958, speed: 960, vehicle: 'Boeing 707', domain: 'air' },
  ],
  sequencingChallenges: [
    { items: ['flyer', 'jet'], correctOrder: ['flyer', 'jet'], hint: HINT },
  ],
  innovationChains: [
    { name: 'Flight', milestoneIds: ['flyer', 'jet'], narrative: 'The Flyer led to the jet.' },
  ],
  gradeBand: 'K-2',
});

const sentMessages = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('PropulsionTimeline reader-fit (young-learner read-aloud)', () => {
  it('explore: tapping a milestone reveals a 🔊 that reads its story (name + description + significance) verbatim', () => {
    render(<PropulsionTimeline data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /wright flyer/i })); // select the milestone (reveals detail)
    sendTextSpy.mockClear(); // drop the silent [MILESTONE_EXPLORED] narration
    const btn = screen.getByRole('button', { name: /read this milestone to me/i });
    fireEvent.click(btn);
    const msg = sentMessages().find((m) => /\[READ_MILESTONE\]/.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toContain(M_DESC);
    expect(msg).toContain(M_SIG);
  });

  it('sequence: the ordering task 🔊 reads the instruction + an answer-free ask', () => {
    render(<PropulsionTimeline data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /2\. sequence/i }));
    fireEvent.click(screen.getByRole('button', { name: /read the ordering task to me/i }));
    const msg = sentMessages().find((m) => /oldest invention to the newest/i.test(m));
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/tap the milestones/i);
  });

  it('sequence: after checking, the clue 🔊 reads the hint verbatim', () => {
    render(<PropulsionTimeline data={data()} />);
    fireEvent.click(screen.getByRole('button', { name: /2\. sequence/i }));
    // Build the order (tap both available items), then Check.
    fireEvent.click(screen.getByRole('button', { name: /wright flyer/i }));
    fireEvent.click(screen.getByRole('button', { name: /jet airliner/i }));
    fireEvent.click(screen.getByRole('button', { name: /check order/i }));
    sendTextSpy.mockClear(); // drop the silent [SEQUENCE_*] result message
    fireEvent.click(screen.getByRole('button', { name: /read the clue to me/i }));
    expect(sentMessages().some((m) => m.includes(HINT) && /\[READ_HINT\]/.test(m))).toBe(true);
  });

  it('connect + speed phases each expose an intro 🔊 that reads the phase orientation', () => {
    render(<PropulsionTimeline data={data()} />);

    fireEvent.click(screen.getByRole('button', { name: /3\. connect/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /read this to me/i })[0]);
    expect(sentMessages().some((m) => /\[READ_CONNECT\]/.test(m) && /one invention led to the next/i.test(m))).toBe(true);

    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /4\. speed records/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /read this to me/i })[0]);
    expect(sentMessages().some((m) => /\[READ_SPEED\]/.test(m) && /top speeds have changed/i.test(m))).toBe(true);
  });
});
