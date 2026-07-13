import { describe, expect, it } from 'vitest';
import { soundSwapRemediationMoveFor } from './gemini-sound-swap';
describe('SoundSwap remediation affordances', () => {
  it.each([['addition','isolate_added_sound'],['deletion','isolate_deleted_sound'],['substitution','contrast_replacement']] as const)(
    'maps %s to its remediation move', (operation, expected) => expect(soundSwapRemediationMoveFor(operation, 'focus')).toBe(expected),
  );
  it('leaves baseline untagged', () => expect(soundSwapRemediationMoveFor('substitution')).toBeUndefined());
});
