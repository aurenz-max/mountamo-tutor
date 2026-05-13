'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PerspectivesBlockData } from '../types';
import BlockWrapper from './BlockWrapper';

interface PerspectivesBlockProps {
  data: PerspectivesBlockData;
  index: number;
  /** Called when the student submits an answer (only fires when comprehension is present) */
  onAnswer?: (blockId: string, correct: boolean, attempts: number) => void;
  /** Whether the block has already been answered (from parent state) */
  answered?: boolean;
}

const PerspectivesBlock: React.FC<PerspectivesBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
}) => {
  const { perspectives, eventDescription, comprehension, label } = data;

  const [activeId, setActiveId] = useState<string>(perspectives[0]?.id ?? '');
  const [viewedIds, setViewedIds] = useState<Set<string>>(
    () => new Set(perspectives[0]?.id ? [perspectives[0].id] : []),
  );

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(false);

  const activePerspective = useMemo(
    () => perspectives.find((p) => p.id === activeId) ?? perspectives[0],
    [perspectives, activeId],
  );

  const selectPerspective = useCallback((id: string) => {
    setActiveId(id);
    setViewedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const minPerspectivesViewed = 2;
  const enoughViewed = viewedIds.size >= Math.min(minPerspectivesViewed, perspectives.length);
  const remainingToView = Math.max(0, Math.min(minPerspectivesViewed, perspectives.length) - viewedIds.size);

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (answered) return;
      setSelectedIndex(optionIndex);
    },
    [answered],
  );

  const handleSubmit = useCallback(() => {
    if (!comprehension || selectedIndex === null || answered) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (selectedIndex === comprehension.correctIndex) {
      setAnswered(true);
      setShowExplanation(true);
      onAnswer?.(data.id, true, newAttempts);
    } else if (newAttempts >= 2) {
      setAnswered(true);
      setShowExplanation(true);
      setSelectedIndex(comprehension.correctIndex);
      onAnswer?.(data.id, false, newAttempts);
    } else {
      setSelectedIndex(null);
    }
  }, [comprehension, selectedIndex, answered, attempts, onAnswer, data.id]);

  if (perspectives.length === 0 || !activePerspective) {
    return (
      <BlockWrapper label={label} index={index} accent="rose" variant="default">
        <p className="text-sm text-slate-500 italic">No perspectives provided.</p>
      </BlockWrapper>
    );
  }

  return (
    <BlockWrapper label={label} index={index} accent="rose" variant="default">
      <div className="space-y-5">
        {/* Shared event framing */}
        <div className="rounded-xl bg-rose-500/5 border border-rose-500/15 px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-rose-300/60 mb-1">
            The event
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{eventDescription}</p>
        </div>

        {/* Perspective tabs */}
        <div className="flex flex-wrap gap-2">
          {perspectives.map((p) => {
            const isActive = p.id === activeId;
            const isViewed = viewedIds.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => selectPerspective(p.id)}
                className={[
                  'group relative px-3 py-2 rounded-lg border text-left transition-all',
                  isActive
                    ? 'bg-rose-500/15 border-rose-400/40 text-rose-100'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20',
                ].join(' ')}
              >
                <div className="text-sm font-medium leading-tight">{p.name}</div>
                <div className={`text-[11px] leading-tight ${isActive ? 'text-rose-200/80' : 'text-slate-500'}`}>
                  {p.role}
                </div>
                {isViewed && !isActive && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active perspective narrative */}
        <div className="rounded-xl bg-slate-950/40 border border-white/10 p-5">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <div>
              <h4 className="text-base font-medium text-slate-100 leading-tight">
                {activePerspective.name}
              </h4>
              <p className="text-xs text-rose-300/80 mt-0.5">{activePerspective.role}</p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              In their words
            </span>
          </div>

          <div className="space-y-3 border-l-2 border-rose-400/30 pl-4">
            {activePerspective.narrative.map((para, i) => (
              <p key={i} className="text-sm text-slate-300 leading-relaxed italic">
                &ldquo;{para}&rdquo;
              </p>
            ))}
          </div>
        </div>

        {/* Comprehension question (gated on viewing >=2 perspectives) */}
        {comprehension && (
          <div className="space-y-3 pt-2">
            {!enoughViewed && !answered && (
              <div className="text-xs text-slate-500 italic px-1">
                Read at least {Math.min(minPerspectivesViewed, perspectives.length)} perspectives
                to unlock the question
                {remainingToView > 0 && ` — ${remainingToView} more to go`}.
              </div>
            )}

            <div
              className={[
                'rounded-xl border p-4 space-y-3 transition-opacity',
                enoughViewed || answered
                  ? 'bg-amber-500/5 border-amber-500/20 opacity-100'
                  : 'bg-white/5 border-white/10 opacity-50 pointer-events-none',
              ].join(' ')}
            >
              <p className="text-sm font-medium text-slate-100 leading-relaxed">
                {comprehension.question}
              </p>

              <div className="space-y-2">
                {comprehension.options.map((option, i) => {
                  let optionClasses =
                    'w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm ';

                  if (answered) {
                    if (i === comprehension.correctIndex) {
                      optionClasses += 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200';
                    } else if (i === selectedIndex && i !== comprehension.correctIndex) {
                      optionClasses += 'bg-rose-500/20 border-rose-500/40 text-rose-200';
                    } else {
                      optionClasses += 'bg-white/5 border-white/10 text-slate-500';
                    }
                  } else if (i === selectedIndex) {
                    optionClasses += 'bg-amber-500/15 border-amber-500/40 text-amber-100';
                  } else {
                    optionClasses += 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20 cursor-pointer';
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(i)}
                      disabled={answered || !enoughViewed}
                      className={optionClasses}
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-mono">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>

              {!answered && (
                <Button
                  variant="ghost"
                  className="bg-amber-500/10 border border-amber-500/30 text-amber-200 hover:bg-amber-500/20"
                  onClick={handleSubmit}
                  disabled={selectedIndex === null || !enoughViewed}
                >
                  Check Answer
                </Button>
              )}

              {answered && (
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      selectedIndex === comprehension.correctIndex && attempts <= 1
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : selectedIndex === comprehension.correctIndex
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }
                  >
                    {selectedIndex === comprehension.correctIndex
                      ? attempts === 1
                        ? 'Correct!'
                        : 'Correct (2nd try)'
                      : 'Incorrect'}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
                  </span>
                </div>
              )}

              {showExplanation && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-blue-200/90 leading-relaxed">{comprehension.explanation}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </BlockWrapper>
  );
};

export default PerspectivesBlock;
