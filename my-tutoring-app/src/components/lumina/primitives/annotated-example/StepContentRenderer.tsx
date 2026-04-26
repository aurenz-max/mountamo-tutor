'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ArrowRight, Check, GitBranch, Table2, Image, TrendingUp } from 'lucide-react';
import type {
  StepContent,
  AlgebraStepContent,
  TableStepContent,
  DiagramStepContent,
  GraphSketchStepContent,
  CaseSplitStepContent,
} from './types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type CanvasConfig,
} from '../visual-primitives/math/canvas-2d/coords';
import {
  drawAxes,
  drawCurve,
  drawShadedRegion,
  drawVector,
  drawLabeledPoint,
} from '../visual-primitives/math/canvas-2d/shapes';
import { sampleCurve } from './canvas-2d-sample';

// ═══════════════════════════════════════════════════════════════════════
// KaTeX Rendering Utilities
// ═══════════════════════════════════════════════════════════════════════

function renderKatex(latex: string, displayMode = true): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return `<span class="text-red-400 font-mono text-sm">${latex}</span>`;
  }
}

/** Render KaTeX inline — for mixed text/math content. Wraps $...$ segments. */
function renderMixedContent(text: string): string {
  // Split on $...$ delimiters
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith('$') && part.endsWith('$')) {
        const inner = part.slice(1, -1);
        return renderKatex(inner, false);
      }
      return part;
    })
    .join('');
}

const KaTeX: React.FC<{ latex: string; display?: boolean; className?: string }> = ({
  latex,
  display = true,
  className = '',
}) => {
  const html = React.useMemo(() => renderKatex(latex, display), [latex, display]);
  return (
    <span
      className={`text-slate-100 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const MixedContent: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const html = React.useMemo(() => renderMixedContent(text), [text]);
  return (
    <span
      className={`text-slate-300 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Step Type Renderers
// ═══════════════════════════════════════════════════════════════════════

const AlgebraStepView: React.FC<{ content: AlgebraStepContent }> = ({ content }) => {
  const [activeTransition, setActiveTransition] = useState(0);
  const totalTransitions = content.transitions.length;

  const advance = useCallback(() => {
    setActiveTransition((prev) => Math.min(prev + 1, totalTransitions - 1));
  }, [totalTransitions]);

  if (totalTransitions === 0) {
    return (
      <div className="flex items-center gap-2 pt-2">
        <Check size={14} className="text-emerald-400 flex-shrink-0" />
        <KaTeX latex={content.result} className="text-emerald-300 font-semibold" />
      </div>
    );
  }

  const normalize = (s: string) => s.replace(/\s+/g, '').trim();

  return (
    <div className="space-y-4">
      {/* Collapsed chain: initial expression, then per-transition (op → result) rows.
          Skips the `from` of a transition when it chains from the prior `to`. */}
      <div className="space-y-3">
        {/* Initial expression (first transition's `from`) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-950/50 rounded-lg px-4 py-3 border border-slate-800/50"
        >
          <KaTeX latex={content.transitions[0].from.latex} />
        </motion.div>

        {content.transitions.map((t, i) => {
          const isActive = i <= activeTransition;
          const prev = i > 0 ? content.transitions[i - 1] : null;
          const chainsFromPrior = prev && normalize(prev.to.latex) === normalize(t.from.latex);

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: isActive ? 1 : 0.4, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.15 }}
              className="flex flex-col gap-2"
            >
              {/* Discontinuity guard: render `from` when this transition does not chain */}
              {!chainsFromPrior && i > 0 && (
                <div className="bg-slate-950/50 rounded-lg px-4 py-3 border border-slate-800/50">
                  <KaTeX latex={t.from.latex} />
                </div>
              )}

              {/* Operation label + arrow */}
              <div className="flex items-center gap-2 pl-2">
                <ArrowRight size={14} className="text-blue-400 flex-shrink-0" />
                <span className="text-xs text-blue-400 font-medium italic">{t.operation}</span>
              </div>

              {/* Resulting expression */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: isActive ? 1 : 0.4, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.15 + 0.2 }}
                className="bg-slate-950/50 rounded-lg px-4 py-3 border border-blue-500/20"
              >
                <KaTeX latex={t.to.latex} />
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Play / Next button */}
      {activeTransition < totalTransitions - 1 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={advance}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
        >
          Next transformation ({activeTransition + 1}/{totalTransitions})
        </motion.button>
      )}

      {/* Result */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: activeTransition >= totalTransitions - 1 ? 1 : 0.3 }}
        className="flex items-center gap-2 pt-2 border-t border-slate-800/50"
      >
        <Check size={14} className="text-emerald-400 flex-shrink-0" />
        <KaTeX latex={content.result} className="text-emerald-300 font-semibold" />
      </motion.div>
    </div>
  );
};

const TableStepView: React.FC<{ content: TableStepContent }> = ({ content }) => {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 font-medium">{content.caption}</p>

      <div className="overflow-x-auto rounded-lg border border-slate-800/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50">
              {content.headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-slate-300 font-semibold text-xs uppercase tracking-wider">
                  <MixedContent text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-slate-800/30">
                {row.map((cell, ci) => {
                  const isHighlight =
                    content.highlightCell &&
                    content.highlightCell[0] === ri &&
                    content.highlightCell[1] === ci;
                  return (
                    <td
                      key={ci}
                      className={`px-3 py-2 ${isHighlight ? 'bg-emerald-500/10 text-emerald-300 font-semibold' : 'text-slate-400'}`}
                    >
                      <MixedContent text={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DiagramStepView: React.FC<{ content: DiagramStepContent }> = ({ content }) => {
  return (
    <div className="space-y-3">
      {content.imageBase64 ? (
        <div className="rounded-lg overflow-hidden border border-slate-800/50">
          <img src={content.imageBase64} alt={content.altText} className="w-full" />
        </div>
      ) : (
        <div className="rounded-lg bg-slate-950/50 border border-slate-800/50 p-6 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Image size={32} className="text-slate-600 mx-auto" />
            <p className="text-slate-500 text-sm">{content.altText}</p>
          </div>
        </div>
      )}

      {/* Labels */}
      <div className="grid grid-cols-2 gap-2">
        {content.labels.map((label, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/30"
          >
            <p className="text-xs font-semibold text-slate-200">{label.text}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Semantic curve colors → on-canvas hex. Kept narrow so the planner can
// reason about which curve is the "main" vs "supporting" without picking pixels.
const CURVE_COLORS = {
  primary: '#38bdf8',   // cyan
  secondary: '#f59e0b', // amber
  tertiary: '#22c55e',  // emerald
} as const;

const SHADE_FILLS = [
  'rgba(56, 189, 248, 0.18)',
  'rgba(245, 158, 11, 0.18)',
];

const VECTOR_COLOR = '#a78bfa'; // violet

const GraphSketchStepView: React.FC<{ content: GraphSketchStepContent }> = ({ content }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Resolve effective curve list. A non-empty `curves` array supersedes the
  // legacy single `expression` field; otherwise fall back to a single primary
  // curve so existing callers keep rendering.
  const curves = useMemo(() => {
    if (content.curves && content.curves.length > 0) return content.curves;
    if (content.expression) {
      return [{ expression: content.expression, color: 'primary' as const, style: 'solid' as const }];
    }
    return [];
  }, [content.curves, content.expression]);

  const cfg: CanvasConfig = useMemo(
    () => ({
      xMin: content.domain[0],
      xMax: content.domain[1],
      yMin: content.range[0],
      yMax: content.range[1],
      xLabel: content.xLabel ?? 'x',
      yLabel: content.yLabel ?? 'y',
    }),
    [content.domain, content.range, content.xLabel, content.yLabel],
  );

  // Sample each curve over the visible x-range. mathEvaluator returns null
  // outside the domain — drawCurve handles the resulting gaps.
  const sampledCurves = useMemo(
    () =>
      curves.map((c) => ({
        ...c,
        points: sampleCurve(c.expression, cfg.xMin, cfg.xMax, 240),
      })),
    [curves, cfg.xMin, cfg.xMax],
  );

  // Sample shaded regions only over [from, to]; the polygon is bounded by
  // upper / lower expressions sampled at matching x values.
  const sampledShades = useMemo(
    () =>
      (content.shadedRegions ?? []).map((r) => ({
        label: r.label,
        upper: sampleCurve(r.upper, r.from, r.to, 80),
        lower: sampleCurve(r.lower, r.from, r.to, 80),
      })),
    [content.shadedRegions],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawAxes(ctx, cfg);

    // 1. Shaded regions (under everything else).
    sampledShades.forEach((shade, i) => {
      drawShadedRegion(ctx, shade.upper, shade.lower, cfg, SHADE_FILLS[i % SHADE_FILLS.length]);
    });

    // 2. Curves.
    for (const c of sampledCurves) {
      const color = CURVE_COLORS[c.color ?? 'primary'] ?? CURVE_COLORS.primary;
      if (c.style === 'dashed') {
        ctx.save();
        ctx.setLineDash([6, 5]);
        drawCurve(ctx, c.points, cfg, color, 2.5);
        ctx.restore();
      } else {
        drawCurve(ctx, c.points, cfg, color, 2.5);
      }
    }

    // 3. Vectors.
    for (const v of content.vectors ?? []) {
      drawVector(
        ctx,
        { x: v.from[0], y: v.from[1] },
        { x: v.to[0], y: v.to[1] },
        cfg,
        VECTOR_COLOR,
        v.label,
      );
    }

    // 4. Labeled points (drawn last so they sit above curves).
    for (const pt of content.keyPoints) {
      drawLabeledPoint(ctx, { x: pt.x, y: pt.y }, cfg, '#22c55e', pt.label, true);
    }
  }, [cfg, sampledCurves, sampledShades, content.vectors, content.keyPoints]);

  return (
    <div className="space-y-3">
      {/* Caption */}
      {content.caption && (
        <p className="text-xs text-slate-500 font-medium">{content.caption}</p>
      )}

      {/* Curve legend — only when we have multiple curves or labels worth showing. */}
      {curves.length > 0 && (curves.length > 1 || curves[0].label) && (
        <div className="flex flex-wrap gap-3">
          {curves.map((c, i) => {
            const color = CURVE_COLORS[c.color ?? 'primary'] ?? CURVE_COLORS.primary;
            return (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                <span
                  className="inline-block w-4 h-0.5 rounded"
                  style={{ backgroundColor: color }}
                />
                {c.label ? (
                  <KaTeX latex={c.label} display={false} className="text-slate-200" />
                ) : (
                  <KaTeX latex={c.expression} display={false} className="text-slate-200" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Canvas */}
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-lg border border-slate-800/50 bg-slate-950/60 max-w-full"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>

      {/* Shaded-region labels (rendered as KaTeX-friendly badges so labels like "A = 4/3" parse). */}
      {sampledShades.length > 0 && sampledShades.some((s) => s.label) && (
        <div className="flex flex-wrap gap-2">
          {sampledShades.map(
            (s, i) =>
              s.label && (
                <span
                  key={i}
                  className="text-xs px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-200"
                >
                  <MixedContent text={`$${s.label}$`} />
                </span>
              ),
          )}
        </div>
      )}

      {/* Key points list (in addition to on-canvas markers — useful in compact mode). */}
      {content.keyPoints.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {content.keyPoints.map((pt, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <TrendingUp size={12} className="text-emerald-400 flex-shrink-0" />
              <span className="text-slate-400">
                ({pt.x}, {pt.y})
              </span>
              <span className="text-slate-500 text-xs">{pt.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Feature badges — descriptive metadata, not on-canvas. */}
      {content.features.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {content.features.map((feat, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300"
            >
              {feat.kind}: {feat.label} = {feat.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const CaseSplitStepView: React.FC<{ content: CaseSplitStepContent }> = ({ content }) => {
  const [expandedCase, setExpandedCase] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {/* Condition */}
      <div className="flex items-center gap-2 text-sm">
        <GitBranch size={14} className="text-amber-400" />
        <MixedContent text={content.condition} className="text-slate-300 font-medium" />
      </div>

      {/* Cases */}
      <div className="space-y-2">
        {content.cases.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-lg border border-slate-800/50 overflow-hidden"
          >
            <button
              onClick={() => setExpandedCase(expandedCase === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/30 hover:bg-slate-800/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-mono text-xs font-bold">Case {i + 1}</span>
                <span className="text-slate-400 text-sm">{c.label}</span>
              </div>
              <MixedContent text={c.condition} className="text-xs text-slate-500" />
            </button>

            <AnimatePresence>
              {expandedCase === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-3 space-y-2 border-t border-slate-800/30">
                    <KaTeX latex={c.work} className="text-sm" />
                    <div className="flex items-center gap-2 pt-1">
                      <ArrowRight size={12} className="text-emerald-400" />
                      <KaTeX latex={c.result} display={false} className="text-emerald-300 text-sm" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Main Router
// ═══════════════════════════════════════════════════════════════════════

const STEP_TYPE_ICONS: Record<string, React.ReactNode> = {
  algebra: <span className="text-blue-400 text-xs font-bold font-mono">f(x)</span>,
  table: <Table2 size={12} className="text-amber-400" />,
  diagram: <Image size={12} className="text-cyan-400" />,
  'graph-sketch': <TrendingUp size={12} className="text-cyan-400" />,
  'case-split': <GitBranch size={12} className="text-amber-400" />,
};

export const StepContentRenderer: React.FC<{
  content: StepContent;
  /** Reserved — currently no step type consumes this. Kept on the contract so the
   *  data-level `interactive` flag still flows through to future interactive primitives. */
  interactive?: boolean;
}> = ({ content }) => {
  switch (content.type) {
    case 'algebra':
      return <AlgebraStepView content={content} />;
    case 'table':
      return <TableStepView content={content} />;
    case 'diagram':
      return <DiagramStepView content={content} />;
    case 'graph-sketch':
      return <GraphSketchStepView content={content} />;
    case 'case-split':
      return <CaseSplitStepView content={content} />;
  }
};

export const StepTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  return <>{STEP_TYPE_ICONS[type] || null}</>;
};

export { KaTeX, MixedContent };
