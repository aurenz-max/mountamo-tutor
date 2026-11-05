'use client';

import React, { useCallback, useState } from 'react';
import type { WorkedExampleBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import BlockTutorHelp from './BlockTutorHelp';
import {
  LuminaActionButton, LuminaAnswerChoice, LuminaButton, LuminaFeedbackCard, LuminaMathText, type AnswerChoiceState,
} from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';

interface WorkedExampleBlockProps {
  data: WorkedExampleBlockData;
  index: number;
  /** Called when the student's step is settled (graded worked examples only). */
  onAnswer?: (blockId: string, correct: boolean, attempts: number) => void;
  /** On the tutor workspace: every check reports here, the block never shows the answer itself, and the host owns Try again. */
  onAttempt?: (correct: boolean, work: string) => void;
  answered?: boolean;
  onAskTutor?: (message: string) => void;
}

/**
 * A solved problem, one step at a time. Each step shows the work and, beside it, why that move. When the block has a
 * try step, the student reaches it and picks its work from four lines (the real one and three errors) before it is
 * shown; the steps after it stay hidden until then, because each one starts from its result. Once it is settled the
 * rest of the example and the answer show at once: the shell closes a checked block until Next challenge.
 */
const WorkedExampleBlock: React.FC<WorkedExampleBlockProps> = ({ data, index, onAnswer, onAttempt, answered: answeredProp, onAskTutor }) => {
  const { steps, tryStep } = data;
  const [shown, setShown] = useState(answeredProp ? steps.length : 1);
  const [selected, setSelected] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [settled, setSettled] = useState<null | 'correct' | 'revealed'>(answeredProp ? 'correct' : null);

  // The try step blocks the reveal until it is settled.
  const waiting = !!tryStep && shown > tryStep.index && !settled;
  const visible = waiting ? tryStep!.index : shown;
  const done = shown >= steps.length && !waiting;

  const next = useCallback(() => { SoundManager.tap(); setShown((n) => Math.min(steps.length, n + 1)); }, [steps.length]);
  const all = useCallback(() => {
    SoundManager.tap();
    setShown(tryStep && !settled ? tryStep.index + 1 : steps.length);
  }, [steps.length, tryStep, settled]);

  const check = useCallback(() => {
    if (!tryStep || selected === null || settled) return;
    const n = attempts + 1;
    setAttempts(n);
    const right = selected === tryStep.correctIndex;
    onAttempt?.(right, `Picked "${tryStep.options[selected]}" for step ${tryStep.index + 1}`);
    if (right) {
      SoundManager.playCorrect();
      setSettled('correct');
      setShown(steps.length);
      onAnswer?.(data.id, true, n);
    } else if (!onAttempt && n >= 2) {
      SoundManager.playIncorrect();
      setSettled('revealed');
      setShown(steps.length);
      setSelected(tryStep.correctIndex);
      onAnswer?.(data.id, false, n);
    } else {
      SoundManager.playIncorrect();
      setSelected(null);
    }
  }, [tryStep, selected, settled, attempts, onAttempt, onAnswer, data.id, steps.length]);

  return (
    <BlockWrapper label={data.label} index={index} accent="indigo" variant="default">
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Problem</p>
          <p className="text-slate-100 text-[15px] leading-relaxed"><LuminaMathText text={data.problem} /></p>
        </div>

        <ol className="space-y-2" data-worked-steps>
          {steps.slice(0, visible).map((s, i) => (
            <li key={i} className="grid gap-x-4 gap-y-1 rounded-xl border border-white/5 bg-white/[0.03] p-3 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)]">
              <span className="text-xs font-mono text-indigo-300/80 pt-1">{i + 1}</span>
              <span className="text-slate-100 text-[15px]"><LuminaMathText text={s.work} /></span>
              <span className="text-sm text-slate-400 italic"><LuminaMathText text={s.reason} /></span>
            </li>
          ))}
        </ol>

        {waiting && tryStep && (
          <div className="space-y-3 rounded-xl border border-indigo-400/30 bg-indigo-500/5 p-4" data-worked-try>
            <p className="text-slate-100 font-medium text-[15px]">Your turn: which line is step {tryStep.index + 1}?</p>
            <div className="space-y-2">
              {tryStep.options.map((o, i) => {
                const state: AnswerChoiceState = i === selected ? 'selected' : 'idle';
                return (
                  <LuminaAnswerChoice key={i} aria-label={o} state={state} onClick={() => { SoundManager.select(); setSelected(i); }} className="p-3 text-sm">
                    <span className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-mono">{String.fromCharCode(65 + i)}</span>
                      <LuminaMathText text={o} />
                    </span>
                  </LuminaAnswerChoice>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LuminaActionButton action="check" onClick={check} disabled={selected === null} />
              <BlockTutorHelp
                onAskTutor={onAskTutor}
                message={`[STUDENT_HELP_REQUEST] The student is working through a worked example: "${data.problem}". Steps so far: ${steps.slice(0, tryStep.index).map((s, i) => `${i + 1}) ${s.work}`).join('; ')}. They must pick step ${tryStep.index + 1} from: ${tryStep.options.join('; ')}. Ask what the last line still needs before it is solved. Do NOT name or describe the right line.`}
              />
            </div>
          </div>
        )}

        {settled && tryStep && shown > tryStep.index && (
          <LuminaFeedbackCard status={settled === 'correct' ? 'correct' : 'incorrect'} label={settled === 'correct' ? (attempts <= 1 ? 'Correct!' : 'Correct (2nd try)') : 'Step revealed'}>
            <LuminaMathText text={tryStep.explanation} />
          </LuminaFeedbackCard>
        )}

        {done ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4" data-worked-answer>
            <p className="text-xs uppercase tracking-wide text-emerald-300/80 mb-1">Answer</p>
            <p className="text-slate-100 text-[15px]"><LuminaMathText text={data.answer} /></p>
          </div>
        ) : !waiting && (
          <div className="flex flex-wrap gap-2">
            <LuminaButton tone="primary" size="sm" onClick={next}>Next step</LuminaButton>
            {shown > 1 && <LuminaButton tone="ghost" size="sm" onClick={all}>Show {tryStep && !settled ? 'up to your turn' : 'all steps'}</LuminaButton>}
          </div>
        )}
      </div>
    </BlockWrapper>
  );
};

export default WorkedExampleBlock;
