'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Eye, X } from 'lucide-react';
import { Button } from '../../../ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../ui/accordion';
import { KaTeX, MixedContent } from './StepContentRenderer';
import { RichStepCard } from './RichStepCard';
import type {
  CompareLineAnalysis,
  CompareLineStatus,
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
  /**
   * Phase D — advance to the next problem in the orchestrated plan. The
   * parent (tester / lesson runner) owns advancement and re-mounts the
   * AnnotatedExample with the next slot's data, so this surface tears
   * down and the next problem opens on its watch view. Optional: hidden
   * on the final slot where there is no next problem to advance to.
   */
  onTryNewProblem?: () => void;
  /** Phase D — return to Watch mode (canvas state preserved). */
  onShowMeAgain: () => void;
  /** Phase D — close the Try-It surface entirely. */
  onClose: () => void;
}

const VERDICT_TONE: Record<CompareVerdict, {
  label: string;
  textClass: string;
  glowClass: string;
}> = {
  correct: {
    label: 'Correct',
    textClass: 'text-emerald-200',
    glowClass: 'drop-shadow-[0_0_24px_rgba(52,211,153,0.45)]',
  },
  partial: {
    label: 'Almost',
    textClass: 'text-amber-200',
    glowClass: 'drop-shadow-[0_0_24px_rgba(251,191,36,0.45)]',
  },
  incorrect: {
    label: 'Not yet',
    textClass: 'text-rose-200',
    glowClass: 'drop-shadow-[0_0_24px_rgba(251,113,133,0.45)]',
  },
};

/** Per-line visual treatment for the hero. Status is a property of the line
 *  itself — no pills, no badges, no row cards. */
const LINE_VISUAL: Record<CompareLineStatus, {
  kxClass: string;
  containerClass: string;
}> = {
  aligned: {
    kxClass: 'text-slate-50 drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]',
    containerClass: '',
  },
  shortcut: {
    kxClass: 'text-slate-50',
    containerClass: 'border-l-2 border-cyan-400/70 pl-5',
  },
  error: {
    kxClass: 'text-rose-300/90',
    containerClass: '',
  },
  extra: {
    kxClass: 'text-slate-500',
    containerClass: 'opacity-60',
  },
};

const REVEAL_ACTIVE_LAYERS: LayerId[] = ['steps', 'strategy', 'misconceptions', 'connections', 'narrative'];

/** Letter-by-letter cascade for the verdict word. ~1s total. */
const VerdictWord: React.FC<{ label: string; className: string }> = ({ label, className }) => (
  <span aria-label={label} className={`inline-block ${className}`}>
    {Array.from(label).map((ch, i) => (
      <motion.span
        key={i}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.45,
          delay: 0.1 + i * 0.06,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="inline-block"
        aria-hidden="true"
      >
        {ch === ' ' ? ' ' : ch}
      </motion.span>
    ))}
  </span>
);

/**
 * Phase C — full-screen reveal that replaces the canvas surface once the
 * judge resolves. Hero treatment: large serif verdict word, the student's
 * solve as the protagonist (status as visual property of each line), inline
 * rubric whispers, and a collapsed worked-solution as secondary read.
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

  const hasAnalysis = verdict.stepAnalysis.length > 0;
  const heroLines: Array<{ latex: string; status: CompareLineStatus; note?: string }> =
    hasAnalysis
      ? verdict.stepAnalysis.map((a) => ({
          latex: a.studentLine,
          status: a.status,
          note: a.note,
        }))
      : studentLines.map((l) => ({ latex: l.latex, status: 'extra' as CompareLineStatus }));

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-950 overflow-hidden">
      {/* Close button — top-right corner, unobtrusive */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close reveal"
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
      >
        <X size={16} />
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-10">
          {/* ── Verdict moment — typography is the verdict ─────────────── */}
          <div className="text-center mb-12">
            <h1
              className={`font-serif text-6xl md:text-7xl leading-none tracking-tight ${tone.textClass} ${tone.glowClass}`}
              style={{ fontFamily: '"Times New Roman", Georgia, serif', fontWeight: 500 }}
            >
              <VerdictWord label={tone.label} className="" />
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + tone.label.length * 0.06 + 0.1 }}
              className="mt-5 text-base md:text-lg text-slate-300 leading-relaxed max-w-xl mx-auto"
            >
              {verdict.summary}
            </motion.p>

            {(verdict.finalAnswer || verdict.canonicalAnswer) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 + tone.label.length * 0.06 + 0.25 }}
                className="mt-6 inline-flex items-center gap-3 text-sm"
              >
                <div className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mr-2">
                    You
                  </span>
                  {verdict.finalAnswer ? (
                    <KaTeX latex={verdict.finalAnswer} display={false} className="text-slate-100" />
                  ) : (
                    <span className="text-slate-500 italic text-xs">—</span>
                  )}
                </div>
                <ArrowRight size={14} className="text-slate-600" />
                <div className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mr-2">
                    Expected
                  </span>
                  {verdict.canonicalAnswer ? (
                    <KaTeX latex={verdict.canonicalAnswer} display={false} className="text-slate-100" />
                  ) : (
                    <span className="text-slate-500 italic text-xs">—</span>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Hero — student's solve as the protagonist ──────────────── */}
          {heroLines.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="text-center py-12"
            >
              <p className="text-base text-slate-400 italic max-w-md mx-auto leading-relaxed">
                No work was captured this time. The worked solution is below — give it another try
                when you&apos;re ready.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {heroLines.map((line, i) => {
                const visual = LINE_VISUAL[line.status];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: 0.6 + i * 0.1,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={visual.containerClass}
                  >
                    <div className="text-2xl md:text-3xl leading-tight">
                      <KaTeX latex={line.latex} display={false} className={visual.kxClass} />
                    </div>
                    {line.note && (
                      <p className="mt-2 text-sm text-slate-400 italic leading-relaxed">
                        <MixedContent text={line.note} />
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── Worked solution — collapsed by default ─────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.0 }}
            className="mt-16"
          >
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="worked-solution" className="border-white/10">
                <AccordionTrigger className="text-sm text-slate-400 hover:text-slate-200 hover:no-underline gap-2 py-3">
                  <span className="flex items-center gap-2">
                    <ChevronDown size={14} className="opacity-60" />
                    Show the worked solution
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4 space-y-0 relative">
                    <div className="absolute left-[1.15rem] top-4 bottom-4 w-0.5 bg-slate-800 z-0" />
                    {sibling.steps.map((step, idx) => (
                      <div key={step.id} className="relative z-10 pb-6 last:pb-0">
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
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
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
          {onTryNewProblem && (
            <Button
              size="sm"
              onClick={onTryNewProblem}
              className="bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 text-emerald-100 font-semibold gap-2"
            >
              Next problem
              <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
