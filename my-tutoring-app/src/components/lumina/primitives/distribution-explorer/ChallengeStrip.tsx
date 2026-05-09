'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Lightbulb } from 'lucide-react';
import { Card } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { FAMILIES } from '../../lib/probability';
import type {
  ComputeChallenge,
  DistributionChallenge,
  DistributionFamily,
  IdentifyChallenge,
  PredictShapeChallenge,
} from './types';

interface ChallengeStripProps {
  challenges: DistributionChallenge[];
  /** Currently active challenge index. Parent owns this — strip just signals advance. */
  activeIndex: number;
  /** Per-challenge result: undefined = pending, true = correct/committed, false = wrong (still pending). */
  results: Record<string, boolean>;
  onCommit: (challengeId: string, correct: boolean) => void;
  onAdvance: () => void;
}

/**
 * Renders the active challenge with type-specific UI. Once committed, the
 * rationale is shown and the parent can advance to the next challenge.
 *
 * Gating policy:
 *   - guided_exploration → "Got it" button always commits as correct.
 *   - identify           → radio of families; commit checks correctFamily.
 *   - compute            → 4-option numeric MCQ; commit checks selected === correctValue.
 *   - predict_shape      → MCQ of shape descriptors; commit checks lexical match.
 */
export const ChallengeStrip: React.FC<ChallengeStripProps> = ({
  challenges,
  activeIndex,
  results,
  onCommit,
  onAdvance,
}) => {
  const challenge = challenges[activeIndex];
  if (!challenge) {
    return (
      <Card className="backdrop-blur-xl bg-emerald-500/10 border-emerald-400/30 p-4">
        <p className="text-sm text-emerald-200 font-medium">All challenges complete.</p>
        <p className="text-xs text-emerald-300/80 mt-1">
          Keep exploring — try sliding parameters to test predictions you've made.
        </p>
      </Card>
    );
  }

  const isCommitted = results[challenge.id] !== undefined;
  const isCorrect = results[challenge.id] === true;
  const hasNext = activeIndex + 1 < challenges.length;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wider font-semibold text-indigo-300">
          Challenge {activeIndex + 1} of {challenges.length}
        </p>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300">
          {challenge.type.replace(/_/g, ' ')}
        </span>
      </div>

      {challenge.scenario && (
        <p className="text-sm text-slate-300 italic leading-relaxed">{challenge.scenario}</p>
      )}

      <p className="text-sm text-slate-100 leading-relaxed">{challenge.prompt}</p>

      <ChallengeBody
        challenge={challenge}
        isCommitted={isCommitted}
        onCommit={(correct) => onCommit(challenge.id, correct)}
      />

      <AnimatePresence>
        {isCommitted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div
              className={`flex items-start gap-2 p-3 rounded border-l-2 text-sm leading-relaxed ${
                isCorrect
                  ? 'bg-emerald-500/10 border-emerald-400 text-emerald-100'
                  : 'bg-amber-500/10 border-amber-400 text-amber-100'
              }`}
            >
              {isCorrect ? <Check size={16} className="mt-0.5 flex-shrink-0" /> : <Lightbulb size={16} className="mt-0.5 flex-shrink-0" />}
              <span>{challenge.rationale}</span>
            </div>
            {hasNext && (
              <Button
                variant="ghost"
                onClick={onAdvance}
                className="bg-indigo-500/15 border border-indigo-400/30 hover:bg-indigo-500/25 text-indigo-100 gap-1.5"
              >
                Next challenge <ChevronRight size={14} />
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

// ── Per-type body ────────────────────────────────────────────────────

interface ChallengeBodyProps {
  challenge: DistributionChallenge;
  isCommitted: boolean;
  onCommit: (correct: boolean) => void;
}

const ChallengeBody: React.FC<ChallengeBodyProps> = ({ challenge, isCommitted, onCommit }) => {
  switch (challenge.type) {
    case 'guided_exploration':
      return <GuidedBody isCommitted={isCommitted} onCommit={onCommit} />;
    case 'identify':
      return <IdentifyBody challenge={challenge} isCommitted={isCommitted} onCommit={onCommit} />;
    case 'compute':
      return <ComputeBody challenge={challenge} isCommitted={isCommitted} onCommit={onCommit} />;
    case 'predict_shape':
      return <PredictShapeBody challenge={challenge} isCommitted={isCommitted} onCommit={onCommit} />;
  }
};

const GuidedBody: React.FC<{ isCommitted: boolean; onCommit: (correct: boolean) => void }> = ({
  isCommitted,
  onCommit,
}) => (
  <Button
    variant="ghost"
    disabled={isCommitted}
    onClick={() => onCommit(true)}
    className="bg-emerald-500/15 border border-emerald-400/30 hover:bg-emerald-500/25 text-emerald-100 gap-1.5"
  >
    <Check size={14} /> Got it
  </Button>
);

const IdentifyBody: React.FC<{
  challenge: IdentifyChallenge;
  isCommitted: boolean;
  onCommit: (correct: boolean) => void;
}> = ({ challenge, isCommitted, onCommit }) => {
  const [selected, setSelected] = useState<DistributionFamily | null>(null);
  const choices = useShuffledFamilies(challenge);

  const submit = () => {
    if (!selected) return;
    onCommit(selected === challenge.correctFamily);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {choices.map((f) => {
          const isSelected = selected === f;
          const isCorrect = f === challenge.correctFamily;
          return (
            <button
              key={f}
              type="button"
              disabled={isCommitted}
              onClick={() => setSelected(f)}
              className={`text-sm px-3 py-2 rounded border transition-colors text-left ${
                isCommitted
                  ? isCorrect
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                    : isSelected
                    ? 'bg-rose-500/10 border-rose-400/40 text-rose-200'
                    : 'bg-slate-800/40 border-slate-700 text-slate-500'
                  : isSelected
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100'
                  : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              {FAMILIES[f].label}
            </button>
          );
        })}
      </div>
      {!isCommitted && (
        <Button
          variant="ghost"
          disabled={!selected}
          onClick={submit}
          className="bg-indigo-500/15 border border-indigo-400/30 hover:bg-indigo-500/25 text-indigo-100"
        >
          Commit answer
        </Button>
      )}
    </div>
  );
};

function useShuffledFamilies(challenge: IdentifyChallenge): DistributionFamily[] {
  // Stable shuffle — keyed off challenge.id so it doesn't reorder on re-render.
  return React.useMemo(() => {
    const all: DistributionFamily[] = [challenge.correctFamily, ...challenge.distractors];
    // Fisher-Yates seeded by challenge.id hash so renders are stable.
    let seed = 0;
    for (let i = 0; i < challenge.id.length; i++) seed = (seed * 31 + challenge.id.charCodeAt(i)) | 0;
    const a = [...all];
    for (let i = a.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [challenge.id, challenge.correctFamily, challenge.distractors]);
}

const ComputeBody: React.FC<{
  challenge: ComputeChallenge;
  isCommitted: boolean;
  onCommit: (correct: boolean) => void;
}> = ({ challenge, isCommitted, onCommit }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const choices = useShuffledNumericChoices(challenge);
  const decimals = challenge.decimals ?? pickDefaultDecimals(challenge.correctValue);

  const submit = () => {
    if (selected === null) return;
    onCommit(selected === challenge.correctValue);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {choices.map((value) => {
          const isSelected = selected === value;
          const isCorrect = value === challenge.correctValue;
          return (
            <button
              key={value}
              type="button"
              disabled={isCommitted}
              onClick={() => setSelected(value)}
              className={`text-sm px-3 py-2 rounded border transition-colors text-left font-mono ${
                isCommitted
                  ? isCorrect
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                    : isSelected
                    ? 'bg-rose-500/10 border-rose-400/40 text-rose-200'
                    : 'bg-slate-800/40 border-slate-700 text-slate-500'
                  : isSelected
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100'
                  : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              {formatNumber(value, decimals)}
              {challenge.unit && <span className="text-slate-400 ml-1.5">{challenge.unit}</span>}
            </button>
          );
        })}
      </div>
      {!isCommitted && (
        <Button
          variant="ghost"
          disabled={selected === null}
          onClick={submit}
          className="bg-indigo-500/15 border border-indigo-400/30 hover:bg-indigo-500/25 text-indigo-100"
        >
          Commit answer
        </Button>
      )}
    </div>
  );
};

function useShuffledNumericChoices(challenge: ComputeChallenge): number[] {
  return React.useMemo(() => {
    const all = [challenge.correctValue, ...challenge.distractors];
    let seed = 0;
    for (let i = 0; i < challenge.id.length; i++) seed = (seed * 31 + challenge.id.charCodeAt(i)) | 0;
    const a = [...all];
    for (let i = a.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [challenge.id, challenge.correctValue, challenge.distractors]);
}

function pickDefaultDecimals(value: number): number {
  // Probabilities and rates are usually <1 — show 4 decimals. Whole-ish answers (E[X]=3) — show 2.
  return Math.abs(value) < 1 ? 4 : 2;
}

function formatNumber(value: number, decimals: number): string {
  // Strip trailing zeros for readability ("3" not "3.00") while preserving precision when needed.
  const fixed = value.toFixed(decimals);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') || '0' : fixed;
}

const PredictShapeBody: React.FC<{
  challenge: PredictShapeChallenge;
  isCommitted: boolean;
  onCommit: (correct: boolean) => void;
}> = ({ challenge, isCommitted, onCommit }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const acceptable = challenge.acceptableAnswers.map(normalize);

  const choices = React.useMemo(() => {
    const all = [challenge.acceptableAnswers[0], ...challenge.distractors];
    // Stable shuffle keyed off challenge id (same trick as IdentifyBody).
    let seed = 0;
    for (let i = 0; i < challenge.id.length; i++) seed = (seed * 31 + challenge.id.charCodeAt(i)) | 0;
    const a = [...all];
    for (let i = a.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [challenge.id, challenge.acceptableAnswers, challenge.distractors]);

  const submit = () => {
    if (!selected) return;
    onCommit(acceptable.includes(normalize(selected)));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        {choices.map((c) => {
          const isSelected = selected === c;
          const isCorrect = acceptable.includes(normalize(c));
          return (
            <button
              key={c}
              type="button"
              disabled={isCommitted}
              onClick={() => setSelected(c)}
              className={`text-sm px-3 py-2 rounded border transition-colors text-left ${
                isCommitted
                  ? isCorrect
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                    : isSelected
                    ? 'bg-rose-500/10 border-rose-400/40 text-rose-200'
                    : 'bg-slate-800/40 border-slate-700 text-slate-500'
                  : isSelected
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100'
                  : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      {!isCommitted && (
        <Button
          variant="ghost"
          disabled={!selected}
          onClick={submit}
          className="bg-indigo-500/15 border border-indigo-400/30 hover:bg-indigo-500/25 text-indigo-100"
        >
          Commit answer
        </Button>
      )}
    </div>
  );
};
