'use client';

/**
 * LuminaMicListener — the shared "the mic is live, speak now" surface.
 *
 * Before this existed, every spoken-production primitive (PictureVocabulary,
 * PhonicsBlender, RhymeStudio, SoundSwap, CvcSpeller, LetterSoundLink)
 * hand-rolled the same three-branch cluster: an idle mic button, a thin
 * level bar labelled "Listening…", and a "Checking…" span. Six copies, six
 * slightly-different meters. This is the one Lumina-themed capture surface:
 *
 *   ● a glass-glow accent ORB with a mic in its heart — calm + breathing when
 *     live and ready, tap-to-talk when dormant
 *   ● a radial SPIKE RING around the orb driven by the live mic RMS, so the
 *     student's own voice visibly ripples the circle — the intuitive "it hears
 *     me" signal
 *   ● a settle spinner + "Checking…" while the judge runs
 *
 * It is state-driven and hook-agnostic. Feed it the capture state + level from
 * either useSpokenWordCapture (push-to-talk: omit `dormant`) or useSpokenTurn
 * (always-listening loop: pass `dormant`). The component owns all the visual
 * states; the primitive owns when to mount it and what the answer means.
 *
 *   <LuminaMicListener
 *     state={spoken.state} level={spoken.level} isSupported={spoken.isSupported}
 *     onStart={() => void spoken.start()} onCancel={spoken.cancel}
 *     accent="emerald" idleLabel="Say it!" />
 *
 * Boundary note: the accent HEX map below is the documented paint exception —
 * SVG stroke/fill cannot use Tailwind class strings, so canvas-style paint is
 * resolved to hex here (mirrors how LuminaScoreRing paints its ring).
 */

import React, { useEffect, useId, useReducer, useRef } from 'react';
import type { LuminaAccent } from './tokens';

/** Capture lifecycle — matches SpokenCaptureState without coupling to the hook. */
export type MicListenerState = 'idle' | 'armed' | 'recording' | 'judging';

export interface LuminaMicListenerProps {
  /** Capture lifecycle from the spoken hook. */
  state: MicListenerState;
  /** Live RMS level (raw, ~0..0.15) — normalized internally. */
  level: number;
  /** Hide the whole surface when the browser has no mic. */
  isSupported: boolean;
  /** Begin listening (a user gesture, or the dormancy-recovery gesture). */
  onStart: () => void;
  /** Stop listening. Renders a quiet "✕ stop" while live when provided. */
  onCancel?: () => void;
  /**
   * Auto-listening loop has stopped (useSpokenTurn.dormant) — show the
   * tap-to-talk orb. OMIT for push-to-talk, where `idle` alone means "offer
   * the button". While an auto loop is mid-rearm (idle but not dormant) the
   * live surface is kept so it never flickers back to a button.
   */
  dormant?: boolean;
  accent?: LuminaAccent;
  size?: 'sm' | 'md' | 'lg';
  /** Prompt on the tap-to-talk orb. */
  idleLabel?: string;
  /** Prompt while armed/waiting for the first sound. */
  listeningLabel?: string;
  /** Prompt while a voice is being captured. */
  recordingLabel?: string;
  /** Prompt while the judge runs. */
  judgingLabel?: string;
  className?: string;
}

const LEVEL_CEIL = 0.12; // RMS that reads as a "full" spike (bench-tuned ceiling)
const NUM_BARS = 56;

// SVG paint — accent hues at the Tailwind-400 weight. See boundary note above.
const ACCENT_HEX: Record<LuminaAccent, string> = {
  orange: '#fb923c',
  emerald: '#34d399',
  cyan: '#22d3ee',
  amber: '#fbbf24',
  blue: '#60a5fa',
  purple: '#c084fc',
  pink: '#f472b6',
  rose: '#fb7185',
  indigo: '#818cf8',
  teal: '#2dd4bf',
};

const SIZES = {
  sm: { box: 104, label: 'text-xs', mic: 22 },
  md: { box: 132, label: 'text-sm', mic: 28 },
  lg: { box: 168, label: 'text-base', mic: 36 },
} as const;

// viewBox geometry (0..200)
const CX = 100;
const CY = 100;
const INNER = 52; // spike base radius
const MAX_LEN = 34; // spike length at full level
const BASE_LEN = 2.5; // resting spike nub

const LuminaMicListener: React.FC<LuminaMicListenerProps> = ({
  state,
  level,
  isSupported,
  onStart,
  onCancel,
  dormant,
  accent = 'emerald',
  size = 'md',
  idleLabel = 'Tap to talk',
  listeningLabel = 'Listening…',
  recordingLabel = 'Listening…',
  judgingLabel = 'Checking…',
  className,
}) => {
  // useId() yields colon-bearing strings (":r0:"); strip them so the SVG
  // url(#…) gradient reference is a clean fragment id across browsers.
  const gradId = `mic-glow-${useId().replace(/:/g, '')}`;
  // Rolling ring buffer: newest level pushed to the front so a loud syllable
  // ripples around the circle. Kept in a ref (mutated in place) + a tick to
  // repaint, so we don't reallocate an array on every ~12fps audio frame.
  const barsRef = useRef<number[]>(new Array(NUM_BARS).fill(0));
  const [, tick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const norm = Math.max(0, Math.min(1, level / LEVEL_CEIL));
    const buf = barsRef.current;
    buf.unshift(norm);
    if (buf.length > NUM_BARS) buf.pop();
    tick();
  }, [level]);

  // Drain the ring the moment we stop actively listening, so old spikes don't
  // freeze on screen during judging / after the turn ends.
  useEffect(() => {
    if (state === 'idle' || state === 'judging') {
      barsRef.current = new Array(NUM_BARS).fill(0);
      tick();
    }
  }, [state]);

  if (!isSupported) return null;

  const sz = SIZES[size];
  const color = ACCENT_HEX[accent];
  // Push-to-talk (dormant omitted): idle === offer the button. Auto loop: only
  // when explicitly dormant, so a mid-rearm idle keeps the live surface.
  const showButton = state === 'idle' && (dormant ?? true);
  const live = !showButton;
  const judging = state === 'judging';
  const recording = state === 'recording';

  const bars = barsRef.current;
  const currentNorm = bars[0] ?? 0;
  const coreScale = live && !judging ? 1 + currentNorm * 0.08 : 1;

  const label = showButton
    ? idleLabel
    : judging
      ? judgingLabel
      : recording
        ? recordingLabel
        : listeningLabel;

  const spikes = bars.map((v, i) => {
    const a = (i / NUM_BARS) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const len = BASE_LEN + v * MAX_LEN;
    return (
      <line
        key={i}
        x1={CX + cos * INNER}
        y1={CY + sin * INNER}
        x2={CX + cos * (INNER + len)}
        y2={CY + sin * (INNER + len)}
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={live ? 0.3 + v * 0.7 : 0.16}
      />
    );
  });

  const orb = (
    <>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity={live ? 0.5 : 0.28} />
            <stop offset="65%" stopColor={color} stopOpacity={live ? 0.12 : 0.07} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* soft accent glow */}
        <circle cx={CX} cy={CY} r={72} fill={`url(#${gradId})`} />
        {/* voice-reactive spike ring, scaled subtly by the current level */}
        <g transform={`translate(${CX} ${CY}) scale(${coreScale}) translate(${-CX} ${-CY})`}>
          {spikes}
        </g>
        {/* core ring — breathes when live-and-ready to signal an open mic */}
        <circle
          cx={CX}
          cy={CY}
          r={46}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeOpacity={live ? 0.55 : 0.3}
          className={live && !judging ? 'animate-pulse' : undefined}
        />
      </svg>
      {/* center glyph: mic when armed/ready, a settle spinner while judging */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {judging ? (
          <div
            className="rounded-full border-2 border-white/20 border-t-white/70 animate-spin"
            style={{ width: sz.mic, height: sz.mic }}
          />
        ) : (
          <span style={{ fontSize: sz.mic }} className="leading-none select-none">
            🎙️
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ''}`}>
      {showButton ? (
        <button
          type="button"
          onClick={onStart}
          aria-label={idleLabel}
          className="relative transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-full"
          style={{ width: sz.box, height: sz.box }}
        >
          {orb}
        </button>
      ) : (
        <div className="relative" style={{ width: sz.box, height: sz.box }}>
          {orb}
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        className={`${sz.label} font-semibold text-center ${
          judging ? 'text-slate-400 animate-pulse' : live ? 'text-slate-200' : 'text-slate-300'
        }`}
      >
        {label}
      </div>

      {live && !judging && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-500 text-xs hover:text-slate-300 transition-colors"
          aria-label="Stop listening"
        >
          ✕ stop
        </button>
      )}
    </div>
  );
};

export default LuminaMicListener;
