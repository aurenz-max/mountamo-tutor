'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { LuminaBadge } from '../ui';
import { KaTeX } from './annotated-example/StepContentRenderer';
import { getFamily, resolveParameters } from '../lib/probability';
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
  }, []);

  const handleAdvance = useCallback(() => {
    setActiveChallengeIdx((i) => Math.min(i + 1, data.challenges.length));
  }, [data.challenges.length]);

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
