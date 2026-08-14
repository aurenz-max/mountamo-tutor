'use client';

/**
 * JudgedMicPanel — the judged loop's stage furniture: the live-capture orb, the
 * runner's status line under it, and whatever the port hangs below (tap-to-hear).
 *
 * Fourteen ports rendered this block byte-identically. It is shared here for one
 * reason bigger than the line count: **the orb must not claim to be listening
 * for an answer it will not receive.** A judged item is answered with the mouth
 * or with the hands (`answerKind`), and on a gesture item the runner HOLDS THE
 * ACTIVITY BRACKET — the mic stays open and capturing, but no turn is ever
 * committed, so "I’m listening" is a lie the child can act on. letter-spotter
 * proved the branch and ten-frame proved that the gesture wording is per-port
 * ("Show me on the frame"); every port inherits both from here instead of
 * hardcoding the voice label and hoping all its items are spoken.
 *
 * WRAPS `LuminaMicListener`, never replaces it — that orb is the ONE live-capture
 * surface in the app. The kit is the frame, never the interaction; this is the
 * judged family's frame around the kit's.
 *
 * Two prop shapes, because four ports (phonics-blender, sound-swap, word-flip,
 * cvc-speller) predate `useJudgedScriptRunner` and drive the loop themselves:
 *
 * ```tsx
 * <JudgedMicPanel run={runner} gestureLabel="Show me on the frame" />
 *
 * <JudgedMicPanel
 *   state={micState} level={ctx.micLevel} statusLine={statusLine}
 *   onStart={() => void prepareLive()} onCancel={…}
 *   answerKind={item.task === 'spell-word' ? 'gesture' : 'voice'}
 *   gestureLabel="Your turn — fill the boxes"
 * />
 * ```
 */

import React from 'react';
import { LuminaMicListener, type MicListenerState } from '../ui';
import type { JudgedScriptItem } from '../hooks/judgedScriptContract';
import type { JudgedScriptRun } from '../hooks/useJudgedScriptRunner';

/** What the panel needs off a runner. Widened to the base item type — the run
 *  is only read here, so a port's narrower run assigns cleanly. */
export type JudgedRunSurface = Pick<
  JudgedScriptRun<JudgedScriptItem>,
  'micState' | 'micLevel' | 'statusLine' | 'start' | 'cancelListening' | 'currentItem'
>;

interface JudgedMicPanelCommonProps {
  /**
   * How the CURRENT item is answered. Omit on a run-driven panel and it is read
   * from `run.currentItem`; pass it only to override (a port whose item type
   * carries the distinction under another name).
   */
  answerKind?: JudgedScriptItem['answerKind'];
  /** What a hands item's turn is, in this primitive's own words. */
  gestureLabel?: string;
  /** Rarely overridden — the mouth-item label. */
  voiceLabel?: string;
  idleLabel?: string;
  openingLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Escape hatch; defaults to a live probe for a usable microphone. */
  isSupported?: boolean;
  className?: string;
  /** Affordances that belong under the status line (tap-to-hear). */
  children?: React.ReactNode;
}

interface JudgedMicPanelRunProps extends JudgedMicPanelCommonProps {
  run: JudgedRunSurface;
  state?: never;
  level?: never;
  statusLine?: never;
  onStart?: never;
  onCancel?: never;
}

interface JudgedMicPanelManualProps extends JudgedMicPanelCommonProps {
  run?: never;
  state: MicListenerState;
  level: number;
  statusLine: string;
  onStart: () => void;
  onCancel?: () => void;
}

export type JudgedMicPanelProps = JudgedMicPanelRunProps | JudgedMicPanelManualProps;

const JudgedMicPanel: React.FC<JudgedMicPanelProps> = (props) => {
  const {
    answerKind,
    gestureLabel = 'Your turn — tap it',
    voiceLabel = 'I’m listening',
    idleLabel = 'Tap to start',
    openingLabel = 'Getting ready…',
    size = 'lg',
    isSupported,
    className,
    children,
  } = props;

  const run = props.run;
  const state = run ? run.micState : props.state;
  const level = run ? run.micLevel : props.level;
  const statusLine = run ? run.statusLine : props.statusLine;
  const onCancel = run ? run.cancelListening : props.onCancel;
  const onStart = run ? () => void run.start() : props.onStart;

  const kind = answerKind ?? run?.currentItem?.answerKind;
  // Same probe every port ran locally. Computed at render, not module scope, so
  // it reads the environment the panel is actually painting in.
  const supported = isSupported
    ?? (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);

  return (
    <div className={`flex flex-col items-center gap-3 pt-1 ${className ?? ''}`}>
      {/* ONE start gesture: connect, open the mic, opening cue, arm. A browser
          will not open a microphone without a gesture — never per answer, never
          a push-to-talk button the child has to find mid-challenge. */}
      <LuminaMicListener
        state={state}
        level={level}
        isSupported={supported}
        onStart={onStart}
        onCancel={onCancel}
        size={size}
        idleLabel={idleLabel}
        openingLabel={openingLabel}
        listeningLabel={kind === 'gesture' ? gestureLabel : voiceLabel}
      />
      <p className="text-sm text-slate-300">{statusLine}</p>
      {children}
    </div>
  );
};

export default JudgedMicPanel;
