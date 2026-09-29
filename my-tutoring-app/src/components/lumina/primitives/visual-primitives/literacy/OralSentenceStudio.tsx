'use client';

/**
 * Oral Sentence Studio — original vocabulary use in complete child sentences.
 *
 * A meaningful scene and two new words stay visible while the child speaks.
 * Runs only on the shared tutor/JEV teaching workspace (workspace rollout C7;
 * the scripted runner was retired, LA-14, user ruling 09-23: one path): the
 * observer judges complete thought + task relevance + semantic word use, never
 * exact wording, and the runtime owns progression. An example sentence appears
 * only after credit. An unbound mount shows the shared "needs the tutor" card.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardDescription,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaReadAloudGlyph,
  LuminaSectionLabel,
} from '../../../ui';
import { useStimulusPipSurface } from '../../../pip/useStimulusPipSurface';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { OralSentenceStudioMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { phaseResultsFromSummary, type PhaseConfig } from '../../../hooks/usePhaseResults';
import { itemsFromChallenges, type OralSentenceStudioItem } from './oralSentenceStudioScript';
import { oralSentenceAssignment, oralSentenceScene } from './oralSentenceStudioWorkspace';
import { PICTURES_LEVER, STRIP_LEVER, leversOnScreen, oralSentenceLevers } from './oralSentenceStudioLevers';

/** Task identities (eval modes): describe a picture, rehearse the sentence
 * for the next step of a class writing piece, or reuse two story words in a
 * new sentence of one's own. */
export type OralSentenceStudioChallengeType =
  | 'describe_scene'
  | 'guided_writing_rehearsal'
  | 'use_story_words';

export interface OralSentenceStudioChallenge {
  id: string;
  type: OralSentenceStudioChallengeType;
  sceneTitle: string;
  settingEmoji: string;
  settingLabel: string;
  actorEmoji: string;
  actorLabel: string;
  actionEmoji: string;
  actionLabel: string;
  objectEmoji: string;
  objectLabel: string;
  /** Exactly two visible words the child must use. */
  targetWords: [string, string];
  /** Child-friendly meanings aligned by index with targetWords. */
  wordMeanings: [string, string];
  /** One meaning picture per target word (the `word_pictures` lever). Never a scene emoji; absent when invalid. */
  wordEmojis?: [string, string];
  /** Private semantic scene anchor; never rendered before or during an attempt. */
  sceneMeaning: string;
  /** Three private, distinct examples proving the answer set is open. */
  acceptedSentences: [string, string, string];
  /** use_story_words only: the 2-3 sentence story the tutor reads aloud. */
  storyText?: string;
  /** guided_writing_rehearsal only: short label for the step already written. */
  priorStepLabel?: string;
}

export interface OralSentenceStudioData {
  title: string;
  description: string;
  gradeLevel?: string;
  /** Representative only; each challenge renders from its own `type`. */
  challengeType: OralSentenceStudioChallengeType | 'mixed';
  /** Three long-form spoken challenges, built by the Fork B orchestrator. */
  challenges: OralSentenceStudioChallenge[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<OralSentenceStudioMetrics>) => void;
}

interface OralSentenceStudioProps {
  data: OralSentenceStudioData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const PHASE_CONFIG: Record<OralSentenceStudioChallengeType, PhaseConfig> = {
  describe_scene: { label: 'Picture Sentences', icon: '💬', accentColor: 'cyan' },
  guided_writing_rehearsal: { label: 'Say It Before We Write', icon: '📝', accentColor: 'purple' },
  use_story_words: { label: 'Story Words', icon: '📖', accentColor: 'amber' },
};

const MODE_PROMPT: Record<OralSentenceStudioChallengeType, string> = {
  describe_scene: 'Look at the scene. Say one complete sentence that uses both new words.',
  guided_writing_rehearsal: 'Look at the next step. Say the sentence we will write for it, using both words.',
  use_story_words: 'Listen to the story. Then make a new sentence of your own with both story words.',
};

const OralSentenceStudioSurface: React.FC<OralSentenceStudioProps> = ({ data, className, runtimePlanItemId }) => {
  const items = useMemo(() => itemsFromChallenges(data.challenges), [data.challenges]);
  const stableInstanceIdRef = useRef(data.instanceId || `oral-sentence-studio-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;
  const workspace = useRef<TeachingWorkspace | null>(null);
  /** The credited item, whose example sentence may now be shown. */
  const [creditedItem, setCreditedItem] = useState<OralSentenceStudioItem | null>(null);
  // In-item levers (`oralSentenceStudioLevers.ts`), keyed by the item they were pulled on.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });

  const evaluation = usePrimitiveEvaluation<OralSentenceStudioMetrics>({
    primitiveType: 'oral-sentence-studio',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const total = items.length;
    const metrics: OralSentenceStudioMetrics = {
      type: 'oral-sentence-studio',
      challengeType: data.challengeType,
      totalChallenges: total,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: total > 0 ? summary.attemptsCount / total : 0,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const runner = useWorkspaceRunner<OralSentenceStudioItem>({
    primitiveId: 'oral-sentence-studio',
    assignment: oralSentenceAssignment,
    items,
    workspace,
    objectiveId: data.objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onAffirmed: (item) => setCreditedItem(item),
  });
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  const currentItem = runner.currentItem ?? items[0] ?? null;
  const pulledLevers = leverState.item === currentItem?.id ? leverState.pulled : [];
  const leverOn = (id: string) => pulledLevers.includes(id) && !runner.revealHeld;

  // What the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation; every item is answerable once it opens.
  useLayoutEffect(() => {
    const item = runner.currentItem;
    if (!item) return;
    const levers = oralSentenceLevers(item, pulledLevers);
    const scene = oralSentenceScene(item);
    const onScreen = leversOnScreen(item, pulledLevers);
    workspace.current = { ...scene,
      facts: { ...scene.facts, ...(onScreen ? { levers_on_screen: onScreen } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        setLeverState({ item: item.id, pulled: [...pulledLevers, id] });
        return true;
      },
    };
  });

  // Pip: the scene is the question side; the sentence is the child's own, so
  // Pip points only at the scene and watches it while the child speaks.
  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The picture', finished: showSummary,
  });
  const phaseResults = useMemo(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => PHASE_CONFIG[item.mode]);
  }, [items, runner.practiceSummary]);

  if (!currentItem) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          These picture sentences are still being made. Try generating the activity again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const challenge = currentItem.challenge;
  const phase = PHASE_CONFIG[challenge.type];
  const feedbackVisible = creditedItem != null && creditedItem.id === currentItem.id && runner.revealHeld;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <LuminaCardTitle className="text-lg">{data.title}</LuminaCardTitle>
            <LuminaCardDescription className="mt-1">{data.description}</LuminaCardDescription>
          </div>
          {!showSummary && (
            <LuminaBadge accent="cyan">{phase.icon} {phase.label}</LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {!showSummary && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              <LuminaReadAloudGlyph size={32} speaking={runner.tutorSpeaking} />
            </div>

            <LuminaPrompt>{MODE_PROMPT[challenge.type]}</LuminaPrompt>

            {challenge.type === 'use_story_words' && challenge.storyText && (
              <LuminaPanel accent="amber">
                <LuminaSectionLabel>The story</LuminaSectionLabel>
                <p className="mt-2 text-lg leading-relaxed text-slate-100">{challenge.storyText}</p>
              </LuminaPanel>
            )}

            {pip.store && <div {...pip.dock} />}
            <LuminaPanel {...pip.target('stimulus')} accent="cyan" className="overflow-hidden">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <LuminaSectionLabel>
                    {challenge.type === 'describe_scene' ? 'Picture to describe'
                      : challenge.type === 'guided_writing_rehearsal' ? 'We are writing' : 'Story picture'}
                  </LuminaSectionLabel>
                  <p className="mt-1 font-semibold text-slate-100">{challenge.sceneTitle}</p>
                </div>
                <LuminaBadge accent="cyan">Keep looking while you speak</LuminaBadge>
              </div>

              {challenge.type === 'guided_writing_rehearsal' && challenge.priorStepLabel && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-slate-950/45 px-3 py-1 text-slate-300">
                    ✅ Already written: {challenge.priorStepLabel}
                  </span>
                  <span className="text-cyan-200/70" aria-hidden>→</span>
                  <span className="rounded-full bg-cyan-400/15 px-3 py-1 font-semibold text-cyan-100">
                    Now: this step
                  </span>
                </div>
              )}

              <div className="relative min-h-56 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-sky-400/15 via-indigo-400/10 to-emerald-400/15 p-5">
                <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-slate-950/45 px-3 py-1.5 text-xs font-semibold text-slate-200">
                  <span className="text-xl" role="img" aria-hidden>{challenge.settingEmoji}</span>
                  {challenge.settingLabel}
                </div>

                <div className="flex min-h-44 items-end justify-center gap-4 pt-12 sm:gap-8">
                  <div className="max-w-32 text-center">
                    <span className="block text-6xl" role="img" aria-label={challenge.actorLabel}>
                      {challenge.actorEmoji}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-slate-100">{challenge.actorLabel}</span>
                  </div>

                  <div className="pb-7 text-center">
                    <span className="block text-4xl" role="img" aria-label={challenge.actionLabel}>
                      {challenge.actionEmoji}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-cyan-100">{challenge.actionLabel}</span>
                    <span className="mt-1 block text-xl text-cyan-200/70" aria-hidden>→</span>
                  </div>

                  <div className="max-w-32 text-center">
                    <span className="block text-6xl" role="img" aria-label={challenge.objectLabel}>
                      {challenge.objectEmoji}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-slate-100">{challenge.objectLabel}</span>
                  </div>
                </div>
              </div>
            </LuminaPanel>

            <LuminaPanel accent="amber">
              <LuminaSectionLabel>
                {challenge.type === 'use_story_words' ? 'Use both story words' : 'Use both words'}
              </LuminaSectionLabel>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {challenge.targetWords.map((word, index) => (
                  <div key={word} className="rounded-xl border border-amber-300/15 bg-amber-300/10 p-4">
                    <p className="text-xl font-bold text-amber-100">{word}</p>
                    <p className="mt-1 text-sm text-slate-300">{challenge.wordMeanings[index]}</p>
                    {/* Help: what the word means, as a picture of its own. Never a scene picture. */}
                    {leverOn(PICTURES_LEVER) && challenge.wordEmojis && (
                      <span data-lever="word-picture" className="mt-2 block text-4xl" role="img" aria-label={`${word} picture`}>
                        {challenge.wordEmojis[index]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {/* Help: the shape of a whole sentence. Two empty boxes and the word chips; nothing is filled in. */}
              {leverOn(STRIP_LEVER) && (
                <div data-lever="sentence-strip" className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span className="rounded-xl border-2 border-dashed border-cyan-300/40 px-4 py-2 text-cyan-100">👤 Who?</span>
                  <span className="rounded-xl border-2 border-dashed border-cyan-300/40 px-4 py-2 text-cyan-100">⚡ What happens?</span>
                  {challenge.targetWords.map(word => (
                    <span key={word} className="rounded-full bg-amber-300/15 px-3 py-1 font-semibold text-amber-100">{word}</span>
                  ))}
                </div>
              )}
            </LuminaPanel>

            {feedbackVisible && creditedItem && (
              <LuminaFeedbackCard
                status="correct"
                label="Your sentence worked"
                teachingNote="This is one possible sentence. Your own wording can be different."
              >
                {creditedItem.modelResponse}
              </LuminaFeedbackCard>
            )}

          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Sentence Studio Complete!"
            celebrationMessage="You used new words to make complete picture sentences."
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const OralSentenceStudioBound = withWorkspaceOnly<OralSentenceStudioProps>('oral-sentence-studio',
  OralSentenceStudioSurface, (props) => props.data.title);

/** Runs only on the teaching workspace; keyed so a new challenge set mounts a fresh session. */
const OralSentenceStudio: React.FC<OralSentenceStudioProps> = (props) => (
  <OralSentenceStudioBound
    key={[props.data.instanceId ?? '', ...props.data.challenges.map((challenge) => challenge.id)].join('|')}
    {...props}
  />
);

export default OralSentenceStudio;
