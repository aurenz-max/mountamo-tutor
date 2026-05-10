'use client';

import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BlockShell from './BlockShell';
import type { VocabInContextBlockData } from '../types';

interface VocabInContextBlockProps {
  data: VocabInContextBlockData;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}

const VocabInContextBlock: React.FC<VocabInContextBlockProps> = ({
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
      setSelectedIndex(data.correctIndex);
      onAnswer(data.id, false, next);
    } else {
      setSelectedIndex(null);
    }
  }, [selectedIndex, answered, attempts, data, onAnswer]);

  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="cyan">
      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-cyan-300/80 font-semibold mb-1">
            Vocabulary in context
          </p>
          <p className="text-slate-100 text-[15px] leading-relaxed">
            In the highlighted passage, what does{' '}
            <span className="font-bold italic text-cyan-200 px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30">
              {data.word}
            </span>{' '}
            mean here?
          </p>
        </div>

        <div className="space-y-2">
          {data.meanings.map((meaning, i) => {
            let cls = 'w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm ';
            if (answered) {
              if (i === data.correctIndex) cls += 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200';
              else if (i === selectedIndex) cls += 'bg-rose-500/20 border-rose-500/40 text-rose-200';
              else cls += 'bg-white/5 border-white/10 text-slate-500';
            } else if (i === selectedIndex) {
              cls += 'bg-cyan-500/15 border-cyan-500/40 text-cyan-100';
            } else {
              cls += 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 cursor-pointer';
            }
            return (
              <button
                key={i}
                onClick={() => !answered && setSelectedIndex(i)}
                disabled={answered}
                className={cls}
              >
                {meaning}
              </button>
            );
          })}
        </div>

        {!answered && (
          <Button
            variant="ghost"
            className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20"
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
                ? attempts === 1 ? 'Correct!' : 'Correct (2nd try)'
                : 'Revealed'}
            </Badge>
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

export default VocabInContextBlock;
