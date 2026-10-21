'use client';

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { LuminaBadge } from '../ui';
import { KaTeX } from './annotated-example/StepContentRenderer';
import { getFamily, resolveParameters } from '../lib/probability';
import { PipDock, PipWorkspace } from '../pip/WorkspacePip';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../evaluation';
import type { DistributionExplorerMetrics } from '../evaluation/types';
import type { TeachingWorkspace } from '../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../components/live-activity/bossLevers';
import { DistributionPlot } from './distribution-explorer/DistributionPlot';
import { ParameterPanel } from './distribution-explorer/ParameterPanel';
import { MomentReadout } from './distribution-explorer/MomentReadout';
import { FamilySelector } from './distribution-explorer/FamilySelector';
import { ChallengeStrip } from './distribution-explorer/ChallengeStrip';
import {
  describeDistributionWork, distributionCorrect, distributionMiss, workspaceScene, type DistributionWork,
} from './distribution-explorer/distributionExplorerWorkspace';
import {
  DISTRIBUTION_LEVERS, EVENT_STRIP_LEVER, FAMILY_FACTS, FAMILY_FACTS_LEVER, PRACTICE_NOTE, SHAPE_GUIDE, SHAPE_GUIDE_LEVER,
  SLIDER_GLOW_LEVER, WORKED_MODEL_LEVER, eventStrip, namedSliders, stripText, workedModel,
} from './distribution-explorer/distributionExplorerLevers';
import { distributionExplorerBoss } from './distribution-explorer/distributionExplorer.boss';
import type {
  DistributionChallenge,
  DistributionExplorerData,
  DistributionFamily,
} from './distribution-explorer/types';

// ═══════════════════════════════════════════════════════════════════════
// DistributionExplorer — the master distribution workbench.
//
// Discrete + continuous families with interactive parameter sliders, live moment readout, PDF/CDF view toggle, and
// a challenge strip authored by the orchestrator. The math engine in `lumina/lib/probability` evaluates the chosen
// family at the current parameters — Gemini never invents PMF values, only narrative + challenges.
//
// Taught only on the shared tutor/JEV workspace (its boss is `distribution-explorer/distributionExplorer.boss.ts`):
// the runtime advances, and the checks in `distributionExplorerWorkspace.ts` commit.
// ═══════════════════════════════════════════════════════════════════════

interface DistributionExplorerProps {
  data: DistributionExplorerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const useDistributionProgress = useWorkspaceProgressFor('distribution-explorer');

const DistributionExplorerSurface = ({ data, className, runtimePlanItemId }: DistributionExplorerProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const challenges = data.challenges;

  const stableInstanceIdRef = useRef(data.instanceId || `distribution-explorer-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;

  // ── Progression: the runtime moves the index. ──
  /** Bound below; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useDistributionProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: distributionExplorerBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const activeChallengeIdx = progress.currentIndex;
  /** A checked answer stays closed until Try again or the next item. */
  const blocked = progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  // Family + params are local state — the data only seeds them. Students drive the workbench.
  const [family, setFamily] = useState<DistributionFamily>(data.initial.family);
  const [params, setParams] = useState<Record<string, number>>(() =>
    resolveParameters(data.initial.family, data.initial.parameters),
  );
  const [view, setView] = useState<'pdf' | 'cdf'>('pdf');

  // Per-challenge results: only a correct check is written here (a wrong one reopens through Try again, and must not
  // show the rationale or the key).
  const [results, setResults] = useState<Record<string, boolean>>({});
  /** The choice picked on the active challenge, and whether the workbench moved since it opened (explore's check). */
  const [selected, setSelected] = useState<string | null>(null);
  const [explored, setExplored] = useState(false);

  // In-item levers (`DISTRIBUTION_LEVERS`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place (ungraded practice; the session item comes back after it).
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
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const shownChallenges = practice ? challenges.map((c, i) => (i === activeChallengeIdx ? practice : c)) : challenges;
  // While an identify challenge is pending the workbench must not name a family: the selector is locked and the
  // family's name, formula, description and sliders are hidden, so the chart cannot be read for the answer.
  const identifyPending =
    activeChallenge?.type === 'identify' && results[activeChallenge.id] === undefined;
  // While a compute item is pending the workbench must not print a value that answers it: the moment readout (E[X],
  // Var) and the chart's hover readout (P(X = x), F(x)) are hidden. The shape stays, and the sliders still move it.
  const computePending =
    activeChallenge?.type === 'compute' && results[activeChallenge.id] === undefined;

  // ── Evaluation (under a lesson's evaluation provider) ──
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

  // Check (or Got it): the activity's own check commits; only a correct one is shown as answered.
  const handleCheck = useCallback(() => {
    const ch = activeChallenge;
    if (!ch || learnerBlocked() || results[ch.id] !== undefined) return;
    if (ch.type !== 'guided_exploration' && selected === null) return;
    const correct = distributionCorrect(ch, work);
    progress.commitCheck(describeDistributionWork(ch, work), correct, distributionMiss(ch, work));
    if (correct) setResults((prev) => ({ ...prev, [ch.id]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChallenge, results, selected, explored, family, params, progress.commitCheck]);

  // What the tutor and the observer are shown, republished every render. No demonstration, no presentation.
  useLayoutEffect(() => {
    if (!activeChallenge || !sessionChallenge) return;
    const scene = workspaceScene(activeChallenge, work, identifyPending, computePending);
    const levers = practice ? [] : DISTRIBUTION_LEVERS.declare(sessionChallenge, null, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : DISTRIBUTION_LEVERS.support(sessionChallenge, null),
      onScreen: practice ? '' : DISTRIBUTION_LEVERS.onScreen(sessionChallenge, null, pulledLevers),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = DISTRIBUTION_LEVERS.simpler(sessionChallenge, null, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); setSelected(null); setExplored(false);
          return { practice: distributionExplorerBoss.assignment!(easier) };
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

  const plotName = identifyPending ? 'Mystery distribution' : familyDef.label;

  return (
    <div className={`max-w-7xl mx-auto font-sans text-slate-200 ${className || ''}`}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-6 space-y-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <LuminaBadge accent="blue">{data.subject}</LuminaBadge>
          <LuminaBadge accent="pink">{data.evalMode.replace(/_/g, ' ')}</LuminaBadge>
          {practice && <LuminaBadge accent="amber">Practice</LuminaBadge>}
        </div>
        <h1 className="text-2xl font-serif font-bold text-white tracking-tight">{data.title}</h1>
        {data.lessonContext && (
          <Card className="backdrop-blur-xl bg-slate-900/30 border-white/5 px-5 py-3">
            <p className="text-sm text-slate-300 leading-relaxed">{data.lessonContext}</p>
          </Card>
        )}
      </div>

      {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the workbench (family, sliders,
          chart and challenge strip) as one region. */}
      <div className="mb-4"><PipDock /></div>
      <PipWorkspace className="grid grid-cols-1 lg:grid-cols-12 gap-4">
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
      </PipWorkspace>
    </div>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
export const DistributionExplorer = withWorkspaceOnly<DistributionExplorerProps>(
  'distribution-explorer', DistributionExplorerSurface, props => props.data.title);

export default DistributionExplorer;
