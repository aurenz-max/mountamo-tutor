'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ArrowRight, Check, GitBranch, Table2, Image, TrendingUp } from 'lucide-react';
import type {
  StepContent,
  AlgebraStepContent,
  SubstitutionStepContent,
  TableStepContent,
  DiagramStepContent,
  GraphSketchStepContent,
  CaseSplitStepContent,
  VerificationStepContent,
  KaTeXTransition,
} from './types';

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
// Animated KaTeX Transition
// ═══════════════════════════════════════════════════════════════════════

const KaTeXTransitionView: React.FC<{
  transition: KaTeXTransition;
  index: number;
  isActive: boolean;
}> = ({ transition, index, isActive }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isActive ? 1 : 0.4, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.15 }}
      className="flex flex-col gap-2"
    >
      {/* From expression */}
      <div className="flex items-center gap-3">
        <div className="flex-grow bg-slate-950/50 rounded-lg px-4 py-3 border border-slate-800/50">
          <KaTeX latex={transition.from.latex} />
        </div>
      </div>

      {/* Operation label + arrow */}
      <div className="flex items-center gap-2 pl-2">
        <ArrowRight size={14} className="text-blue-400 flex-shrink-0" />
        <span className="text-xs text-blue-400 font-medium italic">{transition.operation}</span>
      </div>

      {/* To expression */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: isActive ? 1 : 0.4, scale: 1 }}
        transition={{ duration: 0.3, delay: index * 0.15 + 0.2 }}
        className="flex-grow bg-slate-950/50 rounded-lg px-4 py-3 border border-blue-500/20"
      >
        <KaTeX latex={transition.to.latex} />
      </motion.div>
    </motion.div>
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

  return (
    <div className="space-y-4">
      {/* Transitions */}
      <div className="space-y-4">
        {content.transitions.map((t, i) => (
          <KaTeXTransitionView
            key={i}
            transition={t}
            index={i}
            isActive={i <= activeTransition}
          />
        ))}
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

const SubstitutionStepView: React.FC<{ content: SubstitutionStepContent }> = ({ content }) => {
  const [showResult, setShowResult] = useState(false);

  return (
    <div className="space-y-4">
      {/* Template expression */}
      <div className="bg-slate-950/50 rounded-lg px-4 py-3 border border-slate-800/50">
        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">Template</p>
        <KaTeX latex={content.template} />
      </div>

      {/* Substitution pills */}
      <div className="flex flex-wrap gap-2">
        {content.substitutions.map((sub, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20"
          >
            <KaTeX latex={sub.variable} display={false} className="text-purple-300 text-sm" />
            <ArrowRight size={12} className="text-purple-400" />
            <KaTeX latex={sub.value} display={false} className="text-purple-200 text-sm" />
          </motion.div>
        ))}
      </div>

      {/* Reveal result */}
      {!showResult ? (
        <button
          onClick={() => setShowResult(true)}
          className="text-xs text-purple-400 hover:text-purple-300 font-medium px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
        >
          Apply substitution
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 pt-2 border-t border-slate-800/50"
        >
          <Check size={14} className="text-emerald-400 flex-shrink-0" />
          <KaTeX latex={content.result} className="text-emerald-300" />
        </motion.div>
      )}
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

const GraphSketchStepView: React.FC<{ content: GraphSketchStepContent }> = ({ content }) => {
  return (
    <div className="space-y-3">
      {/* Expression */}
      <div className="bg-slate-950/50 rounded-lg px-4 py-3 border border-slate-800/50">
        <KaTeX latex={content.expression} />
      </div>

      {/* Key Points */}
      <div className="grid grid-cols-2 gap-2">
        {content.keyPoints.map((pt, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <TrendingUp size={12} className="text-cyan-400 flex-shrink-0" />
            <span className="text-slate-400">
              ({pt.x}, {pt.y})
            </span>
            <span className="text-slate-500 text-xs">{pt.label}</span>
          </div>
        ))}
      </div>

      {/* Features */}
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

const VerificationStepView: React.FC<{ content: VerificationStepContent }> = ({ content }) => {
  return (
    <div className="space-y-4">
      {/* Claim */}
      <div className="bg-emerald-500/5 rounded-lg px-4 py-3 border border-emerald-500/20">
        <p className="text-xs text-emerald-400 mb-1 uppercase tracking-wider font-medium">Verifying</p>
        <KaTeX latex={content.claim} />
      </div>

      {/* Check transitions */}
      <div className="space-y-3">
        {content.checkTransitions.map((t, i) => (
          <KaTeXTransitionView key={i} transition={t} index={i} isActive={true} />
        ))}
      </div>

      {/* Verified badge */}
      {content.verified && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
        >
          <Check size={16} className="text-emerald-400" />
          <span className="text-emerald-300 font-semibold text-sm">Verified</span>
        </motion.div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Main Router
// ═══════════════════════════════════════════════════════════════════════

const STEP_TYPE_ICONS: Record<string, React.ReactNode> = {
  algebra: <span className="text-blue-400 text-xs font-bold font-mono">f(x)</span>,
  substitution: <ArrowRight size={12} className="text-purple-400" />,
  table: <Table2 size={12} className="text-amber-400" />,
  diagram: <Image size={12} className="text-cyan-400" />,
  'graph-sketch': <TrendingUp size={12} className="text-cyan-400" />,
  'case-split': <GitBranch size={12} className="text-amber-400" />,
  verification: <Check size={12} className="text-emerald-400" />,
};

export const StepContentRenderer: React.FC<{ content: StepContent }> = ({ content }) => {
  switch (content.type) {
    case 'algebra':
      return <AlgebraStepView content={content} />;
    case 'substitution':
      return <SubstitutionStepView content={content} />;
    case 'table':
      return <TableStepView content={content} />;
    case 'diagram':
      return <DiagramStepView content={content} />;
    case 'graph-sketch':
      return <GraphSketchStepView content={content} />;
    case 'case-split':
      return <CaseSplitStepView content={content} />;
    case 'verification':
      return <VerificationStepView content={content} />;
  }
};

export const StepTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  return <>{STEP_TYPE_ICONS[type] || null}</>;
};

export { KaTeX, MixedContent };
