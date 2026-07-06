'use client';

/**
 * CaptureSurface — the studio's shared mic UI for one useVoiceCapture engine.
 *
 * Renders the right entry affordance per modality (tap-to-talk orb for ptt,
 * start button → live orb for turn/open), the dormancy recovery orb with
 * reason-specific copy, the mic-open latency readout, and the concurrent
 * judging badge. Scenarios supply labels; the engine supplies truth.
 */

import React from 'react';
import { LuminaButton, LuminaMicListener } from '../../ui';
import type { LuminaAccent } from '../../ui/tokens';
import { MAX_AUTO_CAPTURES, type VoiceCapture, type VoiceModality } from '../../hooks/useVoiceCapture';

const MODALITY_ACCENT: Record<VoiceModality, LuminaAccent> = {
  ptt: 'emerald',
  turn: 'cyan',
  open: 'purple',
};

const DORMANT_COPY: Record<Exclude<VoiceCapture['dormantReason'], null>, string> = {
  silence: 'Quiet for two windows — tap the orb when ready.',
  budget: 'Capture budget spent — tap the orb to keep going.',
  idle: 'Mic closed after a quiet spell — tap the orb to reopen.',
};

export interface CaptureSurfaceProps {
  voice: VoiceCapture;
  modality: VoiceModality;
  /** ptt orb prompt / dormancy prompt. */
  idleLabel: string;
  listeningLabel: string;
  /** turn/open start-button text. */
  startLabel: string;
  /** Scenario status line (actuation feedback, judge notes…). */
  statusNote?: string;
}

const CaptureSurface: React.FC<CaptureSurfaceProps> = ({
  voice,
  modality,
  idleLabel,
  listeningLabel,
  startLabel,
  statusNote,
}) => {
  const accent = MODALITY_ACCENT[modality];
  const listener = (dormantAware: boolean) => (
    <LuminaMicListener
      state={voice.state}
      level={voice.level}
      isSupported={voice.isSupported}
      onStart={dormantAware ? voice.resume : voice.start}
      onCancel={voice.stop}
      dormant={dormantAware ? voice.dormant : undefined}
      accent={accent}
      size="lg"
      idleLabel={idleLabel}
      openingLabel="Mic warming up…"
      listeningLabel={listeningLabel}
    />
  );

  return (
    <div className="space-y-3">
      {modality === 'ptt' ? (
        listener(false)
      ) : !voice.active ? (
        <LuminaButton tone="primary" onClick={voice.start} className="text-lg px-8 py-3">
          🎙️ {startLabel}
        </LuminaButton>
      ) : (
        <div className="space-y-2">
          {listener(true)}
          {modality === 'turn' && (
            <p className="text-xs text-slate-500">
              window {voice.windowsUsed}/{MAX_AUTO_CAPTURES}
            </p>
          )}
          {modality === 'open' && voice.inFlight > 0 && (
            <p className="text-xs text-blue-300 animate-pulse">
              judging ×{voice.inFlight} while still listening…
            </p>
          )}
          <LuminaButton onClick={voice.stop}>
            {modality === 'open' ? 'Close mic' : 'End turn'}
          </LuminaButton>
        </div>
      )}

      {voice.micOpenMs !== null && voice.state !== 'idle' && (
        <p className="text-xs text-slate-600">
          mic live in {voice.micOpenMs}ms — ready chirp fired then, not at the tap
        </p>
      )}

      {voice.dormant && voice.dormantReason && (
        <p className="text-amber-300 text-sm">{DORMANT_COPY[voice.dormantReason]}</p>
      )}

      {statusNote && (
        <p
          className={
            voice.state === 'judging'
              ? 'text-blue-300 animate-pulse font-semibold text-sm'
              : 'text-amber-300 text-sm'
          }
        >
          {statusNote}
        </p>
      )}
    </div>
  );
};

export default CaptureSurface;
