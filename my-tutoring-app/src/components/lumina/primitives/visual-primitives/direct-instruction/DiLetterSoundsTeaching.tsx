'use client';

/**
 * DiLetterSoundsTeaching — the letter-sounds stage as a tutor/JEV teaching
 * workspace (fourth adopter, after Counting Board, Shape Sorter and the number
 * train; first adopter outside math, and the first DI pack to migrate).
 *
 * The stage defines the assignment and the legal scene actions; the tutor
 * chooses how to teach; JEV observes its completed feedback; the runtime commits
 * scoped outcomes. Nothing here composes a model line, scans for "Yes" or
 * "My turn", counts corrections or advances at a miss cap.
 *
 * What the DI pedagogy KEEPS, because it is task structure rather than control
 * protocol: the child answers out loud in every mode; the printed stimulus stays
 * on screen at every tier; a short vowel is still elicited through its keyword;
 * a stop is still judged as a clipped release; the letter's NAME is still not
 * the answer. What it loses is the requirement that the tutor say one exact
 * sentence and that the application read progression out of those words.
 *
 * Two objects are drawn, and both are real: the stimulus card (the printed
 * grapheme, or the keyword in print for onset isolation) and the keyword
 * picture. The tutor can mark either one to point at it while teaching —
 * "this picture is a moon, and moon starts with mmm" is the keyword route, and
 * it is a genuine teaching move rather than an answer. A mark is never a
 * learner attempt, and it never moves the gold ring off the stimulus.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaChallengeCounter, LuminaReadAloudGlyph } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingItem, type TeachingWorkspace }
  from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import type { DiLetterSoundsMetrics } from '../../../evaluation/types';
import { buildLetterSoundItems, type LetterSoundItem } from './diLetterSoundsDomain';
import type { DiLetterSoundsData } from './DiLetterSounds';

export interface DiLetterSoundsTeachingProps {
  data: DiLetterSoundsData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

export default function DiLetterSoundsTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: DiLetterSoundsTeachingProps) {
  const items = useMemo(() => buildLetterSoundItems(data.challenges), [data.challenges]);
  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent>
      <p>These sounds are still being prepared. Try generating this practice again.</p>
    </LuminaCardContent></LuminaCard>;
  }
  return <SoundWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} runtimeEvalMode={runtimeEvalMode} />;
}

function SoundWorkspace({ data, items, className, runtimePlanItemId, runtimeEvalMode }:
  DiLetterSoundsTeachingProps & { items: LetterSoundItem[] }) {
  const instance = useRef(data.instanceId || `di-letter-sounds-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  const evalMode = runtimeEvalMode || data.challengeType || 'letter_sound';

  const assignments = useMemo<TeachingItem[]>(() => items.map(item => ({
    id: item.id,
    task: item.ask,
    expectedAnswer: item.accepted,
    // Every mode is spoken: the child produces a sound, the tutor hears the
    // audio and JEV reads its completed feedback. There is no gesture channel
    // to check, and no transcript parser in front of the sound.
    response: 'speech' as const,
    checkResponse: () => null,
  })), [items]);

  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'di-letter-sounds',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, evalMode, items: assignments, workspace });

  const evaluation = useTeachingEvaluation<DiLetterSoundsMetrics>({ primitiveType: 'di-letter-sounds',
    instanceId: instance.current, data, assignments, lesson, evalMode,
    metrics: result => ({ type: 'di-letter-sounds', evalMode, challengeType: items[0].challengeType,
      totalChallenges: items.length, correctCount: result.solvedCount, attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount, hintsViewed: 0, overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round(result.attemptsCount / items.length * 10) / 10 }) });

  const item = items[lesson.state.index];
  const printed = item.stimulus === 'word' ? item.keyword : item.letter;

  useLayoutEffect(() => {
    workspace.current = {
      objects: [
        { id: 'stimulus', selected: false, group: 'assignment target (gold ring)',
          label: item.stimulus === 'word'
            ? `the word "${item.keyword}" printed on the card`
            : `the letter "${item.letter}" printed on the card` },
        { id: 'picture', selected: false, group: 'keyword picture',
          label: `a picture of a ${item.keyword}` },
      ],
      demonstration: marks,
      facts: { kind: item.challengeType, assignment: item.assignment,
        keyword: item.keyword, elicitation: item.elicitation, articulation: item.articulation,
        supportTier: item.supportTier,
        ...(item.stimulus === 'letter' ? { printedLetter: item.letter } : { printedWord: item.keyword }),
        markMeaning: 'Purple dashed marks are yours. They point at the card or the picture while you teach; '
          + 'they are not the learner answering, and they never move the gold ring off the stimulus.' },
      readyForResponse: true, canDemonstrate: true, canPresent: false,
      mark, clearPresentation: () => mark([]),
    };
    lesson.publishWorkspace();
  });

  const summary = lesson.summary;
  if (summary) return <LuminaCard className={className} surface="elevated">
    <LuminaCardContent className="space-y-6">
      <PhaseSummaryPanel heading="Great work today!" celebrationMessage="You said every sound!"
        overallScore={evaluation.submittedResult?.score} durationMs={evaluation.elapsedMs}
        phases={summary.outcomes.map((outcome, position) => ({
          label: items[position]?.stimulus === 'word' ? items[position].keyword : items[position]?.letter ?? '',
          score: outcome.score, attempts: outcome.attempts, firstTry: outcome.corrections === 0,
          accentColor: 'cyan' as const }))} />
    </LuminaCardContent>
  </LuminaCard>;

  return <LuminaCard className={className} surface="elevated">
    <LuminaCardHeader>
      <div className="flex items-center justify-between gap-3">
        <div>
          <LuminaCardTitle>{data.title || 'Letter Sounds'}</LuminaCardTitle>
          <LuminaCardDescription>{data.description}</LuminaCardDescription>
        </div>
        <LuminaBadge accent="cyan">Say it out loud</LuminaBadge>
      </div>
    </LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
      <div className="flex flex-col items-center gap-4">
        <div data-sound-object="picture" data-pip-object="stage"
          data-tutor-demonstration={marks.includes('picture')}
          aria-label={`Picture of a ${item.keyword}`}
          className={`rounded-2xl border px-6 py-3 text-7xl leading-none ${marks.includes('picture')
            ? 'border-purple-300 outline outline-2 outline-dashed outline-offset-4 outline-purple-400'
            : 'border-transparent'}`}>
          <span aria-hidden="true">{item.emoji}</span>
        </div>
        <div data-sound-object="stimulus" data-assignment-target="true"
          data-tutor-demonstration={marks.includes('stimulus')}
          aria-label={item.stimulus === 'word' ? `The word ${item.keyword}` : `The letter ${item.letter}`}
          className={`rounded-2xl border-2 border-amber-300 bg-amber-400/10 px-10 py-4 font-bold tracking-wide text-white ${
            item.stimulus === 'word' ? 'text-5xl lowercase' : 'text-7xl'} ${marks.includes('stimulus')
              ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
          {printed}
        </div>
      </div>
      <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
      <p className="text-center text-sm text-slate-400">Say the sound out loud, or ask for help.</p>
    </LuminaCardContent>
  </LuminaCard>;
}
