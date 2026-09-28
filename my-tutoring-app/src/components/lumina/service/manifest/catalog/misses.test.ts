/**
 * `teachingWorkspace.misses` across the catalog (handoff 20). The ids themselves are checked by type against each
 * family's miss union (`missLists.ts`); what a type cannot see is checked here: a list keyed by a mode the primitive
 * does not have is never read, so its misses silently go unchecked by the sweep's J8 rule.
 */
import { describe, expect, it } from 'vitest';
import { UNIVERSAL_CATALOG } from './index';

const withMisses = UNIVERSAL_CATALOG.filter(c => c.teachingWorkspace?.misses);

describe('catalog miss lists', () => {
  it('at least the math families declare misses', () => {
    expect(withMisses.length).toBeGreaterThanOrEqual(20);
  });

  it.each(withMisses.map(c => [c.id, c] as const))('%s: every mode is one of its eval modes, every list is named', (_id, c) => {
    const modes = new Set((c.evalModes ?? []).map(m => m.evalMode));
    for (const [mode, ids] of Object.entries(c.teachingWorkspace!.misses!)) {
      expect(modes.has(mode), `"${mode}" is not an eval mode of ${c.id}: ${Array.from(modes).join(', ')}`).toBe(true);
      expect(ids.length, `${c.id}.${mode} lists no misses`).toBeGreaterThan(0);
      for (const id of ids) expect(id).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(new Set(ids).size, `${c.id}.${mode} lists a miss twice`).toBe(ids.length);
    }
  });
});
