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

  it('DI-120-1: the barge-in bar can never sink under bursty leakage on a quiet device', () => {
    // Replay of the 2026-08-06 counting-120 sitting's device: near-silent
    // ambient (ambient bar clamps to its 0.008 minimum) and an echo median of
    // ~0.0002 — the derived barge bar was 0.0108, and two leakage blips at
    // peak 0.018 opened turns over tutor audio, anchored EMPTY attempts, and
    // burned `count-39`. Real answers in the same run peaked 0.045–0.116.
    let state = observe(new Array(8).fill(0.002));
    state = new Array(16).fill(0.0002).reduce(
      (next, level) => observeVoiceFloor(next, level, true),
      state,
    );
    const thresholds = deriveVoiceThresholds(state, DEFAULT_VOICE_TURN_CONFIG);
    expect(thresholds.echoReady).toBe(true);
    // The floor: rejects the measured 0.018 leakage class…
    expect(thresholds.echoOpen).toBeGreaterThan(0.018);
    expect(thresholds.echoOpen).toBeGreaterThanOrEqual(0.03);
    // …while every measured real barge-in answer still clears the bar.
    expect(thresholds.echoOpen).toBeLessThan(0.045);
    // The AMBIENT bar stays sensitive — answering into silence is untouched.
    expect(thresholds.ambientOpen).toBeLessThanOrEqual(0.008);
  });

  it('DI-120-1: the pre-calibration fallback barge bar honours the same floor', () => {
    const thresholds = deriveVoiceThresholds(EMPTY_VOICE_CALIBRATION, {
      ...DEFAULT_VOICE_TURN_CONFIG,
      silenceThreshold: 0.004,
      bargeInMultiplier: 1.2,
    });
    expect(thresholds.echoReady).toBe(false);
    expect(thresholds.echoOpen).toBeGreaterThanOrEqual(0.03);
  });
});
