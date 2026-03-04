'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type {
  KnowledgeProfileResponse,
  CompletionResponse,
  SubjectSummary,
} from './types';

// Subject emoji mapping (mirrors SubjectSelector)
const SUBJECT_EMOJI: Record<string, string> = {
  mathematics: '🔢',
  math: '🔢',
  science: '🔬',
  'language-arts': '📝',
  'language arts': '📝',
  reading: '📖',
  writing: '✏️',
  'social-studies': '🌍',
  'social studies': '🌍',
};

const SUBJECT_COLORS: Record<string, string> = {
  mathematics: 'from-cyan-500/30 to-blue-500/30 border-cyan-500/20',
  math: 'from-cyan-500/30 to-blue-500/30 border-cyan-500/20',
  science: 'from-green-500/30 to-emerald-500/30 border-green-500/20',
  'language-arts': 'from-purple-500/30 to-violet-500/30 border-purple-500/20',
  'language arts': 'from-purple-500/30 to-violet-500/30 border-purple-500/20',
  reading: 'from-rose-500/30 to-pink-500/30 border-rose-500/20',
  writing: 'from-violet-500/30 to-indigo-500/30 border-violet-500/20',
  'social-studies': 'from-amber-500/30 to-yellow-500/30 border-amber-500/20',
  'social studies': 'from-amber-500/30 to-yellow-500/30 border-amber-500/20',
};

function formatSubjectName(key: string): string {
  return key
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface DiagnosticProfileCardProps {
  profile: KnowledgeProfileResponse;
  completionResponse: CompletionResponse;
  onStartLearning: () => void;
}

export const DiagnosticProfileCard: React.FC<DiagnosticProfileCardProps> = ({
  profile,
  completionResponse,
  onStartLearning,
}) => {
  const subjects = Object.entries(profile.by_subject);
  const totalMastered = subjects.reduce(
    (sum, [, s]) => sum + s.mastered,
    0,
  );
  const totalFrontier = profile.frontier_skills.length;

  return (
    <div className="max-w-3xl mx-auto w-full space-y-8">
      {/* Celebratory header */}
      <div className="text-center space-y-3">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-white">
          All done! Here&apos;s what we learned!
        </h2>
        <p className="text-slate-400 text-lg">
          We found{' '}
          <span className="text-cyan-400 font-semibold">{totalMastered}</span>{' '}
          things you already know
          {totalFrontier > 0 && (
            <>
              {' '}and{' '}
              <span className="text-green-400 font-semibold">
                {totalFrontier}
              </span>{' '}
              skills ready to learn next
            </>
          )}
          !
        </p>
      </div>

      {/* Per-subject cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {subjects.map(([key, summary]) => (
          <SubjectCard key={key} subjectKey={key} summary={summary} />
        ))}
      </div>

      {/* Overall stats */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-400">
              Skills assessed:{' '}
              <span className="text-white font-medium">
                {profile.total_classified}
              </span>
            </div>
            <div className="text-slate-400">
              Directly tested:{' '}
              <span className="text-white font-medium">
                {profile.total_probed}
              </span>
            </div>
            <div className="text-slate-400">
              Coverage:{' '}
              <span className="text-white font-medium">
                {Math.round(profile.coverage_pct)}%
              </span>
            </div>
          </div>
          {completionResponse.seeded_count > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              {completionResponse.seeded_count} skills have been added to your
              learning plan.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Start Learning button */}
      <div className="text-center">
        <Button
          onClick={onStartLearning}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white px-10 py-4 text-lg rounded-xl shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-400/30"
        >
          Start Learning!
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SubjectCard — one subject's diagnostic results
// ---------------------------------------------------------------------------

function SubjectCard({
  subjectKey,
  summary,
}: {
  subjectKey: string;
  summary: SubjectSummary;
}) {
  const emoji = SUBJECT_EMOJI[subjectKey.toLowerCase()] || '📚';
  const colorClass =
    SUBJECT_COLORS[subjectKey.toLowerCase()] ||
    'from-slate-500/30 to-slate-600/30 border-slate-500/20';
  const masteryPct = Math.round(summary.mastery_pct);
  const barWidth = Math.max(2, masteryPct); // minimum visible width

  return (
    <Card
      className={`backdrop-blur-xl bg-gradient-to-br ${colorClass} border overflow-hidden`}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <h3 className="text-lg font-semibold text-white">
            {formatSubjectName(subjectKey)}
          </h3>
        </div>

        {/* Mastery bar */}
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-700"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Already knows: {summary.mastered} skills</span>
            <span>{masteryPct}%</span>
          </div>
        </div>

        {/* Frontier */}
        {summary.frontier_skills.length > 0 && (
          <p className="text-xs text-green-400/80">
            Ready to learn: {summary.frontier_skills.length} skills
          </p>
        )}

        {/* Remaining */}
        {summary.not_mastered > 0 && (
          <p className="text-xs text-slate-500">
            Coming later: {summary.not_mastered} skills
          </p>
        )}
      </CardContent>
    </Card>
  );
}
