'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Beaker, BookOpen, FlaskConical, Bug, Telescope, Zap, Pencil, Film, ClipboardCheck, Cpu, ChevronDown, ChevronRight } from 'lucide-react';
import catalogData from '@/lib/curriculum-authoring/primitive-catalog.json';

interface EvalMode {
  evalMode: string;
  label: string;
  beta: number;
  scaffoldingMode: number;
  challengeTypes: string[];
  description: string;
}

interface PrimitiveEntry {
  id: string;
  domain: string;
  description: string;
  constraints?: string;
  supportsEvaluation: boolean;
  evalModes: EvalMode[];
  hasTutoring: boolean;
}

const DOMAIN_ICONS: Record<string, typeof Beaker> = {
  core: Cpu,
  math: BookOpen,
  engineering: Beaker,
  science: FlaskConical,
  biology: Bug,
  astronomy: Telescope,
  physics: Zap,
  literacy: Pencil,
  media: Film,
  assessment: ClipboardCheck,
};

const DOMAIN_COLORS: Record<string, string> = {
  core: 'bg-gray-100 text-gray-700',
  math: 'bg-blue-100 text-blue-700',
  engineering: 'bg-orange-100 text-orange-700',
  science: 'bg-green-100 text-green-700',
  biology: 'bg-emerald-100 text-emerald-700',
  astronomy: 'bg-purple-100 text-purple-700',
  physics: 'bg-yellow-100 text-yellow-700',
  literacy: 'bg-pink-100 text-pink-700',
  media: 'bg-indigo-100 text-indigo-700',
  assessment: 'bg-red-100 text-red-700',
};

function BetaBadge({ beta }: { beta: number }) {
  let color = 'bg-green-100 text-green-800';
  if (beta >= 4) color = 'bg-red-100 text-red-800';
  else if (beta >= 2.5) color = 'bg-yellow-100 text-yellow-800';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium ${color}`}>
      β {beta.toFixed(1)}
    </span>
  );
}

function ScaffoldBadge({ mode }: { mode: number }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-600">
      S{mode}
    </span>
  );
}

function EvalModeRow({ em }: { em: EvalMode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-gray-50 text-sm">
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        <BetaBadge beta={em.beta} />
        <ScaffoldBadge mode={em.scaffoldingMode} />
      </div>
      <div className="min-w-0">
        <div className="font-medium text-gray-800">
          <code className="text-xs bg-gray-100 px-1 rounded mr-1.5">{em.evalMode}</code>
          {em.label}
        </div>
        {em.description && (
          <div className="text-xs text-gray-500 mt-0.5">{em.description}</div>
        )}
        {em.challengeTypes.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {em.challengeTypes.map(ct => (
              <span key={ct} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                {ct}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PrimitiveCard({ primitive, isExpanded, onToggle }: {
  primitive: PrimitiveEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const DomainIcon = DOMAIN_ICONS[primitive.domain] || Cpu;
  const domainColor = DOMAIN_COLORS[primitive.domain] || 'bg-gray-100 text-gray-700';

  return (
    <div className="border rounded-lg bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="pt-0.5">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-semibold text-gray-900">{primitive.id}</code>
            <Badge variant="outline" className={`text-xs ${domainColor} border-0`}>
              <DomainIcon className="h-3 w-3 mr-1" />
              {primitive.domain}
            </Badge>
            {primitive.supportsEvaluation && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                eval
              </Badge>
            )}
            {primitive.hasTutoring && (
              <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
                tutoring
              </Badge>
            )}
            {primitive.evalModes.length > 0 && (
              <span className="text-xs text-gray-500">
                {primitive.evalModes.length} mode{primitive.evalModes.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {primitive.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{primitive.description}</p>
          )}
        </div>
      </button>

      {isExpanded && primitive.evalModes.length > 0 && (
        <div className="border-t px-3 py-2 bg-gray-50/50">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Eval Modes
          </div>
          <div className="space-y-0.5">
            {primitive.evalModes.map(em => (
              <EvalModeRow key={em.evalMode} em={em} />
            ))}
          </div>
        </div>
      )}

      {isExpanded && primitive.evalModes.length === 0 && primitive.supportsEvaluation && (
        <div className="border-t px-3 py-2 bg-yellow-50/50">
          <p className="text-xs text-yellow-700">
            Supports evaluation but no eval modes defined yet.
          </p>
        </div>
      )}
    </div>
  );
}

type FilterMode = 'all' | 'with-eval-modes' | 'eval-no-modes' | 'no-eval';

export function PrimitiveCatalogView() {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterDomain, setFilterDomain] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const primitives = catalogData as PrimitiveEntry[];

  const domains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of primitives) {
      counts.set(p.domain, (counts.get(p.domain) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [primitives]);

  const filtered = useMemo(() => {
    return primitives.filter(p => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchesId = p.id.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesEvalMode = p.evalModes.some(em =>
          em.evalMode.toLowerCase().includes(q) || em.label.toLowerCase().includes(q)
        );
        if (!matchesId && !matchesDesc && !matchesEvalMode) return false;
      }

      // Domain filter
      if (filterDomain && p.domain !== filterDomain) return false;

      // Eval mode filter
      switch (filterMode) {
        case 'with-eval-modes':
          return p.evalModes.length > 0;
        case 'eval-no-modes':
          return p.supportsEvaluation && p.evalModes.length === 0;
        case 'no-eval':
          return !p.supportsEvaluation;
        default:
          return true;
      }
    });
  }, [primitives, search, filterDomain, filterMode]);

  // Group by domain
  const grouped = useMemo(() => {
    const groups = new Map<string, PrimitiveEntry[]>();
    for (const p of filtered) {
      if (!groups.has(p.domain)) groups.set(p.domain, []);
      groups.get(p.domain)!.push(p);
    }
    return groups;
  }, [filtered]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(filtered.filter(p => p.evalModes.length > 0).map(p => p.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Stats
  const totalEvalModes = primitives.reduce((n, p) => n + p.evalModes.length, 0);
  const withEvalModes = primitives.filter(p => p.evalModes.length > 0).length;
  const supportsEval = primitives.filter(p => p.supportsEvaluation).length;
  const evalNoModes = primitives.filter(p => p.supportsEvaluation && p.evalModes.length === 0).length;

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-2xl font-bold text-gray-900">{primitives.length}</div>
          <div className="text-xs text-gray-500">Total Primitives</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold text-green-600">{withEvalModes}</div>
          <div className="text-xs text-gray-500">With Eval Modes</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold text-blue-600">{totalEvalModes}</div>
          <div className="text-xs text-gray-500">Total Eval Modes</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold text-yellow-600">{evalNoModes}</div>
          <div className="text-xs text-gray-500">Eval but No Modes</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search primitives or eval modes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <select
              value={filterDomain}
              onChange={e => setFilterDomain(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All domains</option>
              {domains.map(([domain, count]) => (
                <option key={domain} value={domain}>
                  {domain} ({count})
                </option>
              ))}
            </select>

            <select
              value={filterMode}
              onChange={e => setFilterMode(e.target.value as FilterMode)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">All primitives</option>
              <option value="with-eval-modes">With eval modes ({withEvalModes})</option>
              <option value="eval-no-modes">Eval but no modes ({evalNoModes})</option>
              <option value="no-eval">No eval support ({primitives.length - supportsEval})</option>
            </select>

            <div className="flex gap-1">
              <button onClick={expandAll} className="text-xs text-blue-600 hover:underline">
                Expand all
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={collapseAll} className="text-xs text-blue-600 hover:underline">
                Collapse
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="text-sm text-gray-500">
        Showing {filtered.length} of {primitives.length} primitives
      </div>

      {Array.from(grouped.entries()).map(([domain, domainPrimitives]) => {
        const DomainIcon = DOMAIN_ICONS[domain] || Cpu;
        const evalCount = domainPrimitives.reduce((n, p) => n + p.evalModes.length, 0);

        return (
          <div key={domain} className="space-y-2">
            <div className="flex items-center gap-2 pt-2">
              <DomainIcon className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                {domain}
              </h3>
              <span className="text-xs text-gray-400">
                {domainPrimitives.length} primitives, {evalCount} eval modes
              </span>
            </div>
            <div className="space-y-1.5">
              {domainPrimitives.map(p => (
                <PrimitiveCard
                  key={p.id}
                  primitive={p}
                  isExpanded={expandedIds.has(p.id)}
                  onToggle={() => toggleExpand(p.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
