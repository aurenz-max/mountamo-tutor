import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GateProgressDots } from '../PlannerDashboard/MasteryComponents';
import type { KnowledgeGraphProgressResponse, KnowledgeGraphNode } from '@/lib/studentAnalyticsAPI';
import { MasteryBar } from './shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A skill-level group derived from subskill nodes */
interface SkillGroup {
  skill_id: string;
  /** Best description available (from first node) */
  label: string;
  nodes: KnowledgeGraphNode[];
  /** Fraction of subskills at gate 4 (mastered/inferred) */
  completionRatio: number;
  /** Highest gate across all subskills */
  maxGate: number;
  /** Whether any subskill is frontier or in_progress */
  isFrontier: boolean;
}

type GroupCategory = 'frontier' | 'in_review' | 'mastered' | 'not_started' | 'locked';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NODE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  mastered:    { bg: 'bg-emerald-500/20 border-emerald-500/30', text: 'text-emerald-400', label: 'Mastered' },
  inferred:    { bg: 'bg-teal-500/20 border-teal-500/30', text: 'text-teal-400', label: 'Inferred' },
  in_review:   { bg: 'bg-cyan-500/20 border-cyan-500/30', text: 'text-cyan-400', label: 'In Review' },
  in_progress: { bg: 'bg-blue-500/20 border-blue-500/30', text: 'text-blue-400', label: 'In Progress' },
  frontier:    { bg: 'bg-amber-500/20 border-amber-500/30', text: 'text-amber-400', label: 'Frontier' },
  not_started: { bg: 'bg-slate-500/20 border-slate-500/30', text: 'text-slate-400', label: 'Not Started' },
  locked:      { bg: 'bg-slate-700/20 border-slate-700/30', text: 'text-slate-600', label: 'Locked' },
};

const CATEGORY_META: Record<GroupCategory, { label: string; color: string; description: string }> = {
  frontier:    { label: 'Now Crafting', color: 'amber', description: 'Skills with unlocked subskills ready to learn' },
  in_review:   { label: 'Retesting',   color: 'cyan',  description: 'Skills in the review / retest cycle' },
  mastered:    { label: 'Completed',    color: 'emerald', description: 'All subskills at gate 4 or inferred' },
  not_started: { label: 'Up Next',      color: 'slate', description: 'Unlocked but not yet attempted' },
  locked:      { label: 'Locked',       color: 'slate', description: 'Prerequisites not yet met' },
};

function groupNodesBySkill(
  nodes: KnowledgeGraphNode[],
  skillLabels: Record<string, string>,
): SkillGroup[] {
  const map = new Map<string, KnowledgeGraphNode[]>();
  for (const n of nodes) {
    const list = map.get(n.skill_id) || [];
    list.push(n);
    map.set(n.skill_id, list);
  }

  return Array.from(map.entries()).map(([skill_id, skillNodes]) => {
    const mastered = skillNodes.filter(n =>
      n.status === 'mastered' || n.status === 'inferred' || n.current_gate === 4
    ).length;
    const completionRatio = skillNodes.length > 0 ? mastered / skillNodes.length : 0;
    const maxGate = Math.max(...skillNodes.map(n => n.current_gate));
    const isFrontier = skillNodes.some(n =>
      n.status === 'frontier' || n.status === 'in_progress'
    );

    const label = skillLabels[skill_id] || skill_id;

    return { skill_id, label, nodes: skillNodes, completionRatio, maxGate, isFrontier };
  });
}

function categorizeSkillGroup(g: SkillGroup): GroupCategory {
  if (g.completionRatio === 1) return 'mastered';
  if (g.isFrontier) return 'frontier';
  if (g.nodes.some(n => n.status === 'in_review')) return 'in_review';
  if (g.nodes.every(n => n.status === 'locked')) return 'locked';
  return 'not_started';
}

function sortSubskillNodes(nodes: KnowledgeGraphNode[]): KnowledgeGraphNode[] {
  const statusOrder: Record<string, number> = {
    in_progress: 0, frontier: 1, in_review: 2, not_started: 3,
    mastered: 4, inferred: 5, locked: 6,
  };
  return [...nodes].sort((a, b) =>
    (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Compact summary ribbon replacing 8 stat pills */
function SummaryRibbon({ data }: { data: KnowledgeGraphProgressResponse }) {
  const total = data.total_nodes;
  const masteredTotal = data.mastered_direct + data.mastered_inferred;
  const pct = total > 0 ? Math.round((masteredTotal / total) * 100) : 0;

  const stats = [
    { label: 'Mastered', value: masteredTotal, color: 'text-emerald-400' },
    { label: 'In Progress', value: data.in_progress, color: 'text-blue-400' },
    { label: 'In Review', value: data.in_review, color: 'text-cyan-400' },
    { label: 'Frontier', value: data.frontier_node_ids.length, color: 'text-amber-400' },
    { label: 'Locked', value: data.locked, color: 'text-slate-500' },
  ];

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{pct}%</span>
            <span className="text-xs text-slate-500">mastered ({masteredTotal}/{total} subskills)</span>
          </div>
          {data.total_leapfrogs > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-teal-400">{data.total_leapfrogs} leapfrogs</span>
              {data.leapfrog_retest_pass_rate != null && (
                <span className="text-slate-500">{Math.round(data.leapfrog_retest_pass_rate * 100)}% retest</span>
              )}
            </div>
          )}
        </div>
        <MasteryBar value={total > 0 ? masteredTotal / total : 0} />
        <div className="flex items-center gap-4 mt-3">
          {stats.map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
              <span className="text-[10px] text-slate-600 uppercase tracking-wider">{s.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** A single subskill row inside a skill recipe card */
function SubskillIngredient({ node }: { node: KnowledgeGraphNode }) {
  const style = NODE_STATUS_STYLES[node.status] || NODE_STATUS_STYLES.not_started;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-slate-900/60 border border-white/5">
      <GateProgressDots gate={node.current_gate} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-300 truncate">{node.description}</div>
        <div className="text-[10px] text-slate-600 font-mono">{node.subskill_id}</div>
      </div>
      {node.theta != null && (
        <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
          &theta; {node.theta.toFixed(2)}
        </span>
      )}
      {node.inferred_from && (
        <span className="text-[10px] text-teal-500 flex-shrink-0">inferred</span>
      )}
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    </div>
  );
}

/** A skill "recipe card" — the gear piece being crafted */
function SkillRecipeCard({ group }: { group: SkillGroup }) {
  const completedCount = group.nodes.filter(n =>
    n.status === 'mastered' || n.status === 'inferred'
  ).length;
  const total = group.nodes.length;
  const sorted = sortSubskillNodes(group.nodes);

  return (
    <div className="rounded-lg bg-slate-800/50 border border-white/5 overflow-hidden">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors [&[data-state=open]]:bg-white/5">
        <div className="flex-1 text-left space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-200">{group.label}</span>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-shrink-0">
              <span>{completedCount}/{total} subskills</span>
              <span className={`font-bold ${
                group.completionRatio >= 0.8 ? 'text-emerald-400' :
                group.completionRatio >= 0.3 ? 'text-amber-400' : 'text-slate-400'
              }`}>
                {Math.round(group.completionRatio * 100)}%
              </span>
            </div>
          </div>
          <MasteryBar value={group.completionRatio} className="h-1.5" />
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-3">
        <div className="space-y-1 mt-1">
          {sorted.map(node => (
            <SubskillIngredient key={node.subskill_id} node={node} />
          ))}
        </div>
      </AccordionContent>
    </div>
  );
}

/** A category section with accordion skill cards inside */
function CategorySection({
  category,
  groups,
  defaultOpen,
}: {
  category: GroupCategory;
  groups: SkillGroup[];
  defaultOpen?: boolean;
}) {
  const meta = CATEGORY_META[category];
  const [open, setOpen] = useState(defaultOpen ?? false);

  if (groups.length === 0) return null;

  const totalSubskills = groups.reduce((sum, g) => sum + g.nodes.length, 0);

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full bg-${meta.color}-400`} />
          <span className="text-sm font-semibold text-slate-100">{meta.label}</span>
          <span className="text-xs text-slate-500">
            {groups.length} skill{groups.length !== 1 ? 's' : ''} &middot; {totalSubskills} subskills
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <CardContent className="pt-0 pb-3">
          <Accordion type="multiple" className="space-y-1">
            {groups.map(g => (
              <AccordionItem key={g.skill_id} value={g.skill_id} className="border-0">
                <SkillRecipeCard group={g} />
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function KnowledgeGraphPanel({
  data,
  subject,
  subjects,
  skillLabels,
  onSubjectChange,
  onMount,
}: {
  data: KnowledgeGraphProgressResponse | null;
  subject: string;
  subjects: string[];
  skillLabels: Record<string, string>;
  onSubjectChange: (s: string) => void;
  onMount?: () => void;
}) {
  useEffect(() => { onMount?.(); }, [onMount]);

  const categorized = useMemo(() => {
    if (!data?.nodes?.length) return null;

    const skillGroups = groupNodesBySkill(data.nodes, skillLabels);
    const buckets: Record<GroupCategory, SkillGroup[]> = {
      frontier: [], in_review: [], mastered: [], not_started: [], locked: [],
    };
    for (const g of skillGroups) {
      buckets[categorizeSkillGroup(g)].push(g);
    }

    // Sort frontier by lowest completion first (most work to do)
    buckets.frontier.sort((a, b) => a.completionRatio - b.completionRatio);
    // Sort mastered by completion desc
    buckets.mastered.sort((a, b) => b.completionRatio - a.completionRatio);

    return buckets;
  }, [data, skillLabels]);

  return (
    <div className="space-y-4">
      {/* Subject selector */}
      {subjects.length > 0 ? (
        <div className="flex gap-1 p-1 rounded-lg bg-slate-900/60 border border-white/5 w-fit">
          {subjects.map(s => (
            <button
              key={s}
              onClick={() => onSubjectChange(s)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                subject === s ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-500">Loading subjects...</div>
      )}

      {!data ? (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-8 text-center text-slate-500">
            Select a subject to load knowledge graph data.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Compact summary ribbon */}
          <SummaryRibbon data={data} />

          {categorized ? (
            <>
              {/* Frontier = "Now Crafting" — always open */}
              <CategorySection category="frontier" groups={categorized.frontier} defaultOpen />

              {/* In review */}
              <CategorySection category="in_review" groups={categorized.in_review} />

              {/* Up next (not started but unlocked) */}
              <CategorySection category="not_started" groups={categorized.not_started} />

              {/* Mastered — collapsed by default */}
              <CategorySection category="mastered" groups={categorized.mastered} />

              {/* Locked — collapsed by default */}
              <CategorySection category="locked" groups={categorized.locked} />
            </>
          ) : (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="py-8 text-center text-slate-500">
                No node data available. Try loading with node details enabled.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
