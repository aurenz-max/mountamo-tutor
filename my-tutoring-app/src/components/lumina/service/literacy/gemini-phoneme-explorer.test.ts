import { describe, expect, it } from 'vitest';
import { phonemeRemediationMoveFor } from './gemini-phoneme-explorer';

describe('PhonemeExplorer remediation affordances', () => {
  it.each([
    ['isolate', 'contrast_phoneme'],
    ['blend', 'blend_through'],
    ['segment', 'segment_boundary'],
    ['manipulate', 'isolate_operation'],
  ] as const)('maps %s to its structural remediation move', (mode, expected) => {
    expect(phonemeRemediationMoveFor(mode, 'A repeatable wrong sound rule.')).toBe(expected);
  });

  it('leaves baseline generation untagged', () => {
    expect(phonemeRemediationMoveFor('isolate')).toBeUndefined();
  });
});
