import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compileDisplay } from './compile';
import { displayDocument } from './document';
import { getTemplate, recordUse, requestDisplay, resolveParams, saveTemplate, searchTemplates } from './library';
import { FORBIDDEN_SOURCE, LINES_PARAMS, LINES_PROBES, LINES_SOURCE } from './fixtures';
import { buildDisplayBlock } from '../core/deep-dive-agent/displays';
import type { DisplayTemplate } from './types';

describe('compileDisplay', () => {
  it('compiles a kit display and rejects imports, network and a missing Display', () => {
    expect(compileDisplay(LINES_SOURCE).ok).toBe(true);
    const bad = compileDisplay(FORBIDDEN_SOURCE);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join()).toMatch(/no import[^]*no network/);
    const none = compileDisplay('const x = 1;');
    if (!none.ok) expect(none.errors.join()).toMatch(/function Display/);
    const shadow = compileDisplay('function Display() { const Slider = 1; return null; }');
    if (!shadow.ok) expect(shadow.errors.join()).toMatch(/redeclare kit names: Slider/);
  });

  it('builds a page that cannot end its own script tag early', () => {
    const c = compileDisplay('function Display() { return <Text>{"</script><b>x</b>"}</Text>; }');
    if (!c.ok) throw new Error(c.errors.join());
    const html = displayDocument(c.js, {});
    expect(html).toContain("default-src 'none'");
    expect(html.match(/<\/script>/g)?.length).toBe(4);
  });
});

describe('display library', () => {
  let dir: string;
  const template: DisplayTemplate = {
    id: 'two-lines-meet-test', title: 'When do two lines meet?', idea: 'Two lines with different slopes meet at exactly one point; equal slopes never meet unless they are the same line.',
    tags: ['linear equations', 'slope', 'systems of equations', 'grades 7-9'], source: LINES_SOURCE, params: LINES_PARAMS, probes: LINES_PROBES,
    createdAt: '2026-11-04T00:00:00Z', uses: 0,
  };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'gen-display-'));
    process.env.LUMINA_GEN_DISPLAY_DIR = dir;
    saveTemplate(template);
  });
  afterAll(() => { delete process.env.LUMINA_GEN_DISPLAY_DIR; rmSync(dir, { recursive: true, force: true }); });

  it('finds a template by shared words and counts its uses', () => {
    expect(searchTemplates('Solving systems of linear equations').map((t) => t.id)).toEqual(['two-lines-meet-test']);
    expect(searchTemplates('Why leaves change color')).toEqual([]);
    recordUse('two-lines-meet-test');
    expect(getTemplate('two-lines-meet-test')?.uses).toBe(1);
    expect(getTemplate('../etc/passwd')).toBeUndefined();
    requestDisplay({ topic: 't', gradeLevel: 'g', idea: 'i', interaction: 'x', why: 'y' });
  });

  it('checks lesson params against the template and fills the rest from validated defaults', () => {
    const r = resolveParams(LINES_PARAMS, { fixedSlope: 3 });
    expect('values' in r && r.values).toMatchObject({ fixedSlope: 3, fixedIntercept: -1 });
    expect(resolveParams(LINES_PARAMS, { fixedSlope: 'three' })).toEqual({ error: 'param "fixedSlope" must be number' });
    expect(resolveParams(LINES_PARAMS, { speed: 1 })).toEqual({ error: 'unknown params: speed' });
  });

  it('builds a DeepDive display block from a template and lesson params', () => {
    const base = { id: '', label: 'Where lines meet' };
    const block = buildDisplayBlock(template, [{ name: 'fixedSlope', valueJson: '3' }], base);
    if ('error' in block) throw new Error(block.error);
    expect(block.blockType).toBe('display');
    expect(block.html).toContain('"fixedSlope":3');
    expect(buildDisplayBlock(template, [{ name: 'fixedSlope', valueJson: '"x"' }], base)).toEqual({ error: 'param "fixedSlope" must be number' });
  });
});
