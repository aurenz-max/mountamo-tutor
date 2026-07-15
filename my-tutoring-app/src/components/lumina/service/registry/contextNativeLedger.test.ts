/**
 * Intent-contract regression tests for the registry boundary.
 *
 * Every production generator must receive the resolved GenerationContext. This
 * makes per-component intent/objective delivery a system invariant instead of a
 * manually maintained migration list.
 */

import { describe, expect, it } from 'vitest';
import type { ComponentId } from '../../types';
import type { GenerationContext } from '../generation/generationContext';
// Side-effect import: registers every generator with the ContentRegistry.
import '../registry/generators';
import {
  getGenerator,
  getRegisteredIds,
  isContextNative,
  registerContextGenerator,
} from './contentRegistry';

describe('context-native ledger coverage', () => {
  it('keeps every registered generator on the resolved GenerationContext contract', () => {
    const registered = getRegisteredIds();

    // Catch an accidentally missing registration module without forcing exact-count
    // maintenance whenever a new primitive is added.
    expect(registered.length).toBeGreaterThanOrEqual(190);
    expect(registered.filter((id) => !isContextNative(id))).toEqual([]);
  });
});

describe('registerContextGenerator threads resolveGenerationContext', () => {
  it('invokes the callback with a resolved intent when item.intent is set', async () => {
    let captured: GenerationContext | null = null;
    const SPY_ID = '__intent-probe-spy__' as ComponentId;

    registerContextGenerator(SPY_ID, async (ctx) => {
      captured = ctx;
      return null;
    });

    const wrapped = getGenerator(SPY_ID);
    expect(wrapped).toBeDefined();

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
