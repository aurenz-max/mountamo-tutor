'use client';

import React, { useEffect, useState } from 'react';
import { LuminaActionButton, LuminaButton, LuminaFeedbackCard, LuminaMathText } from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';
import { SurfaceBoard, useSurfaceAnswer } from '../../../../../service/agent-kit/SurfaceBoard';
import { describeSurfaceWork } from '../../../../../service/agent-kit/surfaceScene';
import { answerReady, gradeAnswer, missHint, rightAnswer } from '../../../../../service/agent-kit/surfaces';
import type { CheckBlockData } from '../types';
import BlockWrapper from './BlockWrapper';

interface CheckBlockProps {
  data: CheckBlockData;
  index: number;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  /** On the tutor workspace: every check reports here, and the host owns Try again. */
  onAttempt?: (correct: boolean, work: string) => void;
  /** Already answered (a solved check, or one credited aloud): the board shows a right answer. */
  answered?: boolean;
}

/**
 * A check on a kit answer surface (`service/agent-kit/surfaces.ts`): the student taps a part of a display, picks or
 * sorts or orders cards, builds a set, or changes a display until a goal holds. The kit draws the board and judges the
 * answer; this block adds the question, the Check button and the explanation.
 */
const CheckBlock: React.FC<CheckBlockProps> = ({ data, index, onAnswer, onAttempt, answered: answeredProp }) => {
  const { item } = data;
  const board = useSurfaceAnswer();
  const { answer, setAnswer } = board;
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(answeredProp ?? false);
  const [hint, setHint] = useState<string | null>(null);

  // A check that arrives answered shows one right answer on its board.
  useEffect(() => {
    if (answeredProp) setAnswer(a => ({ ...a, ...rightAnswer(item) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = answerReady(item, answer);
  const check = () => {
    if (solved || !ready) return;
    const tries = attempts + 1;
    setAttempts(tries);
    const graded = gradeAnswer(item, answer);
    onAttempt?.(graded.correct, describeSurfaceWork(item, answer));
    if (graded.correct) {
      SoundManager.playCorrect();
      setSolved(true);
      setHint(null);
      onAnswer(data.id, true, tries);
    } else {
      SoundManager.playIncorrect();
      const why = missHint(item, answer);
      setHint(`Not yet. ${why ? `${why} ` : ''}Look again.`);
    }
  };

  return (
    <BlockWrapper label={data.label} index={index} accent="amber" variant="compact">
      <div className="space-y-4" data-deep-dive-surface={item.surface}>
        <p className="text-[15px] font-medium leading-relaxed text-slate-100"><LuminaMathText text={item.prompt} /></p>
        <SurfaceBoard item={item} board={board} locked={solved} checked={solved || hint !== null} onChanged={() => setHint(null)} />
        {!solved && (
          <div className="flex flex-wrap items-center gap-2">
            {item.surface !== 'choose' && item.surface !== 'point' && (
              <LuminaButton tone="ghost" onClick={() => { board.reset(); setHint(null); }}>Clear</LuminaButton>
            )}
            <LuminaActionButton action="check" onClick={check} disabled={!ready} />
          </div>
        )}
        {hint && !solved && <LuminaFeedbackCard status="incorrect"><p>{hint}</p></LuminaFeedbackCard>}
        {solved && (
          <LuminaFeedbackCard status="correct" label={attempts <= 1 ? 'Correct!' : `Correct (try ${attempts})`}>
            <LuminaMathText text={data.explanation} />
          </LuminaFeedbackCard>
        )}
      </div>
    </BlockWrapper>
  );
};

export default CheckBlock;
