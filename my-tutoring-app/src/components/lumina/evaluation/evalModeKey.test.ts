import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOGS_BY_DOMAIN, UNIVERSAL_CATALOG } from '../service/manifest/catalog';
import { resetEvalModeWarnings, resolveSubmittedEvalMode, singleManifestMode, warnUnresolvedEvalMode } from './evalModeKey';

afterEach(() => { resetEvalModeWarnings(); vi.restoreAllMocks(); });

describe('resolveSubmittedEvalMode', () => {
  it('rule 1: a single-key manifest pin that is a catalog mode wins over the component report', () => {
    expect(resolveSubmittedEvalMode('ten-frame', 'add', 'operate')).toEqual({ evalMode: 'operate', rule: 'manifest' });
    expect(resolveSubmittedEvalMode('ten-frame', 'subitize', 'operate')).toEqual({ evalMode: 'operate', rule: 'manifest' });
    // A blend or mixed pin names no single skill; a pin that is not a catalog mode is ignored.
    expect(resolveSubmittedEvalMode('ten-frame', 'subitize', 'operate|subitize').evalMode).toBe('subitize');
    expect(resolveSubmittedEvalMode('ten-frame', 'subitize', 'mixed').evalMode).toBe('subitize');
    expect(resolveSubmittedEvalMode('ten-frame', 'subitize', 'no_such_mode')).toEqual({ evalMode: 'subitize', rule: 'catalog' });
    expect([singleManifestMode('operate'), singleManifestMode('a|b'), singleManifestMode('mixed'), singleManifestMode(undefined), singleManifestMode(' ')])
      .toEqual(['operate', undefined, undefined, undefined, undefined]);
  });

  it('rule 2: a reported catalog mode is kept', () => {
    expect(resolveSubmittedEvalMode('counting-board', 'count')).toEqual({ evalMode: 'count', rule: 'catalog' });
    expect(resolveSubmittedEvalMode('number-line', 'jump')).toEqual({ evalMode: 'jump', rule: 'catalog' });
  });

  it('rule 3: a challenge type listed under exactly one mode becomes that mode (CNB-3, TF-6)', () => {
    expect(resolveSubmittedEvalMode('counting-board', 'count_all')).toEqual({ evalMode: 'count', rule: 'challenge-type' });
    expect(resolveSubmittedEvalMode('counting-board', 'group_count')).toEqual({ evalMode: 'group', rule: 'challenge-type' });
    expect(resolveSubmittedEvalMode('ten-frame', 'add')).toEqual({ evalMode: 'operate', rule: 'challenge-type' });
    expect(resolveSubmittedEvalMode('ten-frame', 'split')).toEqual({ evalMode: 'decompose', rule: 'challenge-type' });
    expect(resolveSubmittedEvalMode('number-line', 'show_jump')).toEqual({ evalMode: 'jump', rule: 'challenge-type' });
  });

  it('rule 4: anything else is kept, ambiguity is reported, and development warns once', () => {
    // knowledge-check lists multiple_choice under several modes.
    const kc = resolveSubmittedEvalMode('knowledge-check', 'multiple_choice');
    expect(kc.rule).toBe('kept');
    expect(kc.evalMode).toBe('multiple_choice');
    expect(kc.ambiguous!.length).toBeGreaterThan(1);
    expect(resolveSubmittedEvalMode('ten-frame', 'default')).toEqual({ evalMode: 'default', rule: 'kept' });
    expect(resolveSubmittedEvalMode('no-such-primitive', 'x')).toEqual({ evalMode: 'x', rule: 'kept' });
    expect(resolveSubmittedEvalMode('ten-frame', undefined)).toEqual({ evalMode: undefined, rule: 'none' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnUnresolvedEvalMode('ten-frame', resolveSubmittedEvalMode('ten-frame', 'default'));
    warnUnresolvedEvalMode('ten-frame', resolveSubmittedEvalMode('ten-frame', 'default'));
    warnUnresolvedEvalMode('ten-frame', resolveSubmittedEvalMode('ten-frame', 'operate'));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('ten-frame submitted "default"');
  });

  it('table: every catalog challenge type resolves to its mode or is reported ambiguous', () => {
    const ambiguous: string[] = [];
    let checked = 0;
    const seen = new Set<string>();
    const catalog = [...UNIVERSAL_CATALOG, ...Object.values(CATALOGS_BY_DOMAIN).flat()].filter((e) => !seen.has(e.id) && seen.add(e.id));
    for (const entry of catalog) {
      const modes = (entry.evalModes ?? []) as Array<{ evalMode: string; challengeTypes?: readonly string[] }>;
      for (const mode of modes) {
        for (const type of mode.challengeTypes ?? []) {
          checked += 1;
          const resolved = resolveSubmittedEvalMode(entry.id, type);
          const owners = modes.filter((m) => (m.challengeTypes ?? []).includes(type)).map((m) => m.evalMode);
          if (owners.length === 1 || modes.some((m) => m.evalMode === type)) {
            // A type that is also a mode name resolves by rule 2; otherwise by rule 3 to its one owner.
            expect(resolved.evalMode, `${entry.id}/${type}`).toBe(modes.some((m) => m.evalMode === type) ? type : owners[0]);
          } else {
            expect(resolved, `${entry.id}/${type}`).toMatchObject({ rule: 'kept', evalMode: type });
            ambiguous.push(`${entry.id}/${type} → ${owners.join('|')}`);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
    // The ambiguous set is the catalog's, not the resolver's: a challenge type that several modes share cannot
    // name one skill, so it is kept as reported (knowledge-check's multiple_choice is the known case).
    expect(new Set(ambiguous.map((a) => a.split('/')[0]))).toContain('knowledge-check');
    expect(ambiguous.every((a) => resolveSubmittedEvalMode(a.split('/')[0], a.split('/')[1].split(' ')[0]).rule === 'kept')).toBe(true);
  });
});
