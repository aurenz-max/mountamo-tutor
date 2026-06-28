/**
 * Intent-contract regression test — PRD §6.5, Parts 2 & 3.
 *
 * Part 2 (ledger coverage): asserts every generator in the migrated set is
 * registered AND context-native. Reverting any one to `registerGenerator`
 * re-opens the intent-drop defect class and fails CI here.
 *
 * Part 3 (wrapper production path): proves `registerContextGenerator` actually
 * threads `resolveGenerationContext`, so a context-native generator receives a
 * `ctx.intent` even when intent rides only at `item.intent` (the production shape
 * `/eval-test` masks). Part 1 validates the resolver in isolation; this confirms
 * the wrapper invokes it.
 *
 * Loading the registry pulls in the production import graph (geminiClient →
 * `server-only` + `GEMINI_API_KEY`). vitest.config.ts aliases `server-only` to a
 * stub and vitest.setup.ts supplies a dummy key, so this import is network/env-free.
 */

import { describe, expect, it } from 'vitest';
import type { ComponentId } from '../../types';
import type { GenerationContext } from '../generation/generationContext';
// Side-effect import: registers every generator with the ContentRegistry.
import '../registry/generators';
import {
  getGenerator,
  hasGenerator,
  isContextNative,
  registerContextGenerator,
} from './contentRegistry';

/**
 * The migrated context-native set as of 2026-06-27.
 *
 * KEEP IN SYNC: when a future batch migrates more generators to
 * `registerContextGenerator`, add their ids here so the contract stays guarded.
 * (New entries are also covered implicitly — `isContextNative` reflects the live
 * ledger — but the explicit list is what makes a *regression* visible.)
 *
 * Typed as `ComponentId[]`: a typo'd or removed id fails tsc, not just the test.
 */
const MIGRATED_CONTEXT_NATIVE: ComponentId[] = [
  // pilot
  'number-tracer',
  // math (full ctx)
  'skip-counting-runner',
  'multiplication-explorer',
  'math-fact-fluency',
  'shape-builder',
  'ten-frame',
  'counting-board',
  'number-sequencer',
  'addition-subtraction-scene',
  'bar-model',
  'number-line',
  'base-ten-blocks',
  'fraction-circles',
  // chemistry (full ctx)
  'stoichiometry-lab',
  'gas-laws-simulator',
  'matter-explorer',
  'reaction-lab',
  'states-of-matter',
  'atom-builder',
  'molecule-constructor',
  // core narrative (registry-adapter)
  'concept-card-grid',
  'feature-exhibit',
  'comparison-panel',
  'generative-table',
  'graph-board',
  'scale-spectrum',
  'formula-card',
  'image-panel',
  'take-home-activity',
  'interactive-passage',
  'word-builder',
  'math-visual',
  'custom-visual',
  'sentence-analyzer',
];

describe('context-native ledger coverage (PRD §6.5, Part 2)', () => {
  it('covers the full migrated set of 34 generators', () => {
    expect(MIGRATED_CONTEXT_NATIVE).toHaveLength(34);
    expect(new Set(MIGRATED_CONTEXT_NATIVE).size).toBe(34); // no duplicates
  });

  it.each(MIGRATED_CONTEXT_NATIVE)('"%s" is registered', (id) => {
    expect(hasGenerator(id)).toBe(true);
  });

  it.each(MIGRATED_CONTEXT_NATIVE)('"%s" is context-native (not reverted to registerGenerator)', (id) => {
    expect(isContextNative(id)).toBe(true);
  });
});

describe('registerContextGenerator threads resolveGenerationContext (PRD §6.5, Part 3)', () => {
  it('invokes the callback with a ctx whose intent is defined when item.intent is set', async () => {
    let captured: GenerationContext | null = null;
    // Throwaway id — never executes a real generator, so no Gemini is needed.
    const SPY_ID = '__intent-probe-spy__' as ComponentId;

    registerContextGenerator(SPY_ID, async (ctx) => {
      captured = ctx;
      return null;
    });

    const wrapped = getGenerator(SPY_ID);
    expect(wrapped).toBeDefined();

    // Production shape: intent rides at item.intent, NOT in config — the case
    // eval-test never produces.
    await wrapped!(
      { componentId: SPY_ID, instanceId: 'spy-1', intent: 'top-level intent only' },
      'Some Topic',
      'grade-appropriate context',
      'grade-1',
    );

    expect(captured).not.toBeNull();
    expect(captured!.intent).toBe('top-level intent only');
    expect(captured!.topic).toBe('Some Topic');
    expect(isContextNative(SPY_ID)).toBe(true);
  });
});
