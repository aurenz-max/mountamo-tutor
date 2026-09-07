'use client';

import React, { useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader,
  LuminaCardTitle, LuminaChallengeCounter, LuminaPanel, LuminaPrompt } from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { YouAndMeMetrics } from '../../../evaluation/types';
import { useJudgedScriptRunner } from '../../../hooks/useJudgedScriptRunner';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { youAndMePack, buildYouAndMeItems, sceneStatement, taskPrompt } from './youAndMeScript';
import type { SupportTier } from '../../../service/generation/generationContext';
import { supportFor, type YouAndMeSupportScaffold } from './youAndMeSupport';

export type YouAndMeMode = 'describe_action' | 'describe_independent_action';

export interface YouAndMeChallenge {
  id: string;
  /** Both turns in a pair retain this scene, actor and object. */
  sceneId: string;
  type: YouAndMeMode;
  participants: [{ name: string; emoji: string }, { name: string; emoji: string }];
  actor: 0 | 1;
  speaker: 0 | 1;
  object: string;
  objectEmoji: string;
  /** Past-tense action without a subject: "packed the bag". */
  action: string;
  supportTier?: SupportTier;
  support?: YouAndMeSupportScaffold;
}

export interface YouAndMeData {
  title: string;
  description: string;
  gradeLevel: string;
  challengeType: YouAndMeMode | 'mixed';
  challenges: YouAndMeChallenge[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<YouAndMeMetrics>) => void;
}

/** A new payload remounts the runner so an old verdict cannot score regenerated scenes. */
export default function YouAndMe({ data, className }: { data: YouAndMeData; className?: string }) {
  return <YouAndMeSession key={JSON.stringify([data.instanceId, data.challenges])} data={data} className={className} />;
}

function YouAndMeSession({ data, className }: { data: YouAndMeData; className?: string }) {
  const instanceId = useRef(data.instanceId ?? `you-and-me-${crypto.randomUUID()}`).current;
  const [correctedId, setCorrectedId] = useState<string | null>(null);
  const items = useMemo(() => buildYouAndMeItems(data.challenges), [data.challenges]);
  const pack = useMemo(() => youAndMePack(items), [items]);
  const evaluation = usePrimitiveEvaluation<YouAndMeMetrics>({
    primitiveType: 'you-and-me', instanceId, skillId: data.skillId,
    subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });
  // The shared spoken runner owns attempts and progression. Mirroring it through
  // useChallengeProgress would create a second scoring/progression authority.
  const run = useJudgedScriptRunner({
    pack, instanceId, gradeLevel: data.gradeLevel, exhibitId: data.exhibitId,
    silenceCloseMs: 1200,
    onItemOpened: () => setCorrectedId(null),
    onCorrectionRetry: item => setCorrectedId(item.id),
    onFinished: summary => {
      const modes = Array.from(new Set(items.map(item => item.type)));
      const metrics: YouAndMeMetrics = {
        type: 'you-and-me', challengeType: modes.length === 1 ? modes[0] : 'mixed', totalChallenges: items.length,
        correctCount: summary.solvedCount, attemptsCount: summary.attemptsCount,
        firstTryCount: summary.firstTryCount, hintsViewed: summary.hearTaps,
        overallAccuracy: summary.accuracy, averageAttemptsPerChallenge: summary.attemptsCount / items.length,
        modeResults: modes.map(mode => {
          const ids = new Set(items.filter(item => item.type === mode).map(item => item.id));
          const outcomes = summary.outcomes.filter(outcome => ids.has(outcome.id));
          return { mode, total: ids.size, correct: outcomes.filter(outcome => outcome.solved).length,
            accuracy: outcomes.reduce((sum, outcome) => sum + outcome.score, 0) / ids.size };
        }),
      };
      evaluation.submitResult(summary.passed, summary.accuracy, metrics,
        { outcomes: summary.outcomes, observations: summary.observations,
          perspectives: items.map(({ id, sceneId, type, actor, speaker }) => ({ id, sceneId, type, actor, speaker })) },
        undefined, summary.diagnosisEvidence);
    },
  });
  const item = run.currentItem ?? items[0];
  if (!item) return <LuminaCard><LuminaCardContent>No scenes available. Generate a new activity.</LuminaCardContent></LuminaCard>;
  if (run.summary) return <PhaseSummaryPanel
    phases={phaseResultsFromSummary(items, run.summary, ch => ({
      label: `${ch.participants[ch.speaker].name} speaking`, icon: ch.objectEmoji,
    }))} overallScore={run.summary.accuracy} heading="You & Me"
    celebrationMessage="Both partners had a turn." />;

  const speaker = item.participants[item.speaker];
  const actor = item.participants[item.actor];
  const support = supportFor(item);
  const swapped = run.currentIndex > 0 && items[run.currentIndex - 1]?.sceneId === item.sceneId;
  return <LuminaCard className={className}>
    <LuminaCardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LuminaCardTitle>{data.title}</LuminaCardTitle>
        <LuminaChallengeCounter current={run.currentIndex + 1} total={items.length} />
      </div>
      <p className="text-sm text-slate-400">{data.description}</p>
    </LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      <div className="flex justify-center"><LuminaBadge accent="pink">
        {swapped ? 'Trade roles · same action, new speaker' : 'Meet the partners'}
      </LuminaBadge></div>
      <div className="relative grid grid-cols-2 gap-4 rounded-3xl bg-gradient-to-br from-rose-950/20 to-teal-950/25 p-4 sm:p-8">
        {item.participants.map((person, index) => <div key={person.name}
          className={`relative flex min-h-52 flex-col items-center justify-center gap-3 rounded-3xl border-2 p-4 transition-all duration-500 ${support.showSpeakerHighlight && index === item.speaker ? 'border-pink-300 bg-pink-300/10 shadow-lg shadow-pink-300/10' : 'border-slate-600/40 bg-slate-800/20'}`}>
          <span className="text-6xl sm:text-7xl" role="img" aria-label={person.name}>{person.emoji}</span>
          <span className="text-lg font-semibold text-slate-100">{person.name}</span>
          <span className="text-sm text-slate-300">{index === item.speaker ? 'Speaking now' : 'Listening partner'}</span>
          {support.showActorMarker && index === item.actor && <span className="flex items-center gap-2 text-sm text-slate-200">
            <span className="text-3xl" role="img" aria-label={item.object}>{item.objectEmoji}</span> Did the action
          </span>}
        </div>)}
        <div className="col-span-2 text-center text-lg text-slate-100">{sceneStatement(item)}</div>
      </div>
      <LuminaPrompt>{taskPrompt(item)}</LuminaPrompt>
      {support.preparation && <LuminaPanel><p className="text-center text-slate-200">{support.preparation}</p></LuminaPanel>}
      {correctedId === item.id && <LuminaPanel>
        <p className="text-center text-slate-200">{speaker.name} is speaking. {actor.name} did the action.</p>
      </LuminaPanel>}
      <JudgedMicPanel run={run} voiceLabel="Tell your partner" idleLabel="Let’s talk" />
      {run.running && <div className="text-center"><LuminaButton tone="ghost" onClick={run.hearStimulus}>
        Hear the scene again
      </LuminaButton></div>}
    </LuminaCardContent>
  </LuminaCard>;
}
