import { describe, expect, it } from 'vitest';
import { resolveCellBuilderPhases } from '../cellBuilderWorkspace';

// The render tests moved to CellBuilder.workspace.test.tsx (bound mounts) when the scripted path was deleted
// (2026-10-18); the pure mission rule stays here.
describe('CellBuilder mode contract', () => {
  it('runs every mission when none is pinned, and honors pinned and blended missions in canonical order', () => {
    expect(resolveCellBuilderPhases({})).toEqual([
      'cell_inventory',
      'organelle_placement',
      'structure_function',
      'cell_specialization',
    ]);
    expect(resolveCellBuilderPhases({ challengeType: 'structure_function' })).toEqual(['structure_function']);
    expect(resolveCellBuilderPhases({ challengeTypes: ['cell_specialization', 'cell_inventory'] })).toEqual([
      'cell_inventory',
      'cell_specialization',
    ]);
  });
});
