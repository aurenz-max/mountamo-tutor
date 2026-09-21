'use client';

/**
 * DiWordReadingTeaching — the word-reading stage as a tutor/JEV teaching
 * workspace (fifth adopter, after Counting Board, Shape Sorter, the number train
 * and di-letter-sounds; the second DI pack to migrate).
 *
 * The stage defines the assignment and the legal scene actions; the tutor chooses
 * how to teach; JEV observes its completed feedback; the runtime commits scoped
 * outcomes. Nothing here composes a model line, scans for "Yes" or "My turn",
 * counts corrections or advances at a miss cap.
 *
 * What the DI pedagogy KEEPS, because it is task structure rather than control
 * protocol: the child reads the printed word OUT LOUD; the word is the only thing
 * on the card before the read; a decodable word is blended from its printed
 * letters and an irregular sight word is recalled whole; a different word is
 * wrong however close it sounds. What it loses is the requirement that the tutor
 * say one exact sentence and that the application read progression out of those
 * words.
 *
 * WHAT IS DRAWN, AND WHY IT IS DRAWN THAT WAY
 *
 * The answer IS the stimulus, so there is no answer side to withhold from the
 * tutor — it must have the word to judge the read at all. The leak this primitive
 * has to block is the tutor SAYING the word before the child reads it, which is
 * why `askFor` never contains the word and why the guidance is explicit about it.
 *
 * On a decodable item the printed letters are separate workspace objects, so
 * marking one is the real DISTAR sound-out gesture — point at "s", say sss, then
 * sweep the whole word. On a sight word those objects do not exist, so a tutor
 * that tries to sound out an irregular word is refused by the scene rather than
 * by a sentence of guidance. That is the "two word types, one act" constraint
 * made structural.
 *
 * THE REWARD-REVEAL DECISION (handoff 09, §"What is genuinely new", item 1)
 *
 * The reward picture is NOT a workspace object and never sits beside an unread
 * word. It is revealed in a read-words trail under the stage, one entry per
 * COMMITTED correct attempt, read from `lesson.state.attempts`. Three reasons,
 * in order of weight:
 *
 *   1. As a workspace object the tutor could see it and name it before the read.
 *      That is the same answer leak the ANSWER-LEAK RULE blocks on screen, only
 *      worse, because it arrives spoken and the child cannot look away from it.
 *   2. There is no `phase === 'affirmed'` to key off here. The observer commits
 *      success, and `apply_tutor_verdict` submits and advances inside one
 *      `flushSync`, so a reward keyed on the current item's phase would render on
 *      the held-success path and never on the advance path. Keying it on the
 *      committed attempt gives every affirmed word its receipt, with no timer and
 *      no local phase guess.
 *   3. A trail only ever contains words already read, so it cannot pre-cue the
 *      word in flight or any word still to come.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaChallengeCounter, LuminaReadAloudGlyph } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingItem, type TeachingWorkspace }
  from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import type { DiWordReadingMetrics } from '../../../evaluation/types';
import { buildWordReadingItems, type WordReadingItem } from './diWordReadingDomain';
import type { DiWordReadingData } from './DiWordReading';

export interface DiWordReadingTeachingProps {
  data: DiWordReadingData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

export default function DiWordReadingTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: DiWordReadingTeachingProps) {
  const items = useMemo(() => buildWordReadingItems(data.challenges), [data.challenges]);
  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent>
      <p>These words are still being prepared. Try generating this practice again.</p>
    </LuminaCardContent></LuminaCard>;
  }
  return <WordWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} runtimeEvalMode={runtimeEvalMode} />;
}

function WordWorkspace({ data, items, className, runtimePlanItemId, runtimeEvalMode }:
  DiWordReadingTeachingProps & { items: WordReadingItem[] }) {
  const instance = useRef(data.instanceId || `di-word-reading-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  const evalMode = runtimeEvalMode || data.challengeType || 'read_word';

  const assignments = useMemo<TeachingItem[]>(() => items.map(item => ({
    id: item.id,
    task: item.ask,
    expectedAnswer: item.accepted,
    // Every mode is spoken: the child reads print aloud, the tutor hears the
    // audio and JEV reads its completed feedback. There is no gesture channel to
    // check, and no transcript parser in front of the read.
    response: 'speech' as const,
    checkResponse: () => null,
  })), [items]);

  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'di-word-reading',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, evalMode, items: assignments, workspace });

  const evaluation = useTeachingEvaluation<DiWordReadingMetrics>({ primitiveType: 'di-word-reading',
    instanceId: instance.current, data, assignments, lesson, evalMode,
    metrics: result => ({ type: 'di-word-reading', evalMode, challengeType: items[0].challengeType,
      totalChallenges: items.length, correctCount: result.solvedCount, attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount, hintsViewed: 0, overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round(result.attemptsCount / items.length * 10) / 10 }) });

  const item = items[lesson.state.index];
  /** Words whose read the observer has already committed. The reward reveal and
   *  the completion recap both read from here, never from a local phase. */
  const read = items.filter(candidate =>
    lesson.state.attempts.some(attempt => attempt.itemId === candidate.id && attempt.correct));

  useLayoutEffect(() => {
    workspace.current = {
      objects: [
        { id: 'word', selected: false, group: 'assignment target (gold ring)',
          label: `the word "${item.word}" printed on the card, which the learner must read` },
        // Present only where the letters really spell the word, so a sight word
        // has no letter to sound out and the attempt is refused by the scene.
        ...item.letters.map((letter, position) => ({ id: `letter-${position}`, selected: false,
          group: 'printed letter of that word',
          label: `the letter "${letter}", letter ${position + 1} of the printed word` })),
      ],
      demonstration: marks,
      facts: { kind: item.challengeType, assignment: item.assignment, printedWord: item.word,
        wordType: item.wordType === 'cvc' ? 'decodable — blended from its printed letters'
          : 'irregular sight word — recalled whole, never sounded out',
        ...(item.soundOut ? { soundOut: item.soundOut } : {}),
        markMeaning: 'Purple dashed marks are yours. They point at the whole word or at one of its printed '
          + 'letters while you teach; they are not the learner reading, and they never move the gold ring off '
          + 'the word.' },
      readyForResponse: true, canDemonstrate: true, canPresent: false,
      mark, clearPresentation: () => mark([]),
    };
    lesson.publishWorkspace();
  });

  const summary = lesson.summary;
  if (summary) return <LuminaCard className={className} surface="elevated">
    <LuminaCardContent className="space-y-6">
      <PhaseSummaryPanel heading="Great reading today!" celebrationMessage="You read every word!"
        overallScore={evaluation.submittedResult?.score} durationMs={evaluation.elapsedMs}
        phases={summary.outcomes.map((outcome, position) => ({
          label: items[position]?.word ?? '',
          score: outcome.score, attempts: outcome.attempts, firstTry: outcome.corrections === 0,
          accentColor: 'cyan' as const }))} />
    </LuminaCardContent>
  </LuminaCard>;

  return <LuminaCard className={className} surface="elevated">
    <LuminaCardHeader>
      <div className="flex items-center justify-between gap-3">
        <div>
          <LuminaCardTitle>{data.title || 'Word Reading'}</LuminaCardTitle>
          <LuminaCardDescription>{data.description}</LuminaCardDescription>
        </div>
        <LuminaBadge accent="cyan">Read it out loud</LuminaBadge>
      </div>
    </LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
      {/* The printed word alone. No picture, emoji or hint joins it before the
          read — decoding print IS the skill. */}
      <div className="flex justify-center">
        <div data-word-object="printed" data-assignment-target="true"
          data-tutor-demonstration={marks.includes('word')}
          aria-label={`The word ${item.word}`}
          className={`flex items-baseline rounded-2xl border-2 border-amber-300 bg-amber-400/10 px-10 py-4 text-7xl font-bold lowercase tracking-wide text-white ${
            marks.includes('word') ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
          {item.letters.length
            ? item.letters.map((letter, position) => (
              <span key={position} data-word-letter={position}
                data-tutor-demonstration={marks.includes(`letter-${position}`)}
                className={`rounded-lg ${marks.includes(`letter-${position}`)
                  ? 'outline outline-2 outline-dashed outline-offset-2 outline-purple-400' : ''}`}>
                {letter}
              </span>))
            : <span>{item.word}</span>}
        </div>
      </div>
      {/* The reward reveal: only words the observer has already committed. */}
      {read.length > 0 && <div className="flex flex-wrap justify-center gap-2" aria-label="Words you have read">
        {read.map(done => <div key={done.id} data-word-read={done.word}
          className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">
          <span className="text-lg font-semibold lowercase text-white">{done.word}</span>
          <span className="text-xl leading-none" aria-hidden="true">{done.emoji || '✅'}</span>
        </div>)}
      </div>}
      <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
      <p className="text-center text-sm text-slate-400">Read the word out loud, or ask for help.</p>
    </LuminaCardContent>
  </LuminaCard>;
}
