'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { LuminaBadge } from '../ui';
import { KaTeX } from './annotated-example/StepContentRenderer';
import { getFamily, resolveParameters } from '../lib/probability';
import { useLuminaAI } from '../hooks/useLuminaAI';
import { DistributionPlot } from './distribution-explorer/DistributionPlot';
import { ParameterPanel } from './distribution-explorer/ParameterPanel';
import { MomentReadout } from './distribution-explorer/MomentReadout';
import { FamilySelector } from './distribution-explorer/FamilySelector';
import { ChallengeStrip } from './distribution-explorer/ChallengeStrip';
import type {
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
// ═══════════════════════════════════════════════════════════════════════

interface DistributionExplorerProps {
  data: DistributionExplorerData;
  className?: string;
}

export const DistributionExplorer: React.FC<DistributionExplorerProps> = ({ data, className }) => {
  // Family + params are local state — the data only seeds them. Students drive the workbench.
  const [family, setFamily] = useState<DistributionFamily>(data.initial.family);
  const [params, setParams] = useState<Record<string, number>>(() =>
    resolveParameters(data.initial.family, data.initial.parameters),
  );
  const [view, setView] = useState<'pdf' | 'cdf'>('pdf');

  // Per-challenge results: undefined = not yet committed, true/false = correct/incorrect.
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [activeChallengeIdx, setActiveChallengeIdx] = useState(0);

  const familyDef = useMemo(() => getFamily(family), [family]);
  const evaluated = useMemo(() => familyDef.evaluate(params), [familyDef, params]);

  // While an identify challenge is pending, lock the family selector so the
  // workbench can't be used to read off the answer. Parameter sliders stay
  // active so the student can still inspect the *shape*.
  const activeChallenge = data.challenges[activeChallengeIdx];
  const identifyPending =
    activeChallenge?.type === 'identify' && results[activeChallenge.id] === undefined;

  // ── AI tutoring ────────────────────────────────────────────────
  // Previously orphaned: the catalog held a full tutoring block but the
  // component never called useLuminaAI. aiPrimitiveData mirrors the catalog
  // contextKeys (family, evalMode, parameters, current prompt/type, a moment
  // snapshot). It carries NO correct answer — the workbench answers live in the
  // challenge objects, which we never put in primitive_data, so the silent
  // context update can't leak them.
  const stableInstanceIdRef = useRef(data.instanceId || `distribution-explorer-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;

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

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'distribution-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeLevel,
  });

  // Introduce the workbench once the tutor connects (one end_of_turn message
  // carrying the first challenge's prompt so the tutor reads a real task).
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || data.challenges.length === 0) return;
    hasIntroducedRef.current = true;
    const first = data.challenges[0];
    sendText(
      `[ACTIVITY_START] Distribution-explorer session — ${data.evalMode.replace(/_/g, ' ')} mode on the ${family} family, ${data.challenges.length} challenge(s). `
      + `Introduce the workbench briefly (sliders change parameters; the chart, moments, and CDF update live), then read the first challenge: "${first.prompt}".`,
      { silent: true },
    );
  }, [isConnected, data.challenges, data.evalMode, family, sendText]);

  const handleFamilyChange = useCallback(
    (next: DistributionFamily) => {
      setFamily(next);
      // Reset params to the new family's defaults — old names won't transfer cleanly.
      setParams(resolveParameters(next, undefined));
    },
    [],
  );

  const handleParamChange = useCallback((name: string, value: number) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleCommit = useCallback((challengeId: string, correct: boolean) => {
    setResults((prev) => ({ ...prev, [challengeId]: correct }));
    const ch = data.challenges.find((c) => c.id === challengeId);
    if (!ch) return;
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
  }, [data.challenges, sendText]);

  // Send exactly one end_of_turn message per advance, carrying the NEXT
  // challenge's data (or the session summary), so the tutor introduces a real
  // problem instead of racing ahead of the silent context update.
  const handleAdvance = useCallback(() => {
    const nextIdx = activeChallengeIdx + 1;
    const next = data.challenges[nextIdx];
    if (next) {
      sendText(
        `[NEXT_CHALLENGE] Challenge ${nextIdx + 1} of ${data.challenges.length} (${next.type}): "${next.prompt}". `
        + `Introduce it briefly — what should the student focus on?`,
        { silent: true },
      );
    } else {
      sendText(
        `[ALL_COMPLETE] The student finished all ${data.challenges.length} distribution challenges. `
        + `Give a brief, encouraging summary tied to the ${family} family.`,
        { silent: true },
      );
    }
    setActiveChallengeIdx((i) => Math.min(i + 1, data.challenges.length));
  }, [activeChallengeIdx, data.challenges, family, sendText]);

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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left rail — family + params + moments */}
        <div className="lg:col-span-4 space-y-4">
          <FamilySelector active={family} onChange={handleFamilyChange} disabled={identifyPending} />
          <ParameterPanel familyDef={familyDef} values={params} onChange={handleParamChange} />
          <MomentReadout moments={evaluated.moments} />
        </div>

        {/* Right pane — chart + formula + view toggle + challenge */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {familyDef.label} {view === 'pdf'
                  ? (familyDef.kind === 'discrete' ? 'PMF' : 'PDF')
                  : 'CDF'}
              </p>
              <div className="flex gap-1">
                {(['pdf', 'cdf'] as const).map((v) => (
                  <Button
                    key={v}
                    variant="ghost"
                    size="sm"
                    onClick={() => setView(v)}
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
            <DistributionPlot evaluated={evaluated} view={view} />
            <div className="text-center">
              <KaTeX latex={familyDef.formula} />
            </div>
            <p className="text-xs text-slate-500 text-center italic">{familyDef.description}</p>
          </Card>

          <ChallengeStrip
            challenges={data.challenges}
            activeIndex={activeChallengeIdx}
            results={results}
            onCommit={handleCommit}
            onAdvance={handleAdvance}
          />
        </div>
      </div>
    </div>
  );
};

export default DistributionExplorer;
