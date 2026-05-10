'use client';

import React, { useMemo } from 'react';
import type { PassageSpan, PassageStimulus } from './types';

// ═══════════════════════════════════════════════════════════════════════
// PassageRenderer
//
// Renders a stimulus with anchor-based highlights. Every block in the
// orchestrator can flag anchor spans as "active" (highlighted now) or
// "selectable" (clickable for evidence-highlight mode); this component
// resolves overlap order, layered tones, and click handlers.
// ═══════════════════════════════════════════════════════════════════════

export type AnchorTone =
  | 'active'           // currently in-focus block (split_passage)
  | 'evidence-correct' // student selected and it's evidence
  | 'evidence-wrong'   // student selected but it's not evidence
  | 'evidence-missed'  // student didn't select but it was evidence (revealed)
  | 'selectable'       // candidate span the student can click
  | 'selected'         // candidate span the student has clicked
  | 'reveal';          // post-answer reveal anchor (e.g. mcq evidenceAnchor)

interface AnchorOverlay {
  span: PassageSpan;
  tone: AnchorTone;
  /** Span identity for click handlers — orchestrator-defined string. */
  key?: string;
}

interface PassageRendererProps {
  stimulus: PassageStimulus;
  /** Anchors to render with visual emphasis. Later overlays paint over earlier ones. */
  overlays?: AnchorOverlay[];
  /** Click handler for `selectable` / `selected` overlays. */
  onAnchorClick?: (key: string) => void;
  className?: string;
}

const TONE_CLASSES: Record<AnchorTone, string> = {
  active: 'bg-indigo-400/20 border-b-2 border-indigo-300/70 text-indigo-50',
  'evidence-correct': 'bg-emerald-400/25 border-b-2 border-emerald-300/80 text-emerald-50',
  'evidence-wrong': 'bg-rose-400/25 border-b-2 border-rose-300/80 text-rose-50',
  'evidence-missed': 'bg-amber-400/15 border-b-2 border-dashed border-amber-300/60 text-amber-100',
  selectable:
    'bg-white/5 border-b border-dashed border-slate-400/40 text-slate-100 hover:bg-amber-400/15 hover:border-amber-300/70 cursor-pointer transition-colors',
  selected:
    'bg-amber-400/20 border-b-2 border-amber-300/80 text-amber-50 cursor-pointer hover:bg-amber-400/30 transition-colors',
  reveal: 'bg-cyan-400/20 border-b-2 border-cyan-300/70 text-cyan-50',
};

// ── Slicing logic ───────────────────────────────────────────────────
//
// Given a list of overlays (which may overlap), produce a flat array of
// non-overlapping segments where each segment carries the *topmost* tone.
// Later overlays in the input array win over earlier ones.

interface Segment {
  start: number;
  end: number;
  /** Topmost overlay covering this segment, or undefined for plain text. */
  overlay?: AnchorOverlay;
}

function sliceSegments(textLength: number, overlays: AnchorOverlay[]): Segment[] {
  if (overlays.length === 0 || textLength === 0) {
    return [{ start: 0, end: textLength }];
  }

  // Collect every boundary point.
  const boundaries = new Set<number>([0, textLength]);
  for (const ov of overlays) {
    boundaries.add(Math.max(0, Math.min(ov.span.start, textLength)));
    boundaries.add(Math.max(0, Math.min(ov.span.end, textLength)));
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;

    // Find the topmost overlay covering this segment (last in input order).
    let winning: AnchorOverlay | undefined;
    for (const ov of overlays) {
      if (ov.span.start <= start && ov.span.end >= end) {
        winning = ov;
      }
    }
    segments.push({ start, end, overlay: winning });
  }
  return segments;
}

// ── Main renderer ───────────────────────────────────────────────────

const PassageRenderer: React.FC<PassageRendererProps> = ({
  stimulus,
  overlays = [],
  onAnchorClick,
  className,
}) => {
  const text = stimulus.text;
  const segments = useMemo(() => sliceSegments(text.length, overlays), [text.length, overlays]);

  const inner = segments.map((seg, i) => {
    const sub = text.slice(seg.start, seg.end);
    if (!seg.overlay) {
      return (
        <span key={i} className="whitespace-pre-wrap">
          {sub}
        </span>
      );
    }
    const tone = seg.overlay.tone;
    const clickable = (tone === 'selectable' || tone === 'selected') && !!onAnchorClick && !!seg.overlay.key;
    const cls = TONE_CLASSES[tone];
    return (
      <span
        key={i}
        className={`whitespace-pre-wrap rounded-sm px-0.5 ${cls}`}
        onClick={clickable ? () => onAnchorClick!(seg.overlay!.key!) : undefined}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
      >
        {sub}
      </span>
    );
  });

  // Stimulus-kind-specific shell. The text comes pre-joined so anchor offsets
  // are always valid; the wrapper just adds attribution + structural styling.
  switch (stimulus.kind) {
    case 'poem':
      return (
        <div className={`font-serif ${className || ''}`}>
          <header className="mb-4">
            <h3 className="text-lg font-semibold text-slate-100">{stimulus.title}</h3>
            {stimulus.author && <p className="text-xs text-slate-500 italic mt-0.5">— {stimulus.author}</p>}
          </header>
          <div className="text-[15px] leading-[1.85] text-slate-200">{inner}</div>
        </div>
      );

    case 'dialogue':
      return (
        <div className={`font-serif ${className || ''}`}>
          {stimulus.title && (
            <h3 className="text-lg font-semibold text-slate-100 mb-3">{stimulus.title}</h3>
          )}
          <div className="text-[15px] leading-[1.85] text-slate-200">{inner}</div>
        </div>
      );

    case 'sentence-set':
      return (
        <div className={`text-[15px] leading-[1.9] text-slate-200 ${className || ''}`}>{inner}</div>
      );

    case 'prose':
    default:
      return (
        <div className={className}>
          {(stimulus.title || stimulus.author) && (
            <header className="mb-3">
              {stimulus.title && (
                <h3 className="text-lg font-semibold text-slate-100">{stimulus.title}</h3>
              )}
              {stimulus.author && <p className="text-xs text-slate-500 italic mt-0.5">— {stimulus.author}</p>}
              {stimulus.source && <p className="text-[10px] text-slate-600 uppercase tracking-wider mt-0.5">{stimulus.source}</p>}
            </header>
          )}
          <div className="text-[15px] leading-[1.8] text-slate-200 font-serif">{inner}</div>
        </div>
      );
  }
};

export default PassageRenderer;
