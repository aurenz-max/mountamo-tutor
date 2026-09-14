import { describe, expect, it } from 'vitest';
import { countingBoardPipPose, type CountingPipState } from './countingBoardPipPose';

const working: CountingPipState = {
  running: true, preparing: false, currentSolved: false, revealHeld: false, judging: false,
  tutorSpeaking: false, cueMatchesItem: true, perceptual: false, giving: false,
  visibleIds: ['one', 'two'], lastTouchedId: 'two',
};

describe('Pip follows Counting Board phases', () => {
  it('points during this item’s introduction and follows the child during work', () => {
    expect(countingBoardPipPose({ ...working, tutorSpeaking: true })).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'one' });
    expect(countingBoardPipPose(working)).toEqual({ phase: 'working', gesture: 'look', targetId: 'two' });
  });
  it('receives only during a handover, and celebrates only an affirmed result', () => {
    expect(countingBoardPipPose({ ...working, judging: true, giving: true }).gesture).toBe('receive');
    expect(countingBoardPipPose({ ...working, judging: true }).phase).toBe('checking');
    expect(countingBoardPipPose({ ...working, currentSolved: true })).toEqual({ phase: 'celebrating', gesture: 'none' });
  });
  it('does not point into the next challenge during the previous cue’s audio tail', () => {
    expect(countingBoardPipPose({ ...working, cueMatchesItem: false, tutorSpeaking: true })).toEqual({ phase: 'idle', gesture: 'none' });
    expect(countingBoardPipPose({ ...working, revealHeld: true, cueMatchesItem: false })).toEqual({ phase: 'celebrating', gesture: 'none' });
  });
  it('never singles out objects for subitizing or follows a hidden target', () => {
    expect(countingBoardPipPose({ ...working, perceptual: true, tutorSpeaking: true }).gesture).toBe('none');
    expect(countingBoardPipPose({ ...working, perceptual: true }).targetId).toBeUndefined();
    expect(countingBoardPipPose({ ...working, visibleIds: ['one'] }).targetId).toBeUndefined();
  });
  it('is idle before the activity starts even if there is a remembered touch', () => {
    expect(countingBoardPipPose({ ...working, running: false })).toEqual({ phase: 'idle', gesture: 'none' });
  });
});
