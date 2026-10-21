// @vitest-environment jsdom
/**
 * Within-mode SUPPORT TIER verification for spelling-pattern-explorer, mounted the way a lesson mounts it (the
 * teaching workspace is the only path). The tier is display withdrawal before spelling starts; content is the same:
 *   L1 pattern-reveal panel      shown (easy/legacy) → HIDDEN (medium/hard)
 *   L2 word-tile highlights      all → first 3 worked examples → none
 *   L3 ruleTemplate display      shown → shown → HIDDEN
 * Keep-trues: the "What pattern do they share?" prompt renders at every tier; the word's hint button is never
 * tier-gated. (The scripted path's live glow and "show" reveal went with that path: the check is the commit.)
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../../components/live-activity/runtime/testing/workspaceHarness';
import type { SpellingPatternExplorerData } from '../SpellingPatternExplorer';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const RULE_TEMPLATE = 'When a word ends in -ake, the a says ___';
type Tier = SpellingPatternExplorerData['supportTier'];

const makeData = (supportTier?: Tier): SpellingPatternExplorerData => ({
  title: 'Magic E Lab', gradeLevel: '2', patternType: 'long-vowel',
  patternWords: ['cake', 'lake', 'bake', 'make', 'take', 'rake'],
  highlightPattern: 'ake', ruleTemplate: RULE_TEMPLATE,
  correctRule: 'The silent e makes the a say its long name.',
  dictationWords: ['snake', 'flake', 'brake', 'shake'],
  dictationHints: ['a slithering reptile', 'one bit of falling snow', 'it stops the car', 'wiggle quickly side to side'],
  ...(supportTier ? { supportTier } : {}),
});

const mount = (tier?: Tier) =>
  mountWorkspace({ primitiveId: 'spelling-pattern-explorer', evalMode: 'long_vowel', data: makeData(tier) as never });
/** Highlighted-pattern spans: each highlighted tile renders a span whose exact text is "ake"; the panel adds one. */
const highlighted = (h: WorkspaceHarness) => h.view.queryAllByText('ake').length;
const toRule = (h: WorkspaceHarness) => h.press(/I see the pattern/);
const toApply = (h: WorkspaceHarness) => {
  toRule(h);
  act(() => { fireEvent.change(h.view.getByLabelText('Your spelling rule'), { target: { value: 'The silent e says the name.' } }); });
  h.press(/Next: Apply the Rule/);
};

describe('L1 panel + L2 highlights (observe)', () => {
  it.each([[undefined], ['easy']] as [Tier][])('%s shows the reveal panel and highlights every word', tier => {
    const h = mount(tier);
    expect(h.view.getByText(/^Pattern:/)).toBeTruthy();
    expect(highlighted(h)).toBe(7);
    h.close();
  });

  it('medium HIDES the reveal panel and keeps only the first 3 worked-example highlights', () => {
    const h = mount('medium');
    expect(h.view.queryByText(/^Pattern:/)).toBeNull();
    expect(highlighted(h)).toBe(3);
    for (const w of ['make', 'take', 'rake']) expect(h.view.getByText(w)).toBeTruthy();
    h.close();
  });

  it('hard HIDES the panel and every highlight: the student induces the pattern', () => {
    const h = mount('hard');
    expect(h.view.queryByText(/^Pattern:/)).toBeNull();
    expect(highlighted(h)).toBe(0);
    for (const w of ['cake', 'lake', 'bake', 'make', 'take', 'rake']) expect(h.view.getByText(w)).toBeTruthy();
    h.close();
  });

  it.each([[undefined], ['easy'], ['medium'], ['hard']] as [Tier][])('%s keeps the "What pattern do they share?" prompt', tier => {
    const h = mount(tier);
    expect(h.view.getByText('Look at these words. What pattern do they share?')).toBeTruthy();
    h.close();
  });
});

describe('L3 ruleTemplate (rule phase)', () => {
  it.each([[undefined], ['easy'], ['medium']] as [Tier][])('%s shows the fill-in-the-blank template', tier => {
    const h = mount(tier);
    toRule(h);
    expect(h.view.getByText(RULE_TEMPLATE)).toBeTruthy();
    h.close();
  });

  it('hard HIDES the template: the student states the rule unaided', () => {
    const h = mount('hard');
    toRule(h);
    expect(h.view.queryByText(RULE_TEMPLATE)).toBeNull();
    expect(h.view.getByPlaceholderText('Write the spelling rule in your own words...')).toBeTruthy();
    h.close();
  });
});

describe('the word\'s hint is never withdrawn', () => {
  it.each([[undefined], ['easy'], ['medium'], ['hard']] as [Tier][])('%s offers the hint on the word being spelled', tier => {
    const h = mount(tier);
    toApply(h);
    h.press('hint');
    expect(h.view.getByText('a slithering reptile')).toBeTruthy();
    h.close();
  });
});
