/**
 * Generator-side support-tier harness for spelling-pattern-explorer.
 *
 * The tier NEVER enters the prompt — `finalizeSpellingPatternExplorerData` is the
 * single post-parse exit path: it strips `difficulty`/`targetEvalMode` from the
 * config spread and stamps the typed `supportTier` AFTER the spread (so config
 * can never clobber it). These pure tests pin that whole contract:
 *   • strict tier normalization (unknown/absent → null → NOTHING stamped),
 *   • the config-spread leak guard (raw `difficulty` string never reaches data),
 *   • byte-identical legacy payload when no tier resolves,
 *   • content fields are never touched by the tier.
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeSupportTier,
  finalizeSpellingPatternExplorerData,
} from './gemini-spelling-pattern-explorer';
import type { SpellingPatternExplorerData } from '../../primitives/visual-primitives/literacy/SpellingPatternExplorer';

const baseResult = (): SpellingPatternExplorerData => ({
  title: 'Magic E Lab',
  gradeLevel: '2',
  patternType: 'long-vowel',
  patternWords: ['cake', 'lake', 'bake', 'make', 'take', 'rake'],
  highlightPattern: 'ake',
  ruleTemplate: 'When a word ends in -ake, the a says ___',
  correctRule: 'The silent e makes the a say its long name.',
  dictationWords: ['snake', 'flake', 'brake', 'shake'],
  dictationHints: ['reptile', 'snow bit', 'stops the car', 'wiggle'],
});

describe('normalizeSupportTier — strict lookup', () => {
  it('maps the three known tiers (case/whitespace tolerant)', () => {
    expect(normalizeSupportTier('easy')).toBe('easy');
    expect(normalizeSupportTier('medium')).toBe('medium');
    expect(normalizeSupportTier('hard')).toBe('hard');
    expect(normalizeSupportTier(' HARD ')).toBe('hard');
  });

  it('unknown/absent → null (no tier applied)', () => {
    expect(normalizeSupportTier(undefined)).toBeNull();
    expect(normalizeSupportTier('')).toBeNull();
    expect(normalizeSupportTier('banana')).toBeNull();
    expect(normalizeSupportTier('3')).toBeNull();
  });
});

describe('finalizeSpellingPatternExplorerData — stamp + spread guard', () => {
  it('stamps supportTier from config.difficulty and strips the raw string', () => {
    const out = finalizeSpellingPatternExplorerData(baseResult(), { difficulty: 'hard' });
    expect(out.supportTier).toBe('hard');
    expect(out).not.toHaveProperty('difficulty');
  });

  it('stamps easy', () => {
    const out = finalizeSpellingPatternExplorerData(baseResult(), { difficulty: 'easy' });
    expect(out.supportTier).toBe('easy');
    expect(out).not.toHaveProperty('difficulty');
  });

  it('absent difficulty ⇒ byte-identical legacy payload (no new fields at all)', () => {
    const result = baseResult();
    const out = finalizeSpellingPatternExplorerData(result, {});
    expect(out).toEqual(result);
    expect(out).not.toHaveProperty('supportTier');
    expect(out).not.toHaveProperty('difficulty');
  });

  it('unknown difficulty ⇒ NOTHING stamped, nothing leaked', () => {
    const out = finalizeSpellingPatternExplorerData(baseResult(), { difficulty: 'banana' });
    expect(out).not.toHaveProperty('supportTier');
    expect(out).not.toHaveProperty('difficulty');
  });

  it('undefined config ⇒ legacy payload', () => {
    const result = baseResult();
    const out = finalizeSpellingPatternExplorerData(result, undefined);
    expect(out).toEqual(result);
    expect(out).not.toHaveProperty('supportTier');
  });

  it('strips targetEvalMode exactly like the legacy spread did', () => {
    const out = finalizeSpellingPatternExplorerData(baseResult(), {
      targetEvalMode: 'long_vowel',
      difficulty: 'medium',
    });
    expect(out).not.toHaveProperty('targetEvalMode');
    expect(out.supportTier).toBe('medium');
  });

  it('the stamp WINS over a config-provided supportTier (stamp after spread)', () => {
    const out = finalizeSpellingPatternExplorerData(baseResult(), {
      difficulty: 'hard',
      supportTier: 'easy',
    });
    expect(out.supportTier).toBe('hard');
  });

  it('never touches content fields at any tier (display gates are component-side)', () => {
    const result = baseResult();
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const out = finalizeSpellingPatternExplorerData(result, { difficulty });
      expect(out.patternWords, difficulty).toEqual(result.patternWords);
      expect(out.dictationWords, difficulty).toEqual(result.dictationWords);
      expect(out.highlightPattern, difficulty).toBe(result.highlightPattern);
      expect(out.ruleTemplate, difficulty).toBe(result.ruleTemplate);
      expect(out.correctRule, difficulty).toBe(result.correctRule);
      expect(out.dictationHints, difficulty).toEqual(result.dictationHints);
    }
  });

  it('config-provided content overrides still win (legacy manifest behavior kept)', () => {
    const out = finalizeSpellingPatternExplorerData(baseResult(), {
      title: 'Custom Title',
      difficulty: 'medium',
    });
    expect(out.title).toBe('Custom Title');
    expect(out.supportTier).toBe('medium');
  });
});
