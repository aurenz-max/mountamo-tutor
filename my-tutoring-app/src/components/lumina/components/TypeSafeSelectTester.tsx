'use client';

/**
 * TypeSafeSelectTester — dev panel POC for TypeSafe-driven primitive selection.
 *
 * Type a topic (and optionally the lesson objectives), pick a grade, run. The
 * panel calls POST /api/lumina/typesafe-select, which ranks the live catalog
 * with TypeSafe's System One model and verifies a shortlist: fit score, phase
 * role, eval-mode pick. Two HTTP calls, typically ~1-2 s end to end.
 *
 * This is a measurement surface, not a lesson launch: TypeSafe cannot author a
 * manifest's prose, so what you see here is the selection half only. Compare
 * its picks against the current curator with
 *   node scripts/typesafe-manifest-probe.mjs --topic "…" --grade N --compare
 */
import React, { useCallback, useState } from 'react';
import { LuminaButton, LuminaInput, LuminaPanel, LuminaSectionLabel, LuminaTable } from '../ui';
import type {
  PhaseRole,
  RoleFilter,
  SelectPrimitivesResult,
} from '../service/manifest/typesafe/selectPrimitives';

interface Props {
  onBack: () => void;
}

const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const ROLE_LABEL: Record<PhaseRole, string> = {
  introduce: 'Introduce',
  visualize: 'Visualize',
  apply: 'Apply',
  assess: 'Assess',
};

const pct = (p: number) => `${Math.round(p * 100)}%`;
const fixed = (n: number, d = 2) => n.toFixed(d);

function fitTone(fit: number): string {
  if (fit >= 2.5) return 'text-emerald-300';
  if (fit >= 1.75) return 'text-cyan-200';
  if (fit >= 1) return 'text-amber-300';
  return 'text-slate-500';
}

export default function TypeSafeSelectTester({ onBack }: Props) {
  const [topic, setTopic] = useState('Comparing fractions with unlike denominators');
  const [grade, setGrade] = useState('4');
  const [objectivesText, setObjectivesText] = useState('');
  const [k, setK] = useState(8);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SelectPrimitivesResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const run = useCallback(async () => {
    const t = topic.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    const objectives = objectivesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch('/api/lumina/typesafe-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, grade, objectives, k, roleFilter }),
      });
      const json = (await res.json()) as SelectPrimitivesResult | { error: string };
      if (!res.ok || 'error' in json) {
        setError('error' in json ? json.error : `HTTP ${res.status}`);
        setResult(null);
      } else {
        setResult(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [topic, grade, objectivesText, k, roleFilter]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 text-slate-100">
      <div className="mb-6 flex items-start gap-4">
        <button
          onClick={onBack}
          className="rounded-full border border-white/10 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/60"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">TypeSafe Select</h1>
          <p className="text-xs text-slate-400">
            Rank the live catalog for a topic with TypeSafe&apos;s System One model, then verify a shortlist:
            fit, phase role, eval mode. Selection only — no prose is generated.
          </p>
        </div>
      </div>

      <LuminaPanel className="mb-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto]">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Topic
            <LuminaInput
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void run();
              }}
              placeholder="e.g. Adding two-digit numbers with regrouping"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Grade
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 focus:border-cyan-400/40 focus:outline-none"
            >
              {GRADES.map((g) => (
                <option key={g} value={g} className="bg-slate-900">
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Role options
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-slate-100 focus:border-cyan-400/40 focus:outline-none"
              title="none: every primitive is an option for every phase role. affordances: a role only sees primitives whose catalog affordances declare that role (untagged stay in)."
            >
              <option value="none" className="bg-slate-900">whole catalog</option>
              <option value="affordances" className="bg-slate-900">filter by affordance role</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Shortlist k
            <LuminaInput
              type="number"
              min={1}
              max={20}
              value={k}
              onChange={(e) => setK(Math.max(1, Math.min(20, Number(e.target.value) || 8)))}
              className="w-24"
            />
          </label>
        </div>
        <label className="mt-4 flex flex-col gap-1 text-xs text-slate-400">
          Learning objectives (optional, one per line — the production pipeline always has these)
          <textarea
            value={objectivesText}
            onChange={(e) => setObjectivesText(e.target.value)}
            rows={3}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none"
            placeholder={'Explain why fractions need a common denominator to compare\nCompare two fractions using a visual model'}
          />
        </label>
        <div className="mt-4 flex items-center gap-3">
          <LuminaButton tone="primary" onClick={() => void run()} disabled={loading || !topic.trim()}>
            {loading ? 'Asking TypeSafe…' : 'Run selection'}
          </LuminaButton>
          {result && (
            <span className="text-xs text-slate-500">
              {result.model} · {result.catalogSize} primitives · skim {result.skim.ms} ms · verify {result.verify.ms} ms ·{' '}
              {result.skim.usage.input_tokens + result.verify.usage.input_tokens} in /{' '}
              {result.skim.usage.output_tokens + result.verify.usage.output_tokens} out tokens
            </span>
          )}
        </div>
      </LuminaPanel>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      )}

      {result && (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
              subject <span className="font-semibold text-cyan-200">{result.subject.choice}</span> ({pct(result.subject.confidence)} conf)
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
              informational <span className="font-semibold text-cyan-200">{pct(result.informational)}</span>
              <span className="text-slate-500"> · high → deep-dive territory</span>
            </span>
            {result.objectives && (
              <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
                {result.objectives.length} objective{result.objectives.length === 1 ? '' : 's'} in state
              </span>
            )}
          </div>

          <section>
            <LuminaSectionLabel className="mb-3">Block skeleton — best primitive per phase role</LuminaSectionLabel>
            <div className="grid gap-3 md:grid-cols-4">
              {result.roles.map((r) => (
                <LuminaPanel key={r.role} accent="cyan">
                  <div className="flex justify-between text-[10px] uppercase tracking-wide text-slate-500">
                    <span>{ROLE_LABEL[r.role]}</span>
                    <span>{result.roleOptionCounts[r.role]} options</span>
                  </div>
                  <div className="mt-1 font-mono text-sm text-cyan-200">{r.id}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    p {pct(r.p)} · conf {pct(r.confidence)}
                  </div>
                  <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                    {r.runnersUp.map((u) => (
                      <div key={u.id} className="flex justify-between gap-2">
                        <span className="truncate font-mono">{u.id}</span>
                        <span>{pct(u.p)}</span>
                      </div>
                    ))}
                  </div>
                </LuminaPanel>
              ))}
            </div>
          </section>

          <section>
            <LuminaSectionLabel className="mb-3">Verified shortlist — full description, constraints, affordances</LuminaSectionLabel>
            <LuminaTable
              columns={['fit 0-3', 'primitive', 'skim rank', 'skim p', 'role', 'eval mode', 'mode conf']}
              rows={result.shortlist.map((s) => [
                <span key="fit" className={`font-semibold ${fitTone(s.fit)}`}>
                  {fixed(s.fit)}
                </span>,
                <span key="id" className="font-mono text-cyan-200">
                  {s.id}
                </span>,
                s.skimRank ?? <span className="text-slate-500">via role</span>,
                fixed(s.skimP, 3),
                ROLE_LABEL[s.role],
                s.mode ? (
                  <span key="mode">
                    <span className="font-mono">{s.mode}</span>
                    <span className="text-slate-500"> of {s.modeCandidates}</span>
                  </span>
                ) : (
                  <span className="text-slate-500">{s.modeCandidates <= 1 ? 'single-mode' : '—'}</span>
                ),
                s.modeConfidence == null ? '—' : pct(s.modeConfidence),
              ])}
            />
          </section>

          <section>
            <LuminaSectionLabel className="mb-3">Overall skim ranking — top {result.overall.length}</LuminaSectionLabel>
            <div className="flex flex-wrap gap-2">
              {result.overall.map((r) => (
                <span
                  key={r.id}
                  className={`rounded-full border px-3 py-1 font-mono text-[11px] ${
                    r.p >= 0.05 ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-white/10 text-slate-400'
                  }`}
                >
                  {r.rank}. {r.id} <span className="text-slate-500">{fixed(r.p, 3)}</span>
                </span>
              ))}
            </div>
          </section>

          <section>
            <button onClick={() => setShowRaw((v) => !v)} className="text-xs text-slate-400 underline-offset-2 hover:underline">
              {showRaw ? 'Hide' : 'Show'} raw response
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-96 overflow-auto rounded-xl border border-white/10 bg-slate-950/60 p-4 text-[11px] text-slate-300">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
