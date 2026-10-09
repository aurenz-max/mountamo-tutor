'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { LuminaBadge } from '../ui';
import { KaTeX } from './annotated-example/StepContentRenderer';
import { getFamily, resolveParameters } from '../lib/probability';
import { useLuminaAI } from '../hooks/useLuminaAI';
import { useWorkspacePipSurface } from '../pip/useWorkspacePipSurface';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../evaluation';
import type { DistributionExplorerMetrics } from '../evaluation/types';
import type { TeachingWorkspace } from '../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../components/live-activity/runtime/useWorkspaceProgress';
import { DistributionPlot } from './distribution-explorer/DistributionPlot';
import { ParameterPanel } from './distribution-explorer/ParameterPanel';
import { MomentReadout } from './distribution-explorer/MomentReadout';
import { FamilySelector } from './distribution-explorer/FamilySelector';
import { ChallengeStrip } from './distribution-explorer/ChallengeStrip';
import {
  describeDistributionWork, distributionCorrect, distributionMiss, workspaceAssignment, workspaceScene,
  type DistributionWork,
} from './distribution-explorer/distributionExplorerWorkspace';
import {
  EVENT_STRIP_LEVER, FAMILY_FACTS, FAMILY_FACTS_LEVER, SHAPE_GUIDE, SHAPE_GUIDE_LEVER, SLIDER_GLOW_LEVER, WORKED_MODEL_LEVER,
  distributionLevers, eventStrip, leverFacts, namedSliders, practiceItem, stripText, workedModel,
} from './distribution-explorer/distributionExplorerLevers';
import type {
  DistributionChallenge,
  DistributionExplorerData,
  DistributionFamily,
} from './distribution-explorer/types';

// ═══════════════════════════════════════════════════════════════════════
// DistributionExplorer — the master distribution workbench.
//
// Wave-1 scope: discrete + continuous families with interactive parameter
// sliders, live moment readout, PDF/CDF view toggle, and a phase-gated
// challenge strip authored by the orchestrator. The math engine in
// `lumina/lib/probability` evaluates the chosen family at the current
// parameters — Gemini never invents PMF values, only narrative + challenges.
//
// Two controllers (`withWorkspaceController`): the scripted one (its own Next,
// scripted tutor messages), and the shared tutor/JEV workspace, where the
// runtime advances and the checks in `distributionExplorerWorkspace.ts` commit.
// ═══════════════════════════════════════════════════════════════════════

interface DistributionExplorerProps {
  data: DistributionExplorerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const DistributionExplorerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  DistributionExplorerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<DistributionChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const challenges = data.challenges;

  const stableInstanceIdRef = useRef(data.instanceId || `distribution-explorer-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;

  // ── Progression. On the workspace path the runtime moves the index. ──
  /** Bound below; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const activeChallengeIdx = progress.currentIndex;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const blocked = tutorOwned && progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  // Family + params are local state — the data only seeds them. Students drive the workbench.
  const [family, setFamily] = useState<DistributionFamily>(data.initial.family);
  const [params, setParams] = useState<Record<string, number>>(() =>
    resolveParameters(data.initial.family, data.initial.parameters),
  );
  const [view, setView] = useState<'pdf' | 'cdf'>('pdf');

  // Per-challenge results: undefined = not yet committed, true/false = correct/incorrect. With the tutor only a
  // correct check is written here (a wrong one reopens through Try again, and must not show the rationale or the key).
  const [results, setResults] = useState<Record<string, boolean>>({});
  /** The choice picked on the active challenge, and whether the workbench moved since it opened (explore's check). */
  const [selected, setSelected] = useState<string | null>(null);
  const [explored, setExplored] = useState(false);

  // In-item levers (`distributionExplorerLevers.ts`), keyed by the session item they were pulled on, and the easier item
  // a simplify lever put on screen in its place (ungraded practice; the session item comes back after it).
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<DistributionChallenge | null>(null);

  // A fresh item, Try again, or back from practice: the pick and the explore check start over. A retry on the practice
  // item keeps it (only `endPractice` removes it).
  openItem.current = () => { setSelected(null); setExplored(false); };

  const familyDef = useMemo(() => getFamily(family), [family]);
  const evaluated = useMemo(() => familyDef.evaluate(params), [familyDef, params]);

  const sessionChallenge: DistributionChallenge | undefined = challenges[activeChallengeIdx];
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const activeChallenge: DistributionChallenge | undefined = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** The pulls drawn on screen now: never on a practice item. */
  const onScreenLevers = practice ? [] : pulledLevers;
  const leverOn = (id: string) => onScreenLevers.includes(id);
  const shownChallenges = practice ? challenges.map((c, i) => (i === activeChallengeIdx ? practice : c)) : challenges;
  // While an identify challenge is pending the workbench must not name a family: the selector is locked and the
  // family's name, formula, description and sliders are hidden, so the chart cannot be read for the answer.
  const identifyPending =
    activeChallenge?.type === 'identify' && results[activeChallenge.id] === undefined;
  // While a compute item is pending the workbench must not print a value that answers it: the moment readout (E[X],
  // Var) and the chart's hover readout (P(X = x), F(x)) are hidden. The shape stays, and the sliders still move it.
  const computePending =
    activeChallenge?.type === 'compute' && results[activeChallenge.id] === undefined;

  // ── Evaluation (workspace path, under a lesson's evaluation provider) ──
  const { submitResult: submitEvaluation, hasSubmitted: hasSubmittedEvaluation } =
    usePrimitiveEvaluation<DistributionExplorerMetrics>({
      primitiveType: 'distribution-explorer',
      instanceId: resolvedInstanceId,
      skillId: data.skillId,
      subskillId: data.subskillId,
      objectiveId: data.objectiveId,
      exhibitId: data.exhibitId,
      onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
    });

  finish.current = (result) => {
    if (hasSubmittedEvaluation || challenges.length === 0 || progress.recordsEvaluation === false) return;
    const metrics: DistributionExplorerMetrics = {
      type: 'distribution-explorer',
      evalMode: data.evalMode,
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      overallAccuracy: result.accuracy,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── AI tutoring (scripted path) ────────────────────────────────
  // aiPrimitiveData mirrors the catalog contextKeys (family, evalMode, parameters, current prompt/type, a moment
  // snapshot). It carries NO correct answer. On the workspace path the tutor reads the scene instead.
  const aiPrimitiveData = useMemo(() => ({
    family,
    evalMode: data.evalMode,
    parameters: params,
    currentPrompt: activeChallenge?.prompt ?? null,
    currentChallengeType: activeChallenge?.type ?? null,
    momentSnapshot: {
      mean: Number(evaluated.moments.mean.toFixed(3)),
      variance: Number(evaluated.moments.variance.toFixed(3)),
      skewness: Number(evaluated.moments.skewness.toFixed(3)),
    },
  }), [family, data.evalMode, params, activeChallenge, evaluated]);

  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'distribution-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeLevel,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // Introduce the workbench once the tutor connects (one end_of_turn message
  // carrying the first challenge's prompt so the tutor reads a real task).
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    const first = challenges[0];
    sendText(
      `[ACTIVITY_START] Distribution-explorer session — ${data.evalMode.replace(/_/g, ' ')} mode on the ${family} family, ${challenges.length} challenge(s). `
      + `Introduce the workbench briefly (sliders change parameters; the chart, moments, and CDF update live), then read the first challenge: "${first.prompt}".`,
      { silent: true },
    );
  }, [isConnected, challenges, data.evalMode, family, sendText]);

  const handleFamilyChange = useCallback(
    (next: DistributionFamily) => {
      if (learnerBlocked()) return;
      setFamily(next);
      // Reset params to the new family's defaults — old names won't transfer cleanly.
      setParams(resolveParameters(next, undefined));
      setExplored(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleParamChange = useCallback((name: string, value: number) => {
    if (learnerBlocked()) return;
    setParams((prev) => ({ ...prev, [name]: value }));
    setExplored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback((key: string) => {
    if (learnerBlocked()) return;
    setSelected(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const work: DistributionWork = { picked: selected, explored, family, params };

  const handleCheck = useCallback(() => {
    const ch = activeChallenge;
    if (!ch || learnerBlocked() || results[ch.id] !== undefined) return;
    if (ch.type !== 'guided_exploration' && selected === null) return;
    // The scripted path credits Got it as it always has; with the tutor, Got it is checked (the workbench moved).
    const correct = ch.type === 'guided_exploration' && !tutorOwned ? true : distributionCorrect(ch, work);
    progress.commitCheck(describeDistributionWork(ch, work), correct, distributionMiss(ch, work));
    if (!tutorOwned || correct) setResults((prev) => ({ ...prev, [ch.id]: correct }));
    if (ch.type === 'guided_exploration') {
      // Explore phase has no graded answer — affirm the observation, don't grade.
      sendText(
        `[EXPLORATION_DONE] The student finished the guided exploration: "${ch.prompt}". `
        + `Affirm their observation in one sentence and invite them onward — no grading.`,
        { silent: true },
      );
    } else if (correct) {
      sendText(
        `[ANSWER_CORRECT] The student answered the ${ch.type} challenge correctly: "${ch.prompt}". `
        + `Congratulate briefly and reinforce WHY it's right in one sentence (shape / support / the mean-variance relationship).`,
        { silent: true },
      );
    } else {
      sendText(
        `[ANSWER_INCORRECT] The student answered the ${ch.type} challenge "${ch.prompt}" incorrectly. `
        + `Give a structural hint that points at shape, support, or the mean-variance relationship. `
        + `Do NOT reveal the correct family or value — they can re-read the rationale on screen.`,
        { silent: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChallenge, results, selected, explored, family, params, tutorOwned, progress.commitCheck, sendText]);

  // Scripted path only: send exactly one end_of_turn message per advance, carrying the NEXT challenge's data (or the
  // session summary). The workspace path hides Next and the runtime advances.
  const handleAdvance = useCallback(() => {
    const nextIdx = activeChallengeIdx + 1;
    const next = challenges[nextIdx];
    if (next) {
      sendText(
        `[NEXT_CHALLENGE] Challenge ${nextIdx + 1} of ${challenges.length} (${next.type}): "${next.prompt}". `
        + `Introduce it briefly — what should the student focus on?`,
        { silent: true },
      );
    } else {
      sendText(
        `[ALL_COMPLETE] The student finished all ${challenges.length} distribution challenges. `
        + `Give a brief, encouraging summary tied to the ${family} family.`,
        { silent: true },
      );
    }
    setSelected(null);
    setExplored(false);
    progress.advance();
  }, [activeChallengeIdx, challenges, family, sendText, progress]);

  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration, no
  // presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !activeChallenge || !sessionChallenge) return;
    const scene = workspaceScene(activeChallenge, work, identifyPending, computePending);
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : distributionLevers(sessionChallenge, pulledLevers);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'An easier practice item is on screen in place of the item. It is not graded; the full item comes back after it.' } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionChallenge);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); setSelected(null); setExplored(false);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); setSelected(null); setExplored(false); },
    };
  });

  // What the pulled help levers draw (never on a practice item; none prints the answer).
  const strip = leverOn(EVENT_STRIP_LEVER) && sessionChallenge ? eventStrip(sessionChallenge) : null;
  const model = leverOn(WORKED_MODEL_LEVER) && sessionChallenge ? workedModel(sessionChallenge) : null;
  const glow = leverOn(SLIDER_GLOW_LEVER) && sessionChallenge?.type === 'guided_exploration'
    ? (namedSliders(sessionChallenge.prompt).length ? namedSliders(sessionChallenge.prompt) : familyDef.parameters.map((p) => p.name))
    : undefined;
  const notes = leverOn(FAMILY_FACTS_LEVER) ? FAMILY_FACTS : undefined;

  // ── Pip shared surface ───────────────────────────────────────────
  // Pip outlines the workbench (family, sliders, chart and challenge strip) as one
  // region during the tutor's speech, looks at what the child moves, and celebrates
  // only a committed correct answer. Guided exploration has no graded answer, so it
  // never celebrates.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: activeChallenge?.id ?? null,
    label: 'The distribution workbench',
    solved: !!activeChallenge && activeChallenge.type !== 'guided_exploration' && results[activeChallenge.id] === true,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  const plotName = identifyPending ? 'Mystery distribution' : familyDef.label;

  return (
    <div className={`max-w-7xl mx-auto font-sans text-slate-200 ${className || ''}`}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-6 space-y-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <LuminaBadge accent="blue">{data.subject}</LuminaBadge>
          <LuminaBadge accent="pink">{data.evalMode.replace(/_/g, ' ')}</LuminaBadge>
        </div>
        <h1 className="text-2xl font-serif font-bold text-white tracking-tight">{data.title}</h1>
        {data.lessonContext && (
          <Card className="backdrop-blur-xl bg-slate-900/30 border-white/5 px-5 py-3">
            <p className="text-sm text-slate-300 leading-relaxed">{data.lessonContext}</p>
          </Card>
        )}
      </div>

      {/* ── Workbench grid ─────────────────────────────────────── */}
      {pip.store && activeChallenge && <div {...pip.dock} className={`${pip.dock.className} mb-4`} />}
      <div {...pip.workspace} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left rail — family + params + moments */}
        <div className="lg:col-span-4 space-y-4">
          {identifyPending ? (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                The family picker and sliders come back once you have identified the family.
              </p>
            </Card>
          ) : (
            <>
              <FamilySelector active={family} onChange={handleFamilyChange} disabled={blocked} />
              <ParameterPanel familyDef={familyDef} values={params} onChange={handleParamChange} disabled={blocked} highlight={glow} />
            </>
          )}
          {computePending ? (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                The mean, variance and the chart&apos;s value readout come back once you have checked your answer.
              </p>
            </Card>
          ) : (
            <MomentReadout moments={evaluated.moments} />
          )}
        </div>

        {/* Right pane — chart + formula + view toggle + challenge */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {plotName} {identifyPending ? '' : view === 'pdf'
                  ? (familyDef.kind === 'discrete' ? 'PMF' : 'PDF')
                  : 'CDF'}
              </p>
              <div className="flex gap-1">
                {(['pdf', 'cdf'] as const).map((v) => (
                  <Button
                    key={v}
                    variant="ghost"
                    size="sm"
                    onClick={() => { if (!learnerBlocked()) setView(v); }}
                    className={`text-xs ${
                      view === v
                        ? 'bg-indigo-500/20 border border-indigo-400/40 text-indigo-100'
                        : 'bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {v.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            <DistributionPlot evaluated={evaluated} view={view} hideValues={computePending} />
            {!identifyPending && (
              <>
                <div className="text-center">
                  <KaTeX latex={familyDef.formula} />
                </div>
                <p className="text-xs text-slate-500 text-center italic">{familyDef.description}</p>
              </>
            )}
          </Card>

          <ChallengeStrip
            challenges={shownChallenges}
            activeIndex={activeChallengeIdx}
            results={results}
            selected={selected}
            onSelect={handleSelect}
            onCheck={handleCheck}
            onAdvance={handleAdvance}
            tutorOwned={tutorOwned}
            blocked={blocked}
            notes={notes}
          />

          {(strip || model || leverOn(SHAPE_GUIDE_LEVER)) && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4 space-y-2">
              {strip && (
                <p data-lever="event-strip" className="text-sm font-mono text-amber-200">{stripText(strip)}</p>
              )}
              {model && (
                <div data-lever="worked-model" className="space-y-0.5">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">A worked model, not your item</p>
                  {model.steps.map((step) => (
                    <p key={step} className="text-sm font-mono text-amber-100">{step}</p>
                  ))}
                </div>
              )}
              {leverOn(SHAPE_GUIDE_LEVER) && (
                <ul data-lever="shape-guide" className="text-sm text-amber-100 space-y-0.5">
                  {SHAPE_GUIDE.map((line) => <li key={line}>{line}</li>)}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
export const DistributionExplorer = withWorkspaceController<DistributionExplorerProps, ProgressOptions<DistributionChallenge>, Progress>(
  'distribution-explorer', DistributionExplorerSurface, useScriptedProgress, useWorkspaceProgressFor('distribution-explorer'));

export default DistributionExplorer;
