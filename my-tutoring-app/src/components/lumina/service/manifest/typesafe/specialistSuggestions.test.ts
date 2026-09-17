/**
 * Failsafe contract for the optional TypeSafe suggestion block: whatever the
 * ranker does — missing key, throwing, hanging — manifest generation gets a
 * value back inside the budget and the prompt block renders empty.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const selectPrimitives = vi.fn();
const typesafeConfigured = vi.fn(() => true);

vi.mock('./selectPrimitives', () => ({
  POLICY_SCAFFOLD_IDS: new Set(['knowledge-check', 'concept-card-grid']),
  selectPrimitives: (...args: unknown[]) => selectPrimitives(...args),
  suggestSpecialists: (r: { shortlist: Array<{ id: string; fit: number; mode: string | null }> }, opts: { minFit?: number; max?: number; excludeIds?: Set<string> } = {}) =>
    r.shortlist
      .filter((s) => s.fit >= (opts.minFit ?? 1.5) && !(opts.excludeIds?.has(s.id) ?? false))
      .slice(0, opts.max ?? 4)
      .map((s) => ({ id: s.id, fit: s.fit, mode: s.mode })),
}));
vi.mock('./typesafeClient', () => ({ typesafeConfigured: () => typesafeConfigured() }));

import { _resetSuggestionBreaker, fetchSpecialistSuggestions, suggestionArmFromEnv } from './specialistSuggestions';
import { buildSpecialistSuggestionsBlock } from '../gemini-manifest';

const objectives = [
  { id: 'obj1', text: 'Model two-digit numbers with tens rods and ones', grade: '2' },
  { id: 'obj2', text: 'Add tens to tens and ones to ones', grade: '2' },
];
const goodResult = {
  shortlist: [
    { id: 'base-ten-blocks', fit: 2.7, mode: 'build_number' },
    { id: 'knowledge-check', fit: 2.4, mode: 'apply' },
    { id: 'regrouping-workbench', fit: 1.9, mode: 'add_no_regroup' },
  ],
  roles: [{ role: 'apply', id: 'base-ten-blocks', p: 0.9 }],
};

beforeEach(() => {
  _resetSuggestionBreaker();
  selectPrimitives.mockReset();
  typesafeConfigured.mockReturnValue(true);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.LUMINA_TYPESAFE_SUGGESTIONS;
});

describe('suggestionArmFromEnv', () => {
  it('reads off as default and only accepts strict | loose', () => {
    expect(suggestionArmFromEnv()).toBeNull();
    process.env.LUMINA_TYPESAFE_SUGGESTIONS = 'strict';
    expect(suggestionArmFromEnv()).toBe('strict');
    process.env.LUMINA_TYPESAFE_SUGGESTIONS = ' Loose ';
    expect(suggestionArmFromEnv()).toBe('loose');
    process.env.LUMINA_TYPESAFE_SUGGESTIONS = 'on';
    expect(suggestionArmFromEnv()).toBeNull();
  });
});

describe('fetchSpecialistSuggestions failsafe', () => {
  it('strict preset keeps strong fits and drops policy scaffolds', async () => {
    selectPrimitives.mockResolvedValue(goodResult);
    const run = await fetchSpecialistSuggestions('topic', 'elementary', objectives, 'strict');
    expect(run.error).toBeUndefined();
    expect(run.perObjective).toHaveLength(2);
    expect(run.perObjective[0].candidates.map((c) => c.id)).toEqual(['base-ten-blocks']);
    // The block numbers candidates like the objectives list.
    const block = buildSpecialistSuggestionsBlock(objectives, run.perObjective);
    expect(block).toContain('1. base-ten-blocks (2.7)');
    expect(block).toContain('2. base-ten-blocks (2.7)');
  });

  it('renders no block and makes no call when the key is missing', async () => {
    typesafeConfigured.mockReturnValue(false);
    const run = await fetchSpecialistSuggestions('topic', 'elementary', objectives, 'strict');
    expect(selectPrimitives).not.toHaveBeenCalled();
    expect(run.error).toMatch(/TYPESAFE_API_KEY/);
    expect(buildSpecialistSuggestionsBlock(objectives, run.perObjective)).toBe('');
  });

  it('a throwing ranker yields empty candidates for that objective, never a throw', async () => {
    selectPrimitives.mockRejectedValueOnce(new Error('HTTP 529')).mockResolvedValueOnce(goodResult);
    const run = await fetchSpecialistSuggestions('topic', 'elementary', objectives, 'strict');
    expect(run.error).toBeUndefined();
    expect(run.perObjective[0].candidates).toEqual([]);
    expect(run.perObjective[0].error).toBe('HTTP 529');
    expect(run.perObjective[1].candidates).toHaveLength(1);
  });

  it('a hanging ranker is cut at the budget and renders no block', async () => {
    selectPrimitives.mockImplementation(
      (input: { signal: AbortSignal }) =>
        new Promise((_, reject) => input.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const t0 = Date.now();
    const run = await fetchSpecialistSuggestions('topic', 'elementary', objectives, 'strict', { timeoutMs: 50 });
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(run.error).toMatch(/timed out after 50 ms/);
    expect(buildSpecialistSuggestionsBlock(objectives, run.perObjective)).toBe('');
  });

  it('opens the breaker after three total failures and skips without calling', async () => {
    selectPrimitives.mockRejectedValue(new Error('down'));
    for (let i = 0; i < 3; i++) await fetchSpecialistSuggestions('topic', 'elementary', objectives, 'loose');
    expect(selectPrimitives).toHaveBeenCalledTimes(6);
    const run = await fetchSpecialistSuggestions('topic', 'elementary', objectives, 'loose');
    expect(selectPrimitives).toHaveBeenCalledTimes(6);
    expect(run.error).toMatch(/circuit open/);
    expect(run.perObjective).toEqual([]);
  });

  it('with no objectives it does nothing', async () => {
    const run = await fetchSpecialistSuggestions('topic', 'elementary', [], 'strict');
    expect(selectPrimitives).not.toHaveBeenCalled();
    expect(buildSpecialistSuggestionsBlock([], run.perObjective)).toBe('');
  });
});
