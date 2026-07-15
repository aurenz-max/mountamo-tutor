'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { TimelineBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import { LuminaActionButton, LuminaFeedbackCard, dropZoneStateClass } from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';
import BlockTutorHelp from './BlockTutorHelp';
import { useTapTutor, TapHint } from './TapTutor';
import { seededShuffle } from './seededShuffle';

interface TimelineBlockProps {
  data: TimelineBlockData;
  index: number;
  /** Called when the student completes the ordering challenge ('order' mode only) */
  onAnswer?: (blockId: string, correct: boolean, attempts: number) => void;
  /** Whether the block has already been answered (from parent state) */
  answered?: boolean;
  /** Bridge to the DeepDive live tutor; tapping an event asks it to tell the story. */
  onAskTutor?: (message: string) => void;
}

interface TimelineEvent {
  date: string;
  title: string;
  description: string;
}

const MAX_ATTEMPTS = 3;

// ── Display event body (shared by static timeline + post-answer view) ──
interface EventBodyProps {
  event: TimelineEvent;
  align: 'left' | 'right';
  onTap?: () => void;
  active?: boolean;
}

const EventBody: React.FC<EventBodyProps> = ({ event, align, onTap, active }) => {
  const inner = (
    <>
      <div className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25 mb-2">
        <span className="text-xs font-mono text-rose-300/90">{event.date}</span>
      </div>
      <h4 className="text-sm font-medium text-slate-100 mb-1">{event.title}</h4>
      <p className="text-sm text-slate-400 leading-relaxed">{event.description}</p>
    </>
  );
  if (!onTap) return inner;
  return (
    <button
      type="button"
      onClick={onTap}
      className={`block w-full cursor-pointer rounded-lg p-2 -m-2 transition-colors hover:bg-white/5 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${active ? 'bg-white/5 ring-1 ring-rose-400/40' : ''}`}
    >
      {inner}
    </button>
  );
};

const TimelineBlock: React.FC<TimelineBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
  onAskTutor,
}) => {
  const { events, label } = data;
  const isOrderChallenge = data.interactionMode === 'order' && !!onAnswer && events.length >= 3;
  const { enabled, activeKey, ask } = useTapTutor(onAskTutor);

  // ── Order challenge state ─────────────────────────────────────────
  // Shuffled pool of true-order indices (identity-safe via seededShuffle)
  const shuffledIdxs = useMemo(
    () => seededShuffle(events.map((_, i) => i), data.id),
    [events, data.id],
  );

  // sequence[slot] = true-order event index the student placed there
  const [sequence, setSequence] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [lastCheckMsg, setLastCheckMsg] = useState<string | null>(null);

  const poolIdxs = shuffledIdxs.filter((i) => !sequence.includes(i));
  const allPlaced = sequence.length === events.length;

  const placeNext = useCallback(
    (eventIdx: number) => {
      if (answered) return;
      SoundManager.select();
      setSequence((s) => (s.includes(eventIdx) ? s : [...s, eventIdx]));
    },
    [answered],
  );

  const removeFromSequence = useCallback(
    (eventIdx: number) => {
      if (answered) return;
      SoundManager.tap();
      setSequence((s) => s.filter((i) => i !== eventIdx));
    },
    [answered],
  );

  const handleCheck = useCallback(() => {
    if (!allPlaced || answered) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const correctCount = sequence.filter((eventIdx, slot) => eventIdx === slot).length;

    if (correctCount === events.length) {
      SoundManager.playCorrect();
      setAnswered(true);
      setWasCorrect(true);
      setLastCheckMsg(null);
      onAnswer?.(data.id, true, newAttempts);
    } else if (newAttempts >= MAX_ATTEMPTS) {
      SoundManager.playIncorrect();
      setAnswered(true);
      setWasCorrect(false);
      setLastCheckMsg(null);
      onAnswer?.(data.id, false, newAttempts);
    } else {
      // Keep events that are in the right slot, return the rest to the pool
      SoundManager.playIncorrect();
      setSequence((s) => {
        // Only a correct prefix can stay — a correct-slot event after a gap
        // would shift once earlier events are removed.
        let keep = 0;
        while (keep < s.length && s[keep] === keep) keep++;
        return s.slice(0, keep);
      });
      setLastCheckMsg(
        `${correctCount} of ${events.length} in the right spot. The correctly-placed events from the start stayed — try the rest again!`,
      );
    }
  }, [allPlaced, answered, attempts, sequence, events.length, data.id, onAnswer]);

  // ── Tap-to-explore (static + post-answer view) ────────────────────
  const askAboutEvent = (i: number, event: TimelineEvent) => {
    const next = events[i + 1];
    ask(
      `event-${i}`,
      `[TIMELINE_EXPLORE] The student tapped the timeline event "${event.title}" (${event.date}): "${event.description}". Tell the story of this moment in 2-3 vivid, grade-appropriate sentences${
        next ? ` and connect it to what happens next ("${next.title}")` : ''
      }. End with one curiosity question. Do not mention that they tapped.`,
    );
  };

  // ── Static timeline (also the post-answer reveal) ─────────────────
  const renderStaticTimeline = () => (
    <div className="relative">
      {/* Central timeline line */}
      <div className="absolute left-[calc(50%-0.5px)] top-0 bottom-0 w-px bg-gradient-to-b from-rose-400/40 via-rose-400/20 to-transparent hidden md:block" />
      {/* Mobile: left-aligned line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-rose-400/40 via-rose-400/20 to-transparent md:hidden" />

      <div className="space-y-6">
        {events.map((event, i) => {
          const isLeft = i % 2 === 0;
          const onTap = enabled ? () => askAboutEvent(i, event) : undefined;
          const active = activeKey === `event-${i}`;

          return (
            <div key={i} className="relative flex items-start gap-4 md:gap-0">
              {/* Mobile layout: all left-aligned */}
              <div className="md:hidden flex items-start gap-4 w-full">
                <div className="relative z-10 mt-1 flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                  </div>
                </div>
                <div className="flex-1 pb-2">
                  <EventBody event={event} align="left" onTap={onTap} active={active} />
                </div>
              </div>

              {/* Desktop layout: alternating left/right */}
              <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 w-full items-start">
                <div className={`${isLeft ? '' : 'invisible'} text-right pr-2`}>
                  {isLeft && <EventBody event={event} align="right" onTap={onTap} active={active} />}
                </div>
                <div className="relative z-10 mt-1 flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                  </div>
                </div>
                <div className={`${isLeft ? 'invisible' : ''} pl-2`}>
                  {!isLeft && <EventBody event={event} align="left" onTap={onTap} active={active} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Ordering challenge UI ─────────────────────────────────────────
  // Dates are hidden during the challenge — they would give the order away.
  const renderOrderChallenge = () => (
    <div className="space-y-4">
      <p className="text-slate-100 font-medium text-[15px] leading-relaxed">
        Put these events in the order they happened — tap them first to last.
      </p>

      {/* Sequence slots */}
      <ol className="space-y-2">
        {events.map((_, slot) => {
          const eventIdx = sequence[slot];
          const filled = eventIdx !== undefined;
          return (
            <li key={slot} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-xs font-mono text-rose-300/90">
                {slot + 1}
              </span>
              {filled ? (
                <button
                  type="button"
                  onClick={() => removeFromSequence(eventIdx)}
                  className={`flex-1 text-left rounded-lg px-3 py-2 cursor-pointer transition-colors ${dropZoneStateClass('filled')}`}
                >
                  <span className="text-sm font-medium text-slate-100 block">
                    {events[eventIdx].title}
                  </span>
                  <span className="text-xs text-slate-500">Tap to remove</span>
                </button>
              ) : (
                <div className={`flex-1 rounded-lg px-3 py-3 text-xs italic ${dropZoneStateClass('idle')}`}>
                  {slot === sequence.length ? 'Tap an event below to place it here' : ''}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Pool of unplaced events (no dates!) */}
      {poolIdxs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {poolIdxs.map((eventIdx) => (
            <button
              key={eventIdx}
              type="button"
              onClick={() => placeNext(eventIdx)}
              className="text-left rounded-lg px-3 py-2.5 bg-rose-500/5 border border-rose-500/20 cursor-pointer hover:bg-rose-500/10 hover:border-rose-400/30 transition-colors"
            >
              <span className="text-sm font-medium text-slate-100 block mb-0.5">
                {events[eventIdx].title}
              </span>
              <span className="text-xs text-slate-400 leading-relaxed">
                {events[eventIdx].description}
              </span>
            </button>
          ))}
        </div>
      )}

      {lastCheckMsg && <p className="text-sm text-amber-300/90">{lastCheckMsg}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <LuminaActionButton action="check" onClick={handleCheck} disabled={!allPlaced} />
        <BlockTutorHelp
          onAskTutor={onAskTutor}
          message={`[STUDENT_HELP_REQUEST] The student is putting timeline events in chronological order in the "${label || 'timeline'}" block. The correct order is: ${events.map((e, i) => `${i + 1}. "${e.title}"`).join('; ')}. Help them reason about which event had to come before another — ask ONE guiding question about cause and effect. Do NOT state the order or any event's position.`}
        />
      </div>
    </div>
  );

  return (
    <BlockWrapper label={label} index={index} accent="rose" variant="default">
      {isOrderChallenge && !answered ? (
        renderOrderChallenge()
      ) : (
        <>
          {renderStaticTimeline()}
          {isOrderChallenge && answered && (
            <div className="mt-4">
              <LuminaFeedbackCard
                status={wasCorrect ? 'correct' : 'incorrect'}
                label={wasCorrect ? 'Perfect sequence!' : 'Here’s the real order'}
              >
                {wasCorrect
                  ? `You put all ${events.length} events in order in ${attempts} ${attempts === 1 ? 'try' : 'tries'}.`
                  : 'Trace the timeline above with the dates showing — notice how each event sets up the next.'}
              </LuminaFeedbackCard>
            </div>
          )}
          {enabled && <TapHint text="Tap any event to hear its story from your tutor" />}
        </>
      )}
    </BlockWrapper>
  );
};

export default TimelineBlock;
