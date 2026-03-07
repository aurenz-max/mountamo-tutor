import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GateProgressDots } from '../PlannerDashboard/MasteryComponents';
import type { StudentMetrics, SkillData, SubskillData } from '@/lib/studentAnalyticsAPI';
import { pct, masteryColor, gateStatusBadge, isRetestOverdue } from './helpers';
import { MasteryBar } from './shared';

export function CurriculumPanel({ metrics }: { metrics: StudentMetrics }) {
  const units = metrics.hierarchical_data;

  if (!units.length) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-8 text-center text-slate-500">No curriculum data available</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <Accordion type="multiple" className="space-y-2">
        {units.map(unit => (
          <AccordionItem key={unit.unit_id} value={unit.unit_id} className="border-0">
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors [&[data-state=open]]:bg-white/5">
                <div className="flex-1 text-left space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-100">{unit.unit_title}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{unit.attempted_skills}/{unit.total_skills} skills</span>
                      <span>{unit.attempt_count} attempts</span>
                      <span className={`font-bold text-${masteryColor(unit.mastery)}-400`}>
                        {pct(unit.mastery)}
                      </span>
                    </div>
                  </div>
                  <MasteryBar value={unit.mastery} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <SkillsList skills={unit.skills} />
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function SkillsList({ skills }: { skills: SkillData[] }) {
  return (
    <Accordion type="multiple" className="space-y-1 mt-2">
      {skills.map(skill => (
        <AccordionItem key={skill.skill_id} value={skill.skill_id} className="border-0">
          <div className="rounded-lg bg-slate-800/50 border border-white/5 overflow-hidden">
            <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-white/5 transition-colors text-sm [&[data-state=open]]:bg-white/5">
              <div className="flex-1 text-left space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-200 text-xs">{skill.skill_description}</span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-shrink-0">
                    <span>{skill.attempted_subskills}/{skill.total_subskills}</span>
                    <span>{skill.attempt_count} att</span>
                    <span className={`font-bold text-${masteryColor(skill.mastery)}-400`}>
                      {pct(skill.mastery)}
                    </span>
                  </div>
                </div>
                <MasteryBar value={skill.mastery} className="h-1.5" />
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-2">
              <SubskillList subskills={skill.subskills} />
            </AccordionContent>
          </div>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function SubskillList({ subskills }: { subskills: SubskillData[] }) {
  return (
    <div className="space-y-1 mt-1">
      {subskills.map(ss => {
        const gate = ss.current_gate ?? 0;
        const completionPct = Math.round((ss.completion_pct ?? 0) * 100);
        const status = gateStatusBadge(ss);
        const overdue = isRetestOverdue(ss.next_retest_eligible);
        const passes = ss.passes ?? 0;
        const fails = ss.fails ?? 0;

        return (
          <div key={ss.subskill_id}
            className="flex items-center gap-3 px-3 py-2 rounded-md bg-slate-900/60 border border-white/5">
            {/* Gate progress dots */}
            <GateProgressDots gate={gate} />
            {/* Description + completion bar */}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-300 truncate">{ss.subskill_description}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0 font-mono">{completionPct}%</span>
              </div>
            </div>
            {/* Pass/fail stats (gate >= 2 only) */}
            {gate >= 2 && (
              <div className="text-right flex-shrink-0 w-14">
                <div className="text-[10px] text-slate-400 font-mono">{passes}P/{fails}F</div>
              </div>
            )}
            {/* Stats */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-slate-500">{ss.attempt_count} att</span>
              {overdue && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-red-500/20 border-red-500/30 text-red-400">
                  Retest due
                </span>
              )}
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${status.bg} ${status.text}`}>
                {status.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
