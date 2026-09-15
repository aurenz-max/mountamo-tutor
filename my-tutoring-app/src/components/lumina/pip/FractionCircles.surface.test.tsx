// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FractionCircles, { type FractionCirclesChallenge } from '../primitives/visual-primitives/math/FractionCircles';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { expectClassicWorkspace, mountWithStore, poseOf } from './testing/classicSurface';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: null as string | null }));
const phase = vi.hoisted(() => ({ stage: 'asking', revealHeld: false, submit: vi.fn() }));
vi.mock('../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }) }));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => ({
    currentItem: pack.items[0] ?? null, currentIndex: 0, stage: phase.stage, tutorSpeaking: false,
    currentSolved: false, revealHeld: phase.revealHeld, cuedItemId: pack.items[0]?.id ?? null,
    canAttempt: phase.stage !== 'judging', solvedIds: new Set(), running: true, preparing: false, summary: null,
    stimulusTapped: false, hearStimulus: vi.fn(), isAwaitingGesture: () => false, submitGestureAttempt: phase.submit,
  }),
}));
vi.mock('../components/DiActionPanel', () => ({ default: () => null }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../components/PhaseSummaryPanel', () => ({ default: () => <p>Done</p> }));
beforeEach(() => { Object.assign(phase, { stage: 'asking', revealHeld: false }); phase.submit.mockClear(); });
afterEach(cleanup);

const compare = (id: string, a: [number, number], b: [number, number]): FractionCirclesChallenge => ({
  id, type: 'compare', numerator: a[0], denominator: a[1], compareFraction: { numerator: b[0], denominator: b[1] },
  instruction: 'Compare.', hint: 'Look', narration: '', showFractionLabels: false, supportTier: 'medium',
});

describe('Fraction Circles shares its workspace with Pip', () => {
  it('click modes keep the classic workspace contract', () => {
    const data = { title: 'Compare', instanceId: 'circles', challenges: [compare('a', [1, 4], [1, 8]), compare('b', [2, 6], [2, 3])] };
    expectClassicWorkspace({ mounted: mountWithStore(() => <FractionCircles data={data} />), tutor, instanceId: 'circles' });
  });

  it('touch-a-fraction outlines the pictures as a group and watches the one the child touches', () => {
    const store = new PipSurfaceStore();
    const data = { title: 'Touch', instanceId: 'touch', challenges: [{ id: 't', type: 'touch_fraction' as const, numerator: 1, denominator: 3, instruction: '', hint: '', narration: '' }] };
    const ui = () => <PipSurfaceContext.Provider value={store}><FractionCircles data={data} /></PipSurfaceContext.Provider>;
    const view = render(ui());
    expect(store.getActive()?.targets.map((t) => t.id)).toContain('stimulus');
    const [first] = screen.getAllByRole('button', { name: /Picture/ });
    act(() => { fireEvent.click(first); });
    expect(phase.submit).toHaveBeenCalledTimes(1);
    act(() => { phase.stage = 'judging'; view.rerender(ui()); });
    expect(poseOf(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: first.getAttribute('data-pip-object') });
    view.unmount();
    expect(store.getActive()).toBeNull();
  });
});
