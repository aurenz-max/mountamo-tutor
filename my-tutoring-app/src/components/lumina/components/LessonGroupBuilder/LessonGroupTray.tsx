'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import type { SelectedSubskill, BloomPhase } from './types';
import { nextBloomPhase, BLOOM_LABELS, BLOOM_COLORS } from './bloomUtils';

interface LessonGroupTrayProps {
  subskills: SelectedSubskill[];
  onRemove: (id: string) => void;
  onUpdateBloom: (id: string, phase: BloomPhase) => void;
  onLaunch: () => void;
  onClear: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const MIN_SUBSKILLS = 2;
const MAX_SUBSKILLS = 5;

export const LessonGroupTray: React.FC<LessonGroupTrayProps> = ({
  subskills,
  onRemove,
  onUpdateBloom,
  onLaunch,
  onClear,
  collapsed = false,
  onToggleCollapse,
}) => {
  const isValid = subskills.length >= MIN_SUBSKILLS && subskills.length <= MAX_SUBSKILLS;

  // Infer lesson topic from common subject/unit
  const lessonTopic = useMemo(() => {
    if (subskills.length === 0) return '';
    const subjects = new Set(subskills.map(s => s.subject));
    const units = new Set(subskills.map(s => s.unitTitle));
    const subjectStr = Array.from(subjects).join(', ');
    if (units.size === 1) {
      return `${subjectStr}: ${Array.from(units)[0]}`;
    }
    return subjectStr;
  }, [subskills]);

  // Phase distribution for display
  const phaseCounts = useMemo(() => {
    const counts: Record<BloomPhase, number> = { identify: 0, explain: 0, apply: 0 };
    for (const s of subskills) {
      counts[s.bloomPhase]++;
    }
    return counts;
  }, [subskills]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        subskills.length > 0 ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {/* Backdrop gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-4 pb-4">
        <div className="backdrop-blur-xl bg-slate-900/80 border border-white/10 rounded-t-2xl shadow-2xl shadow-black/50">
          {/* Header bar — always visible */}
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-between px-5 py-3 border-b border-white/5 hover:bg-white/5 transition-colors rounded-t-2xl"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">
                Lesson Builder
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  isValid
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {subskills.length}/{MAX_SUBSKILLS} selected
              </Badge>
              {!isValid && subskills.length > 0 && subskills.length < MIN_SUBSKILLS && (
                <span className="text-[10px] text-amber-400">
                  Select at least {MIN_SUBSKILLS} subskills
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {collapsed ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </div>
          </button>

          {/* Expanded content */}
          {!collapsed && (
            <div className="px-5 py-4 space-y-4">
              {/* Topic preview */}
              {lessonTopic && (
                <div className="text-xs text-slate-500">
                  <span className="text-slate-400 font-medium">Lesson topic:</span>{' '}
                  {lessonTopic}
                </div>
              )}

              {/* Selected subskills */}
              <div className="flex flex-wrap gap-2">
                {subskills.map((subskill) => {
                  const colors = BLOOM_COLORS[subskill.bloomPhase];
                  return (
                    <div
                      key={subskill.id}
                      className={`group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${colors.border} bg-white/5 hover:bg-white/10`}
                    >
                      {/* Bloom's verb badge — click to cycle */}
                      <button
                        onClick={() => onUpdateBloom(subskill.id, nextBloomPhase(subskill.bloomPhase))}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${colors.bg} ${colors.text} ${colors.border} border hover:opacity-80`}
                        title="Click to change Bloom's phase"
                      >
                        {BLOOM_LABELS[subskill.bloomPhase]}
                      </button>

                      {/* Subskill description */}
                      <span className="text-xs text-slate-300 max-w-[200px] truncate">
                        {subskill.description}
                      </span>

                      {/* Remove button */}
                      <button
                        onClick={() => onRemove(subskill.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Phase distribution */}
              <div className="flex items-center gap-4 text-[10px] text-slate-500">
                {(Object.entries(phaseCounts) as [BloomPhase, number][]).map(([phase, count]) => (
                  <span key={phase} className={`flex items-center gap-1 ${count > 0 ? BLOOM_COLORS[phase].text : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${count > 0 ? BLOOM_COLORS[phase].bg : 'bg-slate-700'}`} />
                    {BLOOM_LABELS[phase]}: {count}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <button
                  onClick={onClear}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>

                <Button
                  onClick={onLaunch}
                  disabled={!isValid}
                  className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
                    isValid
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Launch Lesson
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
