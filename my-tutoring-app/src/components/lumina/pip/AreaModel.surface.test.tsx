// @vitest-environment jsdom
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, it, vi } from 'vitest';
import AreaModel from '../primitives/visual-primitives/math/AreaModel';
import { expectClassicWorkspace, mountWithStore } from './testing/classicSurface';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: null as string | null }));
vi.mock('../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, ...tutor }) }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
afterEach(cleanup);

const challenge = (id: string, factor1Parts: number[], factor2Parts: number[]) => ({ id, factor1Parts, factor2Parts,
  showPartialProducts: false, showDimensions: true, algebraicMode: false, highlightCell: null, showCellEquations: true });

describe('Area Model shares its grid and inputs with Pip', () => {
  it('keeps the classic workspace contract on the model', () => {
    const data = { title: 'Multiply', description: 'Area model', challengeType: 'find_area', supportTier: 'medium', instanceId: 'area',
      challenges: [challenge('a1', [30, 4], [40, 3]), challenge('a2', [20, 5], [30, 6])] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expectClassicWorkspace({ mounted: mountWithStore(() => <AreaModel data={data as any} />), tutor, instanceId: 'area' });
  });
});
