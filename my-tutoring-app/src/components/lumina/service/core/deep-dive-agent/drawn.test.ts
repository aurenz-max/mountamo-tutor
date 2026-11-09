import { describe, expect, it } from 'vitest';
import { blockIssues, blockTools, buildBlock, visibleText, type BlockContext } from './blocks';
import { drawnSvg, isDrawn, pinKey } from './drawn';
import { gradeDrawnLabels, viewBoxOf } from '../../../primitives/visual-primitives/core/deep-dive/blocks/drawnDiagram';
import type { DeepDiveBlock, DiagramBlockData, FigureBlockData } from '../../../primitives/visual-primitives/core/deep-dive/types';

const ctx: BlockContext = { evalMode: 'apply', preReader: false, grade: 4 };
const common = { label: 'Parts', tutoringBrief: 'Look.', transitionCue: 'Next.', section: 1, ideas: ['1.1'] };
const svg = `<svg viewBox='0 0 400 200'><circle cx='100' cy='100' r='40'/><rect x='250' y='50' width='100' height='100'/></svg>`;
const labels = [
  { text: 'petal', description: 'Bright part.', x: 100, y: 100 },
  { text: 'stamen', description: 'Makes pollen.', x: 300, y: 100 },
  { text: 'sepal', description: 'Protects.', x: 200, y: 20 },
  { text: 'pistil', description: 'Holds the egg.', x: 200, y: 180 },
];
const args = { ...common, svg, caption: 'A flower.', altText: 'A flower in parts.', learningObjective: 'Name the parts.', labels };
const built = <T extends DeepDiveBlock>(b: DeepDiveBlock | { error: string }) => {
  if ('error' in b) throw new Error(b.error);
  return b as T;
};

describe('drawn diagrams', () => {
  it('turns the author\'s coordinates into positions and needs no image', () => {
    const b = built<DiagramBlockData>(buildBlock('diagram', args, ctx));
    expect(b.svg).toBe(svg);
    expect(b.imageBase64).toBe('');
    expect(b.labels[0].position).toEqual({ x: 25, y: 50 });
    expect(b.labels[1].position).toEqual({ x: 75, y: 50 });
    expect(b.interactionMode).toBe('label');
  });

  it('reads a viewBox with commas and an offset, and refuses a drawing with none', () => {
    expect(viewBoxOf('<svg viewBox="10,20,100,50"></svg>')).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    expect(viewBoxOf('<svg width="100"></svg>')).toBeNull();
    expect(buildBlock('diagram', { ...args, svg: '<svg width="100"></svg>' }, ctx)).toMatchObject({ error: expect.stringMatching(/viewBox/) });
  });

  it('refuses a drawing and a picture prompt together, neither, and a part off the page', () => {
    expect(buildBlock('diagram', { ...args, imagePrompt: 'a flower' }, ctx)).toHaveProperty('error');
    expect(buildBlock('diagram', { ...args, svg: undefined }, ctx)).toHaveProperty('error');
    expect(buildBlock('diagram', { ...args, labels: labels.map((l, i) => (i ? l : { ...l, x: 900 })) }, ctx)).toMatchObject({ error: expect.stringMatching(/petal/) });
  });

  it('refuses a part with no position, and two parts too close to tell apart', () => {
    expect(buildBlock('diagram', { ...args, labels: labels.map(({ x: _x, ...l }, i) => (i ? { ...l, x: labels[i].x } : l)) }, ctx)).toHaveProperty('error');
    expect(buildBlock('diagram', { ...args, labels: labels.map((l, i) => (i === 1 ? { ...l, x: 102, y: 102 } : l)) }, ctx)).toMatchObject({ error: expect.stringMatching(/too close/) });
  });

  it('blocks a drawing that writes a part\'s name, and passes other text', () => {
    const named = built<DiagramBlockData>(buildBlock('diagram', { ...args, svg: svg.replace('</svg>', '<text x="5" y="9">Stamen</text></svg>') }, ctx));
    expect(blockIssues(named, ctx).blocking.join()).toMatch(/stamen/i);
    const other = built<DiagramBlockData>(buildBlock('diagram', { ...args, svg: svg.replace('</svg>', '<text x="5" y="9">Top view</text></svg>') }, ctx));
    expect(blockIssues(other, ctx).blocking).toEqual([]);
  });

  it('keeps the drawing out of what the student is counted as reading', () => {
    expect(visibleText(built(buildBlock('diagram', args, ctx)))).not.toMatch(/viewBox/);
    expect(visibleText(built(buildBlock('figure', { ...common, svg, caption: 'A flower.', altText: 'A flower.' }, ctx)))).not.toMatch(/viewBox/);
  });

  it('grades a label on its own part and fails one on another part or far from any', () => {
    const b = built<DiagramBlockData>(buildBlock('diagram', args, ctx));
    const [petal, stamen] = b.labels;
    const at = (x: number, y: number) => ({ x, y });
    const r = gradeDrawnLabels(b.labels, [
      { labelId: petal.id, position: at(27, 48) },
      { labelId: stamen.id, position: at(26, 52) },
    ]);
    expect(r.labelResults.map(x => x.correct)).toEqual([true, false]);
    expect(gradeDrawnLabels(b.labels, [{ labelId: petal.id, position: at(2, 2) }]).labelResults[0].correct).toBe(false);
    expect(r.overallFeedback).toMatch(/1 of 4/);
  });
});

describe('figures', () => {
  it('builds from a drawing, refuses a broken one, and is ungraded', () => {
    const f = built<FigureBlockData>(buildBlock('figure', { ...common, svg, caption: 'A flower.', altText: 'A flower.' }, ctx));
    expect(f.display).toEqual({ kind: 'svg', svg });
    expect(buildBlock('figure', { ...common, svg: 'no drawing', caption: 'c', altText: 'a' }, ctx)).toHaveProperty('error');
  });

  it('holds a code-drawn display the agent wrote as values', () => {
    const f = built<FigureBlockData>(buildBlock('figure', { ...common, display: JSON.stringify({ kind: 'clock', hour: 3, minute: 30 }), caption: 'Half past.', altText: 'A clock.' }, ctx));
    expect(f.display).toEqual({ kind: 'clock', hour: 3, minute: 30 });
    expect(isDrawn(f)).toBe(false);
    expect(visibleText(f)).not.toMatch(/clock"|hour/);
  });

  it('refuses a display it hides and a broken one, and a figure with neither', () => {
    const fig = (display: unknown) => buildBlock('figure', { ...common, display: JSON.stringify(display), caption: 'c', altText: 'a' }, ctx);
    expect(fig({ kind: 'bar_graph', labels: ['a', 'b'], values: [1, 2] })).toMatchObject({ error: expect.stringMatching(/not offered here/) });
    expect(fig({ kind: 'clock', hour: 40, minute: 0 })).toMatchObject({ error: expect.stringMatching(/hour is a whole number/) });
    expect(buildBlock('figure', { ...common, caption: 'c', altText: 'a' }, ctx)).toHaveProperty('error');
  });

  it('offers the author a figure tool and a diagram tool that takes a drawing', () => {
    const tools = blockTools(ctx);
    expect(tools.map(t => t.name)).toContain('write_figure');
    const diagram = tools.find(t => t.name === 'write_diagram')!;
    expect(Object.keys(diagram.parameters!.properties!)).toContain('svg');
    expect(diagram.parameters!.required).not.toContain('imagePrompt');
  });
});

describe('what the author looks at', () => {
  it('shows a drawn diagram with its numbered pins and sanitizes the drawing', () => {
    const b = built<DiagramBlockData>(buildBlock('diagram', { ...args, svg: svg.replace('<circle', '<script>x()</script><circle') }, ctx));
    expect(isDrawn(b)).toBe(true);
    const drawn = drawnSvg(b);
    expect(drawn).toContain('<circle cx="100" cy="100" r="11.1');
    expect(drawn.match(/fill="#14b8a6"/g)).toHaveLength(4);
    expect(drawn.trimEnd().endsWith('</svg>')).toBe(true);
    expect(pinKey(b)).toContain('1 = petal');
    expect(drawn).not.toContain('<script');
  });

  it('does not look at a diagram whose picture comes from the image model', () => {
    const { svg: _svg, ...noDrawing } = args;
    const b = built<DiagramBlockData>(buildBlock('diagram', { ...noDrawing, imagePrompt: 'a flower', labels: labels.map(({ x: _x, y: _y, ...l }) => l) }, ctx));
    expect(isDrawn(b)).toBe(false);
  });
});
