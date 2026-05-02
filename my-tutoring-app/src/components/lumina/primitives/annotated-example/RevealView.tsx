'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, XCircle, ArrowRight, Eye, X, Sparkles } from 'lucide-react';
import { Card } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { KaTeX, MixedContent } from './StepContentRenderer';
import { RichStepCard } from './RichStepCard';
import type {
  CompareLineAnalysis,
  CompareVerdict,
  JudgeVerdict,
} from '../../service/annotated-example/judge-types';
import type { LayerId, RichAnnotatedExampleData } from './types';

interface RevealViewProps {
  /** The sibling problem the student just attempted. */
  sibling: RichAnnotatedExampleData;
  /** Final transcribed lines from the canvas — what the judge saw. */
  studentLines: Array<{ latex: string; confidence: number }>;
  /** The judge's verdict + per-line analysis. */
  verdict: JudgeVerdict;
  /** Phase D — start a fresh attempt with a new sibling. */
  onTryNewProblem: () => void;
  /** Phase D — return to Watch mode (canvas state preserved). */
  onShowMeAgain: () => void;
  /** Phase D — close the Try-It surface entirely. */
  onClose: () => void;
}

const VERDICT_TONE: Record<CompareVerdict, {
  icon: React.ReactNode;
  label: string;
  cardClass: string;
  iconClass: string;
  badgeClass: string;
}> = {
  correct: {
    icon: <CheckCircle2 size={28} />,
    label: 'Correct',
    cardClass: 'bg-emerald-500/10 border-emerald-400/40',
    iconClass: 'text-emerald-300',
    badgeClass: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200',
  },
  partial: {
    icon: <AlertCircle size={28} />,
    label: 'Almost there',
    cardClass: 'bg-amber-500/10 border-amber-400/40',
    iconClass: 'text-amber-300',
    badgeClass: 'bg-amber-500/20 border-amber-400/40 text-amber-200',
  },
  incorrect: {
    icon: <XCircle size={28} />,
    label: 'Not quite',
    cardClass: 'bg-rose-500/10 border-rose-400/40',
    iconClass: 'text-rose-300',
    badgeClass: 'bg-rose-500/20 border-rose-400/40 text-rose-200',
  },
};

const LINE_STATUS_TONE: Record<CompareLineAnalysis['status'], {
  symbol: string;
  pillClass: string;
  label: string;
  rowClass: string;
}> = {
  aligned: {
    symbol: '✓',
    pillClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    label: 'aligned',
    rowClass: 'bg-emerald-500/5 border-emerald-400/20',
  },
  shortcut: {
    symbol: '↗',
    pillClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
    label: 'shortcut',
    rowClass: 'bg-cyan-500/5 border-cyan-400/20',
  },
  error: {
    symbol: '⚠',
    pillClass: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
    label: 'error',
    rowClass: 'bg-rose-500/5 border-rose-400/20',
  },
  extra: {
    symbol: '+',
    pillClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    label: 'extra',
    rowClass: 'bg-slate-500/5 border-slate-500/20',
  },
};

/** All annotation layers default-on so misconception/strategy notes render
 *  next to each canonical step in the right column. The student is studying
 *  the rubric, not navigating it — there's no need to hide layers here. */
const REVEAL_ACTIVE_LAYERS: LayerId[] = ['steps', 'strategy', 'misconceptions', 'connections', 'narrative'];

/**
 * Phase C — full-screen reveal that replaces the canvas surface once the
 * judge resolves. Verdict banner at top, then a two-column comparison:
 * the student's transcribed work on the left (per-line tags + notes), the
 * canonical steps with annotation layers on the right. Footer hosts the
 * three Phase D CTAs.
 */
export const RevealView: React.FC<RevealViewProps> = ({
  sibling,
  studentLines,
  verdict,
  onTryNewProblem,
  onShowMeAgain,
  onClose,
}) => {
  const tone = VERDICT_TONE[verdict.verdict];

  // Build a quick alignment map: which canonical steps did the student touch?
  // Drives a subtle highlight on the right column so coverage is visible.
  const matchedCanonicalSteps = React.useMemo(() => {
    const set = new Set<number>();
    for (const a of verdict.stepAnalysis) {
      if (a.matchedCanonicalStep !== null) set.add(a.matchedCanonicalStep);
    }
    return set;
  }, [verdict.stepAnalysis]);

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-950 overflow-hidden">
      {/* ── Verdict banner ──────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-white/5 flex-shrink-0">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className={`relative overflow-hidden border p-5 shadow-xl ${tone.cardClass}`}>
            <div className="relative z-10 flex items-start gap-4">
              <div className={`flex-shrink-0 ${tone.iconClass}`}>{tone.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className={`${tone.badgeClass} gap-1.5`}>
                    <Sparkles size={11} />
                    {tone.label}
                  </Badge>
                  <Badge variant="outline" className="text-slate-300 border-white/15 bg-white/5">
                    {sibling.subject}
                  </Badge>
                </div>
                <p className="text-base text-slate-100 leading-relaxed">{verdict.summary}</p>
                {(verdict.finalAnswer || verdict.canonicalAnswer) && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-slate-900/40 border border-white/5 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                        Your answer
                      </p>
                      {verdict.finalAnswer ? (
                        <KaTeX latex={verdict.finalAnswer} display={false} className="text-slate-100" />
                      ) : (
                        <p className="text-slate-500 italic text-xs">Not identified</p>
                      )}
                    </div>
                    <div className="rounded-md bg-slate-900/40 border border-white/5 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                        Expected
                      </p>
                      {verdict.canonicalAnswer ? (
                        <KaTeX latex={verdict.canonicalAnswer} display={false} className="text-slate-100" />
                      ) : (
                        <p className="text-slate-500 italic text-xs">—</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 gap-2 flex-shrink-0"
                aria-label="Close reveal"
              >
                <X size={14} />
                Close
              </Button>
            </div>

            <div className="pointer-events-none absolute top-0 right-0 w-48 h-48 bg-current opacity-10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
          </Card>
        </motion.div>
      </div>

      {/* ── Two-column comparison ───────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left — student's work, per-line tagged */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Your work</p>
              <span className="text-xs text-slate-600">— transcribed from your canvas</span>
            </div>

            {studentLines.length === 0 ? (
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-5">
                <p className="text-sm text-slate-400 italic">
                  No work was captured. The canonical solution is on the right — give it another try when you&apos;re ready.
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {verdict.stepAnalysis.length === 0
                  ? studentLines.map((line, i) => (
                      <Card
                        key={i}
                        className="backdrop-blur-xl bg-slate-900/40 border-white/10 px-4 py-3"
                      >
                        <div className="flex items-baseline gap-3">
                          <span className="text-[10px] font-mono text-slate-600 flex-shrink-0">{i + 1}</span>
                          <KaTeX latex={line.latex} display={false} className="text-slate-200" />
                        </div>
                      </Card>
                    ))
                  : verdict.stepAnalysis.map((analysis, i) => {
                      const lineTone = LINE_STATUS_TONE[analysis.status];
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.04 }}
                          className={`rounded-lg border px-4 py-3 ${lineTone.rowClass}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-[10px] font-mono text-slate-600 flex-shrink-0 pt-1">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full border px-2 py-0.5 ${lineTone.pillClass}`}
                                >
                                  <span className="text-sm leading-none">{lineTone.symbol}</span>
                                  {lineTone.label}
                                </span>
                                {analysis.matchedCanonicalStep !== null && (
                                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                                    → step {analysis.matchedCanonicalStep + 1}
                                  </span>
                                )}
                              </div>
                              <KaTeX
                                latex={analysis.studentLine}
                                display={false}
                                className="text-slate-100"
                              />
                              {analysis.note && (
                                <p className="text-xs text-slate-400 italic mt-2 leading-relaxed">
                                  <MixedContent text={analysis.note} />
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
              </div>
            )}
          </div>

          {/* Right — canonical solution with all annotation layers on */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Worked solution</p>
              <span className="text-xs text-slate-600">— the rubric the judge used</span>
            </div>

            <div className="space-y-0 relative">
              <div className="absolute left-[1.15rem] top-4 bottom-4 w-0.5 bg-slate-800 z-0" />
              {sibling.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`relative z-10 pb-6 last:pb-0 transition-opacity ${
                    matchedCanonicalSteps.size > 0 && !matchedCanonicalSteps.has(idx)
                      ? 'opacity-60'
                      : ''
                  }`}
                >
                  <RichStepCard
                    step={step}
                    index={idx}
                    activeLayers={REVEAL_ACTIVE_LAYERS}
                    isCompact
                    interactive={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Phase D footer CTAs ─────────────────────────────────────── */}
      <div className="px-5 py-4 border-t border-white/5 bg-slate-950/80 backdrop-blur flex-shrink-0">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 gap-2"
          >
            Done for now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowMeAgain}
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 gap-2"
          >
            <Eye size={14} />
            Show me again
          </Button>
          <Button
            size="sm"
            onClick={onTryNewProblem}
            className="bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 text-emerald-100 font-semibold gap-2"
          >
            Try a new problem
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};
