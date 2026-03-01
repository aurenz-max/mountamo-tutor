import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/authApiClient';
import { GATE_LABELS, GATE_COLORS } from './MasteryComponents';

// ---------------------------------------------------------------------------
// Curriculum types (local to seed panel)
// ---------------------------------------------------------------------------

interface CurrSubskill {
  id: string;
  description: string;
}

interface CurrSkill {
  id: string;
  description: string;
  subskills: CurrSubskill[];
}

interface CurrUnit {
  id: string;
  title: string;
  skills: CurrSkill[];
}

interface SeedQueueItem {
  subject: string;
  skill_id: string;
  subskill_id: string;
  subskill_label: string;
  target_gate: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MasterySeedPanel: React.FC<{
  studentId: string;
  loading: boolean;
  onSeeded: () => void;
  onError: (msg: string) => void;
  onLoadingChange: (loading: boolean) => void;
}> = ({ studentId, loading, onSeeded, onError, onLoadingChange }) => {
  const [expanded, setExpanded] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [curriculum, setCurriculum] = useState<CurrUnit[]>([]);
  const [loadingCurr, setLoadingCurr] = useState(false);
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [seedQueue, setSeedQueue] = useState<SeedQueueItem[]>([]);
  const [defaultGate, setDefaultGate] = useState(2);
  const [seeding, setSeeding] = useState(false);
  const currCache = useRef<Map<string, CurrUnit[]>>(new Map());

  const loadSubjects = useCallback(async () => {
    try {
      const result = await authApi.getSubjects() as (string | { subject_name: string })[];
      const names = (Array.isArray(result) ? result : []).map(s =>
        typeof s === 'string' ? s : s.subject_name
      );
      setSubjects(names);
    } catch {
      onError('Failed to load subjects');
    }
  }, [onError]);

  const loadCurriculum = useCallback(async (subject: string) => {
    const cached = currCache.current.get(subject);
    if (cached) {
      setCurriculum(cached);
      return;
    }
    setLoadingCurr(true);
    try {
      const data = await authApi.getSubjectCurriculum(subject) as { curriculum: CurrUnit[] };
      currCache.current.set(subject, data.curriculum);
      setCurriculum(data.curriculum);
    } catch {
      onError(`Failed to load ${subject} curriculum`);
    } finally {
      setLoadingCurr(false);
    }
  }, [onError]);

  const handleExpand = async () => {
    setExpanded(!expanded);
    if (!expanded && subjects.length === 0) {
      await loadSubjects();
    }
  };

  const handleSubjectClick = async (subject: string) => {
    if (subject === selectedSubject) {
      setSelectedSubject(null);
      setCurriculum([]);
      return;
    }
    setSelectedSubject(subject);
    setExpandedSkills(new Set());
    await loadCurriculum(subject);
  };

  const toggleSkill = (skillId: string) => {
    setExpandedSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const addToQueue = (subject: string, skill: CurrSkill, sub: CurrSubskill) => {
    if (seedQueue.some(q => q.subskill_id === sub.id)) return; // no duplicates
    setSeedQueue(prev => [...prev, {
      subject,
      skill_id: skill.id,
      subskill_id: sub.id,
      subskill_label: sub.description,
      target_gate: defaultGate,
    }]);
  };

  const removeFromQueue = (subskillId: string) => {
    setSeedQueue(prev => prev.filter(q => q.subskill_id !== subskillId));
  };

  const updateQueueGate = (subskillId: string, gate: number) => {
    setSeedQueue(prev => prev.map(q =>
      q.subskill_id === subskillId ? { ...q, target_gate: gate } : q
    ));
  };

  const seedSelected = async () => {
    if (seedQueue.length === 0) return;
    setSeeding(true);
    onLoadingChange(true);
    try {
      await authApi.post(`/api/mastery/debug/seed/${studentId}`, {
        subskills: seedQueue.map(q => ({
          subject: q.subject,
          skill_id: q.skill_id,
          subskill_id: q.subskill_id,
          target_gate: q.target_gate,
        })),
      });
      setSeedQueue([]);
      onSeeded();
    } catch (e: any) {
      onError(`Seed error: ${e.message}`);
    } finally {
      setSeeding(false);
      onLoadingChange(false);
    }
  };

  const queuedIds = new Set(seedQueue.map(q => q.subskill_id));

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2">
        <button
          onClick={handleExpand}
          className="w-full flex items-center justify-between"
        >
          <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Custom Seed — Curriculum Picker
          </CardTitle>
          <span className={`text-slate-500 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Default gate selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Default target gate:</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(g => (
                <button
                  key={g}
                  onClick={() => setDefaultGate(g)}
                  className={`w-7 h-7 rounded text-xs font-mono transition-colors ${
                    defaultGate === g
                      ? `${GATE_COLORS[g]} text-white`
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500">{GATE_LABELS[defaultGate]}</span>
          </div>

          {/* Subject pills */}
          {subjects.length === 0 ? (
            <div className="text-center">
              <span className="text-xs text-slate-500">Loading subjects...</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map(subj => (
                <button
                  key={subj}
                  onClick={() => handleSubjectClick(subj)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    selectedSubject === subj
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-200'
                      : 'bg-white/5 border-white/20 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>
          )}

          {/* Curriculum tree */}
          {loadingCurr && (
            <div className="text-center py-4">
              <span className="text-xs text-slate-400 animate-pulse">Loading curriculum...</span>
            </div>
          )}

          {!loadingCurr && curriculum.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {curriculum.map(unit => (
                <div key={unit.id} className="space-y-1">
                  <div className="text-xs font-semibold text-slate-300 px-2 py-1 bg-white/5 rounded">
                    {unit.title}
                  </div>
                  {unit.skills.map(skill => (
                    <div key={skill.id} className="ml-2">
                      <button
                        onClick={() => toggleSkill(skill.id)}
                        className="w-full text-left px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                      >
                        <span className={`transition-transform ${expandedSkills.has(skill.id) ? 'rotate-90' : ''}`}>
                          ▸
                        </span>
                        <span className="flex-1 truncate">{skill.description}</span>
                        <span className="text-slate-600 text-[10px]">{skill.subskills.length}</span>
                      </button>
                      {expandedSkills.has(skill.id) && (
                        <div className="ml-4 space-y-0.5">
                          {skill.subskills.map(sub => {
                            const queued = queuedIds.has(sub.id);
                            return (
                              <button
                                key={sub.id}
                                onClick={() => !queued && selectedSubject && addToQueue(selectedSubject, skill, sub)}
                                disabled={queued}
                                className={`w-full text-left px-2 py-1 rounded text-[11px] flex items-center gap-2 transition-all ${
                                  queued
                                    ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                                    : 'text-slate-400 hover:bg-violet-500/10 hover:text-violet-200'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${queued ? 'bg-violet-400' : 'bg-slate-600'}`} />
                                <span className="flex-1 truncate">{sub.description}</span>
                                {queued && <span className="text-[9px] text-violet-400">added</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Seed queue */}
          {seedQueue.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Seed Queue ({seedQueue.length} subskills)
                </span>
                <button
                  onClick={() => setSeedQueue([])}
                  className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {seedQueue.map(item => (
                  <div key={item.subskill_id} className="flex items-center gap-2 p-1.5 rounded bg-slate-800/30 border border-white/5">
                    <span className="flex-1 text-[11px] text-slate-300 truncate" title={item.subskill_id}>
                      {item.subskill_label}
                    </span>
                    <span className="text-[9px] text-slate-500 capitalize flex-shrink-0">{item.subject}</span>
                    {/* Per-item gate selector */}
                    <div className="flex gap-0.5 flex-shrink-0">
                      {[0, 1, 2, 3, 4].map(g => (
                        <button
                          key={g}
                          onClick={() => updateQueueGate(item.subskill_id, g)}
                          className={`w-5 h-5 rounded text-[9px] font-mono transition-colors ${
                            item.target_gate === g
                              ? `${GATE_COLORS[g]} text-white`
                              : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => removeFromQueue(item.subskill_id)}
                      className="text-red-400 hover:text-red-300 text-xs flex-shrink-0 px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="w-full bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 text-violet-300"
                onClick={seedSelected}
                disabled={seeding || loading || seedQueue.length === 0}
              >
                {seeding ? 'Seeding...' : `Seed ${seedQueue.length} Subskills`}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
