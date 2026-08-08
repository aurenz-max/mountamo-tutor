'use client';

/**
 * PipCharacter — the Curator's embodied face, as a standalone creature.
 *
 * Extracted from CuratorCompanion so the character can be reused (idle screen,
 * completion screen, onboarding) and so its behaviour can be reasoned about on
 * its own. Pure presentation: it takes a mood + a live mic level and owns every
 * pixel of the performance. It knows nothing about Gemini, sessions, or prompts.
 *
 * What makes it feel alive (in rough order of how much each one buys):
 *
 *  1. IT HEARS YOU. `level` is the raw mic RMS from the lesson's open mic. It
 *     drives a halo that opens with the student's own voice — the same "it hears
 *     me" signal LuminaMicListener gives capture surfaces, but on the character,
 *     where a 5-year-old is already looking. A silent open mic still breathes,
 *     so "live but quiet" never reads as "dead".
 *  2. IT LOOKS AT YOU. The pupils track the pointer through a spring, off a
 *     window listener writing MotionValues — no React re-render per mousemove.
 *  3. IT CAN BE TOUCHED. `onPoke` makes Pip a real button: squash, sparkle
 *     burst, earcon. Tapping the character is the most K-5-native affordance on
 *     the screen; a text button is the least.
 *  4. BROWS. Two rotating paths carry more mood than eyes+mouth combined, for
 *     ~10 lines. The mood table below is the whole emotional range.
 *  5. A GROUND SHADOW phase-locked to the float, which is what sells the bounce
 *     as weight rather than drift.
 *
 * ACCESSIBILITY: every looping animation is gated on `useReducedMotion()`. Under
 * reduce-motion Pip holds a static, still-expressive pose — mood is carried by
 * brow/eye/mouth SHAPE, which survives with no motion at all. Pointer tracking
 * is also disabled there (it is unrequested movement).
 *
 * Coordinates: the art is drawn in the original 0..100 space; the viewBox is
 * widened to -8..108 purely to give the halo and sparkles room to escape the
 * body without clipping. `transform-origin` values are therefore plain user
 * units (SVG's default `transform-box: view-box`).
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion, useSpring } from 'framer-motion';
import { SoundManager } from '../utils/SoundManager';

export type PipMood = 'sleeping' | 'thinking' | 'speaking' | 'listening' | 'happy' | 'excited';

/** Mic RMS at which the halo is fully open. Matches LuminaMicListener's ~0..0.15 raw scale. */
const MIC_FULL_SCALE = 0.12;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Brow pose per mood — the cheapest expressive lever in the whole character,
 * and the easiest one to get badly wrong.
 *
 * SIGN CONVENTION, because it bites: rotating a brow so its INNER end (the one
 * nearer the nose) drops is the universal anger signal — positive rotate on the
 * left, negative on the right. Doing that to both at once is a scowl, not
 * concentration, no matter what the mouth is doing. Inner ends UP is the other
 * trap: that reads as worried or pleading.
 *
 * So the poses below are per-side rather than mirrored, and keep rotation near
 * zero. 'thinking' gets its meaning from a MILD asymmetry plus averted eyes (see
 * the gaze effect) — a big brow gap on its own doesn't read as pondering, it
 * reads as "huh?". Pip wears this on every single turn, so it has to be
 * neutral-friendly at a glance.
 *
 * GEOMETRY CAP: brows live at y=39 with ends at cx±6.5, and the body ellipse
 * edge under the OUTER end sits at y≈34. Raising much past -3.5 walks the brow
 * off the top of the head — it renders floating outside the silhouette. If a
 * mood needs to look more surprised, widen the eyes; don't raise the brows.
 */
interface BrowPose {
  y: number;
  rotate: number;
}
export const BROW: Record<PipMood, { left: BrowPose; right: BrowPose }> = {
  sleeping: { left: { y: 3, rotate: 0 }, right: { y: 3, rotate: 0 } },
  // One slightly up, one resting. Small on purpose — the averted gaze is doing
  // the real work, and a wide gap tips straight over into confusion.
  thinking: { left: { y: -2.5, rotate: -2 }, right: { y: 0.5, rotate: 0 } },
  speaking: { left: { y: -1, rotate: 0 }, right: { y: -1, rotate: 0 } },
  // Attentive, symmetric, open — "go on, I'm with you".
  listening: { left: { y: -2.5, rotate: 0 }, right: { y: -2.5, rotate: 0 } },
  happy: { left: { y: 0, rotate: 0 }, right: { y: 0, rotate: 0 } },
  excited: { left: { y: -3.5, rotate: 0 }, right: { y: -3.5, rotate: 0 } },
};

/** Eye openness per mood. Shape alone must carry the mood under reduce-motion. */
const EYE_SCALE_Y: Record<PipMood, number> = {
  sleeping: 0.12,
  thinking: 0.9,
  speaking: 1,
  listening: 1.12,
  happy: 1,
  excited: 1.15,
};

const MOOD_LABEL: Record<PipMood, string> = {
  sleeping: 'Pip is asleep. Tap to wake Pip up',
  thinking: 'Pip is thinking',
  speaking: 'Pip is talking',
  listening: 'Pip is listening to you',
  happy: 'Pip, your helper',
  excited: 'Pip is excited',
};

/** Four-point sparkle, centred on its own origin so it can be translated freely. */
const STAR = 'M 0 -3.6 L 1.05 -1.05 L 3.6 0 L 1.05 1.05 L 0 3.6 L -1.05 1.05 L -3.6 0 L -1.05 -1.05 Z';

/** Where poke/celebration sparkles fly to, and in what order. */
const SPARKS = [
  { x: 14, y: 32 },
  { x: 86, y: 36 },
  { x: 24, y: 82 },
  { x: 78, y: 84 },
  { x: 50, y: 8 },
  { x: 92, y: 62 },
];

export interface PipCharacterProps {
  mood: PipMood;
  /** Live student mic RMS (~0..0.15). Drives the "I can hear you" halo. */
  level?: number;
  /** Force the mouth loop independently of mood (default: mood === 'speaking'). */
  talking?: boolean;
  /** Rendered size in px. Pip is the emotional anchor — do not go below ~64. */
  size?: number;
  /** Makes Pip a real button. Fires on tap/Enter, after the local reaction plays. */
  onPoke?: () => void;
  /** Eyes follow the pointer. Auto-disabled while asleep or under reduced motion. */
  trackPointer?: boolean;
  /** Accessible name. Defaults to a mood-derived description. */
  label?: string;
  className?: string;
}

export const PipCharacter: React.FC<PipCharacterProps> = ({
  mood,
  level = 0,
  talking,
  size = 128,
  onPoke,
  trackPointer = true,
  label,
  className = '',
}) => {
  const reduced = useReducedMotion();
  const asleep = mood === 'sleeping';
  const excited = mood === 'excited';
  const thinking = mood === 'thinking';
  const listening = mood === 'listening';
  const isTalking = talking ?? mood === 'speaking';

  const rootRef = useRef<HTMLDivElement>(null);
  const squash = useAnimationControls();
  const [burst, setBurst] = useState(0);

  // Normalised loudness. Kept as a plain number: the provider already re-renders
  // every consumer on each audio frame, so a MotionValue would buy nothing here.
  const heard = clamp(level / MIC_FULL_SCALE, 0, 1);

  // ── Gaze ────────────────────────────────────────────────────────────────
  // Pointer → pupil offset in user units, sprung so the eyes settle rather than
  // snap. Written straight to MotionValues: no state, no re-render per move.
  const gazeX = useSpring(0, { stiffness: 260, damping: 24, mass: 0.35 });
  const gazeY = useSpring(0, { stiffness: 260, damping: 24, mass: 0.35 });

  useEffect(() => {
    // Thinking BREAKS eye contact. Averting the eyes up and away is the single
    // strongest "working on it" signal a face has — and it is honest, since the
    // tutor really is computing rather than attending to the student. Without
    // it the brows and mouth have to carry the whole mood alone, and they
    // overshoot into confusion trying. The spring makes the glance drift away.
    if (thinking) {
      gazeX.set(-2.6);
      gazeY.set(-2.2);
      return;
    }
    if (!trackPointer || asleep || reduced) {
      gazeX.set(0);
      gazeY.set(0);
      return;
    }
    const onMove = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Saturate at roughly one body-width away, so the eyes are already at full
      // deflection for anything across the lesson rather than only right beside Pip.
      gazeX.set(clamp((e.clientX - cx) / (r.width * 1.4), -1, 1) * 3.4);
      gazeY.set(clamp((e.clientY - cy) / (r.height * 1.4), -1, 1) * 2.4);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [thinking, trackPointer, asleep, reduced, gazeX, gazeY]);

  // ── Poke ────────────────────────────────────────────────────────────────
  const handlePoke = () => {
    if (!onPoke) return;
    // Direct user gesture, so the AudioContext is unlocked and an earcon is safe.
    SoundManager.playById(asleep ? 'toggleOn' : 'pop');
    if (!reduced) {
      squash.start({
        scale: [1, 0.88, 1.1, 1],
        rotate: [0, -5, 4, 0],
        transition: { duration: 0.52, ease: 'easeOut' },
      });
      setBurst((n) => n + 1);
    }
    onPoke();
  };

  const floatTransition = {
    duration: asleep ? 3.4 : excited ? 0.55 : 2.6,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  };

  const bodyFloat = reduced
    ? {}
    : asleep
      ? { y: [0, 1.5, 0] }
      : excited
        ? { y: [0, -11, 0], rotate: [0, -4, 4, 0] }
        : listening
          ? { y: [0, -7, 0] }
          : { y: [0, -5, 0] };

  const Root: any = onPoke ? motion.button : motion.div;
  const rootProps = onPoke
    ? {
        type: 'button' as const,
        onClick: handlePoke,
        'aria-label': label ?? MOOD_LABEL[mood],
        className: 'block h-full w-full cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70',
        whileHover: reduced ? undefined : { scale: 1.06 },
        whileTap: { scale: 0.94 },
      }
    : {
        role: 'img' as const,
        'aria-label': label ?? MOOD_LABEL[mood],
        className: 'block h-full w-full',
      };

  return (
    <div ref={rootRef} className={className} style={{ width: size, height: size }}>
      <Root {...rootProps}>
        <svg viewBox="-8 -6 116 116" width="100%" height="100%" className="overflow-visible">
          <defs>
            <radialGradient id="pip-body" cx="40%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="55%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#6366f1" />
            </radialGradient>
            <radialGradient id="pip-halo" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.55" />
            </radialGradient>
            <filter id="pip-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Ground shadow — phase-locked to the float so the bounce reads as weight. */}
          <motion.ellipse
            cx="50"
            cy="102"
            rx="26"
            ry="4"
            fill="#020617"
            opacity={0.45}
            animate={reduced ? {} : { rx: [26, 21, 26], opacity: [0.45, 0.26, 0.45] }}
            transition={floatTransition}
          />

          {/* "I can hear you" halo — opens with the student's own voice. A live but
              silent mic still breathes at the floor opacity, so quiet ≠ dead. */}
          {listening && (
            <>
              <motion.circle
                cx="50"
                cy="58"
                r="40"
                fill="url(#pip-halo)"
                style={{ transformOrigin: '50px 58px' }}
                animate={{ scale: 1 + heard * 0.24, opacity: 0.18 + heard * 0.6 }}
                transition={{ duration: 0.11, ease: 'linear' }}
              />
              <motion.circle
                cx="50"
                cy="58"
                r="39"
                fill="none"
                stroke="#a5f3fc"
                strokeWidth="1.6"
                style={{ transformOrigin: '50px 58px' }}
                animate={{ scale: 1 + heard * 0.34, opacity: 0.12 + heard * 0.55 }}
                transition={{ duration: 0.14, ease: 'linear' }}
              />
            </>
          )}

          {/* Tap-me cue: a slow ring only while asleep AND tappable. */}
          {asleep && onPoke && !reduced && (
            <motion.circle
              cx="50"
              cy="58"
              r="38"
              fill="none"
              stroke="#67e8f9"
              strokeWidth="1.5"
              style={{ transformOrigin: '50px 58px' }}
              animate={{ scale: [1, 1.18, 1.18], opacity: [0.5, 0, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            />
          )}

          {/* squash layer (poke) wraps the float layer (idle) so neither clobbers the other */}
          <motion.g animate={squash} style={{ transformOrigin: '50px 62px' }}>
            <motion.g animate={bodyFloat} transition={floatTransition}>
              {/* Antenna + spark tip (ties to the Curator's spark brand) */}
              <line x1="50" y1="24" x2="50" y2="12" stroke="#a5f3fc" strokeWidth="2.5" strokeLinecap="round" />
              <motion.circle
                cx="50"
                cy="10"
                r="4"
                fill="#e0f2fe"
                filter="url(#pip-glow)"
                animate={
                  reduced
                    ? {}
                    : asleep
                      ? { opacity: [0.3, 0.5, 0.3] }
                      : { opacity: [0.7, 1, 0.7], r: thinking ? [3.5, 5.4, 3.5] : [4, 4.6, 4] }
                }
                transition={{ duration: thinking ? 0.65 : 2, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Body */}
              <motion.ellipse
                cx="50"
                cy="58"
                rx="34"
                ry="32"
                fill="url(#pip-body)"
                animate={reduced ? {} : { rx: [34, 35.5, 34], ry: [32, 30.5, 32] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Blush — excitement, and a softer version while listening */}
              {(excited || listening) && (
                <>
                  <ellipse cx="31" cy="63" rx="6.5" ry="4.2" fill="#fb7185" opacity={excited ? 0.55 : 0.3} />
                  <ellipse cx="69" cy="63" rx="6.5" ry="4.2" fill="#fb7185" opacity={excited ? 0.55 : 0.3} />
                </>
              )}

              {/* Brows — the mood carrier. Posed per side (see BROW). */}
              {!asleep &&
                ([['left', 34], ['right', 66]] as const).map(([side, cx]) => (
                  <motion.path
                    key={`brow-${side}`}
                    d={`M ${cx - 6.5} 39 Q ${cx} 36 ${cx + 6.5} 39`}
                    stroke="#0f172a"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.85}
                    style={{ transformOrigin: `${cx}px 38px` }}
                    animate={{ y: BROW[mood][side].y, rotate: BROW[mood][side].rotate }}
                    transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  />
                ))}

              {/* Eyes — dark sclera with a blink loop; pupils ride the gaze spring. */}
              {([34, 66] as const).map((cx) => (
                <g key={`eye-${cx}`}>
                  <motion.ellipse
                    cx={cx}
                    cy="52"
                    rx="8"
                    ry="9"
                    fill="#0f172a"
                    style={{ transformOrigin: `${cx}px 52px` }}
                    animate={
                      asleep || reduced
                        ? { scaleY: EYE_SCALE_Y[mood] }
                        : { scaleY: [EYE_SCALE_Y[mood], EYE_SCALE_Y[mood], 0.1, EYE_SCALE_Y[mood]] }
                    }
                    transition={
                      asleep || reduced
                        ? { duration: 0.3 }
                        : { duration: 4.2, times: [0, 0.93, 0.965, 1], repeat: Infinity, ease: 'linear' }
                    }
                  />
                  {!asleep && (
                    <motion.g style={{ x: gazeX, y: gazeY }}>
                      <circle cx={cx} cy="50" r="3.4" fill="#fff" />
                      <circle cx={cx + 1.4} cy="48.4" r="1.2" fill="#fff" opacity="0.9" />
                    </motion.g>
                  )}
                </g>
              ))}

              {/* Closed-eye lashes when asleep */}
              {asleep &&
                ([34, 66] as const).map((cx) => (
                  <line
                    key={`lash-${cx}`}
                    x1={cx - 7}
                    y1="52"
                    x2={cx + 7}
                    y2="52"
                    stroke="#0f172a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                ))}

              {/* Mouth — morphs by mood; the talk loop is deliberately irregular so
                  it reads as speech rather than a metronome. */}
              {asleep ? (
                <ellipse cx="50" cy="72" rx="3" ry="2.5" fill="#0f172a" opacity="0.6" />
              ) : isTalking ? (
                <motion.ellipse
                  cx="50"
                  cy="71"
                  rx="6"
                  fill="#0f172a"
                  animate={reduced ? { ry: 4 } : { ry: [2, 6.8, 3, 5.4, 2.2, 6, 2] }}
                  transition={reduced ? { duration: 0.2 } : { duration: 0.78, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : excited ? (
                <path d="M 38 68 Q 50 82 62 68 Q 50 74 38 68 Z" fill="#0f172a" />
              ) : thinking ? (
                // Calm and near-neutral, tilted very slightly up. A wavy mouth
                // here is the confusion signal, and a down-tilt is a frown —
                // while working, Pip's mouth should say nothing at all.
                <path
                  d="M 43 71.4 Q 50 69.2 57 70.6"
                  stroke="#0f172a"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
              ) : (
                <path d="M 40 70 Q 50 78 60 70" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
              )}

              {/* Z's while sleeping */}
              {asleep && !reduced && (
                <motion.text
                  x="78"
                  y="34"
                  fontSize="12"
                  fontWeight="bold"
                  fill="#a5f3fc"
                  animate={{ opacity: [0, 1, 0], y: [34, 26, 18] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                >
                  z
                </motion.text>
              )}
              {asleep && reduced && (
                <text x="78" y="30" fontSize="12" fontWeight="bold" fill="#a5f3fc" opacity="0.8">
                  z
                </text>
              )}
            </motion.g>
          </motion.g>

          {/* Poke burst — remounts on the counter so the one-shot replays. */}
          {burst > 0 && (
            <g key={burst}>
              {SPARKS.map((s, i) => (
                <motion.path
                  key={i}
                  d={STAR}
                  fill="#fde68a"
                  initial={{ opacity: 0, scale: 0.2, x: 50, y: 58 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.2, 1.15, 0.4], x: s.x, y: s.y }}
                  transition={{ duration: 0.8, delay: i * 0.035, ease: 'easeOut' }}
                />
              ))}
            </g>
          )}

          {/* Celebration sparkles — gentle, continuous, only while excited. */}
          {excited && !reduced && (
            <g>
              {SPARKS.slice(0, 4).map((s, i) => (
                <motion.path
                  key={`joy-${i}`}
                  d={STAR}
                  fill="#fde68a"
                  style={{ transformOrigin: `${s.x}px ${s.y}px` }}
                  transform={`translate(${s.x} ${s.y})`}
                  animate={{ opacity: [0, 0.95, 0], scale: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
                />
              ))}
            </g>
          )}
        </svg>
      </Root>
    </div>
  );
};

export default PipCharacter;
