'use client';

/**
 * useStudentCurriculumMap — feeds the CurriculumShowcase visual with REAL
 * curriculum-service data, opened on the signed-in student's grade, and lit up
 * with the student's mastery from the knowledge graph.
 *
 * Backend surface:
 *   - authApi.getSubjects()                          → subjects (with grade)
 *   - authApi.getSubjectCurriculum(subj, grade)      → that subject's full units
 *                                                      (unit → skills → subskills)
 *   - analyticsApi.getKnowledgeGraphProgress(id, …)  → per-subskill mastery status
 *
 * The wheel is built from every published grade; a grade's units + mastery are
 * fetched lazily (the student's grade eagerly on mount, others on click) and
 * cached. Unit frames carry a rolled-up mastery status for tinting, and
 * getUnitDetail() returns the unit's skills → subskills with per-subskill status
 * for the deep-dive drawer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/authApiClient';
import { analyticsApi, type KnowledgeGraphNode } from '@/lib/studentAnalyticsAPI';
import { subjectVisual, type ShowcaseGrade } from '@/components/landing/LandingPrimitiveDemos';

// ── Backend shapes (subset we read) ──────────────────────────────────
interface SubjectInfo {
  subject_id?: string;
  subject_name: string;
  grade?: string;
}
interface CurriculumSubskill {
  id: string;
  description: string;
}
interface CurriculumSkill {
  id: string;
  description: string;
  subskills: CurriculumSubskill[];
}
interface CurriculumUnit {
  id: string;
  title: string;
  skills: CurriculumSkill[];
}

// ── Deep-dive detail shapes (exposed to the drawer) ──────────────────
export type MasteryStatus = KnowledgeGraphNode['status'] | 'unknown';
export interface UnitSubskillDetail {
  id: string;
  description: string;
  status: MasteryStatus;
  gate: number;
  theta: number | null;
}
export interface UnitSkillDetail {
  id: string;
  description: string;
  subskills: UnitSubskillDetail[];
}
export interface UnitDetail {
  id: string;
  title: string;
  subject: string;
  skills: UnitSkillDetail[];
}

// ── Grade helpers (mirror CurriculumBrowser's normalization) ─────────
function gradeOrder(g: string): number {
  const l = g.toLowerCase().trim();
  if (l.includes('pre')) return -1;
  if (l === 'k' || l.includes('kindergarten')) return 0;
  const n = parseInt(l, 10);
  return isNaN(n) ? 999 : n;
}
function gradeShortLabel(g: string): string {
  const l = g.toLowerCase().trim();
  if (l.includes('pre')) return 'Pre-K';
  if (l === 'k' || l.includes('kindergarten')) return 'K';
  const n = parseInt(l, 10);
  return isNaN(n) ? g : String(n);
}
function gradeFullLabel(g: string): string {
  const l = g.toLowerCase().trim();
  if (l.includes('pre')) return 'Pre-K';
  if (l === 'k' || l.includes('kindergarten')) return 'Kindergarten';
  const n = parseInt(l, 10);
  return isNaN(n) ? g : `Grade ${n}`;
}

const isMasteredStatus = (s: string) => s === 'mastered' || s === 'inferred';

/** Immutably patch a single subject within the grades array. */
function patchSubject(
  prev: ShowcaseGrade[] | null,
  gradeIndex: number,
  subjectIndex: number,
  patch: Partial<ShowcaseGrade['subjects'][number]>
): ShowcaseGrade[] | null {
  if (!prev) return prev;
  const grade = prev[gradeIndex];
  if (!grade || !grade.subjects[subjectIndex]) return prev;
  const next = prev.slice();
  const subjects = grade.subjects.slice();
  subjects[subjectIndex] = { ...subjects[subjectIndex], ...patch };
  next[gradeIndex] = { ...grade, subjects };
  return next;
}

/**
 * Roll a unit's subskill statuses up to a single unit status for node tinting.
 * Returns undefined when the knowledge graph isn't loaded (or empty) so the node
 * stays accent-colored rather than falsely reading "not started".
 */
function rollupStatus(
  subskillIds: string[],
  kg: Map<string, KnowledgeGraphNode> | undefined
): string | undefined {
  if (!kg || kg.size === 0 || subskillIds.length === 0) return undefined;
  const statuses = subskillIds.map((id) => kg.get(id)?.status ?? 'not_started');
  if (statuses.every(isMasteredStatus)) return 'mastered';
  if (statuses.some((s) => s === 'frontier')) return 'frontier';
  if (statuses.some((s) => isMasteredStatus(s) || s === 'in_progress' || s === 'in_review'))
    return 'in_progress';
  if (statuses.every((s) => s === 'locked')) return 'locked';
  return 'not_started';
}

interface StudentCurriculumMap {
  /** Wheel data for CurriculumShowcase (units + mastery tint fill in as grades load). */
  grades: ShowcaseGrade[] | null;
  /** Index into `grades` for the student's own grade — where the wheel opens. */
  studentGradeIndex: number;
  loading: boolean;
  error: string | null;
  /** Ensure a grade's unit titles are loaded (called on wheel selection). */
  loadGrade: (gradeIndex: number) => void;
  /** Build + tint the knowledge graph for one subject (called on subject selection). */
  loadSubjectGraph: (gradeIndex: number, subjectIndex: number) => void;
  /** Full unit detail (skills → subskills + mastery) for the deep-dive drawer. */
  getUnitDetail: (gradeIndex: number, subjectIndex: number, unitIndex: number) => UnitDetail | null;
}

export function useStudentCurriculumMap(studentId: number): StudentCurriculumMap {
  const { user, userProfile } = useAuth();
  const [grades, setGrades] = useState<ShowcaseGrade[] | null>(null);
  const [studentGradeIndex, setStudentGradeIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-index raw metadata (subjects + a load guard so each grade fetches once).
  const metaRef = useRef<{ rawGrade: string; subjects: SubjectInfo[] }[]>([]);
  // gradeIndex → in-flight/settled curriculum load, so a grade's units fetch once
  // and dependents (per-subject graph tinting) can await it.
  const gradeLoadRef = useRef<Map<number, Promise<void>>>(new Map());
  // "gradeIndex:subjectIndex" for subjects whose knowledge graph has been kicked
  // off — the heavy per-subject graph build runs at most once, and only for the
  // subject the student is actually looking at.
  const subjectGraphRef = useRef<Set<string>>(new Set());
  // Full units per "gradeIndex:subjectIndex", for the deep-dive drawer.
  const fullUnitsRef = useRef<Map<string, { subject: string; units: CurriculumUnit[] }>>(new Map());
  // Knowledge-graph nodes per subject name (shared across grades; a subject's DAG
  // spans all grades), keyed subskill_id → node.
  const kgRef = useRef<Map<string, Map<string, KnowledgeGraphNode>>>(new Map());

  // Fetch (and cache) a subject's knowledge-graph nodes as a subskill_id map.
  const ensureKnowledgeGraph = useCallback(
    async (subjectName: string): Promise<Map<string, KnowledgeGraphNode>> => {
      const existing = kgRef.current.get(subjectName);
      if (existing) return existing;
      const map = new Map<string, KnowledgeGraphNode>();
      try {
        const kg = await analyticsApi.getKnowledgeGraphProgress(studentId, {
          subject: subjectName,
          includeNodes: true,
        });
        for (const node of kg.nodes ?? []) map.set(node.subskill_id, node);
      } catch {
        // No graph for this subject (or access denied) — cache the empty map so
        // we don't refetch; nodes simply stay accent-colored.
      }
      kgRef.current.set(subjectName, map);
      return map;
    },
    [studentId]
  );

  // Load a grade's curriculum (unit titles only) — fast, and cached so it fetches
  // once. The slow per-subject knowledge-graph builds are deferred to
  // loadSubjectGraph so we never build all 4 subjects' graphs at once (which
  // saturated the dev backend's event loop and stalled every other request).
  const loadGrade = useCallback((gradeIndex: number): Promise<void> => {
    const existing = gradeLoadRef.current.get(gradeIndex);
    if (existing) return existing;
    const meta = metaRef.current[gradeIndex];
    if (!meta) return Promise.resolve();

    const p = (async () => {
      await Promise.all(
        meta.subjects.map(async (s, subjectIndex) => {
          const lookup = s.subject_id ?? s.subject_name;
          try {
            const data = (await authApi.getSubjectCurriculum(lookup, s.grade ?? meta.rawGrade)) as {
              curriculum: CurriculumUnit[];
            };
            const units = data?.curriculum ?? [];
            fullUnitsRef.current.set(`${gradeIndex}:${subjectIndex}`, { subject: s.subject_name, units });
            const shown = units.slice(0, 4);
            setGrades((prev) =>
              patchSubject(prev, gradeIndex, subjectIndex, {
                units: shown.map((u) => u.title).filter(Boolean),
                total: units.length,
              })
            );
          } catch {
            /* leave this subject empty; the wheel still works */
          }
        })
      );
    })();

    gradeLoadRef.current.set(gradeIndex, p);
    return p;
  }, []);

  // Build (and tint from) the knowledge graph for ONE subject — the one the
  // student is currently viewing. Kicked off on subject/grade selection so at
  // most one heavy graph build is in flight at a time, on demand.
  const loadSubjectGraph = useCallback(
    async (gradeIndex: number, subjectIndex: number) => {
      const key = `${gradeIndex}:${subjectIndex}`;
      if (subjectGraphRef.current.has(key)) return;
      const meta = metaRef.current[gradeIndex];
      const s = meta?.subjects[subjectIndex];
      if (!s) return;
      subjectGraphRef.current.add(key);

      // Unit titles must exist before we can roll subskill statuses up onto them.
      await loadGrade(gradeIndex);
      try {
        const kg = await ensureKnowledgeGraph(s.subject_name);
        if (kg.size === 0) return;
        const stored = fullUnitsRef.current.get(key);
        if (!stored) return;
        const unitStatus = stored.units
          .slice(0, 4)
          .map((u) => rollupStatus((u.skills ?? []).flatMap((sk) => sk.subskills.map((ss) => ss.id)), kg) ?? '');
        if (unitStatus.some(Boolean)) {
          setGrades((prev) => patchSubject(prev, gradeIndex, subjectIndex, { unitStatus }));
        }
      } catch {
        // No tint for this subject — units still render. Drop the guard so a
        // later re-selection can retry the build.
        subjectGraphRef.current.delete(key);
      }
    },
    [ensureKnowledgeGraph, loadGrade]
  );

  const getUnitDetail = useCallback(
    (gradeIndex: number, subjectIndex: number, unitIndex: number): UnitDetail | null => {
      const stored = fullUnitsRef.current.get(`${gradeIndex}:${subjectIndex}`);
      if (!stored) return null;
      const unit = stored.units[unitIndex];
      if (!unit) return null;
      const kg = kgRef.current.get(stored.subject);
      const hasKg = !!kg && kg.size > 0;
      return {
        id: unit.id,
        title: unit.title,
        subject: stored.subject,
        skills: (unit.skills ?? []).map((sk) => ({
          id: sk.id,
          description: sk.description,
          subskills: sk.subskills.map((ss) => {
            const node = kg?.get(ss.id);
            return {
              id: ss.id,
              description: ss.description,
              status: node?.status ?? (hasKg ? 'not_started' : 'unknown'),
              gate: node?.current_gate ?? 0,
              theta: node?.theta ?? null,
            };
          }),
        })),
      };
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = (await authApi.getSubjects()) as (string | SubjectInfo)[];
        const normalized: SubjectInfo[] = (Array.isArray(result) ? result : []).map((s) =>
          typeof s === 'string' ? { subject_name: s } : s
        );

        // Group subjects by grade, keyed by the CANONICAL grade order so that
        // distinct raw strings for the same grade (e.g. "5" and "Grade 5") merge
        // into one wheel token instead of appearing twice. Within a grade, dedupe
        // subjects by name. Each subject keeps its own raw grade for fetching.
        const studentGrade = userProfile?.grade_level ?? 'K';
        const byGrade = new Map<number, SubjectInfo[]>();
        for (const s of normalized) {
          const rawGrade = s.grade ?? studentGrade;
          const key = gradeOrder(rawGrade);
          const list = byGrade.get(key) ?? [];
          const withGrade: SubjectInfo = { ...s, grade: rawGrade };
          if (!list.some((x) => x.subject_name === withGrade.subject_name)) list.push(withGrade);
          byGrade.set(key, list);
        }

        const sortedOrders = Array.from(byGrade.keys()).sort((a, b) => a - b);
        // Representative raw grade string per canonical group (for labels).
        const sortedGrades = sortedOrders.map((ord) => byGrade.get(ord)![0].grade ?? studentGrade);
        if (sortedOrders.length === 0) {
          if (!cancelled) {
            setError('No curriculum available.');
            setGrades([]);
          }
          return;
        }

        const showcaseGrades: ShowcaseGrade[] = sortedOrders.map((ord, i) => {
          const raw = sortedGrades[i];
          const subjects = byGrade.get(ord)!;
          return {
            label: gradeShortLabel(raw),
            full: gradeFullLabel(raw),
            subjects: subjects.map((s) => {
              const { accent, icon } = subjectVisual(s.subject_name);
              return { name: s.subject_name, accent, icon, units: [], total: 0 };
            }),
          };
        });

        metaRef.current = sortedOrders.map((ord, i) => ({
          rawGrade: sortedGrades[i],
          subjects: byGrade.get(ord)!,
        }));

        // Land the wheel on the student's grade (by canonical grade order).
        let idx = sortedOrders.indexOf(gradeOrder(studentGrade));
        if (idx < 0) idx = 0;

        if (cancelled) return;
        setGrades(showcaseGrades);
        setStudentGradeIndex(idx);
        setLoading(false);

        // Eagerly load the student's own grade so it's populated on first paint.
        loadGrade(idx);
      } catch {
        if (!cancelled) {
          setError('Failed to load curriculum.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, userProfile?.grade_level, loadGrade]);

  return useMemo(
    () => ({ grades, studentGradeIndex, loading, error, loadGrade, loadSubjectGraph, getUnitDetail }),
    [grades, studentGradeIndex, loading, error, loadGrade, loadSubjectGraph, getUnitDetail]
  );
}
