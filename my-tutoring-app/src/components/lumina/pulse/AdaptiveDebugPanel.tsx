'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AdaptiveItemResult, SessionDecision, ManifestLatencyEntry } from './adaptiveEngine/types';

interface AdaptiveDebugPanelProps {
  results: AdaptiveItemResult[];
  decisions: SessionDecision[];
  latencyLog: ManifestLatencyEntry[];
  currentScaffoldingMode: number;
  workedExamplesInserted: number;
  isHydrating: boolean;
  onRestart?: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  continue: 'text-slate-400',
  'switch-representation': 'text-amber-400',
  'insert-example': 'text-violet-400',
  'early-exit': 'text-emerald-400',
  'extend-offer': 'text-cyan-400',
  'end-session': 'text-slate-500',
};

export const AdaptiveDebugPanel: React.FC<AdaptiveDebugPanelProps> = ({
  results,
  decisions,
  latencyLog,
  currentScaffoldingMode,
  workedExamplesInserted,
  isHydrating,
  onRestart,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const scored = results.filter((r) => !r.isWorkedExample);
  const avgLatency = latencyLog.length > 0
    ? Math.round(latencyLog.reduce((a, e) => a + e.latencyMs, 0) / latencyLog.length)
    : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Toggle bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-1.5 bg-slate-900/80 backdrop-blur-sm border-t border-white/5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <span className="flex items-center gap-3">
          <span className="font-mono">
            items:{scored.length} mode:{currentScaffoldingMode} examples:{workedExamplesInserted}
          </span>
          {isHydrating && (
            <span className="text-cyan-400 animate-pulse">hydrating...</span>
          )}
        </span>
        <span>{isOpen ? '\u25BC' : '\u25B2'} Debug</span>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card className="rounded-none border-x-0 border-b-0 bg-slate-950/95 backdrop-blur-xl border-white/5">
              <CardContent className="p-4 max-h-64 overflow-y-auto space-y-4">
                {/* Score progression */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Score Progression</h4>
                  <div className="flex items-end gap-1 h-12">
                    {scored.map((r, i) => (
                      <div
                        key={i}
                        className="flex-1 min-w-[8px] max-w-[24px] rounded-t"
                        style={{
                          height: `${r.score}%`,
                          backgroundColor: r.score >= 90
                            ? '#4ade80'
                            : r.score >= 60
                              ? '#38bdf8'
                              : '#f87171',
                        }}
                        title={`Item ${i + 1}: ${r.score}/100 (mode ${r.scaffoldingMode})`}
                      />
                    ))}
                    {scored.length === 0 && (
                      <span className="text-xs text-slate-600">No items completed yet</span>
                    )}
                  </div>
                </div>

                {/* Decision log */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Decision Log</h4>
                  <div className="space-y-1 font-mono text-xs">
                    {decisions.length === 0 && (
                      <span className="text-slate-600">No decisions yet</span>
                    )}
                    {decisions.map((d, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-slate-600 w-6 text-right">{i + 1}.</span>
                        <span className={`font-medium ${ACTION_COLORS[d.action] ?? 'text-slate-400'}`}>
                          {d.action}
                        </span>
                        <span className="text-slate-600 truncate">{d.reason}</span>
                        <span className="text-slate-700 ml-auto whitespace-nowrap">
                          [{d.inputScores.join(', ')}]
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Latency log */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                    Manifest Latency (avg {avgLatency}ms)
                  </h4>
                  <div className="space-y-1 font-mono text-xs">
                    {latencyLog.length === 0 && (
                      <span className="text-slate-600">No manifest calls yet</span>
                    )}
                    {latencyLog.map((e, i) => (
                      <div key={i} className="flex gap-2 text-slate-500">
                        <span className="w-16">{e.trigger}</span>
                        <span
                          className={
                            e.latencyMs < 2000
                              ? 'text-emerald-500'
                              : e.latencyMs < 4000
                                ? 'text-amber-500'
                                : 'text-red-500'
                          }
                        >
                          {e.latencyMs}ms
                        </span>
                        <span className="text-slate-700">{e.itemCount} item{e.itemCount !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {onRestart && (
                  <div className="pt-2 border-t border-white/5">
                    <Button
                      onClick={onRestart}
                      variant="ghost"
                      size="sm"
                      className="text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400"
                    >
                      Restart Session
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdaptiveDebugPanel;
