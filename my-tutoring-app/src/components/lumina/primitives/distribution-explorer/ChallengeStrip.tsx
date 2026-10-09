'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Lightbulb } from 'lucide-react';
import { Card } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { distributionChoices, distributionCorrect } from './distributionExplorerWorkspace';
import type { DistributionChallenge } from './types';

interface ChallengeStripProps {
  challenges: DistributionChallenge[];
  /** Currently active challenge index. Parent owns this — strip just signals advance. */
  activeIndex: number;
  /** Per-challenge result: undefined = pending, true = correct/committed, false = wrong (still pending). */
  results: Record<string, boolean>;
  /** The choice picked on the active challenge (its `key`). Parent owns it, so the tutor's scene can read it. */
  selected: string | null;
  onSelect: (key: string) => void;
  /** Check (or Got it on a guided exploration). The parent runs the check. */
  onCheck: () => void;
  onAdvance: () => void;
  /** With the tutor: no Next (the runtime advances), and a wrong check shows neither the rationale nor the key. */
  tutorOwned?: boolean;
  /** With the tutor, while a checked answer waits for Try again: every control is closed. */
  blocked?: boolean;
  /** A line under each choice, keyed by the choice's `key` (the `family_facts` lever: the same kind of fact on every one). */
  notes?: Record<string, string>;
}

/**
 * Renders the active challenge with type-specific UI. Once committed, the
 * rationale is shown and the parent can advance to the next challenge.
 *
 * Gating policy (the checks live in `distributionExplorerWorkspace.ts`):
 *   - guided_exploration → "Got it"; scripted always credits it, the tutor path credits it after the workbench moved.
 *   - identify           → choice of families; Check compares with correctFamily.
 *   - compute            → 4-option numeric MCQ; Check compares with correctValue.
 *   - predict_shape      → MCQ of shape descriptors; Check matches acceptableAnswers.
 */
export const ChallengeStrip: React.FC<ChallengeStripProps> = ({
  challenges,
  activeIndex,
  results,
  selected,
  onSelect,
  onCheck,
  onAdvance,
  tutorOwned = false,
  blocked = false,
  notes,
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

      {challenge.type === 'guided_exploration' ? (
        <Button
          variant="ghost"
          disabled={isCommitted || blocked}
          onClick={onCheck}
          className="bg-emerald-500/15 border border-emerald-400/30 hover:bg-emerald-500/25 text-emerald-100 gap-1.5"
        >
          <Check size={14} /> Got it
        </Button>
      ) : (
        <ChoiceBody
          challenge={challenge}
          isCommitted={isCommitted}
          selected={selected}
          blocked={blocked}
          notes={notes}
          onSelect={onSelect}
          onCheck={onCheck}
        />
      )}

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
            {hasNext && !tutorOwned && (
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

// ── Choice body (identify, compute, predict_shape) ───────────────────

const ChoiceBody: React.FC<{
  challenge: DistributionChallenge;
  isCommitted: boolean;
  selected: string | null;
  blocked: boolean;
  notes?: Record<string, string>;
  onSelect: (key: string) => void;
  onCheck: () => void;
}> = ({ challenge, isCommitted, selected, blocked, notes, onSelect, onCheck }) => {
  const choices = React.useMemo(() => distributionChoices(challenge), [challenge]);
  const numeric = challenge.type === 'compute';
  const closed = isCommitted || blocked;

  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${challenge.type === 'identify' ? 'grid-cols-1 sm:grid-cols-3' : numeric ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {choices.map((c) => {
          const isSelected = selected === c.key;
          // The key is marked only once the item is committed (scripted: right or wrong; tutor: right only).
          const isKey = isCommitted && distributionCorrect(challenge, { picked: c.key, explored: false, family: 'binomial', params: {} });
          return (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              disabled={closed}
              onClick={() => onSelect(c.key)}
              className={`text-sm px-3 py-2 rounded border transition-colors text-left ${numeric ? 'font-mono' : ''} ${
                isCommitted
                  ? isKey
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                    : isSelected
                    ? 'bg-rose-500/10 border-rose-400/40 text-rose-200'
                    : 'bg-slate-800/40 border-slate-700 text-slate-500'
                  : isSelected
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100'
                  : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              {c.label}
              {notes?.[c.key] && (
                <span data-lever="family-facts" className="block text-[11px] text-slate-400 mt-0.5">{notes[c.key]}</span>
              )}
            </button>
          );
        })}
      </div>
      {!isCommitted && (
        <Button
          variant="ghost"
          disabled={!selected || blocked}
          onClick={onCheck}
          className="bg-indigo-500/15 border border-indigo-400/30 hover:bg-indigo-500/25 text-indigo-100"
        >
          Check
        </Button>
      )}
    </div>
  );
};
