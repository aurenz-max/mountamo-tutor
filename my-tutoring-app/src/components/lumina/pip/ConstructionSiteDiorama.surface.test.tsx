// @vitest-environment jsdom
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectClassicWorkspace, mountWithStore } from './testing/classicSurface';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// The work site runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
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
vi.mock('../primitives/visual-primitives/engineering/ConstructionScene', () => ({
  default: () => <div data-construction-scene="stub"><button type="button">site</button></div>,
}));
import ConstructionSiteDiorama, { type ConstructionSiteDioramaData } from '../primitives/visual-primitives/engineering/ConstructionSiteDiorama';
import { buildLoadChallenge } from '../primitives/visual-primitives/engineering/constructionModel';

beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = null; });
afterEach(cleanup);

describe('Construction site diorama shares its workspace with Pip', () => {
  it('Pip outlines the whole site, never the truck bed (counting the load is the task)', () => {
    const data: ConstructionSiteDioramaData = { title: 'Site', instanceId: 'site', description: '', challengeType: 'load_truck',
      gradeBand: 'K-2', companyName: 'Big Dig', challenges: [
        buildLoadChallenge({ units: 'scoops', material: 'dirt', target: 3 }, 'the park', 'a'),
        buildLoadChallenge({ units: 'scoops', material: 'sand', target: 5 }, 'the pond', 'b'),
      ] };
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    const mounted = mountWithStore(() => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
      <ConstructionSiteDiorama data={data} runtimePlanItemId="plan-site" runtimeEvalMode="load_truck" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
    expect(mounted.container.querySelectorAll('[data-pip-object]')).toHaveLength(1);
    expectClassicWorkspace({ mounted, tutor, instanceId: 'site' });
  });
});
