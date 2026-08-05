'use client';

/**
 * Open-mic turn authority over a Gemini Live session.
 *
 * The public hook consumes LuminaAIContext for standalone surfaces. The
 * transport-taking variant lets LuminaAIProvider own the single lesson-level
 * instance without trying to consume its own context.
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
  micLevel: number;
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
    micLevel: ctx.micLevel,
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

  const emitClose = useCallback((event: Extract<VoiceTurnEvent, { kind: 'close' }>) => {
    transport.sendActivityEnd();
    callbacksRef.current.onTurnClose?.(event);
  }, [transport.sendActivityEnd]);

  useEffect(() => {
    if (!enabled) return;
    const now = performance.now();

    if (!stateRef.current.active) {
      calibrationRef.current = observeVoiceFloor(
        calibrationRef.current,
        transport.micLevel,
        transport.isTutorAudible,
      );
      const thresholds = deriveVoiceThresholds(calibrationRef.current, baseConfig);
      floorsRef.current = {
        ambientRms: calibrationRef.current.ambientFloor,
        echoRms: calibrationRef.current.echoFloor,
        ...thresholds,
      };
      configRef.current = {
        ...baseConfig,
        silenceThreshold: thresholds.ambientOpen,
        bargeInMultiplier: thresholds.echoOpen / Math.max(thresholds.ambientOpen, Number.EPSILON),
      };
      // The calibration beat is real, not telemetry-only: do not let an
      // arbitrary device floor open a phantom turn before that regime has
      // enough samples to set its bar.
      const activeRegimeReady = transport.isTutorAudible
        ? thresholds.echoReady
        : thresholds.ambientReady;
      if (!activeRegimeReady) return;
    }

    const step = stepVoiceTurn(stateRef.current, {
      level: transport.micLevel,
      tutorAudible: transport.isTutorAudible,
      now,
    }, configRef.current);
    stateRef.current = step.state;
    if (!step.event) return;
    if (step.event.kind === 'open') {
      lastTurnOpenAtRef.current = step.event.at;
      transport.sendActivityStart();
      callbacksRef.current.onTurnOpen?.(step.event);
      return;
    }
    emitClose(step.event);
  }, [
    transport.micLevel,
    transport.isTutorAudible,
    transport.sendActivityStart,
    enabled,
    emitClose,
    baseConfig.framePeriodMs,
    baseConfig.silenceCloseMs,
    baseConfig.minVoiceMs,
    baseConfig.hysteresisHoldRatio,
  ]);

  const reset = useCallback(() => {
    const closed = closeVoiceTurn(stateRef.current, configRef.current);
    stateRef.current = closed.state;
    if (closed.event) emitClose(closed.event);
    lastTurnOpenAtRef.current = null;
    calibrationRef.current = EMPTY_VOICE_CALIBRATION;
    floorsRef.current = {
      ambientRms: 0,
      echoRms: 0,
      ambientOpen: baseConfig.silenceThreshold,
      echoOpen: baseConfig.silenceThreshold * baseConfig.bargeInMultiplier,
      ambientReady: false,
      echoReady: false,
    };
  }, [baseConfig.bargeInMultiplier, baseConfig.silenceThreshold, emitClose]);

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
