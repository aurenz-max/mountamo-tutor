// @vitest-environment jsdom
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, it, vi } from 'vitest';
import fixtures from './testing/workspaceFixtures.json';
import { expectClassicWorkspace, mountWithStore } from './testing/classicSurface';
import ContextCluesDetective from '../primitives/visual-primitives/literacy/ContextCluesDetective';
import PoetryLab from '../primitives/visual-primitives/literacy/PoetryLab';
import EvidenceFinder from '../primitives/visual-primitives/literacy/EvidenceFinder';
import SpellingPatternExplorer from '../primitives/visual-primitives/literacy/SpellingPatternExplorer';
import StoryMap from '../primitives/visual-primitives/literacy/StoryMap';
import CharacterWeb from '../primitives/visual-primitives/literacy/CharacterWeb';
import ReadingRepairStudio from '../primitives/visual-primitives/literacy/ReadingRepairStudio';

const tutor = vi.hoisted(() => ({ isAudioPlaying: false, activePrimitiveId: null as string | null }));
vi.mock('../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAIResponding: false, ...tutor }) }));
vi.mock('../hooks/useVoiceCapture', () => ({ useVoiceCapture: () => ({ status: 'idle', start: vi.fn(), stop: vi.fn(), cancel: vi.fn() }) }));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0, resetAttempt: vi.fn() }),
  useEvaluationContext: () => null,
}));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
afterEach(() => { cleanup(); Object.assign(tutor, { isAudioPlaying: false, activePrimitiveId: null }); });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrimitive = React.ComponentType<{ data: any }>;
// Components without a tutor hook (`no_ai`) never point; they keep the rest of the contract.
const SPEAKING: Array<[string, AnyPrimitive]> = [
  ['context-clues-detective', ContextCluesDetective],
  ['poetry-lab', PoetryLab], ['reading-repair-studio', ReadingRepairStudio],
];
const SILENT: Array<[string, AnyPrimitive]> = [
  ['evidence-finder', EvidenceFinder], ['spelling-pattern-explorer', SpellingPatternExplorer], ['story-map', StoryMap],
  ['character-web', CharacterWeb],
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (id: string): any => ({ ...(fixtures as Record<string, object>)[id], instanceId: id });

describe('classic literacy primitives share one workspace with Pip', () => {
  it.each(SPEAKING)('%s keeps the workspace contract', (id, Primitive) => {
    expectClassicWorkspace({ mounted: mountWithStore(() => <Primitive data={data(id)} />), tutor, instanceId: id });
  });

  it.each(SILENT)('%s keeps the workspace contract without tutor speech', (id, Primitive) => {
    expectClassicWorkspace({ mounted: mountWithStore(() => <Primitive data={data(id)} />), tutor, instanceId: id, silent: true });
  });
});
