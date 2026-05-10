'use client';

import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BlockShell from './BlockShell';
import type { InferenceBuilderBlockData } from '../types';

interface InferenceBuilderBlockProps {
  data: InferenceBuilderBlockData;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}

const InferenceBuilderBlock: React.FC<InferenceBuilderBlockProps> = ({
  data,
  onAnswer,
  answered: answeredProp,
  innerRef,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleSubmit = useCallback(() => {
    if (selectedIndex === null || answered) return;
    const next = attempts + 1;
    setAttempts(next);
    if (selectedIndex === data.correctIndex) {
      setAnswered(true);
      setShowExplanation(true);
      onAnswer(data.id, true, next);
    } else if (next >= 2) {
      setAnswered(true);
      setShowExplanation(true);
      onAnswer(data.id, false, next);
    } else {
      setSelectedIndex(null);
    }
  }, [selectedIndex, answered, attempts, data, onAnswer]);

  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="rose">
      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-rose-300/80 font-semibold mb-1">
            Reading between the lines
          </p>
          <p className="text-slate-100 font-medium text-[15px] leading-relaxed">{data.question}</p>
        </div>

        <div className="space-y-2">
          {data.candidates.map((candidate, i) => {
            const isCorrect = i === data.correctIndex;
            let cls = 'w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ';
            if (answered) {
              if (isCorrect) cls += 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100';
              else if (i === selectedIndex) cls += 'bg-rose-500/20 border-rose-500/40 text-rose-100';
              else cls += 'bg-white/5 border-white/10 text-slate-500';
            } else if (i === selectedIndex) {
              cls += 'bg-rose-500/15 border-rose-500/40 text-rose-50';
            } else {
              cls += 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20 cursor-pointer';
            }
            return (
              <button
                key={i}
                onClick={() => !answered && setSelectedIndex(i)}
                disabled={answered}
                className={cls}
              >
                <div className="space-y-1.5">
                  <div className="font-medium leading-snug">{candidate.inference}</div>
                  {answered && (
                    <p className="text-xs text-slate-400 italic leading-relaxed">{candidate.rationale}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!answered && (
          <Button
            variant="ghost"
            className="bg-rose-500/10 border border-rose-500/30 text-rose-200 hover:bg-rose-500/20"
            onClick={handleSubmit}
            disabled={selectedIndex === null}
          >
            Check Answer
          </Button>
        )}

        {answered && (
          <div className="flex items-center gap-2">
            <Badge
              className={
                selectedIndex === data.correctIndex && attempts === 1
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : selectedIndex === data.correctIndex
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }
            >
              {selectedIndex === data.correctIndex
                ? attempts === 1 ? 'Strong inference!' : 'Got there'
                : 'Revealed'}
            </Badge>
            <span className="text-xs text-slate-500">
              {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          </div>
        )}

        {showExplanation && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-200/90 leading-relaxed">{data.explanation}</p>
          </div>
        )}
      </div>
    </BlockShell>
  );
};

export default InferenceBuilderBlock;
