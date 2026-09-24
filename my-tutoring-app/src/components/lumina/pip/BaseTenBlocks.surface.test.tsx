// @vitest-environment jsdom
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';
import { expectClassicWorkspace, mountWithStore } from './testing/classicSurface';

// Base-ten blocks runs only on the teaching workspace, so Pip is exercised there.
const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: null as string | null }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {}, app: {} }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', conversation: [], sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
import BaseTenBlocks, { type BaseTenBlocksData } from '../primitives/visual-primitives/math/BaseTenBlocks';
afterEach(cleanup);

const data: BaseTenBlocksData = {
  title: 'Teen numbers', description: '', numberValue: 12, interactionMode: 'build', maxPlace: 'tens', gradeBand: 'K-1', instanceId: 'blocks',
  challenges: [{ type: 'build_number', instruction: 'Build 12.', targetNumber: 12, hint: 'One ten, two ones.' }],
};

describe('Base-Ten Blocks (click mat) shares the place value mat with Pip', () => {
  it('keeps the classic workspace contract on the mat', () => {
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    expectClassicWorkspace({
      mounted: mountWithStore(() => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
        <BaseTenBlocks data={data} runtimePlanItemId="plan-blocks" runtimeEvalMode="build_number" />
      </LiveRuntimeSurface></LiveRuntimeContext.Provider>),
      tutor, instanceId: 'blocks',
    });
  });
});
