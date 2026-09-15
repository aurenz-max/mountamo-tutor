// @vitest-environment jsdom
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, it, vi } from 'vitest';
import BaseTenBlocks, { type BaseTenBlocksData } from '../primitives/visual-primitives/math/BaseTenBlocks';
import { expectClassicWorkspace, mountWithStore } from './testing/classicSurface';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: null as string | null }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {}, app: {} }));
vi.mock('../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }) }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
afterEach(cleanup);

const data: BaseTenBlocksData = {
  title: 'Teen numbers', description: '', numberValue: 12, interactionMode: 'build', maxPlace: 'tens', gradeBand: 'K-1', instanceId: 'blocks',
  challenges: [{ type: 'build_number', instruction: 'Build 12.', targetNumber: 12, hint: 'One ten, two ones.' }],
};

describe('Base-Ten Blocks (click-era modes) share the place value mat with Pip', () => {
  it('keeps the classic workspace contract on the mat', () => {
    expectClassicWorkspace({ mounted: mountWithStore(() => <BaseTenBlocks data={data} />), tutor, instanceId: 'blocks' });
  });
});
