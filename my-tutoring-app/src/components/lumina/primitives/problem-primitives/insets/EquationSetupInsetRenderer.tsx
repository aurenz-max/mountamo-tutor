'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Check, X } from 'lucide-react';
import type { EquationSetupInset } from '../../../types';

// ═══════════════════════════════════════════════════════════════════════
// Equation-Setup Inset — interactive modeling gate
// ═══════════════════════════════════════════════════════════════════════
//
// Used at the top of word-problem worked examples. Displays the labeled
// quantities and target unknown as visible scaffolding, then gates the
// canonical equation behind an MCQ. On commit, the canonical reveals
// alongside a rationale and a callout of the misconception (if the
// student picked a distractor).
//
// Reports completion through `onCompletionChange` so the AnnotatedExample
// container can keep solution steps locked until the student commits.
// Other inset renderers ignore this prop — it's specific to interactive
// insets that participate in the example's gating contract.

interface EquationSetupInsetRendererProps {
  data: EquationSetupInset;
  onCompletionChange?: (complete: boolean) => void;
}

interface Choice {
  equation: string;
  misconception?: string;
}

const normalizeEquation = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[{}\\]/g, '')
    .trim();

function renderKatexInline(latex: string): string {
  try {
    return katex.renderToString(latex, {
      displayMode: false,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return latex;
  }
}

function renderKatexDisplay(latex: string): string {
  try {
    return katex.renderToString(latex, {
      displayMode: true,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return latex;
  }
}

const KaTeXInline: React.FC<{ latex: string; className?: string }> = ({ latex, className = '' }) => {
  const html = useMemo(() => renderKatexInline(latex), [latex]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

const KaTeXDisplay: React.FC<{ latex: string; className?: string }> = ({ latex, className = '' }) => {
  const html = useMemo(() => renderKatexDisplay(latex), [latex]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

export const EquationSetupInsetRenderer: React.FC<EquationSetupInsetRendererProps> = ({
  data,
  onCompletionChange,
}) => {
  const [attempt, setAttempt] = useState<{ equation: string; correct: boolean; misconception?: string } | null>(null);

  // Stable shuffled MCQ — re-shuffles per mount only.
  const choices = useMemo(() => {
    const arr: Choice[] = [
      { equation: data.canonicalEquation },
      ...data.distractorEquations.map((d) => ({ equation: d.equation, misconception: d.misconception })),
    ];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptableNormalized = useMemo(
    () => new Set(data.acceptableForms.map((f) => normalizeEquation(f))),
    [data.acceptableForms],
  );

  const submit = useCallback(
    (choice: Choice) => {
      const correct = acceptableNormalized.has(normalizeEquation(choice.equation));
      setAttempt({ equation: choice.equation, correct, misconception: choice.misconception });
    },
    [acceptableNormalized],
  );

  useEffect(() => {
    onCompletionChange?.(attempt != null);
  }, [attempt, onCompletionChange]);

  return (
    <div className="space-y-4">
      {/* Scenario */}
      <p className="text-sm text-slate-300 leading-relaxed">{data.scenario}</p>

      {/* Labeled quantities + target — always visible scaffolding */}
      <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-800/60 bg-slate-900/50">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Quantities</p>
        </div>
        <div className="divide-y divide-slate-800/40">
          {data.quantities.map((q, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-shrink-0 w-10 text-blue-300 font-mono">
                <KaTeXInline latex={q.symbol} />
              </span>
              <span className="flex-1 text-slate-400 text-xs">{q.meaning}</span>
              {q.knownValue !== undefined && (
                <span className="flex-shrink-0 text-emerald-300 font-mono text-sm">
                  <KaTeXInline latex={`= ${q.knownValue}`} />
                </span>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3 px-3 py-2 text-sm bg-amber-500/5">
            <span className="flex-shrink-0 w-10 text-amber-300 font-mono font-semibold">
              <KaTeXInline latex={data.target.symbol} />
            </span>
            <span className="flex-1 text-amber-200/90 text-xs italic">find: {data.target.meaning}</span>
            <span className="flex-shrink-0 text-amber-400 text-[10px] uppercase tracking-wider font-semibold">
              unknown
            </span>
          </div>
        </div>
      </div>

      {/* Gated MCQ — pre-commit */}
      {!attempt && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3.5 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-amber-400/80 font-semibold">
            Predict before reveal
          </p>
          <p className="text-sm text-amber-200 font-medium leading-relaxed">
            Which equation captures the relationship between these quantities?
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {choices.map((choice, i) => (
              <button
                key={i}
                onClick={() => submit(choice)}
                className="text-left px-3 py-2.5 rounded-md bg-slate-800/40 border border-slate-700/50 hover:border-amber-400/50 hover:bg-amber-500/10 transition-colors text-slate-200"
              >
                <KaTeXInline latex={choice.equation} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reveal — post-commit */}
      {attempt && (
        <div className="space-y-3">
          {/* Result banner */}
          <div
            className={`rounded-lg border px-3 py-2 text-xs space-y-1 ${
              attempt.correct
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-red-500/5 border-red-500/30'
            }`}
          >
            <div
              className={`flex items-center gap-2 font-medium ${
                attempt.correct ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              {attempt.correct ? <Check size={12} /> : <X size={12} />}
              <span>
                {attempt.correct
                  ? 'Nice — that captures the relationship.'
                  : 'Not quite. Walk through the right model below.'}
              </span>
            </div>
            {!attempt.correct && (
              <div className="text-slate-400">
                You picked:{' '}
                <span className="text-slate-200 font-mono">
                  <KaTeXInline latex={attempt.equation} />
                </span>
              </div>
            )}
            {!attempt.correct && attempt.misconception && (
              <div className="text-slate-400 italic">Common error: {attempt.misconception}</div>
            )}
          </div>

          {/* Canonical equation, prominently */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold">
              The model
            </p>
            <KaTeXDisplay latex={data.canonicalEquation} className="text-emerald-200 font-semibold" />
            <p className="text-xs text-slate-400 italic leading-relaxed">{data.rationale}</p>
          </div>
        </div>
      )}
    </div>
  );
};
