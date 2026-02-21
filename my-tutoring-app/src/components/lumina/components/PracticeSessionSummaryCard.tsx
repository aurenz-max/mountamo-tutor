'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import type { HydratedPracticeItem, PracticeItemResult, ComponentId } from '../types';
import { useEvaluationContext } from '../evaluation';
import type { PrimitiveEvaluationResult } from '../evaluation';

interface PracticeSessionSummaryCardProps {
  itemResults: PracticeItemResult[];
  hydratedItems: HydratedPracticeItem[];
  totalItems: number;
  subject: string;
  gradeLevel: string;
}

/** Format milliseconds into a readable duration string */
function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/** Get color classes for a score value */
function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

/** Get background color classes for a score badge */
function scoreBadgeBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (score >= 50) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-red-500/20 text-red-300 border-red-500/30';
}

/** Get a short label for the component/problem type */
function getTypeLabel(
  result: PracticeItemResult | null,
  manifestVisualComponentId?: string,
  manifestProblemType?: string,
): string {
  // Prefer manifest-level type info (always available), fall back to result
  const visualId = manifestVisualComponentId ?? result?.visualComponentId;
  const problemType = manifestProblemType ?? result?.problemType;

  if (visualId) {
    return visualId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  if (problemType) {
    return problemType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return result?.mode === 'visual-primitive' ? 'Interactive' : 'Quiz';
}

/**
 * Convert a PrimitiveEvaluationResult from the EvaluationContext into a
 * PracticeItemResult that the summary card can render.
 */
function evalResultToPracticeResult(
  evalResult: PrimitiveEvaluationResult,
  itemIndex: number,
  hydratedItem?: HydratedPracticeItem,
): PracticeItemResult {
  const isVisual = hydratedItem
    ? !!hydratedItem.manifestItem.visualPrimitive
    : !evalResult.primitiveType.includes('multiple-choice') &&
      !evalResult.primitiveType.includes('true-false') &&
      !evalResult.primitiveType.includes('fill-in');

  return {
    instanceId: evalResult.instanceId,
    itemIndex,
    mode: isVisual ? 'visual-primitive' : 'standard-problem',
    visualComponentId: isVisual ? (evalResult.primitiveType as ComponentId) : undefined,
    problemType: hydratedItem?.manifestItem.standardProblem?.problemType,
    success: evalResult.success,
    score: evalResult.score,
    durationMs: evalResult.durationMs,
    evaluationResult: evalResult,
  };
}

export const PracticeSessionSummaryCard: React.FC<PracticeSessionSummaryCardProps> = ({
  itemResults,
  hydratedItems,
  totalItems,
  subject,
  gradeLevel,
}) => {
  // Read from EvaluationContext if available (authoritative source for eval results)
  const evalContext = useEvaluationContext();

  // Merge callback-chain results with context results
  const mergedResults = useMemo(() => {
    // Start with callback-chain results keyed by instanceId
    const resultMap = new Map<string, PracticeItemResult>(
      itemResults.map((r) => [r.instanceId, r])
    );

    // If we have context results, fill in anything the callback chain missed
    if (evalContext) {
      const contextResults = [
        ...evalContext.submittedResults,
        ...evalContext.pendingSubmissions.map((q) => q.result),
      ];

      for (const evalResult of contextResults) {
        if (!resultMap.has(evalResult.instanceId)) {
          // Find the matching hydrated item for context (index, visual/standard)
          const hydratedIdx = hydratedItems.findIndex(
            (hi) => hi.manifestItem.instanceId === evalResult.instanceId
          );
          const hydratedItem = hydratedIdx >= 0 ? hydratedItems[hydratedIdx] : undefined;

          resultMap.set(
            evalResult.instanceId,
            evalResultToPracticeResult(evalResult, hydratedIdx >= 0 ? hydratedIdx : resultMap.size, hydratedItem)
          );
        }
      }
    }

    return resultMap;
  }, [itemResults, evalContext, hydratedItems]);

  // Compute aggregate stats from merged results
  const allResults = Array.from(mergedResults.values());
  const completedResults = allResults.filter((r) => r.success !== undefined);
  const correctCount = completedResults.filter((r) => r.success).length;
  const averageScore =
    completedResults.length > 0
      ? Math.round(
          completedResults.reduce((sum, r) => sum + r.score, 0) / completedResults.length
        )
      : 0;
  const totalDuration = allResults.reduce((sum, r) => sum + r.durationMs, 0);
  const interactiveCount = allResults.filter((r) => r.mode === 'visual-primitive').length;
  const standardCount = allResults.filter((r) => r.mode === 'standard-problem').length;

  // Build item list: use hydratedItems order if available, fall back to results order
  const itemList =
    hydratedItems.length > 0
      ? hydratedItems.map((hi, idx) => ({
          index: idx,
          problemText: hi.manifestItem.problemText,
          difficulty: hi.manifestItem.difficulty,
          isVisual: !!hi.manifestItem.visualPrimitive,
          visualComponentId: hi.manifestItem.visualPrimitive?.componentId,
          problemType: hi.manifestItem.standardProblem?.problemType,
          result: mergedResults.get(hi.manifestItem.instanceId) ?? null,
        }))
      : allResults.map((r, idx) => ({
          index: r.itemIndex ?? idx,
          problemText: `Question ${(r.itemIndex ?? idx) + 1}`,
          difficulty: undefined as string | undefined,
          isVisual: r.mode === 'visual-primitive',
          visualComponentId: r.visualComponentId,
          problemType: r.problemType,
          result: r,
        }));

  return (
    <div className="space-y-6">
      {/* Aggregate Stats */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">{totalItems}</div>
              <div className="text-sm text-slate-400 uppercase tracking-wider">Questions</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2 capitalize">
                {subject.replace('-', ' ')}
              </div>
              <div className="text-sm text-slate-400 uppercase tracking-wider">Subject</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-400 mb-2 capitalize">
                {gradeLevel.replace('-', ' ')}
              </div>
              <div className="text-sm text-slate-400 uppercase tracking-wider">Level</div>
            </div>
          </div>

          {/* Score breakdown */}
          {completedResults.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700 grid grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400 mb-1">
                  {correctCount}/{completedResults.length}
                </div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">Correct</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold mb-1 ${scoreColor(averageScore)}`}>
                  {averageScore}%
                </div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">Avg Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-300 mb-1">
                  {formatDuration(totalDuration)}
                </div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">Total Time</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-cyan-400 mb-1">{interactiveCount}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">Interactive</div>
              </div>
            </div>
          )}

          {/* Type breakdown bar */}
          {completedResults.length > 0 && (interactiveCount > 0 || standardCount > 0) && (
            <div className="mt-6 pt-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>Performance by type</span>
                <span>
                  {interactiveCount} interactive / {standardCount} quiz
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                {interactiveCount > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                    style={{
                      width: `${(interactiveCount / completedResults.length) * 100}%`,
                    }}
                  />
                )}
                {standardCount > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                    style={{
                      width: `${(standardCount / completedResults.length) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Item Breakdown */}
      {itemList.length > 0 && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Question Breakdown</h3>
            <Accordion type="multiple" className="space-y-1">
              {itemList.map((item) => (
                <AccordionItem
                  key={item.index}
                  value={`item-${item.index}`}
                  className="border-b border-white/5 last:border-b-0"
                >
                  <AccordionTrigger className="hover:no-underline py-3 gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      {/* Question number */}
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-slate-300">
                        {item.index + 1}
                      </span>

                      {/* Problem text + type label */}
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-sm text-slate-300">
                          {item.problemText}
                        </span>
                        <span className={`text-xs ${item.isVisual ? 'text-purple-400' : 'text-blue-400'}`}>
                          {getTypeLabel(item.result, item.visualComponentId, item.problemType)}
                        </span>
                      </div>

                      {/* Score badge or not-attempted */}
                      {item.result ? (
                        <Badge
                          variant="outline"
                          className={`flex-shrink-0 border ${scoreBadgeBg(item.result.score)}`}
                        >
                          {item.result.score}%
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="flex-shrink-0 border-slate-600 text-slate-500"
                        >
                          --
                        </Badge>
                      )}

                      {/* Pass/fail indicator */}
                      {item.result && (
                        <span className="flex-shrink-0">
                          {item.result.success ? (
                            <svg
                              className="w-5 h-5 text-emerald-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-5 h-5 text-red-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-11 pb-4">
                    {item.result ? (
                      <div className="space-y-3">
                        {/* Detail row */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Mode badge */}
                          <Badge
                            variant="outline"
                            className={`border text-xs ${
                              item.result.mode === 'visual-primitive'
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            }`}
                          >
                            {item.result.mode === 'visual-primitive'
                              ? 'Interactive'
                              : 'Quiz'}
                          </Badge>

                          {/* Component type */}
                          <Badge
                            variant="outline"
                            className="border border-white/10 bg-white/5 text-slate-400 text-xs"
                          >
                            {getTypeLabel(item.result, item.visualComponentId, item.problemType)}
                          </Badge>

                          {/* Difficulty */}
                          {item.difficulty && (
                            <Badge
                              variant="outline"
                              className={`border text-xs ${
                                item.difficulty === 'easy'
                                  ? 'bg-green-500/10 text-green-300 border-green-500/30'
                                  : item.difficulty === 'medium'
                                  ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
                                  : 'bg-red-500/10 text-red-300 border-red-500/30'
                              }`}
                            >
                              {item.difficulty}
                            </Badge>
                          )}

                          {/* Duration */}
                          <span className="text-xs text-slate-500 ml-auto">
                            {formatDuration(item.result.durationMs)}
                          </span>
                        </div>

                        {/* Score bar */}
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>Score</span>
                            <span className={scoreColor(item.result.score)}>
                              {item.result.score}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                item.result.score >= 80
                                  ? 'bg-emerald-500'
                                  : item.result.score >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${item.result.score}%` }}
                            />
                          </div>
                        </div>

                        {/* Partial credit if different from score */}
                        {item.result.evaluationResult?.partialCredit !== undefined &&
                          item.result.evaluationResult.partialCredit !== item.result.score && (
                            <div className="text-xs text-slate-500">
                              Partial credit:{' '}
                              <span className="text-slate-300">
                                {item.result.evaluationResult.partialCredit}%
                              </span>
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 italic">
                        Not attempted
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PracticeSessionSummaryCard;
