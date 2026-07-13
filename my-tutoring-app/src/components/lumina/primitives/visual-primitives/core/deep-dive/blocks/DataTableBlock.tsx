'use client';

import React, { useCallback, useState } from 'react';
import type { DataTableBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import {
  LuminaTable,
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaFeedbackCard,
  type AnswerChoiceState,
} from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';
import BlockTutorHelp from './BlockTutorHelp';
import { useTapTutor, TapHint } from './TapTutor';

interface DataTableBlockProps {
  data: DataTableBlockData;
  index: number;
  /** Called when the student answers the pattern check (only when patternCheck present) */
  onAnswer?: (blockId: string, correct: boolean, attempts: number) => void;
  /** Whether the block has already been answered (from parent state) */
  answered?: boolean;
  /** Bridge to the DeepDive live tutor; tapping a row asks it to explain that row. */
  onAskTutor?: (message: string) => void;
}

const DataTableBlock: React.FC<DataTableBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
  onAskTutor,
}) => {
  const { enabled, activeKey, ask } = useTapTutor(onAskTutor);
  const patternCheck = data.patternCheck;
  const hasCheck = !!patternCheck && !!onAnswer;

  // ── Pattern-check state (mirrors MultipleChoiceBlock conventions) ──
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (answered) return;
      SoundManager.select();
      setSelectedIndex(optionIndex);
    },
    [answered],
  );

  const handleSubmit = useCallback(() => {
    if (!patternCheck || selectedIndex === null || answered) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (selectedIndex === patternCheck.correctIndex) {
      SoundManager.playCorrect();
      setAnswered(true);
      setShowExplanation(true);
      onAnswer?.(data.id, true, newAttempts);
    } else if (newAttempts >= 2) {
      SoundManager.playIncorrect();
      setAnswered(true);
      setShowExplanation(true);
      setSelectedIndex(patternCheck.correctIndex);
      onAnswer?.(data.id, false, newAttempts);
    } else {
      SoundManager.playIncorrect();
      setSelectedIndex(null);
    }
  }, [patternCheck, selectedIndex, answered, attempts, data.id, onAnswer]);

  const wasCorrect = patternCheck ? selectedIndex === patternCheck.correctIndex : false;

  // ── Tap-to-explore rows ───────────────────────────────────────────
  const askAboutRow = (ri: number, row: string[]) => {
    const rowSummary = data.headers.map((h, ci) => `${h}: ${row[ci] ?? ''}`).join('; ');
    ask(
      `row-${ri}`,
      `[TABLE_EXPLORE] In the "${data.label || data.caption || 'data table'}" table, the student tapped the row "${row[0]}" (${rowSummary}). Explain what this row tells us in 1-2 friendly sentences and point out the most interesting comparison with another row. End with one quick question. Do not mention that they tapped${
        hasCheck ? ', and do NOT answer or hint at the comprehension question below the table' : ''
      }.`,
    );
  };

  // First-column cells become tap targets when the tutor bridge is wired —
  // LuminaTable cells take ReactNode, so the tap affordance rides inside the cell.
  const rows: React.ReactNode[][] = enabled
    ? data.rows.map((row, ri) => [
        <button
          key={`tap-${ri}`}
          type="button"
          onClick={() => askAboutRow(ri, row)}
          className={`w-full text-left cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-white/10 underline decoration-dotted decoration-emerald-400/40 underline-offset-4 ${
            activeKey === `row-${ri}` ? 'bg-white/10' : ''
          }`}
        >
          {row[0]}
        </button>,
        ...row.slice(1),
      ])
    : data.rows;

  return (
    <BlockWrapper label={data.label} index={index} accent="emerald" variant="feature">
      <LuminaTable
        accent="emerald"
        caption={data.caption}
        columns={data.headers}
        rows={rows}
      />
      {enabled && <TapHint text="Tap a row name to hear what it means" />}

      {/* Find-the-pattern check — answering requires comparing rows above */}
      {hasCheck && patternCheck && (
        <div className="mt-5 pt-5 border-t border-white/10 space-y-4">
          <p className="text-slate-100 font-medium text-[15px] leading-relaxed">
            {patternCheck.question}
          </p>

          <div className="space-y-2">
            {patternCheck.options.map((option, i) => {
              let state: AnswerChoiceState;
              if (!answered) {
                state = i === selectedIndex ? 'selected' : 'idle';
              } else if (i === patternCheck.correctIndex) {
                state = 'correct';
              } else if (i === selectedIndex) {
                state = 'incorrect';
              } else {
                state = 'dimmed';
              }

              return (
                <LuminaAnswerChoice
                  key={i}
                  state={state}
                  disabled={answered}
                  onClick={() => handleSelect(i)}
                  className="p-3 text-sm"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-mono">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {option}
                  </span>
                </LuminaAnswerChoice>
              );
            })}
          </div>

          {!answered && (
            <div className="flex flex-wrap items-center gap-3">
              <LuminaActionButton
                action="check"
                onClick={handleSubmit}
                disabled={selectedIndex === null}
              />
              <BlockTutorHelp
                onAskTutor={onAskTutor}
                message={`[STUDENT_HELP_REQUEST] The student is stuck on this question about the "${data.label || data.caption || 'data'}" table: "${patternCheck.question}". Options: ${patternCheck.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('; ')}. The correct answer is "${patternCheck.options[patternCheck.correctIndex]}". Point them at WHICH rows of the table to compare — do NOT reveal or name the correct option.`}
              />
            </div>
          )}

          {showExplanation && (
            <div className="space-y-1">
              <LuminaFeedbackCard
                status={wasCorrect ? 'correct' : 'incorrect'}
                label={
                  wasCorrect
                    ? attempts === 1 ? 'Correct!' : 'Correct (2nd try)'
                    : 'Answer revealed'
                }
              >
                {patternCheck.explanation}
              </LuminaFeedbackCard>
              <p className="text-xs text-slate-500 px-1">
                {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
              </p>
            </div>
          )}
        </div>
      )}
    </BlockWrapper>
  );
};

export default DataTableBlock;
