'use client';

/**
 * useLiveVoiceTurns — open-mic turn authority over a Gemini Live session.
 *
 * Wraps the pure voiceTurnMachine over LuminaAIContext's mic level and
 * playback state, and translates its events into the manual-activity
 * brackets Gemini needs (`sendActivityStart` / `sendActivityEnd`). Built for
 * sessions connected with `audio_input.manual_activity: true` — Gemini's own
 * VAD is off and no learner turn exists unless this hook opens one.
 *
 * Contract (see docs in voiceTurnMachine.ts for the why):
 * - The mic is never gated on tutor audio; opening a turn while the tutor is
 *   audible is native barge-in (Gemini interrupts; the client flushes on
 *   ai_interrupted).
 * - DI-2 dual threshold: barge-in demands `bargeInMultiplier ×` the silence
 *   bar, so AEC echo residue doesn't chop the tutor's lines.
 * - Consumers anchor attempts to these local voice turns — NOT to Live input
 *   transcription, which can be lost under barge-in (DI-1).
 *
 * Calibration groundwork: the hook keeps EMA noise floors for both regimes —
 * `ambient` (tutor silent, no voice open) and `echo` (tutor audible, no voice
 * open). Surfaces can display them and derive threshold suggestions; a future
 * calibration beat will set the config from them automatically.
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

export interface VoiceFloors {
  /** EMA of mic RMS while the tutor is silent and no turn is open. */
  ambientRms: number;
  /** EMA of mic RMS while tutor audio plays and no turn is open — the AEC
   *  echo residual on this device at this volume. */
  echoRms: number;
}

export interface LiveVoiceTurnsOptions {
  /** Master switch — typically "a run is active". Disabling force-closes any
   *  open turn (activityEnd included) so Gemini is never left mid-turn. */
  enabled: boolean;
  config?: Partial<VoiceTurnConfig>;
  /** A turn opened; activityStart has already been sent. */
  onTurnOpen?: (event: Extract<VoiceTurnEvent, { kind: 'open' }>) => void;
  /** A turn closed; activityEnd has already been sent. Fires for ALL closes,
   *  including belowMinVoice blips — check the flag before logging/anchoring. */
  onTurnClose?: (event: Extract<VoiceTurnEvent, { kind: 'close' }>) => void;
}

export interface LiveVoiceTurns {
  /** Synchronous read of whether a local turn is currently open. Ref-backed —
   *  safe inside timers and event handlers (cue gates, phantom guards). */
  isVoiceActive: () => boolean;
  /** Monotonic timestamp of the most recent turn open, or null. Cleared by
   *  the consumer when it anchors an attempt to the turn (DI-1 model). */
  lastTurnOpenAtRef: React.MutableRefObject<number | null>;
  /** Live noise-floor telemetry for both regimes. */
  floorsRef: React.MutableRefObject<VoiceFloors>;
  /** Force-close any open turn and clear floors/turn state (run reset). */
  reset: () => void;
  /** The resolved config in effect (defaults + overrides). */
  config: VoiceTurnConfig;
}

const FLOOR_EMA_ALPHA = 0.05;

export function useLiveVoiceTurns(options: LiveVoiceTurnsOptions): LiveVoiceTurns {
  const ctx = useLuminaAIContext();
  const { enabled } = options;

  const config: VoiceTurnConfig = {
    ...DEFAULT_VOICE_TURN_CONFIG,
    ...options.config,
  };

  const stateRef = useRef(IDLE_VOICE_TURN);
  const lastTurnOpenAtRef = useRef<number | null>(null);
  const floorsRef = useRef<VoiceFloors>({ ambientRms: 0, echoRms: 0 });
  const configRef = useRef(config);
  configRef.current = config;
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const emitClose = useCallback(
    (event: Extract<VoiceTurnEvent, { kind: 'close' }>) => {
      ctx.sendActivityEnd();
      callbacksRef.current.onTurnClose?.(event);
    },
    [ctx],
  );

  // Frame loop: micLevel state updates per capture frame; each update steps
  // the machine once. Mirrors the bench's original inline effect.
  useEffect(() => {
    if (!enabled) return;
    const now = performance.now();
    const frame = { level: ctx.micLevel, tutorAudible: ctx.isAudioPlaying, now };

    // Noise-floor telemetry only while no turn is open (an open turn's audio
    // is voice, not floor).
    if (!stateRef.current.active) {
      const floors = floorsRef.current;
      if (ctx.isAudioPlaying) {
        floors.echoRms = floors.echoRms === 0
          ? ctx.micLevel
          : floors.echoRms + FLOOR_EMA_ALPHA * (ctx.micLevel - floors.echoRms);
      } else {
        floors.ambientRms = floors.ambientRms === 0
          ? ctx.micLevel
          : floors.ambientRms + FLOOR_EMA_ALPHA * (ctx.micLevel - floors.ambientRms);
      }
    }

    const step = stepVoiceTurn(stateRef.current, frame, configRef.current);
    stateRef.current = step.state;
    if (!step.event) return;
    if (step.event.kind === 'open') {
      lastTurnOpenAtRef.current = step.event.at;
      ctx.sendActivityStart();
      callbacksRef.current.onTurnOpen?.(step.event);
      return;
    }
    emitClose(step.event);
  }, [ctx, ctx.micLevel, ctx.isAudioPlaying, enabled, emitClose]);

  const reset = useCallback(() => {
    const closed = closeVoiceTurn(stateRef.current, configRef.current);
    stateRef.current = closed.state;
    if (closed.event) emitClose(closed.event);
    lastTurnOpenAtRef.current = null;
    floorsRef.current = { ambientRms: 0, echoRms: 0 };
  }, [emitClose]);

  // Disable / unmount: never leave Gemini holding an open turn.
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
  // Unmount-only cleanup; emitClose is stable per ctx.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isVoiceActive: () => stateRef.current.active,
    lastTurnOpenAtRef,
    floorsRef,
    reset,
    config,
  };
}
