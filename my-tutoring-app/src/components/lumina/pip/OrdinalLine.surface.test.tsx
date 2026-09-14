// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { ordinalLinePipPose, type OrdinalPipState } from './ordinalLinePipPose';
import OrdinalLine, { type OrdinalLineData } from '../primitives/visual-primitives/math/OrdinalLine';

const phase = vi.hoisted(() => ({ tutorSpeaking: false, stage: 'asking', currentSolved: false, index: 0 }));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, ...phase, cuedItemId: item?.id ?? null,
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: true, preparing: false, summary: null, revealHeld: false, micState: 'armed', statusLine: '',
      start: vi.fn(), hearStimulus: vi.fn(), stimulusTapped: false, armStillness: vi.fn(), clearStillness: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(), loop: {},
    };
  },
}));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({ isConnected: true, sendText: vi.fn() }) }));
vi.mock('../evaluation', () => ({ usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }) }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

afterEach(cleanup);
beforeEach(() => { phase.tutorSpeaking = false; phase.stage = 'asking'; phase.currentSolved = false; phase.index = 0; });

const LINE = [
  { name: 'Rabbit', emoji: '🐰' }, { name: 'Turtle', emoji: '🐢' }, { name: 'Fox', emoji: '🦊' },
  { name: 'Bear', emoji: '🐻' }, { name: 'Frog', emoji: '🐸' },
];
const data: OrdinalLineData = {
  title: 'Parade', maxPosition: 5, context: 'race', showOrdinalLabels: true, labelFormat: 'both', gradeBand: '1', instanceId: 'ordinal',
  challenges: [
    { id: 'c1', type: 'identify', instruction: '', characters: LINE, targetPosition: 3, correctAnswer: '3' },
    { id: 'c2', type: 'build-sequence', instruction: '', characters: LINE, correctAnswer: 'sequence_complete',
      clues: [{ character: 'Turtle', position: 1 }, { character: 'Fox', position: 2 }, { character: 'Rabbit', position: 3 }] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  store.setActive('ordinal');
  const ui = () => <PipSurfaceContext.Provider value={store}><OrdinalLine data={data} /></PipSurfaceContext.Provider>;
  return { store, ui, ...render(ui()) };
}

describe('Ordinal Line drives Pip from its judged phases', () => {
  it('cues identify at the start of the line, never at a character', () => {
    phase.tutorSpeaking = true;
    const { store } = mount();
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'start' });
    expect(store.getActive()?.targets.map((t) => t.id)).not.toContain('marked');
  });

  it('points at the empty places in a build, follows the child’s taps, and receives the line', () => {
    const { store, container, rerender, ui, unmount } = mount();
    const buildIndex = (() => {
      for (let i = 0; i < 6; i++) {
        phase.index = i;
        rerender(ui());
        if (container.querySelector('[data-pip-object="slots"]')) return i;
      }
      return -1;
    })();
    expect(buildIndex).toBeGreaterThanOrEqual(0);
    phase.tutorSpeaking = true;
    rerender(ui());
    expect(store.getActive()?.pose).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'slots' });
    phase.tutorSpeaking = false;
    rerender(ui());
    fireEvent.click(container.querySelector('[data-pip-object^="picture-"]')!);
    expect(store.getActive()?.pose).toMatchObject({ phase: 'working', gesture: 'look' });
    expect(store.getActive()?.pose.targetId).toMatch(/^picture-/);
    fireEvent.click(container.querySelector('[data-pip-object="slot-1"]')!);
    expect(store.getActive()?.pose).toEqual({ phase: 'working', gesture: 'look', targetId: 'slot-1' });
    phase.stage = 'judging';
    rerender(ui());
    expect(store.getActive()?.pose).toMatchObject({ phase: 'checking', gesture: 'receive' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});

describe('ordinal line pose policy', () => {
  const gate: OrdinalPipState = {
    running: true, preparing: false, currentSolved: false, revealHeld: false, judging: false,
    tutorSpeaking: true, cueMatchesItem: true, kind: 'relative_position', visibleIds: ['stage', 'start', 'marked'],
  };
  it('points at the named place only while the tier shows it, and gives no cue for a story', () => {
    expect(ordinalLinePipPose(gate).targetId).toBe('marked');
    expect(ordinalLinePipPose({ ...gate, visibleIds: ['stage', 'start'] }).targetId).toBe('start');
    expect(ordinalLinePipPose({ ...gate, kind: 'sequence_story' })).toEqual({ phase: 'introducing', gesture: 'none', targetId: undefined });
  });
});
