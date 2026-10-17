// @vitest-environment jsdom
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectClassicWorkspace, mountWithStore } from './testing/classicSurface';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// The island tank runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
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
vi.mock('../primitives/visual-primitives/biology/EcosystemScene', () => ({
  default: () => <div data-ecosystem-scene="stub"><button type="button">tank</button></div>,
}));
import EcosystemDiorama, { type EcosystemDioramaData } from '../primitives/visual-primitives/biology/EcosystemDiorama';
import { SUN_TEST_PAIRS, buildSunTest } from '../primitives/visual-primitives/biology/ecosystemModel';

beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = null; });
afterEach(cleanup);

describe('Ecosystem diorama shares its workspace with Pip', () => {
  it('Pip outlines the whole tank, never one thing on test (reading which got warmer is the task)', () => {
    const data: EcosystemDioramaData = { title: 'Tank', instanceId: 'tank', description: '', challengeType: 'sun_test',
      gradeBand: 'K-2', islandName: 'Turtle Island', challenges: [
        buildSunTest(SUN_TEST_PAIRS[0], false, 'a'), buildSunTest(SUN_TEST_PAIRS[3], true, 'b'),
      ] };
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    const mounted = mountWithStore(() => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
      <EcosystemDiorama data={data} runtimePlanItemId="plan-tank" runtimeEvalMode="sun_test" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
    expect(mounted.container.querySelectorAll('[data-pip-object]')).toHaveLength(1);
    expectClassicWorkspace({ mounted, tutor, instanceId: 'tank' });
  });
});
