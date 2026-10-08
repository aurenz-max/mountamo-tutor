// @vitest-environment jsdom
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectClassicWorkspace, mountWithStore } from './testing/classicSurface';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';

// The train yard runs only on the teaching workspace, so Pip is exercised there: the runtime owns progression.
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
import TrainYard, { type TrainYardData } from '../primitives/visual-primitives/engineering/TrainYard';
import { buildTrainYardChallenge } from '../primitives/visual-primitives/engineering/trainYardModel';

beforeEach(() => { tutor.isAudioPlaying = false; tutor.activePrimitiveId = null; });
afterEach(cleanup);

const job = (id: string) => buildTrainYardChallenge(
  { title: 'Harvest Rush', cargo: 'grain', cargoForm: 'loose_bulk', from: 'Elevator', to: 'Port', hillName: 'Cedar Hill' },
  { id, band: 'K-2', rng: () => .5 });

describe('Train Yard shares its workspace with Pip', () => {
  it('Pip outlines the whole yard, never a car kind, and watches what the child couples', () => {
    const data: TrainYardData = { title: 'Yard', instanceId: 'yard', description: '', challengeType: 'build_train', gradeBand: 'K-2',
      challenges: [job('a'), job('b')] };
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    const mounted = mountWithStore(() => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
      <TrainYard data={data} runtimePlanItemId="plan-yard" runtimeEvalMode="build_train" />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
    // The only Pip target is the yard as a whole: no car card is a target, so Pip can never point at the answer.
    expect(mounted.container.querySelectorAll('[data-pip-object]')).toHaveLength(1);
    expectClassicWorkspace({ mounted, tutor, instanceId: 'yard' });
  });
});
