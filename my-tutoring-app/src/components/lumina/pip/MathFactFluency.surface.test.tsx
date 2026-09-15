// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import MathFactFluency, { type MathFactFluencyChallenge, type MathFactFluencyData } from '../primitives/visual-primitives/math/MathFactFluency';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'facts' }));
vi.mock('../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }),
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'facts'; });

const base = { operation: 'addition' as const, operand1: 3, operand2: 2, result: 5, equation: '3 + 2 = 5', correctAnswer: 5, unknownPosition: 'result' as const };
const visualFact: MathFactFluencyChallenge = { ...base, id: 'vf', type: 'visual-fact', instruction: 'How many?', visualType: 'dot-array', visualCount: 5, options: [4, 5, 6] };
const solve: MathFactFluencyChallenge = { ...base, id: 'es', type: 'equation-solve', instruction: 'Solve it.' };
const pictureToEquation: MathFactFluencyChallenge = {
  ...base, id: 'm1', type: 'match', instruction: 'Which equation matches?', matchDirection: 'visual-to-equation', visualType: 'ten-frame', visualCount: 5,
  equationOptions: ['3 + 2 = 5', '2 + 2 = 4'],
};
const equationToPicture: MathFactFluencyChallenge = {
  ...base, id: 'm2', type: 'match', instruction: 'Which picture matches?', matchDirection: 'equation-to-visual',
  visualOptions: [{ type: 'dot-array', count: 4 }, { type: 'dot-array', count: 5 }],
};
const data = (challenges: MathFactFluencyChallenge[]): MathFactFluencyData => ({
  title: 'Facts', challenges, maxNumber: 5, includeSubtraction: false, showVisualAids: true,
  targetResponseTime: 3, adaptiveDifficulty: false, gradeBand: 'K', instanceId: 'facts',
});

function mount(input: MathFactFluencyData) {
  const store = new PipSurfaceStore();
  store.setActive('facts');
  const ui = () => <PipSurfaceContext.Provider value={store}><MathFactFluency data={input} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const speak = (on: boolean) => { tutor.isAudioPlaying = on; view.rerender(ui()); };
  return { store, speak, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id) ?? [];
const tap = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));

describe('Math Fact Fluency drives Pip from its check state', () => {
  it('visual fact: points at the dots, follows a tapped number, celebrates only a right one; the next fact drops the touch', () => {
    const { store, speak, container } = mount(data([visualFact, solve]));
    expect(container.querySelector('[data-pip-dock="facts"]')).not.toBeNull();
    expect(ids(store)).toEqual(expect.arrayContaining(['visual', 'problem', 'option-4', 'option-5', 'option-6']));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'visual' });
    speak(false);
    tap('4');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'option-4' });
    tap('5');
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    tap(/Next Challenge/);
    expect(store.getActive()?.scopeId).toBe('es');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
  });

  it('equation solve: points at the printed problem, never the stepper; a stepper tap is watched', () => {
    const { store, speak } = mount(data([solve]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'problem' });
    speak(false);
    tap('+');
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'entry' });
  });

  it('match: the picture when an equation is chosen, the equation when a picture is chosen — never a choice', () => {
    for (const [challenge, cue] of [[pictureToEquation, 'visual'], [equationToPicture, 'problem']] as const) {
      tutor.isAudioPlaying = true;
      const { store, unmount, container } = mount(data([challenge]));
      expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: cue });
      expect(container.querySelectorAll('[data-pip-dock]')).toHaveLength(1);
      unmount();
      expect(store.getActive()).toBeNull();
    }
  });

  it('speech for another block, or praise carried into the next fact, is not a cue', () => {
    tutor.activePrimitiveId = 'other-block';
    const { store, speak } = mount(data([visualFact, solve]));
    speak(true);
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'none' });
    speak(false);
    tutor.activePrimitiveId = 'facts';
    tap('5');
    speak(true); // praise
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
    tap(/Next Challenge/);
    expect(pose(store)).toEqual({ phase: 'idle', gesture: 'none' });
    speak(false);
    speak(true);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'problem' });
  });
});
