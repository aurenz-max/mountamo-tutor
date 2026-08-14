'use client';

/**
 * LiveMicListener — `LuminaMicListener` wired to the live Lumina session's mic.
 *
 * The kit's orb is state-driven and hook-agnostic on purpose: it takes a
 * `level` so it can be fed by useSpokenWordCapture, useVoiceAnswer, PipLab's
 * own capture, or the session. That stays true. This is the ONE binding of it
 * to `LuminaAIProvider`, for surfaces that draw the session's mic directly
 * rather than through `JudgedMicPanel`.
 *
 * WHY IT IS A COMPONENT AND NOT A PROP (DI BACKLOG 19b, 2026-08-14). The RMS
 * updates once per captured audio frame. A primitive that reads it and passes
 * it down puts a 30-100Hz value in its OWN render path — board, tiles, summary
 * and all re-render for a spike ring at the bottom of the card. Subscribing
 * inside the leaf that paints it stops the render here.
 *
 *   <LiveMicListener state={micState} isSupported={isSupported} … />
 *
 * Use `JudgedMicPanel` instead on a judged surface — it wraps this same orb
 * with the runner's status line and the voice/gesture label branch.
 */

import React from 'react';
import { useMicLevel } from '@/contexts/LuminaAIContext';
import { LuminaMicListener, type LuminaMicListenerProps } from '../ui';

export type LiveMicListenerProps = Omit<LuminaMicListenerProps, 'level'>;

const LiveMicListener: React.FC<LiveMicListenerProps> = (props) => {
  const level = useMicLevel();
  return <LuminaMicListener {...props} level={level} />;
};

export default LiveMicListener;
