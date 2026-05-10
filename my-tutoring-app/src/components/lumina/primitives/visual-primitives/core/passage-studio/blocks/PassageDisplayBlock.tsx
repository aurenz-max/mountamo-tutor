'use client';

import React from 'react';
import BlockShell from './BlockShell';
import PassageRenderer, { type AnchorTone } from '../PassageRenderer';
import ReadAloudButton from '../ReadAloudButton';
import type {
  PassageDisplayBlockData,
  PassageStimulus,
  PassageSpan,
} from '../types';

interface PassageDisplayBlockProps {
  data: PassageDisplayBlockData;
  stimulus: PassageStimulus;
  /** Anchors from elsewhere in the orchestrator (e.g. active block) to highlight here. */
  highlightAnchors?: Array<{ span: PassageSpan; tone: AnchorTone; key?: string }>;
  /** Triggers AI tutor to read the stimulus aloud. */
  onReadAloud?: () => void;
  innerRef?: React.Ref<HTMLDivElement>;
}

/**
 * Display-only block that renders the stimulus (or an excerpt of it). When the
 * orchestrator passes `highlightAnchors`, those spans light up on top of the
 * passage. Used as the anchor surface in `stack` layout.
 */
const PassageDisplayBlock: React.FC<PassageDisplayBlockProps> = ({
  data,
  stimulus,
  highlightAnchors,
  onReadAloud,
  innerRef,
}) => {
  // If excerpt is set, slice the stimulus down. Anchors get translated into
  // excerpt-relative offsets (and any anchor that doesn't intersect is dropped).
  const renderedStimulus: PassageStimulus = data.excerpt
    ? sliceStimulus(stimulus, data.excerpt)
    : stimulus;

  const translatedAnchors = data.excerpt
    ? translateAnchors(highlightAnchors ?? [], data.excerpt)
    : highlightAnchors;

  return (
    <BlockShell
      innerRef={innerRef}
      blockId={data.id}
      label={data.label}
      accent="slate"
    >
      {onReadAloud && (
        <div className="flex justify-end mb-3 -mt-1">
          <ReadAloudButton onClick={onReadAloud} stimulusKind={renderedStimulus.kind} />
        </div>
      )}
      <PassageRenderer stimulus={renderedStimulus} overlays={translatedAnchors} />
    </BlockShell>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────

function sliceStimulus(stim: PassageStimulus, excerpt: PassageSpan): PassageStimulus {
  const sliced = stim.text.slice(excerpt.start, excerpt.end);
  // Keep the original kind but with truncated text and a synthesized minimal
  // structural representation. We don't bother re-splitting lines/turns for
  // the excerpt because PassageRenderer reads from .text.
  switch (stim.kind) {
    case 'poem':
      return { ...stim, text: sliced, lines: sliced.split('\n') };
    case 'dialogue':
      return { ...stim, text: sliced, turns: stim.turns };
    case 'sentence-set':
      return { ...stim, text: sliced, sentences: sliced.split('\n') };
    case 'prose':
    default:
      return { ...stim, text: sliced };
  }
}

function translateAnchors(
  anchors: Array<{ span: PassageSpan; tone: AnchorTone; key?: string }>,
  excerpt: PassageSpan,
): Array<{ span: PassageSpan; tone: AnchorTone; key?: string }> {
  return anchors
    .filter((a) => a.span.end > excerpt.start && a.span.start < excerpt.end)
    .map((a) => ({
      ...a,
      span: {
        ...a.span,
        start: Math.max(0, a.span.start - excerpt.start),
        end: Math.min(excerpt.end - excerpt.start, a.span.end - excerpt.start),
      },
    }));
}

export default PassageDisplayBlock;
