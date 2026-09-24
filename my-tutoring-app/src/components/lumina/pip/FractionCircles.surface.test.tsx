// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { expectClassicWorkspace, mountWithStore, poseOf } from './testing/classicSurface';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// Fraction circles run only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: null as string | null }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', conversation: [], sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../components/PhaseSummaryPanel', () => ({ default: () => <p>Done</p> }));
import FractionCircles, { type FractionCirclesChallenge, type FractionCirclesData } from '../primitives/visual-primitives/math/FractionCircles';

beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = null; });
afterEach(cleanup);

const compare = (id: string, a: [number, number], b: [number, number]): FractionCirclesChallenge => ({
  id, type: 'compare', numerator: a[0], denominator: a[1], compareFraction: { numerator: b[0], denominator: b[1] },
  instruction: 'Compare.', hint: 'Look', narration: '', showFractionLabels: false, supportTier: 'medium',
});

/** The primitive inside a live runtime, bound by its pin, as a lesson mounts it. */
function bound(data: FractionCirclesData, evalMode: string) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  return () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <FractionCircles data={data} runtimePlanItemId="plan-circles" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
}

describe('Fraction Circles shares its workspace with Pip', () => {
  it('click modes keep the classic workspace contract', () => {
    const data = { title: 'Compare', instanceId: 'circles', challenges: [compare('a', [1, 4], [1, 8]), compare('b', [2, 6], [2, 3])] };
    expectClassicWorkspace({ mounted: mountWithStore(bound(data, 'compare')), tutor, instanceId: 'circles' });
  });

  it('touch-a-fraction outlines the pictures as a group and watches the one the child touches', () => {
    const store = new PipSurfaceStore();
    const data = { title: 'Touch', instanceId: 'touch', challenges: [{ id: 't', type: 'touch_fraction' as const, numerator: 1, denominator: 3, instruction: '', hint: '', narration: '' }] };
    const inner = bound(data, 'touch_fraction');
    const ui = () => <PipSurfaceContext.Provider value={store}>{inner()}</PipSurfaceContext.Provider>;
    const view = render(ui());
    expect(store.getActive()?.targets.map((t) => t.id)).toContain('stimulus');
    // A wrong picture (the pictures are shuffled per mount): the checked miss stays on screen and Pip keeps watching it.
    const wrong = screen.getAllByRole('button', { name: /Picture/ }).find((b) => b.getAttribute('data-pip-object') !== 'picture-1-of-3')!;
    act(() => { fireEvent.click(wrong); });
    act(() => { view.rerender(ui()); });
    expect(poseOf(store)).toEqual({ phase: 'working', gesture: 'look', targetId: wrong.getAttribute('data-pip-object') });
    view.unmount();
    expect(store.getActive()).toBeNull();
  });
});
