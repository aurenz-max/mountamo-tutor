'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CompareContrastBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import {
  LuminaActionButton,
  LuminaDropZone,
  LuminaFeedbackCard,
  answerStateClass,
  type DropZoneState,
} from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';
import BlockTutorHelp from './BlockTutorHelp';
import { useTapTutor, TapHint } from './TapTutor';
import { seededShuffle } from './seededShuffle';

interface CompareContrastBlockProps {
  data: CompareContrastBlockData;
  index: number;
  /** Called when the student completes the sort challenge ('sort' mode only) */
  onAnswer?: (blockId: string, correct: boolean, attempts: number) => void;
  /** Whether the block has already been answered (from parent state) */
  answered?: boolean;
  /** Bridge to the DeepDive live tutor. */
  onAskTutor?: (message: string) => void;
}

type Side = 'A' | 'B';

interface SortStatement {
  text: string;
  side: Side; // answer key
}

const MAX_ATTEMPTS = 3;

const CompareContrastBlock: React.FC<CompareContrastBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
  onAskTutor,
}) => {
  const { itemA, itemB, label } = data;
  const isSortChallenge = data.interactionMode === 'sort' && !!onAnswer;
  const { enabled, activeKey, ask } = useTapTutor(onAskTutor);

  // ── Sort challenge state ──────────────────────────────────────────
  const pool = useMemo<SortStatement[]>(
    () =>
      seededShuffle(
        [
          ...itemA.points.map((text): SortStatement => ({ text, side: 'A' })),
          ...itemB.points.map((text): SortStatement => ({ text, side: 'B' })),
        ],
        data.id,
      ),
    [itemA.points, itemB.points, data.id],
  );

  // placements[poolIndex] = side the student assigned (or undefined)
  const [placements, setPlacements] = useState<Record<number, Side | undefined>>({});
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [lastCheckMsg, setLastCheckMsg] = useState<string | null>(null);
  const [zoneFlash, setZoneFlash] = useState<
    Partial<Record<Side, Extract<DropZoneState, 'correct' | 'incorrect'>>> | null
  >(null);
  const zoneFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (zoneFlashTimer.current) clearTimeout(zoneFlashTimer.current);
    },
    [],
  );

  const unplaced = pool.map((_, i) => i).filter((i) => placements[i] === undefined);
  const allPlaced = unplaced.length === 0;

  const placeSelected = useCallback(
    (side: Side) => {
      if (selectedIdx === null || answered) return;
      SoundManager.select();
      setPlacements((p) => ({ ...p, [selectedIdx]: side }));
      setSelectedIdx(null);
    },
    [selectedIdx, answered],
  );

  const unplace = useCallback(
    (poolIdx: number) => {
      if (answered) return;
      SoundManager.tap();
      setPlacements((p) => ({ ...p, [poolIdx]: undefined }));
    },
    [answered],
  );

  const handleCheck = useCallback(() => {
    if (!allPlaced || answered) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const wrongIdxs = pool
      .map((s, i) => (placements[i] !== s.side ? i : -1))
      .filter((i) => i >= 0);

    const wrongSides = new Set(
      wrongIdxs
        .map((i) => placements[i])
        .filter((side): side is Side => side !== undefined),
    );
    if (zoneFlashTimer.current) clearTimeout(zoneFlashTimer.current);
    setZoneFlash({
      A: wrongSides.has('A') ? 'incorrect' : 'correct',
      B: wrongSides.has('B') ? 'incorrect' : 'correct',
    });
    zoneFlashTimer.current = setTimeout(() => setZoneFlash(null), 900);

    if (wrongIdxs.length === 0) {
      SoundManager.playCorrect();
      setAnswered(true);
      setWasCorrect(true);
      setLastCheckMsg(null);
      onAnswer?.(data.id, true, newAttempts);
    } else if (newAttempts >= MAX_ATTEMPTS) {
      // Reveal: place everything correctly and mark incorrect
      SoundManager.playIncorrect();
      const revealed: Record<number, Side> = {};
      pool.forEach((s, i) => { revealed[i] = s.side; });
      setPlacements(revealed);
      setAnswered(true);
      setWasCorrect(false);
      setLastCheckMsg(null);
      onAnswer?.(data.id, false, newAttempts);
    } else {
      // Return the misplaced statements to the pool; keep correct ones
      SoundManager.playIncorrect();
      setPlacements((p) => {
        const next = { ...p };
        wrongIdxs.forEach((i) => { next[i] = undefined; });
        return next;
      });
      const rightCount = pool.length - wrongIdxs.length;
      setLastCheckMsg(
        `${rightCount} of ${pool.length} sorted correctly — the rest went back to the pile. Try again!`,
      );
    }
  }, [allPlaced, answered, attempts, pool, placements, data.id, onAnswer]);

  // ── Tap-to-explore (static mode + post-answer) ────────────────────
  const askAboutPoint = (
    key: string,
    side: { title: string },
    otherSide: { title: string },
    point: string,
  ) =>
    ask(
      key,
      `[COMPARE_EXPLORE] In the "${label || 'comparison'}" block comparing "${itemA.title}" vs "${itemB.title}", the student tapped this point under "${side.title}": "${point}". Expand on it in 1-2 friendly sentences and contrast it with what "${otherSide.title}" is like, then ask the student one quick question — like which one they would notice or prefer. Do not mention that they tapped.`,
    );

  const renderPoint = (
    point: string,
    key: string,
    dotClass: string,
    side: { title: string },
    otherSide: { title: string },
  ) => {
    const inner = (
      <>
        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${dotClass} flex-shrink-0`} />
        <span className="text-sm text-slate-300 leading-relaxed">{point}</span>
      </>
    );
    if (!enabled) return <div className="flex items-start gap-2">{inner}</div>;
    return (
      <button
        type="button"
        onClick={() => askAboutPoint(key, side, otherSide, point)}
        className={`w-full flex items-start gap-2 text-left rounded-lg px-2 py-1 -mx-2 cursor-pointer transition-colors hover:bg-white/5 ${
          activeKey === key ? 'bg-white/5 ring-1 ring-indigo-400/40' : ''
        }`}
      >
        {inner}
      </button>
    );
  };

  // ── Static display (also the post-answer view in sort mode) ───────
  const renderStaticComparison = () => (
    <div className="relative">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-5">
          <h4 className="text-sm font-semibold text-indigo-200 mb-3 uppercase tracking-wide">
            {itemA.title}
          </h4>
          <ul className="space-y-2">
            {itemA.points.map((point, i) => (
              <li key={i}>{renderPoint(point, `a-${i}`, 'bg-indigo-400/60', itemA, itemB)}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-5">
          <h4 className="text-sm font-semibold text-purple-200 mb-3 uppercase tracking-wide">
            {itemB.title}
          </h4>
          <ul className="space-y-2">
            {itemB.points.map((point, i) => (
              <li key={i}>{renderPoint(point, `b-${i}`, 'bg-purple-400/60', itemB, itemA)}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* VS badge — centered on the gap between cards (desktop only) */}
      <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
        <div className="w-9 h-9 rounded-full bg-slate-900 border border-white/15 flex items-center justify-center shadow-lg">
          <span className="text-[10px] font-bold text-slate-400 tracking-wide">VS</span>
        </div>
      </div>
    </div>
  );

  // ── Sort challenge UI ─────────────────────────────────────────────
  const renderSideDropZone = (side: Side) => {
    const item = side === 'A' ? itemA : itemB;
    const titleTint = side === 'A' ? 'text-indigo-200' : 'text-purple-200';
    const placedIdxs = pool.map((_, i) => i).filter((i) => placements[i] === side);
    const receptive = selectedIdx !== null && !answered;
    const zoneState: DropZoneState =
      zoneFlash?.[side] ?? (placedIdxs.length > 0 ? 'filled' : 'idle');

    // Zone is a div[role=button] with chip buttons inside — a real <button>
    // zone would nest interactive elements (invalid HTML, unreliable taps;
    // same bug HypothesisLab hit).
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <h4 className={`text-center text-sm font-semibold uppercase tracking-wide ${titleTint}`}>
          {item.title}
        </h4>
        <LuminaDropZone
          state={zoneState}
          emptyPrompt={receptive ? 'Tap here to place the statement' : 'Nothing here yet'}
          role="button"
          tabIndex={receptive ? 0 : -1}
          aria-disabled={!receptive}
          aria-label={`${item.title} statement target`}
          onClick={() => placeSelected(side)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (receptive && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              placeSelected(side);
            }
          }}
          className={`min-h-[120px] w-full flex-col items-stretch p-4 text-left font-normal ${
            receptive ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          {placedIdxs.length > 0 ? (
            <ul className="space-y-2">
              {placedIdxs.map((i) => (
                <li key={i}>
                  <button
                    type="button"
                    disabled={answered}
                    onClick={(e) => { e.stopPropagation(); unplace(i); }}
                    className={`block w-full rounded-lg border px-2.5 py-1.5 text-left text-sm leading-relaxed ${answerStateClass('idle')} ${
                      answered ? '' : 'cursor-pointer'
                    }`}
                  >
                    {pool[i].text}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </LuminaDropZone>
      </div>
    );
  };

  const renderSortChallenge = () => (
    <div className="space-y-4">
      <p className="text-slate-100 font-medium text-[15px] leading-relaxed">
        Sort each statement: does it describe{' '}
        <span className="text-indigo-300">{itemA.title}</span> or{' '}
        <span className="text-purple-300">{itemB.title}</span>?
      </p>

      {/* Pool of unsorted statements */}
      {unplaced.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unplaced.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                SoundManager.tap();
                setSelectedIdx((cur) => (cur === i ? null : i));
              }}
              className={`text-sm text-left leading-relaxed rounded-lg px-3 py-2 border transition-all cursor-pointer ${
                selectedIdx === i
                  ? answerStateClass('selected')
                  : answerStateClass('idle')
              }`}
            >
              {pool[i].text}
            </button>
          ))}
        </div>
      )}
      {unplaced.length > 0 && (
        <p className="text-xs text-slate-500 italic">
          {selectedIdx !== null
            ? 'Now tap the side where it belongs.'
            : 'Tap a statement to pick it up.'}
        </p>
      )}

      {/* Drop zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderSideDropZone('A')}
        {renderSideDropZone('B')}
      </div>

      {lastCheckMsg && (
        <p className="text-sm text-amber-300/90">{lastCheckMsg}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <LuminaActionButton action="check" onClick={handleCheck} disabled={!allPlaced} />
        <BlockTutorHelp
          onAskTutor={onAskTutor}
          message={`[STUDENT_HELP_REQUEST] The student is sorting statements between "${itemA.title}" and "${itemB.title}" in the "${label || 'comparison'}" block. Statements for ${itemA.title}: ${itemA.points.map((p) => `"${p}"`).join('; ')}. Statements for ${itemB.title}: ${itemB.points.map((p) => `"${p}"`).join('; ')}. Help them think about what makes the two different — ask a guiding question about ONE statement's meaning. Do NOT say which side any statement belongs on.`}
        />
      </div>
    </div>
  );

  return (
    <BlockWrapper label={label} index={index} accent="indigo" variant="default">
      {isSortChallenge && !answered ? (
        renderSortChallenge()
      ) : (
        <>
          {renderStaticComparison()}
          {isSortChallenge && answered && (
            <div className="mt-4">
              <LuminaFeedbackCard
                status={wasCorrect ? 'correct' : 'incorrect'}
                label={wasCorrect ? 'All sorted!' : 'Here’s the correct sort'}
              >
                {wasCorrect
                  ? `You sorted all ${pool.length} statements correctly in ${attempts} ${attempts === 1 ? 'try' : 'tries'}.`
                  : `Compare the two sides above — notice what makes ${itemA.title} different from ${itemB.title}.`}
              </LuminaFeedbackCard>
            </div>
          )}
          {enabled && (
            <TapHint text="Tap any point to hear your tutor compare the two sides" />
          )}
        </>
      )}
    </BlockWrapper>
  );
};

export default CompareContrastBlock;
