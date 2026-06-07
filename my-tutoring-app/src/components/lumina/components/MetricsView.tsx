'use client';

/**
 * MetricsView — renders a primitive's captured `metrics` blob as structured
 * cards instead of raw JSON.
 *
 * A generic field renderer handles every primitive out of the box: it surfaces
 * the cross-cutting signals (challenge counts, attempts, hints, aiAssistance,
 * per-challenge scores) with nice labels, and auto-renders anything else. The
 * PRIMITIVE_METRIC_VIEWS registry is the extension point for bespoke per-primitive
 * layouts — add an entry when a primitive deserves a tailored view; until then it
 * falls back to the generic renderer. A "raw" toggle always exposes the JSON.
 *
 * This is the bridge toward visual replay: it documents each primitive's metrics
 * shape and normalizes the universal signals worth surfacing / awarding on.
 */

import React, { useState } from 'react';
import { LuminaInlineStat, LuminaBadge, type LuminaAccent } from '../ui';

type MetricsRecord = Record<string, unknown>;

// Rendered specially (or intentionally hidden), not in the generic scalar grid.
const SPECIAL_KEYS = new Set(['type', 'evalMode', 'aiAssistance', 'scoresPerChallenge']);

// Cross-cutting fields we recognise across multi-phase primitives — nicer labels
// + accents than the auto-humanized fallback.
const KNOWN: Record<string, { label: string; accent?: LuminaAccent; percent?: boolean }> = {
  challengeType: { label: 'Challenge', accent: 'purple' },
  totalChallenges: { label: 'Challenges', accent: 'cyan' },
  correctCount: { label: 'Correct', accent: 'emerald' },
  firstTryCount: { label: 'First-try', accent: 'emerald' },
  attemptsCount: { label: 'Attempts', accent: 'amber' },
  averageAttemptsPerChallenge: { label: 'Avg tries', accent: 'amber' },
  overallAccuracy: { label: 'Accuracy', accent: 'emerald', percent: true },
  hintsViewed: { label: 'Hints', accent: 'rose' },
};

const LABEL_CLASS = 'text-xs uppercase tracking-wider text-slate-400 font-semibold';
const PRE_CLASS =
  'text-xs text-slate-300 bg-black/30 border border-white/10 rounded-lg p-3 overflow-auto max-h-72';

function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function scoreAccent(score: number): LuminaAccent {
  if (score >= 80) return 'emerald';
  if (score >= 50) return 'amber';
  return 'rose';
}

function isScalar(v: unknown): v is number | string | boolean {
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean';
}

function ScalarStat({ field, value }: { field: string; value: number | string | boolean }) {
  const known = KNOWN[field];
  const label = known?.label ?? humanize(field);
  if (typeof value === 'boolean') {
    return (
      <LuminaInlineStat
        label={label}
        accent={value ? 'emerald' : undefined}
        value={<LuminaBadge accent={value ? 'emerald' : 'rose'}>{value ? 'yes' : 'no'}</LuminaBadge>}
      />
    );
  }
  if (typeof value === 'number') {
    return (
      <LuminaInlineStat
        label={label}
        value={fmtNumber(value)}
        suffix={known?.percent ? '%' : undefined}
        accent={known?.accent}
      />
    );
  }
  return <LuminaInlineStat label={label} value={String(value)} accent={known?.accent} />;
}

function AiAssistance({ ai }: { ai: Record<string, unknown> }) {
  const hints = (ai.hintsUsed ?? {}) as Record<string, number>;
  const time = ai.timeWithAI;
  const timeSec = typeof time === 'number' ? (time / 1000).toFixed(1) : null;
  const turns = typeof ai.conversationTurns === 'number' ? ai.conversationTurns : null;
  const voice = typeof ai.voiceInteractions === 'number' ? ai.voiceInteractions : null;
  return (
    <div>
      <p className={LABEL_CLASS}>AI Assistance</p>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
        <LuminaInlineStat
          label="Enabled"
          value={<LuminaBadge accent={ai.enabled ? 'emerald' : 'rose'}>{ai.enabled ? 'yes' : 'no'}</LuminaBadge>}
        />
        <LuminaInlineStat
          label="Hints L1/L2/L3"
          value={`${hints.level1 ?? 0}/${hints.level2 ?? 0}/${hints.level3 ?? 0}`}
          accent="rose"
        />
        {turns != null && <LuminaInlineStat label="Turns" value={turns} />}
        {voice != null && <LuminaInlineStat label="Voice" value={voice} />}
        {timeSec != null && <LuminaInlineStat label="Time w/ AI" value={timeSec} suffix="sec" accent="amber" />}
      </div>
    </div>
  );
}

function ScoresPerChallenge({ scores }: { scores: number[] }) {
  return (
    <div>
      <p className={LABEL_CLASS}>Scores per challenge</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {scores.map((s, i) => (
          <LuminaBadge key={i} accent={scoreAccent(s)}>
            {fmtNumber(s)}
          </LuminaBadge>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Challenge breakdown — the "5 challenges, 6 attempts = 4 one-shot + 1 two-shot"
// narrative. The top-level `attempts` count is meaningless without the per-
// challenge split; that split lives in the per-challenge results array (usually
// in studentWork), so we locate it and derive the distribution.
// -----------------------------------------------------------------------------

interface ChallengeResult {
  challengeId?: string;
  attempts: number;
  correct?: boolean;
  score?: number;
}

/** An array of per-challenge results = objects that each carry a numeric `attempts`. */
function isChallengeResultArray(v: unknown): v is ChallengeResult[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((e) => e != null && typeof e === 'object' && typeof (e as ChallengeResult).attempts === 'number')
  );
}

/** Find the per-challenge results array within the given sources (shallow scan). */
function findChallengeResults(...sources: unknown[]): ChallengeResult[] | null {
  for (const src of sources) {
    if (isChallengeResultArray(src)) return src;
    if (src != null && typeof src === 'object' && !Array.isArray(src)) {
      for (const val of Object.values(src as Record<string, unknown>)) {
        if (isChallengeResultArray(val)) return val;
      }
    }
  }
  return null;
}

function ChallengeBreakdown({ results }: { results: ChallengeResult[] }) {
  const total = results.length;
  const totalAttempts = results.reduce((s, r) => s + (r.attempts || 0), 0);
  const firstTry = results.filter((r) => r.attempts === 1 && r.correct !== false).length;
  const unsolved = results.filter((r) => r.correct === false).length;

  // Distribution of attempts among solved challenges: "4 one-shot · 1 in 2 tries".
  const dist = new Map<number, number>();
  results.forEach((r) => {
    if (r.correct !== false) dist.set(r.attempts, (dist.get(r.attempts) ?? 0) + 1);
  });
  const parts = Array.from(dist.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([att, count]) => `${count} ${att === 1 ? 'one-shot' : `in ${att} tries`}`);
  if (unsolved > 0) parts.push(`${unsolved} unsolved`);

  const chipAccent = (r: ChallengeResult): LuminaAccent => {
    if (r.correct === false) return 'rose';
    if (r.attempts <= 1) return 'emerald';
    if (r.attempts === 2) return 'amber';
    return 'orange';
  };

  return (
    <div>
      <p className={LABEL_CLASS}>Challenge breakdown</p>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
        <LuminaInlineStat label="Challenges" value={total} accent="cyan" />
        <LuminaInlineStat label="Total attempts" value={totalAttempts} accent="amber" />
        <LuminaInlineStat label="First-try" value={`${firstTry}/${total}`} accent="emerald" />
        {unsolved > 0 && <LuminaInlineStat label="Unsolved" value={unsolved} accent="rose" />}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {results.map((r, i) => (
          <LuminaBadge key={i} accent={chipAccent(r)} title={r.challengeId}>
            {(r.challengeId ?? `#${i + 1}`)}: {r.attempts} {r.attempts === 1 ? 'try' : 'tries'}
            {r.correct === false ? ' ✗' : ''}
          </LuminaBadge>
        ))}
      </div>
      {parts.length > 0 && <p className="mt-2 text-xs text-slate-400">{parts.join(' · ')}</p>}
    </div>
  );
}

/**
 * Bespoke per-primitive metric layouts. Extend when a primitive's metrics
 * deserve a tailored view; everything else uses the generic renderer below.
 */
const PRIMITIVE_METRIC_VIEWS: Record<string, React.FC<{ metrics: MetricsRecord }>> = {};

export interface MetricsViewProps {
  primitiveType: string;
  metrics: MetricsRecord | null;
  /** The attempt's student work — searched for the per-challenge results array. */
  studentWork?: unknown;
}

export function MetricsView({ primitiveType, metrics, studentWork }: MetricsViewProps) {
  const [raw, setRaw] = useState(false);

  if (!metrics || Object.keys(metrics).length === 0) {
    return (
      <div>
        <p className={LABEL_CLASS}>Metrics</p>
        <p className="mt-1 text-slate-500 text-sm">
          No metrics captured — legacy attempt or non-primitive submission.
        </p>
      </div>
    );
  }

  const Custom = PRIMITIVE_METRIC_VIEWS[primitiveType];
  const entries = Object.entries(metrics).filter(([k]) => !SPECIAL_KEYS.has(k));
  const scalars = entries.filter(([, v]) => isScalar(v)) as Array<[string, number | string | boolean]>;
  const complex = entries.filter(([, v]) => !isScalar(v));
  const ai = metrics.aiAssistance;
  const scores = Array.isArray(metrics.scoresPerChallenge)
    ? (metrics.scoresPerChallenge as unknown[]).filter((s): s is number => typeof s === 'number')
    : null;

  const evalMode = typeof metrics.evalMode === 'string' ? metrics.evalMode : null;
  const challengeResults = findChallengeResults(studentWork, metrics);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={LABEL_CLASS}>Metrics{evalMode ? ` · ${evalMode}` : ''}</p>
        <button
          onClick={() => setRaw((r) => !r)}
          className="text-[11px] text-slate-400 hover:text-slate-200 underline"
        >
          {raw ? 'structured' : 'raw'}
        </button>
      </div>

      {raw ? (
        <pre className={PRE_CLASS}>{JSON.stringify(metrics, null, 2)}</pre>
      ) : Custom ? (
        <Custom metrics={metrics} />
      ) : (
        <div className="space-y-4">
          {challengeResults && <ChallengeBreakdown results={challengeResults} />}
          {scalars.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {scalars.map(([k, v]) => (
                <ScalarStat key={k} field={k} value={v} />
              ))}
            </div>
          )}
          {ai != null && typeof ai === 'object' && <AiAssistance ai={ai as Record<string, unknown>} />}
          {scores && scores.length > 0 && <ScoresPerChallenge scores={scores} />}
          {complex.length > 0 && (
            <div className="space-y-2">
              {complex.map(([k, v]) => (
                <details key={k}>
                  <summary className="cursor-pointer text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    {humanize(k)}{' '}
                    <span className="text-slate-600 normal-case tracking-normal">
                      ({Array.isArray(v) ? `${v.length} items` : 'object'})
                    </span>
                  </summary>
                  <pre className={`mt-1 ${PRE_CLASS}`}>{JSON.stringify(v, null, 2)}</pre>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MetricsView;
