import { describe, expect, it } from 'vitest';
import { pipPhasePose, type PipPhaseGate } from './pipPhasePose';

const working: PipPhaseGate = {
  running: true, preparing: false, currentSolved: false, revealHeld: false,
  judging: false, tutorSpeaking: false, cueMatchesItem: true,
};
const attention = { visibleIds: ['a', 'b'], cueId: 'a', attendId: 'b' };

describe('shared Pip phase gate', () => {
  it('points at the cue while this item is spoken and watches during work', () => {
    expect(pipPhasePose({ ...working, tutorSpeaking: true }, attention)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'a' });
    expect(pipPhasePose(working, attention)).toEqual({ phase: 'working', gesture: 'look', targetId: 'b' });
  });
  it('receives only a handover and celebrates only an affirmed item', () => {
    expect(pipPhasePose({ ...working, judging: true }, attention)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'b' });
    expect(pipPhasePose({ ...working, judging: true }, { ...attention, handover: true }).gesture).toBe('receive');
    expect(pipPhasePose({ ...working, revealHeld: true, cueMatchesItem: false }, attention)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });
  it('stays neutral before start, over the previous cue, and for hidden targets', () => {
    expect(pipPhasePose({ ...working, running: false }, attention)).toEqual({ phase: 'idle', gesture: 'none' });
    expect(pipPhasePose({ ...working, tutorSpeaking: true, cueMatchesItem: false }, attention)).toEqual({ phase: 'idle', gesture: 'none' });
    expect(pipPhasePose({ ...working, tutorSpeaking: true }, { visibleIds: ['b'], cueId: 'a' })).toEqual({ phase: 'introducing', gesture: 'none', targetId: undefined });
  });
});
