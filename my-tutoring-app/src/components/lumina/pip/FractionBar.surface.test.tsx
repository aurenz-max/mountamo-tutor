// @vitest-environment jsdom
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, it, vi } from 'vitest';
import FractionBar from '../primitives/visual-primitives/math/FractionBar';
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

const fraction = (id: string, n: number, d: number) => ({ id, numerator: n, denominator: d,
  numeratorChoices: [n, d, n - 1, d + 1], denominatorChoices: [d, n, d + 1, d + 2] });

describe('Fraction Bar shares its step panels with Pip', () => {
  it('keeps the classic workspace contract on the numerator, denominator and build steps', () => {
    const data = { title: 'Build', description: 'Shade', challengeType: 'build', supportTier: 'medium', showPartitionNumerals: false,
      instanceId: 'bars', challenges: [fraction('f1', 3, 4), fraction('f2', 2, 5)] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expectClassicWorkspace({ mounted: mountWithStore(() => <FractionBar data={data as any} />), tutor, instanceId: 'bars' });
  });
});
