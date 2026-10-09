// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FunctionMachine, { type FunctionMachineChallenge } from './FunctionMachine';

const sendText = vi.fn();
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: false, isAudioPlaying: false, activePrimitiveId: null }),
}));
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(() => { cleanup(); sendText.mockClear(); });

const item = (id: string, input: number, output: number, rule: string): FunctionMachineChallenge => ({
  id, rule, inputQueue: [input], showRule: false, makeInput: input, makeOutput: output,
});
const tap = (...keys: string[]) => keys.forEach((k) => fireEvent.click(screen.getByRole('button', { name: `Add ${k}` })));
const done = () => fireEvent.click(screen.getByRole('button', { name: "I'm done!" }));
const rowTiles = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-make-row] button')).map((b) => b.textContent);
const verdict = (c: HTMLElement) => c.querySelector('[data-make-verdict]');

describe('function-machine make_rule open build', () => {
  it('one over -> miss keeps the row -> fix -> first machine kept -> same machine refused -> Start over -> a different machine passes', () => {
    const { container } = render(<FunctionMachine data={{
      title: 'Machines', description: 'Make machines', challengeType: 'make_rule', ruleComplexity: 'oneStep', instanceId: 'fm',
      challenges: [item('m1', 4, 12, '3*x'), item('m2', 3, 15, '5*x'), item('m3', 20, 5, 'x/4')],
    }} />);
    // Opens empty: the ask states the pair, the stored machine is never on screen, and nothing to check yet.
    expect(container.querySelector('[data-make-ask]')!.textContent).toBe('Make a machine that turns 4 into 12.');
    expect(container.textContent).not.toMatch(/3\s*\*?\s*x/);
    expect(rowTiles(container)).toEqual([]);
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);

    // One over: x + 9 gives 13.
    tap('x', '+', '9');
    expect(container.querySelector('[data-make-machine]')!.textContent).toBe('f(x) = x + 9');
    done();
    expect(verdict(container)!.getAttribute('data-make-verdict')).toBe('wrong_output');
    expect(verdict(container)!.textContent).toContain('Your machine turns 4 into 13, not 12.');
    expect(container.querySelector('[data-make-output]')!.textContent).toBe('13');
    expect(rowTiles(container)).toEqual(['x', '+', '9']); // Try again keeps the build

    // Fix it: take the 9 out, put 8 in.
    fireEvent.click(screen.getByRole('button', { name: 'Take out 9' }));
    tap('8');
    done();
    expect(verdict(container)!.getAttribute('data-make-verdict')).toBe('way');
    expect(container.querySelector('[data-made-machines]')!.textContent).toContain('Machine 1: f(x) = x + 8');
    expect(container.querySelector('[data-make-ask]')!.textContent).toBe('Now make a different machine that also turns 4 into 12.');
    expect(rowTiles(container)).toEqual([]);

    // The same machine written the other way round.
    tap('8', '+', 'x');
    done();
    expect(verdict(container)!.getAttribute('data-make-verdict')).toBe('same_machine');
    expect(rowTiles(container)).toEqual(['8', '+', 'x']);
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(rowTiles(container)).toEqual([]);

    // A different machine: 3x.
    tap('3', 'x');
    done();
    const compare = container.querySelector('[data-make-compare]')!;
    expect(compare.textContent).toContain('Both your machines turn 4 into 12. Feed them 5:');
    expect(compare.textContent).toContain('f(x) = x + 8 gives 13');
    expect(compare.textContent).toContain('f(x) = 3x gives 15');

    // The tutor heard the verdicts as facts and never got the stored machine.
    const said = sendText.mock.calls.map((c) => String(c[0]));
    expect(said.some((m) => m.includes('[MACHINE_CHECKED]') && m.includes('not right (wrong_output)'))).toBe(true);
    expect(said.some((m) => m.startsWith('[PHASE_COMPLETE] Make a machine'))).toBe(true);

    // Next item opens empty.
    fireEvent.click(screen.getByRole('button', { name: /Next Function/ }));
    expect(container.querySelector('[data-make-ask]')!.textContent).toBe('Make a machine that turns 3 into 15.');
    expect(rowTiles(container)).toEqual([]);
    expect(container.querySelector('[data-made-machines]')).toBeNull();
  });

  it('an older make_rule payload with no pair takes it from its rule; other modes render as before', () => {
    const { container, unmount } = render(<FunctionMachine data={{
      title: 'Machines', description: 'd', challengeType: 'make_rule',
      challenges: [{ id: 'o1', rule: '2*x', inputQueue: [6], showRule: false }],
    }} />);
    expect(container.querySelector('[data-make-ask]')!.textContent).toBe('Make a machine that turns 6 into 12.');
    unmount();
    render(<FunctionMachine data={{
      title: 'Rules', description: 'd', challengeType: 'create_rule',
      challenges: [{ id: 'c1', rule: '2*x + 1', inputQueue: [0, 1, 2], showRule: false }],
    }} />);
    expect(screen.getByText('Write the rule')).toBeTruthy();
    expect(screen.queryByRole('button', { name: "I'm done!" })).toBeNull();
  });
});
