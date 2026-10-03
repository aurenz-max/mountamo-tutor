// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import AdditionFactStrategies, { type AdditionFactStrategiesData } from '../primitives/visual-primitives/math/AdditionFactStrategies';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';
import { expectClassicWorkspace, mountWithStore } from './testing/classicSurface';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: 'facts' as string | null }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {}, app: {} }));
// Addition fact strategies runs only on the teaching workspace: Pip is exercised there, and hears the shared context.
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, sessionMode: 'lesson', sendText: vi.fn(), conversation: [],
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} }, ...tutor,
}) }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
afterEach(() => { vi.useRealTimers(); });
beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = 'facts'; });

const data: AdditionFactStrategiesData = {
  title: 'Doubles', description: 'Same and same', challengeType: 'recall', strategy: 'doubles', objectEmoji: '🌸',
  introExample: { a: 3, b: 3 }, instanceId: 'facts',
  challenges: [
    { id: 'afs-1', type: 'doubles', a: 4, b: 4, sum: 8 },
    { id: 'afs-2', type: 'doubles', a: 6, b: 6, sum: 12 },
  ],
};

describe('Addition Fact Strategies shares its answer pad with Pip', () => {
  it('keeps the classic workspace contract on the pad', () => {
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    const mounted = mountWithStore(() => <LiveRuntimeContext.Provider value={runtime}>
      <LiveRuntimeSurface runtime={runtime}>
        <AdditionFactStrategies data={data} runtimePlanItemId="plan-facts" runtimeEvalMode="doubles" />
      </LiveRuntimeSurface>
    </LiveRuntimeContext.Provider>);
    mounted.refresh();
    // The pad is the only target: no number, object, or fact is ever published.
    expectClassicWorkspace({ mounted, tutor, instanceId: 'facts' });
  });
});
