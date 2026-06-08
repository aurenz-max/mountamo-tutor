'use client';

/**
 * DemonstratedSkillDetails — the per-primitive "See details" accordion.
 *
 * Lives inside the completion summary (PhaseSummaryPanel). After a student
 * finishes a primitive and the local "good job" summary appears, this reveals
 * which curriculum skill the backend resolved this attempt to — the one piece
 * of student-facing truth the client cannot self-source on a free-typed lesson.
 *
 * Self-scoping, no prop drilling: primitives stack vertically in a lesson, so
 * several completed panels coexist and "latest skill" would cross-wire them.
 * Instead of threading an attemptId through 200+ PhaseSummaryPanel call sites,
 * each accordion CLAIMS the first skill that resolves after it mounts and
 * freezes it. This is unambiguous because a student finishes primitives minutes
 * apart, while the backend resolves a skill in ~1-2s — the next skill to land
 * after this panel appears is always this primitive's. An explicit `attemptId`
 * can still be passed to override the self-discovery.
 *
 * Renders nothing until its skill resolves — or never, in tester harnesses with
 * no EvaluationProvider, or when the topic→curriculum mapping was low-confidence.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useEvaluationContext } from '../evaluation';
import type { DemonstratedSkill } from '../evaluation';
import {
  LuminaAccordion,
  LuminaAccordionItem,
  LuminaBadge,
  accentText,
  type LuminaAccent,
} from '../ui';

function humanize(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreAccent(score: number): LuminaAccent {
  if (score >= 80) return 'emerald';
  if (score >= 50) return 'amber';
  return 'rose';
}

export interface DemonstratedSkillDetailsProps {
  /** Optional explicit attempt to show. When omitted, the accordion self-claims
   *  the first skill that resolves after it mounts (the common case). */
  attemptId?: string;
  className?: string;
}

export const DemonstratedSkillDetails: React.FC<DemonstratedSkillDetailsProps> = ({
  attemptId,
  className,
}) => {
  const context = useEvaluationContext();
  const skills = context?.demonstratedSkills;

  // Self-discovery: snapshot the skills that already existed when we mounted
  // (earlier primitives'), then claim the first new one that appears — and
  // freeze it so a later primitive's skill never replaces ours.
  const baselineRef = useRef<Set<string> | null>(null);
  const [claimedId, setClaimedId] = useState<string | null>(null);

  useEffect(() => {
    if (attemptId || !skills) return; // explicit id given, or no provider
    if (baselineRef.current === null) {
      baselineRef.current = new Set(skills.map((s) => s.attemptId));
    }
    if (!claimedId) {
      const fresh = skills.find((s) => !baselineRef.current!.has(s.attemptId));
      if (fresh) setClaimedId(fresh.attemptId);
    }
  }, [attemptId, skills, claimedId]);

  // No provider (tester harness) → nothing to show.
  if (!skills) return null;

  // Backend mapping hasn't resolved yet (or came back low-confidence). Stay
  // silent rather than show an empty shell — the accordion appears the moment
  // the skill lands in context.
  const targetId = attemptId ?? claimedId;
  if (!targetId) return null;

  const skill: DemonstratedSkill | undefined = skills.find((s) => s.attemptId === targetId);
  if (!skill) return null;

  return (
    <LuminaAccordion type="single" collapsible className={className}>
      <LuminaAccordionItem
        value="demonstrated"
        accent="cyan"
        icon={<span aria-hidden>{'\u{1F9ED}'}</span>}
        label="See what you demonstrated"
      >
        <div className="space-y-3">
          {/* Curriculum path: Subject › Unit › Skill › Subskill. The breadcrumb
              carries Subject + Unit; the skill is the bold headline and the
              subskill the detail line below. Unit segment is omitted on the
              generation/fallback path, which resolves no unit. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            <span>{humanize(skill.subject)}</span>
            {skill.unitTitle && (
              <>
                <span aria-hidden className="text-slate-600">{'›'}</span>
                <span className="text-slate-400 normal-case tracking-normal">{skill.unitTitle}</span>
              </>
            )}
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-slate-100 font-semibold">{skill.skillDescription}</div>
              {skill.subskillDescription && (
                <div className="text-sm text-slate-400 leading-snug mt-0.5">
                  {skill.subskillDescription}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={`text-lg font-bold ${accentText[scoreAccent(skill.score)]}`}>
                {Math.round(skill.score)}%
              </span>
              <LuminaBadge accent={skill.success ? 'emerald' : 'amber'}>
                {skill.success ? 'demonstrated' : 'practiced'}
              </LuminaBadge>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            This activity counted toward your progress on this curriculum skill.
          </p>
        </div>
      </LuminaAccordionItem>
    </LuminaAccordion>
  );
};

export default DemonstratedSkillDetails;
