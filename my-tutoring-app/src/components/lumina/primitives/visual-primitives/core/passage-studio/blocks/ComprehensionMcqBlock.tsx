'use client';

import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BlockShell from './BlockShell';
import type { ComprehensionMcqBlockData } from '../types';

interface ComprehensionMcqBlockProps {
  data: ComprehensionMcqBlockData;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}

const ComprehensionMcqBlock: React.FC<ComprehensionMcqBlockProps> = ({
  data,
  onAnswer,
  answered: answeredProp,
  innerRef,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleSelect = useCallback(
    (i: number) => {
      if (answered) return;
      setSelectedIndex(i);
    },
    [answered],
  );

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
      setSelectedIndex(data.correctIndex);
      onAnswer(data.id, false, next);
    } else {
      setSelectedIndex(null);
    }
  }, [selectedIndex, answered, attempts, data, onAnswer]);

  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="amber">
      <div className="space-y-4">
        <p className="text-slate-100 font-medium text-[15px] leading-relaxed">{data.question}</p>

        <div className="space-y-2">
          {data.options.map((option, i) => {
            let cls = 'w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ';
            if (answered) {
              if (i === data.correctIndex) {
                cls += 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200';
              } else if (i === selectedIndex && i !== data.correctIndex) {
                cls += 'bg-rose-500/20 border-rose-500/40 text-rose-200';
              } else {
                cls += 'bg-white/5 border-white/10 text-slate-500';
              }
            } else if (i === selectedIndex) {
              cls += 'bg-amber-500/15 border-amber-500/40 text-amber-100';
            } else {
              cls += 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20 cursor-pointer';
            }
            return (
              <button key={i} onClick={() => handleSelect(i)} disabled={answered} className={cls}>
                <span className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-mono">
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
            disabled={selectedIndex === null}
          >
            Check Answer
          </Button>
        )}

        {answered && (
          <div className="flex items-center gap-2">
            <Badge
              className={
                selectedIndex === data.correctIndex && attempts <= 1
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : selectedIndex === data.correctIndex
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }
            >
              {selectedIndex === data.correctIndex
                ? attempts === 1 ? 'Correct!' : 'Correct (2nd try)'
                : 'Incorrect'}
            </Badge>
            <span className="text-xs text-slate-500">
              {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          </div>
        )}

        {showExplanation && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-200/90 leading-relaxed">{data.explanation}</p>
            {data.evidenceAnchor && (
              <p className="text-xs text-cyan-300/80 mt-2 italic">
                Look for the highlighted evidence in the passage above.
              </p>
            )}
          </div>
        )}
      </div>
    </BlockShell>
  );
};

export default ComprehensionMcqBlock;
