import { expect, it } from 'vitest';
import { itemsFromChallenges } from './placeValueScript';
import { placeValueVoiceObservation } from './placeValueEvidence';
const items = itemsFromChallenges([{ id: 'a', targetNumber: 2345, highlightedDigitPlace: 1 }], { mode: 'compare', tier: 'medium' }).items;
it('retains observed words and exact task identity', () => {
  expect(placeValueVoiceObservation(items[1], 'four')).toEqual({ challenge: 'say the value of the 4 in 2345', expected: 'forty', observed: 'four' });
  expect(placeValueVoiceObservation(items[0], 'forty').challenge).toBe('name the place of the 4 in 2345');
});
it('does not equate missing ASR with silence or correct ASR with a mathematical error', () => {
  expect(placeValueVoiceObservation(items[1], null).observed).toContain('No reliable learner transcription');
  for (const text of ['forty', '40']) expect(placeValueVoiceObservation(items[1], text).observed).toContain('Conflicting evidence');
});
