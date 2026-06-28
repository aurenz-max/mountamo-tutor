/**
 * Intent-contract regression test — PRD §6.5, Part 1.
 *
 * Guards the defect class that motivated the GenerationContext harmonization:
 * registry handlers silently dropping `intent`/`scope` before the generator saw
 * them. `/eval-test` could never catch this because it injects `config.intent`
 * directly and bypasses the production `flattenManifestToLayout →
 * resolveGenerationContext` path. These tests exercise the real resolver in
 * isolation (pure — no Gemini, no env, no network) and pin the exact contract every
 * context-native generator now relies on.
 */

import { describe, expect, it } from 'vitest';
import type { ManifestItem } from '../registry/contentRegistry';
import { resolveGenerationContext } from './resolveGenerationContext';

const TOPIC = 'Counting to 10';
const GRADE_CONTEXT = 'kindergarten-appropriate, concrete and visual';
const GRADE_LEVEL = 'kindergarten';

/** Build a synthetic manifest item; override only what a case cares about. */
function makeItem(overrides: Partial<ManifestItem> = {}): ManifestItem {
  return {
    componentId: 'number-line',
    instanceId: 'inst-1',
    ...overrides,
  };
}

function resolve(item: ManifestItem) {
  return resolveGenerationContext(item, TOPIC, GRADE_CONTEXT, GRADE_LEVEL);
}

describe('resolveGenerationContext — intent precedence (config.intent → item.intent → item.title)', () => {
  it('prefers config.intent over item.intent and item.title', () => {
    const ctx = resolve(
      makeItem({
        title: 'Title intent',
        intent: 'Item intent',
        config: { intent: 'Config intent' },
      }),
    );
    expect(ctx.intent).toBe('Config intent');
  });

  it('falls back to item.intent when config.intent is absent', () => {
    const ctx = resolve(makeItem({ title: 'Title intent', intent: 'Item intent' }));
    expect(ctx.intent).toBe('Item intent');
  });

  it('falls back to item.title when both config.intent and item.intent are absent', () => {
    const ctx = resolve(makeItem({ title: 'Title intent' }));
    expect(ctx.intent).toBe('Title intent');
  });

  it('is undefined when intent is absent everywhere', () => {
    const ctx = resolve(makeItem());
    expect(ctx.intent).toBeUndefined();
  });

  it('THE ORIGINAL BUG: intent present only at item-level (not in config) still survives', () => {
    // This is the exact shape `/eval-test` masks: eval-test always sets
    // config.intent, so a handler that read only config.intent would look fine
    // there but drop intent in production where it rides at item.intent. The
    // resolver must keep it.
    const ctx = resolve(makeItem({ intent: 'Compare lengths on the number line', config: {} }));
    expect(ctx.intent).toBe('Compare lengths on the number line');
  });
});

describe('resolveGenerationContext — identity, framing, and title passthrough', () => {
  it('passes through identity and lesson framing verbatim', () => {
    const ctx = resolve(makeItem({ componentId: 'ten-frame', instanceId: 'inst-42' }));
    expect(ctx.componentId).toBe('ten-frame');
    expect(ctx.instanceId).toBe('inst-42');
    expect(ctx.topic).toBe(TOPIC);
    expect(ctx.gradeLevel).toBe(GRADE_LEVEL);
    expect(ctx.gradeContext).toBe(GRADE_CONTEXT);
  });

  it('ctx.title === item.title (and undefined when item has no title)', () => {
    expect(resolve(makeItem({ title: 'A Title' })).title).toBe('A Title');
    expect(resolve(makeItem()).title).toBeUndefined();
  });
});

describe('resolveGenerationContext — objective mapping', () => {
  it('maps objectiveId / objectiveText / objectiveVerb from config', () => {
    const ctx = resolve(
      makeItem({
        config: {
          objectiveId: 'OBJ-001',
          objectiveText: 'count and sequence numbers up to 10',
          objectiveVerb: 'count',
        },
      }),
    );
    expect(ctx.objective).toEqual({
      id: 'OBJ-001',
      text: 'count and sequence numbers up to 10',
      verb: 'count',
    });
  });

  it('always returns an objective object even when config carries none', () => {
    const ctx = resolve(makeItem({ config: {} }));
    expect(ctx.objective).toEqual({ id: undefined, text: undefined, verb: undefined });
  });
});

describe('resolveGenerationContext — supportTier normalization', () => {
  it.each(['easy', 'medium', 'hard'] as const)(
    'normalizes valid config.difficulty "%s" to the matching tier',
    (difficulty) => {
      expect(resolve(makeItem({ config: { difficulty } })).supportTier).toBe(difficulty);
    },
  );

  it('lowercases and trims before matching', () => {
    expect(resolve(makeItem({ config: { difficulty: '  HARD ' } })).supportTier).toBe('hard');
  });

  it.each([
    ['garbage string', 'extreme'],
    ['empty string', ''],
    ['number', 3],
    ['null', null],
  ])('returns undefined for %s difficulty', (_label, difficulty) => {
    expect(resolve(makeItem({ config: { difficulty } })).supportTier).toBeUndefined();
  });

  it('returns undefined when config.difficulty is absent', () => {
    expect(resolve(makeItem({ config: {} })).supportTier).toBeUndefined();
  });
});

describe('resolveGenerationContext — scope (axis 1) and raw passthrough', () => {
  it('scope.topic === topic and scope carries the resolved objective + intent', () => {
    const ctx = resolve(
      makeItem({
        intent: 'Compare lengths',
        config: {
          objectiveText: 'count and sequence numbers up to 10',
          objectiveVerb: 'count',
        },
      }),
    );
    expect(ctx.scope.topic).toBe(TOPIC);
    expect(ctx.scope.objectiveText).toBe('count and sequence numbers up to 10');
    expect(ctx.scope.objectiveVerb).toBe('count');
    // intent flows into scope via the resolver's fallback chain.
    expect(ctx.scope.intent).toBe('Compare lengths');
  });

  it('forwards targetEvalMode from config', () => {
    expect(resolve(makeItem({ config: { targetEvalMode: 'build' } })).targetEvalMode).toBe('build');
  });

  it('ctx.raw is the exact item.config object (escape hatch identity)', () => {
    const config = { challengeCount: 5, gradeBand: 'K-2' };
    const ctx = resolve(makeItem({ config }));
    expect(ctx.raw).toBe(config);
  });

  it('degrades gracefully (no throw, empty raw) when config is entirely absent', () => {
    const ctx = resolve(makeItem({ config: undefined }));
    expect(ctx.intent).toBeUndefined();
    expect(ctx.supportTier).toBeUndefined();
    expect(ctx.scope.topic).toBe(TOPIC);
    expect(ctx.raw).toEqual({});
  });
});
