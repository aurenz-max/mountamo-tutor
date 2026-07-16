'use client';

/**
 * ReadMeButton — the shared "🔊 read the current instruction to me again" affordance
 * for K (pre-reader) math primitives.
 *
 * The reader-fit K band gives the tutor the ORIENT/DISAMBIGUATE beat on every
 * challenge start (a catalog aiDirective), but a non-reader who missed it, or who
 * comes back to the screen after a pause, has no way to RE-HEAR the ask — the
 * question is text they cannot read. This is the persistent, on-demand replay: one
 * tap re-voices the current instruction (and, optionally, the answer-free "what to
 * do" clause), in a CONSISTENT position across every eval mode of a primitive.
 *
 * It is a thin wrapper over the kit's LuminaReadAloud (the one "read this to me"
 * surface — cyan audio-out glyph, learned once). The wrapper exists so the message
 * SHAPE and placement are uniform when this generalizes across K math primitives
 * (BACKLOG systemic item, seeded on comparison-builder 2b) — akin to how
 * PreReaderSelfCheck factors the PRE self-check shape out of six primitives.
 *
 * The tutor turn is NON-SILENT by design (the read-aloud IS the tutor speaking),
 * so the parent's `onAskTutor` should route to a non-silent sendText.
 *
 *   <ReadMeButton
 *     instruction={challenge.instruction}
 *     ask="Tap the side that has more, or the equals in the middle if they match."
 *     onAskTutor={(m) => sendText(m)}
 *   />
 */

import React from 'react';
import { LuminaReadAloud } from '../../ui';
import { SoundManager } from '../../utils/SoundManager';

/**
 * Build the standard "read the current instruction aloud" tutor message. Reads the
 * instruction verbatim, then (optionally) an answer-free reminder of what to do.
 * Never name or hint the answer — this is a replay of the QUESTION, not a hint.
 */
export function buildReadMeMessage(opts: {
  instruction: string;
  ask?: string;
  tag?: string;
}): string {
  const { instruction, ask, tag = '[READ_INSTRUCTION]' } = opts;
  return (
    `${tag} The pre-reader tapped the "read it to me" button and cannot read the screen. `
    + `Read the current instruction aloud, word for word, in one warm child-friendly sentence: "${instruction}". `
    + (ask ? `Then remind them what to do, answer-free: ${ask} ` : '')
    + `Do NOT reveal or hint at the answer — only re-read the question and the ask, then wait.`
  );
}

export interface ReadMeButtonProps {
  /** The current on-screen instruction/question to re-voice. */
  instruction: string;
  /** Optional answer-free "what to do" clause appended after the instruction. */
  ask?: string;
  /** Ripple the glyph while the tutor voice is actually playing. */
  speaking?: boolean;
  /** Route to a NON-silent sendText — the read-aloud is the tutor's spoken turn. */
  onAskTutor: (message: string) => void;
  /** Tag the read-aloud message keys on (default `[READ_INSTRUCTION]`). */
  tag?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * A persistent icon-only LuminaReadAloud that re-voices the current instruction on
 * tap. Icon-only (the label is unreadable to a pre-reader anyway; the glyph IS the
 * affordance) with a ≥44px tap target from the kit's `md` size.
 */
export const ReadMeButton: React.FC<ReadMeButtonProps> = ({
  instruction,
  ask,
  speaking = false,
  onAskTutor,
  tag,
  className,
  'aria-label': ariaLabel,
}) => (
  <LuminaReadAloud
    iconOnly
    size="md"
    accent="cyan"
    speaking={speaking}
    aria-label={ariaLabel ?? 'Read the question to me again'}
    className={className}
    onClick={() => {
      SoundManager.tap();
      onAskTutor(buildReadMeMessage({ instruction, ask, tag }));
    }}
  />
);

export default ReadMeButton;
