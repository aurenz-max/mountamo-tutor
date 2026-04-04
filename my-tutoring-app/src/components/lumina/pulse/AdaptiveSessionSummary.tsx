'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AdaptiveItemResult, SessionDecision } from './adaptiveEngine/types';

interface AdaptiveSessionSummaryProps {
  results: AdaptiveItemResult[];
  decisions: SessionDecision[];
  sessionStartedAt: number | null;
  topic: string;
  onDone: () => void;
  onKeepGoing?: () => void;
  showExtension?: boolean;
}

interface SkillSummary {
  topic: string;
  scores: number[];
  avgScore: number;
  label: 'solid' | 'growing' | 'new!';
  delta: number;
}

function computeSkillSummaries(results: AdaptiveItemResult[]): SkillSummary[] {
  const scored = results.filter((r) => !r.isWorkedExample);
  if (scored.length === 0) return [];

  // Group by manifest batch index as a proxy for different sub-topics
  const byBatch = new Map<number, AdaptiveItemResult[]>();
  for (const r of scored) {
    const batch = byBatch.get(r.manifestBatchIndex) ?? [];
    batch.push(r);
    byBatch.set(r.manifestBatchIndex, batch);
  }

  const summaries: SkillSummary[] = [];
  Array.from(byBatch.entries()).forEach(([batchIdx, items]) => {
    const scores = items.map((r: AdaptiveItemResult) => r.score);
    const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
    const first = scores[0];
    const last = scores[scores.length - 1];
    const delta = last - first;

    let label: SkillSummary['label'] = 'growing';
    if (avg >= 85) label = 'solid';
    else if (items.length === 1) label = 'new!';

    summaries.push({
      topic: `Challenge ${summaries.length + 1}`,
      scores,
      avgScore: avg,
      label,
      delta,
    });
  });

  return summaries;
}

function generateMessage(results: AdaptiveItemResult[], decisions: SessionDecision[]): string {
  const scored = results.filter((r) => !r.isWorkedExample);
  const earlyExit = decisions.some((d) => d.action === 'early-exit');
  const avgScore = scored.length > 0
    ? scored.reduce((a, r) => a + r.score, 0) / scored.length
    : 0;

  if (earlyExit) return "You crushed it! Mastery demonstrated \u2014 want to keep going or call it a win?";
  if (avgScore >= 85) return "Fantastic work! You're showing real confidence with this material.";
  if (avgScore >= 65) return "Great effort! You're building solid understanding \u2014 keep practicing!";
  return "Good work sticking with it! Every attempt makes you stronger.";
}

export const AdaptiveSessionSummary: React.FC<AdaptiveSessionSummaryProps> = ({
  results,
  decisions,
  sessionStartedAt,
  topic,
  onDone,
  onKeepGoing,
  showExtension = false,
}) => {
  const scored = results.filter((r) => !r.isWorkedExample);
  const summaries = useMemo(() => computeSkillSummaries(results), [results]);
  const message = useMemo(() => generateMessage(results, decisions), [results, decisions]);
  const earlyExit = decisions.some((d) => d.action === 'early-exit');
  const durationMs = sessionStartedAt ? Date.now() - sessionStartedAt : 0;
  const durationMin = Math.max(1, Math.round(durationMs / 60000));

  const switchCount = decisions.filter((d) => d.action === 'switch-representation').length;
  const exampleCount = decisions.filter((d) => d.action === 'insert-example').length;

  return (
    <motion.div
      className="max-w-lg mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl text-slate-100">
            {earlyExit ? "You crushed it!" : "Today's Session"}
          </CardTitle>
          <p className="text-slate-400 text-sm mt-1">{topic}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Skill bars */}
          <div className="space-y-3">
            {summaries.map((s, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <span className="text-sm w-24 truncate text-slate-300">{s.topic}</span>
                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      s.label === 'solid'
                        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                        : s.label === 'growing'
                          ? 'bg-gradient-to-r from-cyan-400 to-blue-400'
                          : 'bg-gradient-to-r from-violet-400 to-purple-400'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, s.avgScore)}%` }}
                    transition={{ delay: 0.4 + i * 0.1, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <span
                  className={`text-xs font-medium w-16 text-right ${
                    s.label === 'solid'
                      ? 'text-emerald-400'
                      : s.label === 'growing'
                        ? 'text-cyan-400'
                        : 'text-violet-400'
                  }`}
                >
                  {s.label}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Message */}
          <motion.p
            className="text-slate-300 text-center text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {message}
          </motion.p>

          {/* Stats row */}
          <motion.div
            className="flex items-center justify-center gap-4 text-slate-500 text-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <span>{scored.length} items</span>
            <span>&middot;</span>
            <span>{durationMin} min</span>
            {switchCount > 0 && (
              <>
                <span>&middot;</span>
                <span>{switchCount} switch{switchCount > 1 ? 'es' : ''}</span>
              </>
            )}
            {exampleCount > 0 && (
              <>
                <span>&middot;</span>
                <span>{exampleCount} example{exampleCount > 1 ? 's' : ''}</span>
              </>
            )}
          </motion.div>

          {/* Actions */}
          <motion.div
            className="flex gap-3 pt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <Button
              onClick={onDone}
              variant="ghost"
              className="flex-1 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
            >
              Done
            </Button>
            {showExtension && onKeepGoing && (
              <Button
                onClick={onKeepGoing}
                variant="ghost"
                className="flex-1 bg-cyan-500/20 border border-cyan-400/30 hover:bg-cyan-500/30 text-cyan-300"
              >
                Keep Going?
              </Button>
            )}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AdaptiveSessionSummary;
