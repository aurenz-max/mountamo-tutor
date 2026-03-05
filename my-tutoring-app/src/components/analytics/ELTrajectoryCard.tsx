"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  Target,
  Loader2,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import type { SkillAbility, ContextualPhase } from "@/types/calibration";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ELTrajectoryCardProps {
  abilities: SkillAbility[];
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Phase styling
// ---------------------------------------------------------------------------

const PHASE_CONFIG: Record<
  ContextualPhase,
  { bg: string; text: string; border: string; label: string }
> = {
  first_assessment: {
    bg: "bg-blue-500/10",
    text: "text-blue-300",
    border: "border-blue-500/20",
    label: "Baseline",
  },
  early_growth: {
    bg: "bg-green-500/10",
    text: "text-green-300",
    border: "border-green-500/20",
    label: "Growing",
  },
  steady_climb: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    border: "border-emerald-500/20",
    label: "Climbing",
  },
  plateau: {
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    border: "border-amber-500/20",
    label: "Plateau",
  },
  near_target: {
    bg: "bg-purple-500/10",
    text: "text-purple-300",
    border: "border-purple-500/20",
    label: "Almost There",
  },
  mastery_achieved: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-300",
    border: "border-yellow-500/20",
    label: "Mastered",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return ts;
  }
}

function computeAverageEL(abilities: SkillAbility[]): number {
  if (abilities.length === 0) return 0;
  const sum = abilities.reduce((acc, a) => acc + a.earned_level, 0);
  return Math.round((sum / abilities.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkillTrajectoryChart({ ability }: { ability: SkillAbility }) {
  const chartData = ability.theta_history.map((pt) => ({
    date: formatTimestamp(pt.timestamp),
    el: pt.earned_level,
    theta: pt.theta,
    score: pt.score,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        No data yet
      </div>
    );
  }

  // Single point — show a simple stat instead of a line
  if (chartData.length === 1) {
    return (
      <div className="flex items-center justify-center h-32 gap-2">
        <Target className="h-5 w-5 text-blue-400" />
        <span className="text-slate-300 text-sm">
          Starting Level:{" "}
          <span className="text-white font-semibold">
            {chartData[0].el.toFixed(1)}
          </span>
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <YAxis
          domain={[0, 10]}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          width={30}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "#e2e8f0",
            fontSize: "12px",
          }}
          formatter={(value: number) => [value.toFixed(1), "Earned Level"]}
        />
        <ReferenceLine
          y={9}
          stroke="rgba(168,85,247,0.4)"
          strokeDasharray="6 4"
          label={{
            value: "Mastery",
            fill: "#a855f7",
            fontSize: 10,
            position: "insideTopRight",
          }}
        />
        <Line
          type="monotone"
          dataKey="el"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: "#3b82f6", strokeWidth: 0, r: 3 }}
          activeDot={{ fill: "#60a5fa", r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ContextualMessageBanner({ ability }: { ability: SkillAbility }) {
  const msg = ability.contextual_message;
  if (!msg) return null;

  const phase = msg.phase as ContextualPhase;
  const config = PHASE_CONFIG[phase] ?? PHASE_CONFIG.first_assessment;

  return (
    <div
      className={`mt-3 px-3 py-2 rounded-lg border ${config.bg} ${config.border}`}
    >
      <p className={`text-sm ${config.text}`}>{msg.message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ELTrajectoryCard({
  abilities,
  loading,
  error,
}: ELTrajectoryCardProps) {
  // Loading state
  if (loading) {
    return (
      <Card className="mt-6 backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400 mr-2" />
          <span className="text-slate-400">Loading ability data...</span>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="mt-6 backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="flex items-center justify-center py-12">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <span className="text-slate-400">
            Could not load ability data
          </span>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (abilities.length === 0) {
    return (
      <Card className="mt-6 backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            Earned Level Trajectory
          </CardTitle>
          <CardDescription className="text-slate-400">
            Track your ability growth across skills
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm">
              No ability data yet. Complete some practice sessions to see your
              progress here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgEL = computeAverageEL(abilities);

  return (
    <Card className="mt-6 backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              Earned Level Trajectory
            </CardTitle>
            <CardDescription className="text-slate-400">
              Your ability growth across {abilities.length} skill
              {abilities.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-500">Average EL</p>
              <p className="text-2xl font-bold text-blue-400">
                {avgEL.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="space-y-2">
          {abilities.map((ability) => {
            const msg = ability.contextual_message;
            const phase = msg?.phase as ContextualPhase | undefined;
            const phaseConfig = phase
              ? PHASE_CONFIG[phase]
              : undefined;

            return (
              <AccordionItem
                key={ability.skill_id}
                value={ability.skill_id}
                className="border border-white/5 rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:bg-white/5 [&[data-state=open]]:bg-white/5">
                  <div className="flex items-center justify-between w-full mr-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-200">
                        {ability.skill_id}
                      </span>
                      {phaseConfig && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${phaseConfig.bg} ${phaseConfig.text} ${phaseConfig.border}`}
                        >
                          {phaseConfig.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500">
                        {ability.total_items_seen} items
                      </span>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-sm font-semibold text-blue-400">
                          {ability.earned_level.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <SkillTrajectoryChart ability={ability} />
                  <ContextualMessageBanner ability={ability} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
