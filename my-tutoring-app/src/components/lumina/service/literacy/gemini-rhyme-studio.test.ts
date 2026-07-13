import { describe, expect, it } from 'vitest';
import { rhymeRemediationMoveFor } from './gemini-rhyme-studio';

describe('RhymeStudio remediation affordances', () => {
  it.each([
    ['recognition', 'contrast_rime'],
    ['identification', 'diagnostic_option'],
    ['production', 'constrained_production'],
  ] as const)('maps %s to its remediation move', (mode, expected) => {
    expect(rhymeRemediationMoveFor(mode, 'The student matches onset instead of rime.')).toBe(expected);
  });
  it('leaves baseline untagged', () => expect(rhymeRemediationMoveFor('recognition')).toBeUndefined());
});
