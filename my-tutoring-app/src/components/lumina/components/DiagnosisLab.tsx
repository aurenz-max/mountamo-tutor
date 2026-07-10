'use client';

/**
 * Diagnosis Lab — the mock-first bench for the Misconception Loop (PRD Phase 0).
 *
 * Feeds the golden evidence set (evaluation/diagnosis/scenarios.ts) through the
 * live distiller (real Gemini flash, via the `/api/lumina` `distillMisconception`
 * action) and shows evidence vs. verdict side by side. This is where we tune the
 * distiller's honesty BEFORE any backend exists.
 *
 * What the bench auto-checks: the ABSTAIN-vs-GENERATIVE axis against each
 * scenario's `expectation`, plus lightweight leak/vagueness lint. What it does
 * NOT auto-grade: whether a generative verdict is truly student-model /
 * predictive — that is a human review here, and Probe D's LLM judge later.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { LuminaButton, LuminaBadge } from '../ui';
import {
  DIAGNOSIS_SCENARIOS,
  type DiagnosisScenario,
} from '../evaluation/diagnosis/scenarios';
import {
  classifyEvidenceTier,
  type MisconceptionResult,
} from '../evaluation/diagnosis/types';

interface RunState {
  loading: boolean;
  result?: MisconceptionResult;
  error?: string;
  ms?: number;
}

// Banned in student-model text — these mean the distiller restated the score
// instead of naming a mental model. (PRD §6; artifact "Vague — reject".)
const BANNED = /needs?\s+(more\s+)?practice|more\s+practice|struggles?\s+with|is\s+confused\b/i;

function sentenceCount(text: string): number {
  const parts = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return parts.length;
}

/** Lightweight, advisory lint on a generative verdict. Not the real judge. */
function lintDiagnosis(text: string): string[] {
  const flags: string[] = [];
  if (BANNED.test(text)) flags.push('banned phrase (restates score)');
  if (sentenceCount(text) > 1) flags.push('more than one sentence');
  if (/\b\d+\b/.test(text)) flags.push('contains a number (possible answer leak)');
  return flags;
}

const EvidenceBlock: React.FC<{ scenario: DiagnosisScenario }> = ({ scenario }) => {
  const { evidence } = scenario;
  const tier = classifyEvidenceTier(evidence);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <LuminaBadge accent="cyan">{scenario.subject}</LuminaBadge>
        <LuminaBadge accent="indigo">{scenario.evalMode}</LuminaBadge>
        <LuminaBadge accent={tier === 'judge' ? 'purple' : tier === 'structured' ? 'blue' : 'rose'}>
          tier: {tier === 'judge' ? 'A · judge' : tier === 'structured' ? 'B · structured' : 'C · none'}
        </LuminaBadge>
        <span className="text-slate-500 text-xs font-mono">score {scenario.score}</span>
      </div>
      <p className="text-slate-200">
        <span className="text-slate-500">asked: </span>
        {evidence.challengeSummary}
      </p>
      {evidence.expected && (
        <p className="text-slate-400">
          <span className="text-slate-600">expected: </span>
          {evidence.expected}
        </p>
      )}
      {evidence.observed && (
        <p className="text-rose-300/90">
          <span className="text-slate-600">observed: </span>
          {evidence.observed}
        </p>
      )}
      {evidence.priorAttempts && evidence.priorAttempts.length > 0 && (
        <div className="text-slate-400 text-xs pl-3 border-l border-white/10">
          <span className="text-slate-600">prior attempts:</span>
          {evidence.priorAttempts.map((a, i) => (
            <div key={i}>
              · {a.challenge} → <span className="text-rose-300/80">{a.observed}</span>
            </div>
          ))}
        </div>
      )}
      {evidence.judgeFeedback && (
        <p className="text-purple-200/80 text-xs italic bg-purple-500/5 border border-purple-400/15 rounded-md p-2">
          judge: {evidence.judgeFeedback}
        </p>
      )}
    </div>
  );
};

const VerdictBlock: React.FC<{ scenario: DiagnosisScenario; state?: RunState }> = ({
  scenario,
  state,
}) => {
  if (!state) {
    return <p className="text-slate-600 text-sm italic">Not run yet.</p>;
  }
  if (state.loading) {
    return <p className="text-cyan-300/80 text-sm animate-pulse">Distilling…</p>;
  }
  if (state.error) {
    return <p className="text-rose-400 text-sm">Error: {state.error}</p>;
  }
  const result = state.result!;
  const category: 'abstain' | 'generative' = result.abstain ? 'abstain' : 'generative';
  const matched = category === scenario.expectation;
  const lint = !result.abstain ? lintDiagnosis(result.misconceptionText) : [];

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <LuminaBadge accent={category === 'generative' ? 'emerald' : 'amber'}>
          {category === 'generative' ? 'GENERATIVE' : 'ABSTAIN'}
        </LuminaBadge>
        <LuminaBadge accent={matched ? 'emerald' : 'rose'}>
          {matched ? '✓ matches expectation' : `✗ expected ${scenario.expectation}`}
        </LuminaBadge>
        {!result.abstain && (
          <span className="text-slate-500 text-xs font-mono">conf {result.confidence}</span>
        )}
        {typeof state.ms === 'number' && (
          <span className="text-slate-600 text-xs font-mono">{state.ms}ms</span>
        )}
      </div>

      {result.abstain ? (
        <p className="text-amber-200/90 italic">{result.reason}</p>
      ) : (
        <p className="text-emerald-100 leading-snug">
          &ldquo;{result.misconceptionText}&rdquo;
        </p>
      )}

      {lint.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lint.map((f) => (
            <span
              key={f}
              className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-400/30 text-rose-300"
            >
              ⚠ {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const DiagnosisLab: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [busy, setBusy] = useState(false);

  const runOne = useCallback(async (s: DiagnosisScenario) => {
    setRuns((prev) => ({ ...prev, [s.id]: { loading: true } }));
    const started = Date.now();
    try {
      const res = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'distillMisconception',
          params: {
            evidence: s.evidence,
            score: s.score,
            success: s.success,
            subskillId: s.subskillId,
            evalMode: s.evalMode,
            gradeLevel: s.gradeLevel,
          },
        }),
      });
      const data = (await res.json()) as MisconceptionResult & { error?: string };
      if (!res.ok || (data as { error?: string }).error) {
        throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
      }
      setRuns((prev) => ({
        ...prev,
        [s.id]: { loading: false, result: data, ms: Date.now() - started },
      }));
    } catch (err) {
      setRuns((prev) => ({
        ...prev,
        [s.id]: { loading: false, error: err instanceof Error ? err.message : 'Unknown error' },
      }));
    }
  }, []);

  const runAll = useCallback(async () => {
    setBusy(true);
    // Sequential — keeps flash latency readable and avoids a burst of calls.
    for (const s of DIAGNOSIS_SCENARIOS) {
      await runOne(s);
    }
    setBusy(false);
  }, [runOne]);

  const summary = useMemo(() => {
    let done = 0;
    let matched = 0;
    for (const s of DIAGNOSIS_SCENARIOS) {
      const r = runs[s.id];
      if (!r || r.loading || !r.result) continue;
      done += 1;
      const category = r.result.abstain ? 'abstain' : 'generative';
      if (category === s.expectation) matched += 1;
    }
    return { done, matched, total: DIAGNOSIS_SCENARIOS.length };
  }, [runs]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={onBack}
            className="text-slate-500 hover:text-slate-300 text-sm mb-2 inline-flex items-center gap-1.5"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
            🩺 Diagnosis Lab
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            The golden evidence set through the live misconception distiller. Tune honesty here
            before the loop touches a backend. <span className="text-amber-300">Abstain is success.</span>
          </p>
        </div>
        <div className="text-right">
          <LuminaButton tone="primary" onClick={runAll} disabled={busy}>
            {busy ? 'Running…' : 'Run all'}
          </LuminaButton>
          {summary.done > 0 && (
            <p className="text-xs text-slate-400 mt-2 font-mono">
              expectation match:{' '}
              <span className={summary.matched === summary.done ? 'text-emerald-300' : 'text-amber-300'}>
                {summary.matched}/{summary.done}
              </span>{' '}
              <span className="text-slate-600">of {summary.total}</span>
            </p>
          )}
        </div>
      </div>

      {/* Scenario cards */}
      <div className="space-y-4">
        {DIAGNOSIS_SCENARIOS.map((s) => {
          const state = runs[s.id];
          return (
            <div
              key={s.id}
              className="bg-slate-900/40 border border-white/10 backdrop-blur-xl rounded-xl overflow-hidden"
            >
              <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2 min-w-0">
                  <LuminaBadge accent={s.expectation === 'generative' ? 'emerald' : 'amber'}>
                    expect {s.expectation}
                  </LuminaBadge>
                  <span className="text-slate-200 text-sm font-medium truncate">{s.label}</span>
                </div>
                <LuminaButton
                  tone="subtle"
                  size="sm"
                  onClick={() => runOne(s)}
                  disabled={state?.loading || busy}
                >
                  {state?.loading ? '…' : 'Run'}
                </LuminaButton>
              </div>

              <div className="grid md:grid-cols-2 gap-4 p-4">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">
                    Evidence (what the primitive supplies)
                  </div>
                  <EvidenceBlock scenario={s} />
                </div>
                <div className="md:border-l md:border-white/5 md:pl-4">
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">
                    Distiller verdict
                  </div>
                  <VerdictBlock scenario={s} state={state} />
                  <p className="text-slate-600 text-xs mt-3 pt-3 border-t border-white/5">
                    <span className="text-slate-500">why this case: </span>
                    {s.note}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DiagnosisLab;
