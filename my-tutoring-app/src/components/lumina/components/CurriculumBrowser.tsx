'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/authApiClient';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, BookOpen, RefreshCw, GraduationCap } from 'lucide-react';
import type { GradeLevel } from './GradeLevelSelector';

// ── Types ──────────────────────────────────────────────────────────

interface SubjectInfo {
  subject_id?: string;
  subject_name: string;
  grade?: string;
}

interface CurriculumSubskill {
  id: string;
  description: string;
  difficulty_range?: { start: number; end: number; target: number };
}

interface CurriculumSkill {
  id: string;
  description: string;
  subskills: CurriculumSubskill[];
}

interface CurriculumUnit {
  id: string;
  title: string;
  grade?: string | null;
  subject?: string;
  skills: CurriculumSkill[];
}

interface CurriculumBrowserProps {
  onSelectTopic: (topic: string, gradeLevel?: GradeLevel) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────

function mapGradeToLevel(grade: string | null | undefined): GradeLevel | undefined {
  if (!grade) return undefined;
  const g = grade.toLowerCase().trim();
  if (g.includes('pre')) return 'preschool';
  if (g === 'k' || g.includes('kindergarten')) return 'kindergarten';
  const num = parseInt(g);
  if (!isNaN(num)) {
    if (num >= 1 && num <= 5) return 'elementary';
    if (num >= 6 && num <= 8) return 'middle-school';
    if (num >= 9 && num <= 12) return 'high-school';
  }
  return undefined;
}

function gradeSort(a: string, b: string): number {
  const order = (g: string) => {
    const l = g.toLowerCase().trim();
    if (l.includes('pre')) return -1;
    if (l === 'k' || l.includes('kindergarten')) return 0;
    const n = parseInt(l);
    return isNaN(n) ? 999 : n;
  };
  return order(a) - order(b);
}

function gradeLabel(grade: string): string {
  const l = grade.toLowerCase().trim();
  if (l.includes('pre')) return 'Pre-K';
  if (l === 'k' || l.includes('kindergarten')) return 'Kindergarten';
  const n = parseInt(l);
  if (!isNaN(n)) return `Grade ${n}`;
  return grade;
}

// ── Skill Row (inner drill-down) ────────────────────────────────────

interface SkillRowProps {
  skill: CurriculumSkill;
  unit: CurriculumUnit;
  subject: string;
  onSelect: (topic: string, grade?: GradeLevel) => void;
}

const SkillRow: React.FC<SkillRowProps> = ({ skill, unit, subject, onSelect }) => {
  const [expanded, setExpanded] = useState(false);

  const handleSubskillClick = (subskill: CurriculumSubskill) => {
    const topic = `${subject}: ${skill.description} - ${subskill.description}`;
    const grade = mapGradeToLevel(unit.grade);
    onSelect(topic, grade);
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex justify-between items-center gap-3"
      >
        <span className="text-slate-200 text-sm flex-1">{skill.description}</span>
        <span className="text-xs text-slate-500 whitespace-nowrap">{skill.subskills.length} topics</span>
        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="ml-4 mt-2 space-y-1">
          {skill.subskills.map(subskill => (
            <button
              key={subskill.id}
              onClick={() => handleSubskillClick(subskill)}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-blue-500/10 hover:text-blue-200 border border-transparent hover:border-blue-500/20 transition-all flex items-center gap-2 group"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400/50 group-hover:bg-blue-400 transition-colors flex-shrink-0" />
              <span className="flex-1">{subskill.description}</span>
              <svg className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────

export const CurriculumBrowser: React.FC<CurriculumBrowserProps> = ({ onSelectTopic }) => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [curriculumData, setCurriculumData] = useState<CurriculumUnit[] | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);

  // Cache curriculum data per subject to avoid refetching
  const cacheRef = useRef<Map<string, CurriculumUnit[]>>(new Map());

  // Load subjects on first interaction (lazy load)
  const ensureSubjectsLoaded = useCallback(async () => {
    if (subjectsLoaded || loadingSubjects || !user) return;
    setLoadingSubjects(true);
    setError(null);
    try {
      const result = await authApi.getSubjects() as (string | SubjectInfo)[];
      // Normalize: backend may return plain strings (legacy) or objects with subject_name/grade
      const normalized: SubjectInfo[] = (Array.isArray(result) ? result : []).map(s =>
        typeof s === 'string' ? { subject_name: s } : s
      );
      setSubjects(normalized);
      setSubjectsLoaded(true);
    } catch {
      setError('Failed to load subjects');
    } finally {
      setLoadingSubjects(false);
    }
  }, [subjectsLoaded, loadingSubjects, user]);

  const handleSubjectSelect = useCallback(async (subject: string) => {
    if (subject === selectedSubject) {
      // Toggle off
      setSelectedSubject(null);
      setCurriculumData(null);
      return;
    }

    setSelectedSubject(subject);
    setError(null);

    // Check cache
    const cached = cacheRef.current.get(subject);
    if (cached) {
      setCurriculumData(cached);
      return;
    }

    setLoadingCurriculum(true);
    setCurriculumData(null);
    try {
      const data = await authApi.getSubjectCurriculum(subject) as { curriculum: CurriculumUnit[] };
      cacheRef.current.set(subject, data.curriculum);
      setCurriculumData(data.curriculum);
    } catch {
      setError(`Failed to load ${subject} curriculum`);
    } finally {
      setLoadingCurriculum(false);
    }
  }, [selectedSubject]);

  // Don't render for unauthenticated users
  if (!user) return null;

  return (
    <div>
      {/* Section divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700" />
        <span className="text-slate-500 text-xs font-mono uppercase tracking-widest">Browse Curriculum</span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700" />
      </div>

      {/* Subject pills */}
      {!subjectsLoaded && !loadingSubjects && (
        <div className="flex justify-center">
          <button
            onClick={ensureSubjectsLoaded}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10 hover:text-white transition-all text-sm"
          >
            <BookOpen className="w-4 h-4" />
            Load Curriculum
          </button>
        </div>
      )}

      {loadingSubjects && (
        <div className="flex justify-center">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading subjects...
          </div>
        </div>
      )}

      {subjectsLoaded && subjects.length > 0 && (() => {
        // Group subjects by grade
        const grouped = new Map<string, SubjectInfo[]>();
        for (const s of subjects) {
          const key = s.grade ?? '';
          const list = grouped.get(key) ?? [];
          list.push(s);
          grouped.set(key, list);
        }
        const sortedGrades = Array.from(grouped.keys()).sort(gradeSort);

        return (
          <div className="space-y-4 mb-6">
            {sortedGrades.map(grade => (
              <div key={grade}>
                {grade && (
                  <div className="flex items-center gap-2 mb-2.5">
                    <GraduationCap className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">
                      {gradeLabel(grade)}
                    </span>
                    <div className="h-px flex-1 bg-slate-700/60" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-center">
                  {grouped.get(grade)!.map(subject => (
                    <button
                      key={`${subject.subject_name}-${grade}`}
                      onClick={() => handleSubjectSelect(subject.subject_name)}
                      className={`px-4 py-2 rounded-full border transition-all text-sm font-medium ${
                        selectedSubject === subject.subject_name
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                          : 'bg-white/5 border-white/20 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {subject.subject_name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {subjectsLoaded && subjects.length === 0 && (
        <p className="text-center text-slate-500 text-sm">No curriculum available.</p>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
          <span className="text-red-300 text-sm">{error}</span>
          <button
            onClick={() => {
              setError(null);
              if (!subjectsLoaded) {
                setSubjectsLoaded(false);
                ensureSubjectsLoaded();
              } else if (selectedSubject) {
                cacheRef.current.delete(selectedSubject);
                handleSubjectSelect(selectedSubject);
              }
            }}
            className="text-red-300 hover:text-red-200 text-sm underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loadingCurriculum && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Curriculum accordion tree */}
      {curriculumData && curriculumData.length > 0 && selectedSubject && (
        <Accordion type="single" collapsible className="space-y-2">
          {curriculumData.map(unit => (
            <AccordionItem
              key={unit.id}
              value={unit.id}
              className="border border-white/10 rounded-xl overflow-hidden bg-slate-900/40 backdrop-blur-xl"
            >
              <AccordionTrigger className="px-5 py-4 text-slate-100 hover:no-underline hover:bg-white/5 [&[data-state=open]]:bg-white/5">
                <div className="flex items-center gap-3 text-left">
                  <span className="font-semibold">{unit.title}</span>
                  {unit.grade && (
                    <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                      Grade {unit.grade}
                    </Badge>
                  )}
                  <span className="text-xs text-slate-500">{unit.skills.length} skills</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-4">
                <div className="space-y-2">
                  {unit.skills.map(skill => (
                    <SkillRow
                      key={skill.id}
                      skill={skill}
                      unit={unit}
                      subject={selectedSubject}
                      onSelect={onSelectTopic}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {curriculumData && curriculumData.length === 0 && selectedSubject && (
        <p className="text-center text-slate-500 text-sm">No curriculum found for {selectedSubject}.</p>
      )}
    </div>
  );
};
