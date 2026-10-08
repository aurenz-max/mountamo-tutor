import { describe, expect, it } from 'vitest';
import type { ProgressReportResponse } from '@/lib/studentAnalyticsAPI';
import { buildReportText, isAboveGrade } from './reportText';

const week = (accuracy: number | null, answers = 10) => ({
  week_of: '2026-09-28', minutes: answers ? 30 : 0, active_days: answers ? 2 : 0, answers,
  accuracy, checks_passed: 1, mastered: 0,
});

function report(accuracies: Array<number | null>, over: Partial<ProgressReportResponse> = {}): ProgressReportResponse {
  const weeks = accuracies.map((a) => week(a, a == null ? 0 : 10));
  const active = weeks.filter((w) => w.answers);
  return {
    student_id: 1, grade: 'K', as_of: '2026-10-07', interests: [], first_activity: null, last_activity: null,
    recent: { days: 30, active_days: 5, minutes: 60, answers: 40, mastered: 1 },
    accuracy_recent_weeks: active.length ? Math.round(active.reduce((s, w) => s + (w.accuracy ?? 0), 0) / active.length) : null,
    typical_session_minutes: 6, weeks,
    grade_map: [{ subject: 'MATHEMATICS', name: 'Math', total: 10, mastered: 2, learning: 3, tried: 0,
      units: [{ unit_id: 'U1', title: 'Counting and Cardinality', total: 4, mastered: 2, learning: 1, skills: [] }] }],
    subskill_stats: {},
    recent_mastered: [], in_progress: [], needs_practice: [], misconceptions: [],
    time_by_subject: [], grade_mix: [{ grade: 'K', answers: 60 }, { grade: '1', answers: 40 }],
    favorite_activities: [], interest_answers: 0,
    evidence: { answers: 100, sessions: 10, active_days: 8, excluded_burst_answers: 0, burst_days: [] },
    ...over,
  };
}

describe('buildReportText', () => {
  it('calls the work too easy only when most recent weeks sit above the learning band', () => {
    const t = buildReportText(report([95, 98, 92, 100]), 'Ava');
    expect(t.learningHeadline).toContain('almost always right');
    expect(t.shortAnswer).toContain('harder lessons');
  });

  it('never tells a struggling learner they are ready for harder material', () => {
    const t = buildReportText(report([55, 60, 62, 58]), 'Ava');
    expect(t.learningHeadline).toContain('hard right now');
    expect(t.shortAnswer).not.toContain('harder lessons');
    expect(t.learningLede).not.toContain('ready for harder');
  });

  it('describes in-band work as the right difficulty', () => {
    expect(buildReportText(report([78, 80, 74, 82]), 'Ava').learningHeadline).toContain('right difficulty');
  });

  it('gives no difficulty verdict from too little practice', () => {
    const t = buildReportText(report([100]), 'Ava');
    expect(t.shortAnswer).not.toContain('harder lessons');
    expect(t.shortAnswer).toContain('not enough recent practice');
    expect(t.learningHeadline).toContain('too little recent work');
  });

  it('counts only above-grade answers as working ahead', () => {
    const t = buildReportText(report([80]), 'Ava');
    expect(t.aheadShare).toBe(40);
    expect(isAboveGrade('K', 'K')).toBe(false);
    expect(isAboveGrade('1', 'K')).toBe(true);
    expect(isAboveGrade(null, 'K')).toBe(false);
  });

  it('says no struggles when nothing is recorded, and capitalizes a practice-only headline', () => {
    expect(buildReportText(report([80]), 'Ava').helpHeadline).toBe('No struggles recorded');
    const row = { subskill_id: 'X', description: 'x', unit: null, subject: null, grade: 'K', gate: 1,
      answers: 4, accuracy: 50, mastered_on: null, last_seen: null };
    expect(buildReportText(report([80], { needs_practice: [row] }), 'Ava').helpHeadline)
      .toBe('One skill that needs more practice');
  });
});
