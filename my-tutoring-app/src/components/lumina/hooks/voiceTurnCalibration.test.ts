import { describe, expect, it } from 'vitest';
import { DEFAULT_VOICE_TURN_CONFIG } from './voiceTurnMachine';
import {
  deriveVoiceThresholds,
  EMPTY_VOICE_CALIBRATION,
  observeVoiceFloor,
  VOICE_CALIBRATION_MIN_SAMPLES,
} from './voiceTurnCalibration';

const observe = (levels: number[], tutorAudible = false) => levels.reduce(
  (state, level) => observeVoiceFloor(state, level, tutorAudible),
  EMPTY_VOICE_CALIBRATION,
);

describe('voice turn calibration', () => {
  it('keeps the proven defaults during the measure-first beat', () => {
    const state = observe(new Array(VOICE_CALIBRATION_MIN_SAMPLES - 1).fill(0.004));
    const thresholds = deriveVoiceThresholds(state, DEFAULT_VOICE_TURN_CONFIG);
    expect(thresholds.ambientReady).toBe(false);
    expect(thresholds.ambientOpen).toBe(DEFAULT_VOICE_TURN_CONFIG.silenceThreshold);
  });

  it('sets the ambient bar from the measured device floor', () => {
    const state = observe([0.004, 0.005, 0.004, 0.006, 0.005, 0.004, 0.005, 0.004]);
    const thresholds = deriveVoiceThresholds(state, DEFAULT_VOICE_TURN_CONFIG);
    expect(thresholds.ambientReady).toBe(true);
    expect(thresholds.ambientOpen).toBeCloseTo(0.013, 3);
  });

  it('uses a robust median so a spoken outlier does not poison the floor', () => {
    const state = observe([0.004, 0.005, 0.004, 0.006, 0.18, 0.004, 0.005, 0.004]);
    expect(state.ambientFloor).toBeCloseTo(0.0045, 4);
    expect(deriveVoiceThresholds(state, DEFAULT_VOICE_TURN_CONFIG).ambientOpen).toBeLessThan(0.02);
  });

  it('places the barge-in bar above both ambient speech bar and measured echo', () => {
    let state = observe(new Array(8).fill(0.006));
    state = new Array(8).fill(0.03).reduce(
      (next, level) => observeVoiceFloor(next, level, true),
      state,
    );
    const thresholds = deriveVoiceThresholds(state, DEFAULT_VOICE_TURN_CONFIG);
    expect(thresholds.echoReady).toBe(true);
    expect(thresholds.echoOpen).toBeGreaterThan(0.05);
    expect(thresholds.echoOpen).toBeGreaterThan(thresholds.ambientOpen);
  });
});
