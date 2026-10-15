// @vitest-environment jsdom
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectClassicWorkspace, mountWithStore } from './testing/classicSurface';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// The jet runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: null as string | null }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', conversation: [], sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../components/PhaseSummaryPanel', () => ({ default: () => <p>Done</p> }));
// WebGL is not available here; the stub stands in for the canvas the child touches.
vi.mock('../primitives/visual-primitives/engineering/AirplaneScene', () => ({
  default: () => <div data-airplane-scene="stub"><button type="button">jet</button></div>,
}));
import AirplaneDiorama, { type AirplaneDioramaData } from '../primitives/visual-primitives/engineering/AirplaneDiorama';
import { buildAirplaneChallenge } from '../primitives/visual-primitives/engineering/airplaneModel';

beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = null; });
afterEach(cleanup);

describe('Airplane diorama shares its workspace with Pip', () => {
  it('Pip outlines the whole jet, never a part (finding the part is the task)', () => {
    const data: AirplaneDioramaData = { title: 'Jet', instanceId: 'jet', description: '', challengeType: 'find_part', gradeBand: 'K-2',
      airlineName: 'Bluebird', challenges: [buildAirplaneChallenge('wings', { id: 'a', band: 'K-2' }), buildAirplaneChallenge('tail', { id: 'b', band: 'K-2' })] };
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    const mounted = mountWithStore(() => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
      <AirplaneDiorama data={data} runtimePlanItemId="plan-jet" runtimeEvalMode="find_part" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
    expect(mounted.container.querySelectorAll('[data-pip-object]')).toHaveLength(1);
    expectClassicWorkspace({ mounted, tutor, instanceId: 'jet' });
  });
});
