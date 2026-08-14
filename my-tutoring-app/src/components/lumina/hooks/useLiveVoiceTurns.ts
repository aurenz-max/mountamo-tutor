'use client';

/**
 * Open-mic turn authority over a Gemini Live session.
 *
 * The public hook consumes LuminaAIContext for standalone surfaces. The
 * transport-taking variant lets LuminaAIProvider own the single lesson-level
 * instance without trying to consume its own context.
 *
 * FRAME-DRIVEN, NOT RENDER-DRIVEN (DI BACKLOG 19b, 2026-08-14). The machine
 * used to step inside a `useEffect` keyed on `transport.micLevel`, so every
 * audio frame had to become provider state and re-render everything under the
 * provider before the turn machine could see it — 30-100 renders a second for
 * the whole tree, to move one float. The level now arrives through
 * `subscribeMicLevel` and the step runs in that callback: same cadence, same
 * samples, no render. Everything the step needs from the render world is read
 * through `transportRef`/`configRef` at frame time, so this hook subscribes
 * ONCE per enable instead of resubscribing per frame.
 *
 * One behavioural gain came free: the old effect also re-ran whenever an
 * unrelated dep changed identity, stepping the machine a second time on a
 * micLevel sample it had already consumed. Calibration now sees each frame
 * exactly once.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  closeVoiceTurn,
  DEFAULT_VOICE_TURN_CONFIG,
  IDLE_VOICE_TURN,
  stepVoiceTurn,
  type VoiceTurnConfig,
  type VoiceTurnEvent,
} from './voiceTurnMachine';
import {
  deriveVoiceThresholds,
  EMPTY_VOICE_CALIBRATION,
  observeVoiceFloor,
  type VoiceCalibrationState,
} from './voiceTurnCalibration';

export interface VoiceFloors {
  ambientRms: number;
  echoRms: number;
  ambientOpen: number;
  echoOpen: number;
  ambientReady: boolean;
  echoReady: boolean;
}

export interface LiveVoiceTurnTransport {
  /**
   * The live mic RMS, one call per captured audio frame. A subscription rather
   * than a number BECAUSE the machine wants every frame and the render tree
   * wants none of them — see the file docblock.
   */
  subscribeMicLevel: (listener: (level: number) => void) => () => void;
  micFramePeriodMs: number;
  isTutorAudible: boolean;
  sendActivityStart: () => void;
  sendActivityEnd: () => void;
}

export interface LiveVoiceTurnsOptions {
  /** Disabling force-closes an open turn so Gemini is never left mid-turn. */
  enabled: boolean;
  config?: Partial<VoiceTurnConfig>;
  onTurnOpen?: (event: Extract<VoiceTurnEvent, { kind: 'open' }>) => void;
  /** Fires for every close, including below-minimum voice blips. */
  onTurnClose?: (event: Extract<VoiceTurnEvent, { kind: 'close' }>) => void;
}

export interface LiveVoiceTurns {
  isVoiceActive: () => boolean;
  lastTurnOpenAtRef: React.MutableRefObject<number | null>;
  floorsRef: React.MutableRefObject<VoiceFloors>;
  reset: () => void;
  config: VoiceTurnConfig;
}

export function useLiveVoiceTurns(options: LiveVoiceTurnsOptions): LiveVoiceTurns {
  const ctx = useLuminaAIContext();
  return useLiveVoiceTurnsWithTransport(options, {
    subscribeMicLevel: ctx.subscribeMicLevel,
    micFramePeriodMs: ctx.micFramePeriodMs,
    isTutorAudible: ctx.isAudioPlaying,
    sendActivityStart: ctx.sendActivityStart,
    sendActivityEnd: ctx.sendActivityEnd,
  });
}

export function useLiveVoiceTurnsWithTransport(
  options: LiveVoiceTurnsOptions,
  transport: LiveVoiceTurnTransport,
): LiveVoiceTurns {
  const { enabled } = options;
  const { subscribeMicLevel } = transport;
  const baseConfig: VoiceTurnConfig = {
    ...DEFAULT_VOICE_TURN_CONFIG,
    framePeriodMs: transport.micFramePeriodMs || DEFAULT_VOICE_TURN_CONFIG.framePeriodMs,
    ...options.config,
  };

  const stateRef = useRef(IDLE_VOICE_TURN);
  const lastTurnOpenAtRef = useRef<number | null>(null);
  const calibrationRef = useRef<VoiceCalibrationState>(EMPTY_VOICE_CALIBRATION);
  const floorsRef = useRef<VoiceFloors>({
    ambientRms: 0,
    echoRms: 0,
    ambientOpen: baseConfig.silenceThreshold,
    echoOpen: baseConfig.silenceThreshold * baseConfig.bargeInMultiplier,
    ambientReady: false,
    echoReady: false,
  });
  const configRef = useRef(baseConfig);
  // Structural policy (close timing, minimum voice) follows the active
  // primitive; calibrated open bars remain owned by the measured device.
  configRef.current = {
    ...configRef.current,
    ...baseConfig,
    silenceThreshold: floorsRef.current.ambientOpen,
    bargeInMultiplier:
      floorsRef.current.echoOpen / Math.max(floorsRef.current.ambientOpen, Number.EPSILON),
  };
  const callbacksRef = useRef(options);
  callbacksRef.current = options;
  // The step runs outside the render cycle, so everything it reads from the
  // render world reaches it through here — never through a closure a dep array
  // would have to chase.
  const baseConfigRef = useRef(baseConfig);
  baseConfigRef.current = baseConfig;
  const transportRef = useRef(transport);
  transportRef.current = transport;

  const emitClose = useCallback((event: Extract<VoiceTurnEvent, { kind: 'close' }>) => {
    transportRef.current.sendActivityEnd();
    callbacksRef.current.onTurnClose?.(event);
  }, []);

  /** One captured audio frame. Refs only — this does not run in a render. */
  const stepFrame = useCallback((level: number) => {
    const base = baseConfigRef.current;
    const tutorAudible = transportRef.current.isTutorAudible;
    const now = performance.now();

    if (!stateRef.current.active) {
      calibrationRef.current = observeVoiceFloor(calibrationRef.current, level, tutorAudible);
      const thresholds = deriveVoiceThresholds(calibrationRef.current, base);
      floorsRef.current = {
        ambientRms: calibrationRef.current.ambientFloor,
        echoRms: calibrationRef.current.echoFloor,
        ...thresholds,
      };
      configRef.current = {
        ...base,
        silenceThreshold: thresholds.ambientOpen,
        bargeInMultiplier: thresholds.echoOpen / Math.max(thresholds.ambientOpen, Number.EPSILON),
      };
      // The calibration beat is real, not telemetry-only: do not let an
      // arbitrary device floor open a phantom turn before that regime has
      // enough samples to set its bar.
      const activeRegimeReady = tutorAudible ? thresholds.echoReady : thresholds.ambientReady;
      if (!activeRegimeReady) return;
    }

    const step = stepVoiceTurn(stateRef.current, {
      level,
      tutorAudible,
      now,
    }, configRef.current);
    stateRef.current = step.state;
    if (!step.event) return;
    if (step.event.kind === 'open') {
      lastTurnOpenAtRef.current = step.event.at;
      transportRef.current.sendActivityStart();
      callbacksRef.current.onTurnOpen?.(step.event);
      return;
    }
    emitClose(step.event);
  }, [emitClose]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeMicLevel(stepFrame);
  }, [enabled, stepFrame, subscribeMicLevel]);

  const reset = useCallback(() => {
    const base = baseConfigRef.current;
    const closed = closeVoiceTurn(stateRef.current, configRef.current);
    stateRef.current = closed.state;
    if (closed.event) emitClose(closed.event);
    lastTurnOpenAtRef.current = null;
    calibrationRef.current = EMPTY_VOICE_CALIBRATION;
    floorsRef.current = {
      ambientRms: 0,
      echoRms: 0,
      ambientOpen: base.silenceThreshold,
      echoOpen: base.silenceThreshold * base.bargeInMultiplier,
      ambientReady: false,
      echoReady: false,
    };
  }, [emitClose]);

  useEffect(() => {
    if (enabled) return;
    const closed = closeVoiceTurn(stateRef.current, configRef.current);
    stateRef.current = closed.state;
    if (closed.event) emitClose(closed.event);
  }, [enabled, emitClose]);

  useEffect(() => () => {
    const closed = closeVoiceTurn(stateRef.current, configRef.current);
    stateRef.current = closed.state;
    if (closed.event) emitClose(closed.event);
  // Unmount only: emitClose uses ref-backed callbacks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isVoiceActive: () => stateRef.current.active,
    lastTurnOpenAtRef,
    floorsRef,
    reset,
    config: configRef.current,
  };
}
