// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ submissions: [] as unknown[][] }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <p>Block complete</p> }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => undefined }) }));
vi.mock('../../../evaluation', async () => {
  const React = await import('react');
  return { usePrimitiveEvaluation: () => {
    const [hasSubmitted, setSubmitted] = React.useState(false);
    return { hasSubmitted, elapsedMs: 0, submittedResult: null,
      submitResult: (...args: unknown[]) => { state.submissions.push(args); setSubmitted(true); return {}; } };
  } };
});
import NumberLine, { type NumberLineData } from './NumberLine';

const data: NumberLineData = {
  title: 'Hops', range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer', interactionMode: 'jump', supportTier: 'medium',
  challenges: [
    { id: 'show_jump-0', type: 'show_jump', instruction: 'Start at 8 and hop forward 3.', hint: 'Count each hop.', targetValues: [11], startValue: 8,
      operations: [{ type: 'add', startValue: 8, changeValue: 3, showJumpArc: false }] },
    { id: 'show_jump-1', type: 'show_jump', instruction: 'Start at 15 and hop back 4.', hint: 'Count each hop.', targetValues: [11], startValue: 15,
      operations: [{ type: 'subtract', startValue: 15, changeValue: 4, showJumpArc: false }] },
  ],
};

beforeEach(() => {
  state.submissions = [];
  // SVG viewBox is 760 wide: a 760px client rect maps clientX 1:1 onto SVG x.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 240, right: 760, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/** Client x of a value, read from the rendered tick labels (auto-zoom decides the window). */
function tap(value: number) {
  const svg = document.querySelector('svg[viewBox="0 0 760 240"]')!;
  const labels = Array.from(svg.querySelectorAll('text')).filter(t => /^\d+$/.test(t.textContent ?? ''))
    .map(t => ({ v: Number(t.textContent), x: Number(t.getAttribute('x')) }));
  const [a, b] = [labels[0], labels[labels.length - 1]];
  fireEvent.click(svg, { clientX: a.x + ((value - a.v) * (b.x - a.x)) / (b.v - a.v) });
}
const check = () => fireEvent.click(screen.getByRole('button', { name: /check/i }));

it('grades a landing one hop short as wrong, keeps that try, and submits first-response evidence', () => {
  render(<NumberLine data={data} />);
  tap(10); check();                       // one hop short: 8, 9, 10
  expect(screen.queryByRole('button', { name: /next challenge/i })).toBeNull();
  tap(11); check();                       // corrected
  fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
  tap(11); check();                       // right first time

  expect(state.submissions).toHaveLength(1);
  const [success, score, , studentWork, , evidence] = state.submissions[0] as [boolean, number, unknown, { jumpResponses: unknown[] }, unknown, Record<string, unknown>];
  // The canonical score is unchanged: every challenge ended correct.
  expect([success, score]).toEqual([true, 100]);
  expect(studentWork.jumpResponses).toMatchObject([
    { challengeId: 'show_jump-0', attempt: 1, placedLandings: [10], expectedLandings: [11], correct: false },
    { challengeId: 'show_jump-0', attempt: 2, placedLandings: [11], correct: true },
    { challengeId: 'show_jump-1', attempt: 1, placedLandings: [11], correct: true },
  ]);
  expect(evidence).toMatchObject({ firstResponseScore: 50, expected: 'landing at 11', observed: 'landing placed at 10, 2 spaces right of 8' });
  expect((evidence.phases as unknown[])).toHaveLength(3);
});

it('attaches no evidence when every first try was right', () => {
  render(<NumberLine data={data} />);
  tap(11); check();
  fireEvent.click(screen.getByRole('button', { name: /next challenge/i }));
  tap(11); check();
  expect(state.submissions).toHaveLength(1);
  expect(state.submissions[0][5]).toBeUndefined();
  expect((state.submissions[0][3] as { jumpResponses: unknown[] }).jumpResponses).toHaveLength(2);
});
