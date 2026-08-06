/**
 * gemini-di-shapes — Fork A menu-scope contract (deterministic; geminiClient
 * mocked so the wrapper falls back to defaults and the CODE-owned half is
 * what's under test — the same keepable-oracle shape as the sibling packs).
 */

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({ text: '' }),
}));
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import {
  buildShapeSequence,
  generateDiShapes,
  parseNamedShapes,
  SHAPE_MENU,
} from './gemini-di-shapes';

describe('parseNamedShapes — objective text wins', () => {
  it('reads singular, plural, and the K "diamond" word', () => {
    expect(parseNamedShapes('name triangles and circles')).toEqual(['triangle', 'circle']);
    expect(parseNamedShapes('identify a square')).toEqual(['square']);
    expect(parseNamedShapes('sort diamonds and ovals')).toEqual(['rhombus', 'oval']);
    expect(parseNamedShapes('count to 120')).toEqual([]);
  });
});

describe('generateDiShapes — code-enforced scope', () => {
  it('serves the shapes the objective names, and only those', async () => {
    const data = await generateDiShapes('naming triangles and circles', 'kindergarten', {
      intent: 'Correctly name triangles and circles regardless of orientation',
      challengeCount: 6,
    });
    expect(data.challenges).toHaveLength(6);
    const shapes = new Set(data.challenges.map((c) => c.shape));
    expect(Array.from(shapes).sort()).toEqual(['circle', 'triangle']);
    expect(data.challengeType).toBe('name_shape');
  });

  it('falls back to the K.G.2 core five for a generic K objective', async () => {
    const data = await generateDiShapes('naming basic shapes', 'kindergarten', {});
    for (const c of data.challenges) {
      expect(SHAPE_MENU[c.shape].core).toBe(true);
    }
  });

  it('derives every spoken field in code — article, sides, aliases, rotation cap', async () => {
    const data = await generateDiShapes('naming ovals and squares', 'first grade', {
      challengeCount: 6,
    });
    for (const c of data.challenges) {
      const spec = SHAPE_MENU[c.shape];
      expect(c.shapeWord).toBe(spec.word);
      expect(c.article).toBe(spec.article);
      expect(c.sides).toBe(spec.sides);
      expect(Math.abs(c.rotationDeg)).toBeLessThanOrEqual(spec.maxRotationDeg);
      expect(c.asrAliases).toEqual(spec.asrAliases);
      if (c.shape === 'oval') expect(c.article).toBe('an');
    }
  });

  it('attaches the "diamond" alternate to rhombus only', async () => {
    const data = await generateDiShapes('naming diamonds', 'first grade', {
      challengeCount: 3,
    });
    for (const c of data.challenges) {
      expect(c.shape).toBe('rhombus');
      expect(c.spokenAlternates).toEqual(['diamond']);
    }
  });

  it('wrapper defaults never leak a shape name (answer-leak guard path)', async () => {
    // The mocked model returned no wrapper, so defaults ship — and the guard
    // must hold for them too.
    const data = await generateDiShapes('naming basic shapes', 'kindergarten', {});
    const chrome = `${data.title} ${data.description}`.toLowerCase();
    for (const shape of Object.keys(SHAPE_MENU)) {
      expect(chrome).not.toContain(shape);
    }
    expect(chrome).not.toContain('diamond');
  });
});

describe('buildShapeSequence — variance', () => {
  it('shows every selected shape before any repeat and never runs one back-to-back', () => {
    for (let run = 0; run < 25; run++) {
      const seq = buildShapeSequence(['circle', 'triangle', 'square'], 6);
      expect(seq).toHaveLength(6);
      expect(new Set(seq.slice(0, 3)).size).toBe(3);
      for (let i = 1; i < seq.length; i++) {
        expect(seq[i], `back-to-back at ${i} in ${seq.join(',')}`).not.toBe(seq[i - 1]);
      }
    }
  });

  it('a single-shape session tolerates repeats (nothing else to alternate to)', () => {
    expect(buildShapeSequence(['hexagon'], 3)).toEqual(['hexagon', 'hexagon', 'hexagon']);
  });
});
