'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type {
  KnowledgeProfileResponse,
  SubjectSummary,
  StoredDiagnosticProfile,
} from './types';
import { DIAGNOSTIC_PROFILE_STORAGE_KEY } from './types';

// ---------------------------------------------------------------------------
// Shared subject display data (mirrors DiagnosticProfileCard)
// ---------------------------------------------------------------------------

const SUBJECT_EMOJI: Record<string, string> = {
  mathematics: '\u{1F522}',
  math: '\u{1F522}',
  science: '\u{1F52C}',
  'language-arts': '\u{1F4DD}',
  'language arts': '\u{1F4DD}',
  reading: '\u{1F4D6}',
  writing: '\u{270F}\u{FE0F}',
  'social-studies': '\u{1F30D}',
  'social studies': '\u{1F30D}',
};

const SUBJECT_COLORS: Record<string, { card: string; bar: string }> = {
  mathematics: {
    card: 'from-cyan-500/30 to-blue-500/30 border-cyan-500/20',
    bar: 'from-cyan-400 to-blue-400',
  },
  math: {
    card: 'from-cyan-500/30 to-blue-500/30 border-cyan-500/20',
    bar: 'from-cyan-400 to-blue-400',
  },
  science: {
    card: 'from-green-500/30 to-emerald-500/30 border-green-500/20',
    bar: 'from-green-400 to-emerald-400',
  },
  'language-arts': {
    card: 'from-purple-500/30 to-violet-500/30 border-purple-500/20',
    bar: 'from-purple-400 to-violet-400',
  },
  'language arts': {
    card: 'from-purple-500/30 to-violet-500/30 border-purple-500/20',
    bar: 'from-purple-400 to-violet-400',
  },
  reading: {
    card: 'from-rose-500/30 to-pink-500/30 border-rose-500/20',
    bar: 'from-rose-400 to-pink-400',
  },
  writing: {
    card: 'from-violet-500/30 to-indigo-500/30 border-violet-500/20',
    bar: 'from-violet-400 to-indigo-400',
  },
  'social-studies': {
    card: 'from-amber-500/30 to-yellow-500/30 border-amber-500/20',
    bar: 'from-amber-400 to-yellow-400',
  },
  'social studies': {
    card: 'from-amber-500/30 to-yellow-500/30 border-amber-500/20',
    bar: 'from-amber-400 to-yellow-400',
  },
};

function formatSubjectName(key: string): string {
  return key
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KnowledgeMapPanelProps {
  onBack: () => void;
  onNavigateDiagnostic: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const KnowledgeMapPanel: React.FC<KnowledgeMapPanelProps> = ({
  onBack,
  onNavigateDiagnostic,
}) => {
  const [stored, setStored] = useState<StoredDiagnosticProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DIAGNOSTIC_PROFILE_STORAGE_KEY);
      if (raw) {
        setStored(JSON.parse(raw) as StoredDiagnosticProfile);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-between max-w-5xl mx-auto px-4">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            &larr; Back
          </button>
          <h1 className="text-lg font-semibold text-white">Learning Map</h1>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-12">
        {!stored ? (
          <EmptyState onNavigateDiagnostic={onNavigateDiagnostic} />
        ) : (
          <ProfileView
            profile={stored.profile}
            completedAt={stored.completedAt}
            onNavigateDiagnostic={onNavigateDiagnostic}
          />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Empty State — no diagnostic completed yet
// ---------------------------------------------------------------------------

function EmptyState({
  onNavigateDiagnostic,
}: {
  onNavigateDiagnostic: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      <Card className="backdrop-blur-xl bg-gradient-to-br from-slate-900/60 to-slate-800/40 border-white/10 max-w-lg w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-slate-800/60 rounded-2xl flex items-center justify-center">
            <span className="text-4xl">{'\u{1F5FA}\u{FE0F}'}</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">
              No learning map yet
            </h2>
            <p className="text-slate-400 leading-relaxed">
              Complete a Skills Explorer session to see your knowledge profile
              here. We&apos;ll map out what you already know and what&apos;s
              ready to learn next!
            </p>
          </div>
          <Button
            onClick={onNavigateDiagnostic}
            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white px-8 py-3 text-base rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-400/30"
          >
            Start Skills Explorer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile View — shows the knowledge map
// ---------------------------------------------------------------------------

function ProfileView({
  profile,
  completedAt,
  onNavigateDiagnostic,
}: {
  profile: KnowledgeProfileResponse;
  completedAt: string;
  onNavigateDiagnostic: () => void;
}) {
  const subjects = Object.entries(profile.by_subject);
  const totalMastered = subjects.reduce((sum, [, s]) => sum + s.mastered, 0);
  const totalFrontier = profile.frontier_skills.length;
  const totalSkills = subjects.reduce(
    (sum, [, s]) => sum + s.total_skills,
    0,
  );

  return (
    <div className="space-y-8">
      {/* Summary header */}
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold text-white">
          Your Learning Map
        </h2>
        <p className="text-slate-400">
          <span className="text-emerald-400 font-semibold">{totalMastered}</span>{' '}
          skills mastered
          {totalFrontier > 0 && (
            <>
              {' '}&middot;{' '}
              <span className="text-blue-400 font-semibold">{totalFrontier}</span>{' '}
              ready to learn
            </>
          )}
          {' '}&middot;{' '}
          <span className="text-slate-500">{totalSkills} total</span>
        </p>
      </div>

      {/* Overall progress bar */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-300 font-medium">Overall Progress</span>
            <span className="text-slate-400">
              {Math.round(profile.coverage_pct)}% assessed
            </span>
          </div>
          <StackedProgressBar
            mastered={totalMastered}
            frontier={totalFrontier}
            total={totalSkills}
          />
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
              <span className="text-slate-400">Already knows</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
              <span className="text-slate-400">Ready to learn</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-600" />
              <span className="text-slate-400">Coming later</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Per-subject cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {subjects.map(([key, summary]) => (
          <SubjectMapCard key={key} subjectKey={key} summary={summary} />
        ))}
      </div>

      {/* Footer stats + actions */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-slate-400 space-y-1">
              <p>
                Directly tested:{' '}
                <span className="text-white font-medium">
                  {profile.total_probed}
                </span>{' '}
                &middot; Inferred:{' '}
                <span className="text-white font-medium">
                  {profile.total_inferred}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                Assessed on {formatDate(completedAt)}
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={onNavigateDiagnostic}
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            >
              Run Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stacked Progress Bar
// ---------------------------------------------------------------------------

function StackedProgressBar({
  mastered,
  frontier,
  total,
}: {
  mastered: number;
  frontier: number;
  total: number;
}) {
  if (total === 0) return null;
  const masteredPct = (mastered / total) * 100;
  const frontierPct = (frontier / total) * 100;
  // remaining is implicit (fills the bar background)

  return (
    <div className="h-3 rounded-full bg-slate-700/50 overflow-hidden flex">
      {masteredPct > 0 && (
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
          style={{ width: `${masteredPct}%` }}
        />
      )}
      {frontierPct > 0 && (
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
          style={{ width: `${frontierPct}%` }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subject Map Card
// ---------------------------------------------------------------------------

function SubjectMapCard({
  subjectKey,
  summary,
}: {
  subjectKey: string;
  summary: SubjectSummary;
}) {
  const emoji =
    SUBJECT_EMOJI[subjectKey.toLowerCase()] || '\u{1F4DA}';
  const colors = SUBJECT_COLORS[subjectKey.toLowerCase()] || {
    card: 'from-slate-500/30 to-slate-600/30 border-slate-500/20',
    bar: 'from-slate-400 to-slate-500',
  };
  const frontierCount = summary.frontier_skills.length;
  const notMasteredRemaining = summary.not_mastered - frontierCount;

  return (
    <Card
      className={`backdrop-blur-xl bg-gradient-to-br ${colors.card} border overflow-hidden`}
    >
      <CardContent className="p-5 space-y-4">
        {/* Subject header */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              {formatSubjectName(subjectKey)}
            </h3>
            <p className="text-xs text-slate-400">
              {summary.total_skills} skills
            </p>
          </div>
          <span className="text-xl font-bold text-white">
            {Math.round(summary.mastery_pct)}%
          </span>
        </div>

        {/* Stacked bar */}
        <StackedProgressBar
          mastered={summary.mastered}
          frontier={frontierCount}
          total={summary.total_skills}
        />

        {/* Breakdown rows */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded flex items-center justify-center bg-emerald-500/20 text-emerald-400 text-xs">
              &#x2713;
            </span>
            <span className="text-slate-300">Already Knows</span>
            <span className="ml-auto text-emerald-400 font-medium tabular-nums">
              {summary.mastered}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded flex items-center justify-center bg-blue-500/20 text-blue-400 text-xs">
              &#x2605;
            </span>
            <span className="text-slate-300">Ready to Learn</span>
            <span className="ml-auto text-blue-400 font-medium tabular-nums">
              {frontierCount}
            </span>
          </div>
          {notMasteredRemaining > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded flex items-center justify-center bg-slate-600/30 text-slate-500 text-xs">
                &#x1F512;
              </span>
              <span className="text-slate-500">Coming Later</span>
              <span className="ml-auto text-slate-500 font-medium tabular-nums">
                {notMasteredRemaining}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
