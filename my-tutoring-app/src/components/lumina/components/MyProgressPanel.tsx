'use client';

/**
 * MyProgressPanel — the student-facing "My Progress" view opened from the
 * header user menu (StudentBadge → "My activity").
 *
 * Composition, not new UI:
 *   - "Snapshot" header card reads the canonical profile endpoint in one call
 *     (StudentProfileSummary — level/XP/streak, weekly activity, subject mastery).
 *   - "Your journey" hero reuses the SAME curriculum screen shown on the public
 *     home page (`CurriculumShowcase`), now driven by REAL curriculum-service
 *     data for the signed-in student's grade and lit up with their mastery from
 *     the knowledge graph (useStudentCurriculumMap). The wheel opens on their
 *     grade; other grades load on click; clicking a unit opens a deep-dive.
 *   - Below it, the existing StudentActivityPanel (auto-scoped to the signed-in
 *     student, dev controls hidden) shows XP/level/streak + attempt history.
 */

import React, { useState } from 'react';
import { CurriculumShowcase } from '@/components/landing/LandingPrimitiveDemos';
import { useStudentCurriculumMap, type UnitDetail } from '../hooks/useStudentCurriculumMap';
import { LuminaSectionLabel, LuminaBadge } from '../ui';
import ForecastTimeline from './ForecastTimeline';
import StudentActivityPanel from './StudentActivityPanel';
import StudentProfileSummary from './StudentProfileSummary';
import UnitSkillsPanel from './UnitSkillsPanel';

/** The curriculum-map hero, driven by the student's real grade + curriculum + mastery. */
const YourJourney: React.FC<{ studentId: number }> = ({ studentId }) => {
  const { grades, studentGradeIndex, loading, error, loadGrade, loadSubjectGraph, getUnitDetail } =
    useStudentCurriculumMap(studentId);
  const [unitDetail, setUnitDetail] = useState<UnitDetail | null>(null);

  return (
    <div>
      <div className="flex items-center gap-3">
        <LuminaSectionLabel accent="emerald">Your journey</LuminaSectionLabel>
        <LuminaBadge accent="cyan">Tap a unit to dive in</LuminaBadge>
      </div>
      <p className="mt-2 mb-3 max-w-lg text-sm text-slate-400">
        Your grade&apos;s curriculum, straight from Lumina&apos;s live map — units light up as
        you master them. Spin the wheel to explore other grades, or tap a unit for the skills inside.
      </p>

      {loading || !grades ? (
        <div className="h-64 w-full max-w-3xl animate-pulse rounded-2xl border border-white/10 bg-slate-900/40" />
      ) : error && grades.length === 0 ? (
        // Curriculum service unavailable — keep the screen intact with the sample map.
        <div>
          <p className="mb-2 text-xs text-amber-300/80">Showing a sample map — {error}</p>
          <CurriculumShowcase />
        </div>
      ) : (
        <CurriculumShowcase
          grades={grades}
          initialGradeIndex={studentGradeIndex}
          autoTour={false}
          onSelectGrade={loadGrade}
          onSelectSubject={loadSubjectGraph}
          onSelectUnit={(gi, si, ui) => {
            const detail = getUnitDetail(gi, si, ui);
            if (detail) setUnitDetail(detail);
          }}
        />
      )}

      <UnitSkillsPanel detail={unitDetail} studentId={studentId} onClose={() => setUnitDetail(null)} />
    </div>
  );
};

export interface MyProgressPanelProps {
  /** The signed-in student to scope activity to. */
  studentId: number;
  /** Return to the home screen. */
  onBack?: () => void;
}

export default function MyProgressPanel({ studentId, onBack }: MyProgressPanelProps) {
  return (
    <div className="space-y-8 max-w-5xl">
      {onBack && (
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition-colors text-sm"
        >
          &larr; Back
        </button>
      )}

      {/* ── Snapshot — one-call profile read (level/XP/streak + subject mastery) ── */}
      <StudentProfileSummary studentId={studentId} />

      {/* ── Your journey — the same curriculum map as the home page, real data ── */}
      <YourJourney studentId={studentId} />

      {/* ── The road ahead — skill-level forecast (unit ETAs, up-next, drift) ── */}
      <ForecastTimeline studentId={studentId} />

      {/* ── Activity — XP/level/streak + prior lessons (real data, auto-scoped) ── */}
      <StudentActivityPanel
        defaultStudentId={studentId}
        autoLoad
        hideControls
        title="Activity"
        description="Your XP, level, and streak — plus every lesson you've completed. Tap a row to see how it went."
      />
    </div>
  );
}
