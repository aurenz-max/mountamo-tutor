import { describe, expect, it } from 'vitest';
import { buildRemediationPrompt } from './remediationPrompt';

describe('buildRemediationPrompt', () => {
  it('returns an exact empty string when no signal is active', () => {
    expect(buildRemediationPrompt()).toBe('');
    expect(buildRemediationPrompt('   ')).toBe('');
  });

  it('includes targeting, diagnostic variation, and anti-leak guardrails', () => {
    const block = buildRemediationPrompt('The student chooses the smaller quantity instead of the difference.');
    expect(block).toContain('smaller quantity instead of the difference');
    expect(block).toContain('distractor or variation');
    expect(block).toContain('Do NOT state the misconception');
    expect(block).toContain('eval mode, difficulty, and item counts unchanged');
  });
});
