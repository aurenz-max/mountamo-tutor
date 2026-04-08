'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import type { DiagramBlockData } from '../types';
import BlockWrapper from './BlockWrapper';

// ── Shared types ───────────────────────────────────────────────────
interface DiagramExploreProps {
  data: DiagramBlockData & { interactionMode: 'explore' };
  index: number;
}

interface DiagramLabelProps {
  data: DiagramBlockData & { interactionMode: 'label' };
  index: number;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
}

type DiagramBlockProps =
  | DiagramExploreProps
  | DiagramLabelProps
  | { data: DiagramBlockData; index: number; onAnswer?: (blockId: string, correct: boolean, attempts: number) => void; answered?: boolean };

interface LabelPlacement {
  labelId: string;
  text: string;
  position: { x: number; y: number };
}

// ── Flyout card positioning helper ─────────────────────────────────

function getFlyoutPosition(pos: { x: number; y: number }): {
  anchor: 'top' | 'bottom' | 'left' | 'right';
  style: React.CSSProperties;
} {
  // Pick the side with the most space to avoid overflow
  const spaceRight = 100 - pos.x;
  const spaceLeft = pos.x;
  const spaceBottom = 100 - pos.y;
  const spaceTop = pos.y;

  const maxSpace = Math.max(spaceRight, spaceLeft, spaceBottom, spaceTop);

  if (maxSpace === spaceRight && spaceRight > 25) {
    return { anchor: 'right', style: { left: `${pos.x + 3}%`, top: `${pos.y}%`, transform: 'translateY(-50%)' } };
  }
  if (maxSpace === spaceLeft && spaceLeft > 25) {
    return { anchor: 'left', style: { right: `${100 - pos.x + 3}%`, top: `${pos.y}%`, transform: 'translateY(-50%)' } };
  }
  if (maxSpace === spaceTop) {
    return { anchor: 'top', style: { left: `${pos.x}%`, bottom: `${100 - pos.y + 3}%`, transform: 'translateX(-50%)' } };
  }
  return { anchor: 'bottom', style: { left: `${pos.x}%`, top: `${pos.y + 3}%`, transform: 'translateX(-50%)' } };
}

// ═══════════════════════════════════════════════════════════════════
// EXPLORE MODE — Redesigned with flyout cards, spotlight, stagger
// ═══════════════════════════════════════════════════════════════════

const ExploreMode: React.FC<{ data: DiagramBlockData }> = ({ data }) => {
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Staggered marker entrance — reveal one every 120ms
  useEffect(() => {
    if (hasInitialized) return;
    const labelsWithPos = data.labels.filter((l) => l.position);
    if (labelsWithPos.length === 0) return;

    let count = 0;
    const interval = setInterval(() => {
      count++;
      setRevealedCount(count);
      if (count >= labelsWithPos.length) {
        clearInterval(interval);
        setHasInitialized(true);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [data.labels, hasInitialized]);

  const handleLabelClick = (labelId: string) => {
    setActiveLabelId((prev) => (prev === labelId ? null : labelId));
  };

  const activeLabel = data.labels.find((l) => l.id === activeLabelId);
  const labelsWithPos = data.labels.filter((l) => l.position);

  return (
    <div className="space-y-3">
      {/* Image container with vignette + spotlight */}
      <div className="relative rounded-xl overflow-hidden">
        {/* The diagram image */}
        <img
          src={data.imageBase64}
          alt={data.altText}
          className="w-full h-auto object-contain"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
          draggable={false}
        />

        {/* Vignette overlay — blends image edges into card */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(15,23,42,0.6) 100%)',
          }}
        />

        {/* Spotlight dimming — when a label is active, dim everything else */}
        {activeLabelId && activeLabel?.position && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${activeLabel.position.x}% ${activeLabel.position.y}%, transparent 60px, rgba(2,6,23,0.55) 180px)`,
            }}
          />
        )}

        {/* Hotspot markers with staggered entrance */}
        {labelsWithPos.map((label, i) => {
          if (!label.position || i >= revealedCount) return null;
          const isActive = activeLabelId === label.id;
          const labelIndex = data.labels.indexOf(label);
          const flyout = isActive ? getFlyoutPosition(label.position) : null;

          return (
            <React.Fragment key={label.id}>
              {/* Marker */}
              <button
                onClick={() => handleLabelClick(label.id)}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 group"
                style={{
                  left: `${label.position.x}%`,
                  top: `${label.position.y}%`,
                  animation: `diagram-marker-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                }}
              >
                {/* Glow ring */}
                <span
                  className={`absolute rounded-full transition-all duration-300 ${
                    isActive
                      ? 'bg-teal-400/25 scale-100'
                      : 'bg-teal-400/10 scale-75 group-hover:scale-100 group-hover:bg-teal-400/20'
                  }`}
                  style={{ width: 44, height: 44, top: -14, left: -14 }}
                />
                {/* Pulse ring (inactive only) */}
                {!isActive && (
                  <span
                    className="absolute rounded-full border border-teal-400/30 animate-ping"
                    style={{ width: 36, height: 36, top: -10, left: -10, animationDuration: '2.5s' }}
                  />
                )}
                {/* Core dot */}
                <span
                  className={`relative flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold transition-all duration-200 shadow-lg ${
                    isActive
                      ? 'bg-teal-400 text-slate-950 scale-125 shadow-teal-400/50'
                      : 'bg-teal-500/90 text-white group-hover:bg-teal-400 group-hover:scale-110 shadow-teal-500/30'
                  }`}
                >
                  {labelIndex + 1}
                </span>
                {/* Hover name tag (only when not active — flyout replaces it) */}
                {!isActive && (
                  <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-950/95 backdrop-blur-sm border border-teal-500/30 text-teal-200 text-[11px] font-medium px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none shadow-lg shadow-black/40">
                    {label.text}
                  </span>
                )}
              </button>

              {/* Flyout description card (anchored near the marker) */}
              {isActive && flyout && (
                <div
                  className="absolute z-20 w-56 animate-in fade-in zoom-in-95 duration-200"
                  style={flyout.style}
                >
                  <div className="bg-slate-950/95 backdrop-blur-md border border-teal-500/30 rounded-lg p-3 shadow-xl shadow-black/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {labelIndex + 1}
                      </span>
                      <h4 className="text-[13px] font-semibold text-teal-200 leading-tight">{label.text}</h4>
                    </div>
                    <p className="text-[12px] text-slate-300 leading-relaxed">{label.description}</p>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Caption */}
      {data.caption && (
        <p className="text-[11px] text-slate-500 italic text-center px-4">{data.caption}</p>
      )}

      {/* Compact chip strip — replaces the old 2-col grid */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {data.labels.map((label, i) => {
          const isActive = activeLabelId === label.id;
          return (
            <button
              key={label.id}
              onClick={() => handleLabelClick(label.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-teal-500/20 border border-teal-400/40 text-teal-200 shadow-sm shadow-teal-500/10'
                  : 'bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/8 hover:border-white/15'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  isActive ? 'bg-teal-400 text-slate-950' : 'bg-teal-500/30 text-teal-300'
                }`}
              >
                {i + 1}
              </span>
              {label.text}
            </button>
          );
        })}
      </div>

      {/* Keyframe animation for marker entrance */}
      <style jsx>{`
        @keyframes diagram-marker-enter {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// LABEL MODE — Drag labels onto image (evaluable)
// ═══════════════════════════════════════════════════════════════════

const LabelMode: React.FC<{
  data: DiagramBlockData;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
}> = ({ data, onAnswer, answered: answeredProp }) => {
  const [placements, setPlacements] = useState<LabelPlacement[]>([]);
  const [draggedLabel, setDraggedLabel] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(answeredProp ?? false);
  const [feedback, setFeedback] = useState<{
    perLabel: Array<{ labelId: string; correct: boolean; reasoning: string }>;
    overall: string;
    score: number;
  } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const isPlaced = (labelId: string) => placements.some((p) => p.labelId === labelId);

  const handleDragStart = (labelId: string) => {
    if (submitted) return;
    setDraggedLabel(labelId);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!draggedLabel || !imageContainerRef.current || submitted) return;

      const rect = imageContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const label = data.labels.find((l) => l.id === draggedLabel);
      if (!label) return;

      setPlacements((prev) => {
        const existing = prev.findIndex((p) => p.labelId === draggedLabel);
        const newPlacement: LabelPlacement = { labelId: draggedLabel, text: label.text, position: { x, y } };
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newPlacement;
          return updated;
        }
        return [...prev, newPlacement];
      });
      setDraggedLabel(null);
    },
    [draggedLabel, data.labels, submitted],
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleRemove = (labelId: string) => {
    if (submitted) return;
    setPlacements((prev) => prev.filter((p) => p.labelId !== labelId));
  };

  const handleSubmit = useCallback(async () => {
    if (submitted || placements.length !== data.labels.length) return;
    setIsEvaluating(true);

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluateDiagramLabels',
          params: {
            imageBase64: data.imageBase64,
            labels: data.labels.map((l) => ({ id: l.id, text: l.text, description: l.description })),
            studentPlacements: placements,
            learningObjective: data.learningObjective || `Identify key features in the diagram: ${data.caption}`,
          },
        }),
      });

      if (!response.ok) throw new Error('Evaluation request failed');

      const result = await response.json();
      const perLabel = result.labelResults || [];
      const correctCount = perLabel.filter((r: { correct: boolean }) => r.correct).length;
      const score = data.labels.length > 0 ? Math.round((correctCount / data.labels.length) * 100) : 0;

      setFeedback({ perLabel, overall: result.overallFeedback || '', score });
      setSubmitted(true);
      onAnswer(data.id, score >= 70, 1);
    } catch (error) {
      console.error('[DiagramBlock] Evaluation failed:', error);
      setSubmitted(true);
      setFeedback({
        perLabel: data.labels.map((l) => ({ labelId: l.id, correct: false, reasoning: 'Evaluation unavailable' })),
        overall: 'Could not evaluate placements. Try again later.',
        score: 0,
      });
      onAnswer(data.id, false, 1);
    } finally {
      setIsEvaluating(false);
    }
  }, [submitted, placements, data, onAnswer]);

  const allPlaced = placements.length === data.labels.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Image drop zone */}
        <div className="flex-1 relative">
          <div
            ref={imageContainerRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`relative rounded-xl overflow-hidden border-2 transition-colors ${
              draggedLabel ? 'border-teal-500 border-dashed' : 'border-white/10'
            }`}
          >
            <img
              src={data.imageBase64}
              alt={data.altText}
              className="w-full h-auto object-contain"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
              draggable={false}
            />

            {/* Vignette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(15,23,42,0.6) 100%)' }}
            />

            {/* Placed label markers */}
            {placements.map((placement, i) => {
              const labelFeedback = feedback?.perLabel.find((f) => f.labelId === placement.labelId);
              return (
                <div
                  key={placement.labelId}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{
                    left: `${placement.position.x}%`,
                    top: `${placement.position.y}%`,
                  }}
                >
                  <button
                    onClick={() => handleRemove(placement.labelId)}
                    disabled={submitted}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full border-2 text-xs font-medium shadow-lg transition-all ${
                      submitted
                        ? labelFeedback?.correct
                          ? 'bg-emerald-900/90 border-emerald-400/60 text-emerald-200'
                          : 'bg-rose-900/90 border-rose-400/60 text-rose-200'
                        : 'bg-slate-900/90 border-teal-400/60 text-teal-200 hover:border-rose-400/60 hover:text-rose-200 cursor-pointer'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-teal-500/40 flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </span>
                    {placement.text}
                    {!submitted && <span className="text-[10px] opacity-60 ml-1">✕</span>}
                  </button>
                </div>
              );
            })}

            {/* Drop instruction overlay */}
            {draggedLabel && (
              <div className="absolute inset-0 bg-teal-500/5 flex items-center justify-center pointer-events-none">
                <div className="bg-slate-950/90 px-4 py-2 rounded-lg border border-teal-500/40 backdrop-blur-sm">
                  <p className="text-teal-300 text-sm font-medium">
                    Drop to place &ldquo;{data.labels.find((l) => l.id === draggedLabel)?.text}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>

          {data.caption && (
            <p className="text-[11px] text-slate-500 italic text-center mt-2">{data.caption}</p>
          )}
        </div>

        {/* Label chips panel */}
        <div className="lg:w-64 flex-shrink-0 space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">
            Labels ({placements.length}/{data.labels.length})
          </p>

          <div className="space-y-2">
            {data.labels.map((label) => {
              const placed = isPlaced(label.id);
              const labelFeedback = feedback?.perLabel.find((f) => f.labelId === label.id);
              return (
                <div
                  key={label.id}
                  draggable={!submitted && !placed}
                  onDragStart={() => handleDragStart(label.id)}
                  className={`p-2.5 rounded-lg border transition-all ${
                    submitted
                      ? labelFeedback?.correct
                        ? 'bg-emerald-500/10 border-emerald-500/30 opacity-80'
                        : 'bg-rose-500/10 border-rose-500/30 opacity-80'
                      : placed
                        ? 'bg-teal-500/10 border-teal-500/20 opacity-50'
                        : 'bg-white/5 border-white/10 hover:bg-white/8 cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {submitted && labelFeedback ? (
                      <span className={`text-sm ${labelFeedback.correct ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {labelFeedback.correct ? '✓' : '✗'}
                      </span>
                    ) : placed ? (
                      <span className="text-sm text-teal-400">✓</span>
                    ) : (
                      <span className="text-sm text-slate-500">⠿</span>
                    )}
                    <span className={`text-sm ${placed ? 'text-teal-300' : 'text-slate-200'}`}>
                      {label.text}
                    </span>
                  </div>
                  {submitted && labelFeedback?.reasoning && (
                    <p className="text-xs text-slate-400 mt-1 ml-6">{labelFeedback.reasoning}</p>
                  )}
                </div>
              );
            })}
          </div>

          {!submitted && (
            <button
              onClick={handleSubmit}
              disabled={!allPlaced || isEvaluating}
              className="w-full px-4 py-2.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-200 hover:bg-teal-500/20 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isEvaluating ? 'Evaluating...' : 'Check Placement'}
            </button>
          )}

          {feedback && (
            <div className="space-y-2">
              <Badge
                className={
                  feedback.score >= 70
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }
              >
                {feedback.score}% — {feedback.score >= 70 ? 'Well done!' : 'Keep practicing'}
              </Badge>
              {feedback.overall && (
                <p className="text-xs text-slate-400 leading-relaxed">{feedback.overall}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

const DiagramBlock: React.FC<DiagramBlockProps> = (props) => {
  const { data, index } = props;
  const isLabelMode = data.interactionMode === 'label';

  return (
    <BlockWrapper
      label={data.label}
      index={index}
      accent="teal"
      variant={isLabelMode ? 'feature' : 'default'}
    >
      {isLabelMode ? (
        <LabelMode
          data={data}
          onAnswer={'onAnswer' in props && props.onAnswer ? props.onAnswer : () => {}}
          answered={'answered' in props ? props.answered : false}
        />
      ) : (
        <ExploreMode data={data} />
      )}
    </BlockWrapper>
  );
};

export default DiagramBlock;
