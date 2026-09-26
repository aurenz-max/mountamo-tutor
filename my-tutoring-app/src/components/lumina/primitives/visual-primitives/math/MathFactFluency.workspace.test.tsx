// @vitest-environment jsdom
/**
 * Math fact fluency on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { MathFactFluencyChallenge, MathFactFluencyData } from './MathFactFluency';
import { mathFactHarnessInputs } from './mathFactFluencyWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const fact = { operation: 'addition' as const, operand1: 3, operand2: 4, result: 7, equation: '3 + 4 = 7', correctAnswer: 7, unknownPosition: 'result' as const };
/** One hand-built fact per catalog mode, keyed by the mode's challenge type. */
const CHALLENGES: Record<MathFactFluencyChallenge['type'], MathFactFluencyChallenge> = {
  'visual-fact': { ...fact, id: 'v1', type: 'visual-fact', instruction: 'How many dots in all?', visualType: 'dot-array', visualCount: 7, options: [6, 7, 8] },
  match: { ...fact, id: 'm1', type: 'match', instruction: 'Which equation matches the picture?', matchDirection: 'visual-to-equation',
    visualType: 'ten-frame', visualCount: 7, equationOptions: ['2 + 4 = 6', '3 + 4 = 7', '4 + 4 = 8'] },
  'equation-solve': { ...fact, id: 'e1', type: 'equation-solve', instruction: 'Solve the fact.', options: [6, 7, 9] },
  'missing-number': { ...fact, id: 'n1', type: 'missing-number', instruction: 'What number is missing?', unknownPosition: 'operand2', correctAnswer: 4 },
  'speed-round': { ...fact, id: 's1', type: 'speed-round', instruction: 'What is 3 + 4?' },
};
const facts = (challenges: MathFactFluencyChallenge[]): Record<string, unknown> & MathFactFluencyData => ({ title: 'Facts', challenges, maxNumber: 10,
  includeSubtraction: false, showVisualAids: true, targetResponseTime: 3, adaptiveDifficulty: false, gradeBand: '1' });
const MODES = (getComponentById('math-fact-fluency')?.evalModes ?? []).map(m => [m.evalMode, m.challengeTypes![0] as MathFactFluencyChallenge['type']] as const);

/** The row's inputs, through the real controls. */
function perform(h: ReturnType<typeof mountWorkspace>, c: MathFactFluencyChallenge, wrong: boolean) {
  for (const input of mathFactHarnessInputs(c, wrong, 10)) {
    if (input.type === 'touch') h.touch(input.target); else h.press(input.label);
  }
}
const readout = (h: ReturnType<typeof mountWorkspace>) => h.view.container.querySelector('.text-3xl')?.textContent;

it('every catalog mode binds', () => {
  expect(MODES.map(([, type]) => type).sort()).toEqual(Object.keys(CHALLENGES).sort());
  for (const [mode, type] of MODES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'math-fact-fluency', pin: mode, objectiveIds: ['o'],
      data: facts([CHALLENGES[type]]) }), mode).not.toBeNull();
  }
});

it.each(MODES)('%s: a checked gesture that publishes no key; a wrong answer reopens clean on Try again, the right one completes once',
  async (mode, type) => {
    const c = CHALLENGES[type];
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: mode, data: facts([c]) });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    const published = JSON.stringify(task);
    expect(published).not.toMatch(/correctAnswer|visualCount/);
    // The full equation carries the answer; only a printed choice may show it.
    if (type !== 'match') expect(published).not.toContain(c.equation);
    expect(published).not.toMatch(/\b7 dots\b|of 7\b/);

    perform(h, c, true);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    // The miss never reveals the answer on screen.
    expect(h.view.container.textContent).not.toMatch(/answer is|correct equation is/i);
    // Input is closed until Try again; Try again clears the rejected answer.
    const answerButton = h.view.container.querySelector('button[data-pip-object^="option-"], button[data-pip-object^="equation-"], button[aria-label="One more"]') as HTMLButtonElement;
    expect(answerButton.disabled).toBe(true);
    const choiceStyles = () => new Set(Array.from(h.view.container.querySelectorAll('button[data-pip-object^="option-"], button[data-pip-object^="equation-"]'))
      .map(b => b.className));
    const choices = type !== 'missing-number' && type !== 'speed-round';
    if (choices) expect(choiceStyles().size, 'the rejected choice is marked').toBe(2);
    else expect(readout(h)).not.toBe('–');
    h.dispatch('retry');
    if (choices) expect(choiceStyles().size, 'Try again leaves a choice marked').toBe(1);
    else expect(readout(h)).toBe('–');

    perform(h, c, false);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

it('a picture match is checked by the picture tapped', () => {
  const c: MathFactFluencyChallenge = { ...fact, id: 'p1', type: 'match', instruction: 'Which picture shows 3 + 4?', matchDirection: 'equation-to-visual',
    visualOptions: [{ type: 'dot-array', count: 6 }, { type: 'dot-array', count: 7 }] };
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'match', data: facts([c]) });
  expect(h.state().task!.demand).toMatchObject({ problem: '3 + 4 = ?' });
  h.touch('picture-0');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  h.dispatch('retry');
  h.touch('picture-1');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('the tutor is told what is drawn: the printed fact with its "?", the choices and that there is no timer', () => {
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'visual_fact', data: facts([CHALLENGES['visual-fact']]) });
  expect(h.state().task!.demand).toMatchObject({ problem: '3 + 4 = ?', choices: '6 | 7 | 8', picture: expect.stringContaining('dot picture'),
    timing: expect.stringContaining('No timer') });
});

it('nothing advances on a clock after a right answer', () => {
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'equation_solve',
    data: facts([CHALLENGES['equation-solve'], { ...CHALLENGES['equation-solve'], id: 'e2' }]) });
  perform(h, CHALLENGES['equation-solve'], false);
  h.settle(30000);
  expect(h.state().task!.itemId).toBe('e1');
});

it('the adapter refuses a fact whose choices lack the answer', () => {
  expect(() => LIVE_ADAPTERS['math-fact-fluency'].validate(facts([{ ...CHALLENGES['equation-solve'], options: [5, 6] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['math-fact-fluency'].validate(facts([{ ...CHALLENGES.match, equationOptions: ['2 + 4 = 6'] }]))).toThrow();
  expect(() => LIVE_ADAPTERS['math-fact-fluency'].validate(facts([{ ...CHALLENGES.match, matchDirection: 'equation-to-visual' }]))).toThrow();
});
