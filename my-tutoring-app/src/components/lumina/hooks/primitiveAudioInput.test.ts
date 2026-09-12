import { describe, expect, it } from 'vitest';
import { resolvePrimitiveAudioInput } from './primitiveAudioInput';

const definition = { audioInputByMode: { equality: { manual_activity: true } } };
describe('mode-specific DI audio', () => {
  it('selects the hydrated equality mode for lesson entry and switches', () => {
    expect(resolvePrimitiveAudioInput(definition, { challenges: [{ type: 'equality' }, { type: 'equality' }] })).toEqual({ manual_activity: true });
    expect(resolvePrimitiveAudioInput(definition, { challengeType: 'equality' })).toEqual({ manual_activity: true });
  });
  it('does not enable DI audio for legacy modes or stale/mixed payloads', () => {
    expect(resolvePrimitiveAudioInput(definition, { challenges: [{ type: 'one_step' }] })).toBeUndefined();
    expect(resolvePrimitiveAudioInput(definition, { challengeType: 'equality', challenges: [{ type: 'one_step' }] })).toBeUndefined();
    expect(resolvePrimitiveAudioInput(definition, { challenges: [{ type: 'equality' }, { type: 'one_step' }] })).toBeUndefined();
    expect(resolvePrimitiveAudioInput(definition, null)).toBeUndefined();
  });
  it('preserves existing component-level declarations', () => {
    expect(resolvePrimitiveAudioInput({ audioInput: { manual_activity: true } }, {})).toEqual({ manual_activity: true });
    expect(resolvePrimitiveAudioInput(undefined, {})).toBeUndefined();
  });
});
