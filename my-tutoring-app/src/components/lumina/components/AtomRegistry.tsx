'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  CATALOGS_BY_DOMAIN,
  UNIVERSAL_CATALOG,
} from '../service/manifest/catalog';
import type { ComponentDefinition, EvalModeDefinition } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Atom = (primitive, eval_mode) pair — the foundational unit of teachable
 * content. Specialized atoms encode their cognitive task in the primitive UI
 * (e.g. ten-frame:missing-addend). Universal atoms use a content-agnostic
 * primitive whose eval_mode encodes cognitive demand, with Gemini filling in
 * the subject matter at runtime (e.g. knowledge-check:recall on any topic).
 */
interface Atom {
  /** Stable key for list rendering. */
  id: string;
  primitiveId: string;
  primitiveDescription: string;
  /** Domain catalog this primitive lives in (math, literacy, core, ...). */
  domain: string;
  /** Whether this atom is universal (subject-agnostic) or specialized. */
  kind: 'universal' | 'specialized';
  evalMode: EvalModeDefinition;
}

interface AtomRegistryProps {
  onBack: () => void;
  /** Navigate to a tester panel — wired to the existing IdleScreen dev tools. */
  onOpenTester?: (panel: string) => void;
}

// ---------------------------------------------------------------------------
// Atom graph (localStorage-backed MVP)
// ---------------------------------------------------------------------------
//
// Persists prereq/lateral/scaffold edges between atoms locally so we can
// validate the authoring UX before committing to a Firestore schema or a
// backend suggestion endpoint. The hook's shape is intentionally chosen to be
// a drop-in replacement target: swap the storage layer for a Firestore
// listener and the rest of the UI does not change.
//
// Migration plan (deferred — see PRD discussion):
//   1. Move storage to `atom_edges/{edgeId}` collection in Firestore.
//   2. Add `POST /api/atom-graph/suggest-edges` backend endpoint that mirrors
//      the `/curriculum-graph` scoped-suggestion pattern (Gemini, <5s, 1-2 calls).
//   3. Replace the manual picker with an "Suggest prereqs" call → accept/reject
//      flow that writes accepted edges directly to Firestore.

type EdgeRelation = 'prerequisite' | 'lateral' | 'scaffold-of' | 'sequential';

interface AtomEdge {
  id: string;
  source: string;        // atom id (`${primitiveId}::${evalMode}`)
  target: string;        // atom id
  relation: EdgeRelation;
  rationale?: string;
  createdAt: number;
}

const GRAPH_STORAGE_KEY = 'lumina:atom-graph:v1';

function loadEdges(): AtomEdge[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GRAPH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistEdges(edges: AtomEdge[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(edges));
  } catch {
    // Quota or privacy mode — silently drop. Graph is non-load-bearing today.
  }
}

function useAtomGraph() {
  const [edges, setEdges] = useState<AtomEdge[]>(() => loadEdges());

  useEffect(() => {
    persistEdges(edges);
  }, [edges]);

  const addEdge = useCallback((edge: Omit<AtomEdge, 'id' | 'createdAt'>) => {
    setEdges(prev => {
      // Reject exact duplicate (same source/target/relation).
      const dup = prev.find(
        e => e.source === edge.source && e.target === edge.target && e.relation === edge.relation,
      );
      if (dup) return prev;
      return [
        ...prev,
        {
          ...edge,
          id: `${edge.source}__${edge.relation}__${edge.target}__${Date.now()}`,
          createdAt: Date.now(),
        },
      ];
    });
  }, []);

  const removeEdge = useCallback((edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
  }, []);

  return { edges, addEdge, removeEdge };
}

const RELATION_OPTIONS: { value: EdgeRelation; label: string; hint: string }[] = [
  { value: 'prerequisite', label: 'Prerequisite', hint: 'Target must be mastered first' },
  { value: 'scaffold-of', label: 'Scaffold of', hint: 'Easier version of the same skill' },
  { value: 'lateral', label: 'Lateral', hint: 'Same difficulty, different angle' },
  { value: 'sequential', label: 'Sequential', hint: 'Next step in a multi-step arc' },
];

function relationBadgeClass(relation: EdgeRelation): string {
  switch (relation) {
    case 'prerequisite':
      return 'bg-red-500/15 text-red-200 border-red-400/30';
    case 'scaffold-of':
      return 'bg-yellow-500/15 text-yellow-200 border-yellow-400/30';
    case 'lateral':
      return 'bg-blue-500/15 text-blue-200 border-blue-400/30';
    case 'sequential':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30';
  }
}

// Primitives from the CORE catalog are universal by definition.
const UNIVERSAL_DOMAINS = new Set(['core', 'media', 'assessment']);

// Map a primitive id to its tester panel id (matches IdleScreen developer tools).
// Domain → panel mapping for the "open tester" button.
const DOMAIN_TO_PANEL: Record<string, string> = {
  math: 'math-primitives-tester',
  engineering: 'engineering-primitives-tester',
  astronomy: 'astronomy-primitives-tester',
  physics: 'physics-primitives-tester',
  biology: 'biology-primitives-tester',
  chemistry: 'chemistry-primitives-tester',
  literacy: 'language-arts-tester',
};

// Specific primitive → panel overrides (universal primitives have their own testers).
const PRIMITIVE_TO_PANEL: Record<string, string> = {
  'knowledge-check': 'knowledge-check-tester',
  'media-player': 'media-player-tester',
  'feature-exhibit': 'feature-exhibit-tester',
  'deep-dive': 'deep-dive-tester',
  'passage-studio': 'passage-studio-tester',
  'annotated-example': 'annotated-example-tester',
  'practice-problem': 'practice-problem-tester',
  'distribution-explorer': 'distribution-explorer-tester',
};

function resolvePanel(primitiveId: string, domain: string): string | null {
  return PRIMITIVE_TO_PANEL[primitiveId] ?? DOMAIN_TO_PANEL[domain] ?? null;
}

// ---------------------------------------------------------------------------
// Atom derivation
// ---------------------------------------------------------------------------

function buildAtoms(): Atom[] {
  const atoms: Atom[] = [];

  for (const [domain, catalog] of Object.entries(CATALOGS_BY_DOMAIN)) {
    const kind: Atom['kind'] = UNIVERSAL_DOMAINS.has(domain)
      ? 'universal'
      : 'specialized';

    for (const primitive of catalog as ComponentDefinition[]) {
      if (!primitive.evalModes || primitive.evalModes.length === 0) continue;

      for (const mode of primitive.evalModes) {
        atoms.push({
          id: `${primitive.id}::${mode.evalMode}`,
          primitiveId: primitive.id,
          primitiveDescription: primitive.description,
          domain,
          kind,
          evalMode: mode,
        });
      }
    }
  }

  return atoms.sort((a, b) => {
    if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
    if (a.primitiveId !== b.primitiveId)
      return a.primitiveId.localeCompare(b.primitiveId);
    return a.evalMode.beta - b.evalMode.beta;
  });
}

function countPrimitivesWithoutEvalModes(): number {
  return UNIVERSAL_CATALOG.filter(
    p => !p.evalModes || p.evalModes.length === 0,
  ).length;
}

// ---------------------------------------------------------------------------
// Domain styling (kept terse — driven by domain key alone)
// ---------------------------------------------------------------------------

const DOMAIN_BADGE_CLASS: Record<string, string> = {
  core: 'bg-slate-500/15 text-slate-200 border-slate-400/30',
  math: 'bg-pink-500/15 text-pink-200 border-pink-400/30',
  engineering: 'bg-orange-500/15 text-orange-200 border-orange-400/30',
  astronomy: 'bg-blue-500/15 text-blue-200 border-blue-400/30',
  physics: 'bg-indigo-500/15 text-indigo-200 border-indigo-400/30',
  biology: 'bg-green-500/15 text-green-200 border-green-400/30',
  chemistry: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  literacy: 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30',
  media: 'bg-purple-500/15 text-purple-200 border-purple-400/30',
  assessment: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30',
  calendar: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  science: 'bg-teal-500/15 text-teal-200 border-teal-400/30',
};

function domainBadgeClass(domain: string): string {
  return (
    DOMAIN_BADGE_CLASS[domain] ??
    'bg-slate-500/15 text-slate-200 border-slate-400/30'
  );
}

// Map β [1, 10] to a difficulty label + color. Mirrors IRT calibration scale.
function betaBand(beta: number): { label: string; className: string } {
  if (beta < 2)
    return { label: 'foundational', className: 'text-emerald-300' };
  if (beta < 4) return { label: 'easy', className: 'text-green-300' };
  if (beta < 6) return { label: 'medium', className: 'text-yellow-300' };
  if (beta < 8) return { label: 'hard', className: 'text-orange-300' };
  return { label: 'advanced', className: 'text-red-300' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AtomRegistry: React.FC<AtomRegistryProps> = ({ onBack, onOpenTester }) => {
  const allAtoms = useMemo(buildAtoms, []);
  const orphanPrimitives = useMemo(countPrimitivesWithoutEvalModes, []);

  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'universal' | 'specialized'>('all');
  const [primitiveFilter, setPrimitiveFilter] = useState<string>('all');

  // Graph state (localStorage-backed MVP; swap for Firestore listener later)
  const { edges, addEdge, removeEdge } = useAtomGraph();
  const [editingAtomId, setEditingAtomId] = useState<string | null>(null);

  // Per-atom edge index for fast row lookups: source atom → outgoing edges.
  const edgesBySource = useMemo(() => {
    const map = new Map<string, AtomEdge[]>();
    for (const edge of edges) {
      const list = map.get(edge.source) ?? [];
      list.push(edge);
      map.set(edge.source, list);
    }
    return map;
  }, [edges]);

  const editingAtom = useMemo(
    () => (editingAtomId ? allAtoms.find(a => a.id === editingAtomId) ?? null : null),
    [editingAtomId, allAtoms],
  );

  const domains = useMemo(
    () => Array.from(new Set(allAtoms.map(a => a.domain))).sort(),
    [allAtoms],
  );

  const primitives = useMemo(() => {
    const base = domainFilter === 'all'
      ? allAtoms
      : allAtoms.filter(a => a.domain === domainFilter);
    return Array.from(new Set(base.map(a => a.primitiveId))).sort();
  }, [allAtoms, domainFilter]);

  const filteredAtoms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allAtoms.filter(a => {
      if (domainFilter !== 'all' && a.domain !== domainFilter) return false;
      if (kindFilter !== 'all' && a.kind !== kindFilter) return false;
      if (primitiveFilter !== 'all' && a.primitiveId !== primitiveFilter) return false;
      if (!q) return true;
      return (
        a.primitiveId.toLowerCase().includes(q) ||
        a.evalMode.evalMode.toLowerCase().includes(q) ||
        a.evalMode.label.toLowerCase().includes(q) ||
        a.evalMode.description.toLowerCase().includes(q)
      );
    });
  }, [allAtoms, search, domainFilter, kindFilter, primitiveFilter]);

  const stats = useMemo(() => {
    const universal = allAtoms.filter(a => a.kind === 'universal').length;
    const specialized = allAtoms.length - universal;
    const uniquePrimitives = new Set(allAtoms.map(a => a.primitiveId)).size;
    return { total: allAtoms.length, universal, specialized, uniquePrimitives };
  }, [allAtoms]);

  return (
    <div className="flex-1 animate-fade-in max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
          onClick={onBack}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Button>
        <div className="text-right">
          <h1 className="text-2xl font-semibold text-slate-100">Atom Registry</h1>
          <p className="text-xs text-slate-400">
            Every <span className="text-slate-300">(primitive, eval_mode)</span> in the live catalog
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total atoms" value={stats.total} />
        <StatCard label="Specialized" value={stats.specialized} hint="domain-bound" />
        <StatCard label="Universal" value={stats.universal} hint="content-agnostic" />
        <StatCard label="Primitives w/ modes" value={stats.uniquePrimitives} hint={`${orphanPrimitives} without modes`} />
        <StatCard label="Edges authored" value={edges.length} hint="local — not synced" />
      </div>

      {/* Filters */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            placeholder="Search primitive, mode, description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-950/40 border-white/10 text-slate-100 placeholder:text-slate-500"
          />

          <Select value={domainFilter} onValueChange={(v) => { setDomainFilter(v); setPrimitiveFilter('all'); }}>
            <SelectTrigger className="bg-slate-950/40 border-white/10 text-slate-100">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {domains.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
            <SelectTrigger className="bg-slate-950/40 border-white/10 text-slate-100">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              <SelectItem value="specialized">Specialized only</SelectItem>
              <SelectItem value="universal">Universal only</SelectItem>
            </SelectContent>
          </Select>

          <Select value={primitiveFilter} onValueChange={setPrimitiveFilter}>
            <SelectTrigger className="bg-slate-950/40 border-white/10 text-slate-100">
              <SelectValue placeholder="Primitive" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All primitives</SelectItem>
              {primitives.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 text-xs text-slate-400">
          Showing {filteredAtoms.length} of {stats.total} atoms
        </div>
      </Card>

      {/* Atom list */}
      <div className="space-y-2">
        {filteredAtoms.length === 0 ? (
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-8 text-center text-slate-400">
            No atoms match these filters.
          </Card>
        ) : (
          filteredAtoms.map(atom => (
            <AtomRow
              key={atom.id}
              atom={atom}
              onOpenTester={onOpenTester}
              edgeCount={edgesBySource.get(atom.id)?.length ?? 0}
              onEditEdges={() => setEditingAtomId(atom.id)}
            />
          ))
        )}
      </div>

      <EdgeEditorDialog
        atom={editingAtom}
        allAtoms={allAtoms}
        edges={edges}
        onAdd={addEdge}
        onRemove={removeEdge}
        onClose={() => setEditingAtomId(null)}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

const StatCard: React.FC<{ label: string; value: number | string; hint?: string }> = ({
  label,
  value,
  hint,
}) => (
  <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4">
    <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
    <div className="text-2xl font-semibold text-slate-100 mt-1">{value}</div>
    {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
  </Card>
);

const AtomRow: React.FC<{
  atom: Atom;
  onOpenTester?: (panel: string) => void;
  edgeCount: number;
  onEditEdges: () => void;
}> = ({ atom, onOpenTester, edgeCount, onEditEdges }) => {
  const { evalMode } = atom;
  const band = betaBand(evalMode.beta);
  const panel = resolvePanel(atom.primitiveId, atom.domain);

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 p-4 hover:bg-slate-900/60 transition-colors">
      <div className="flex items-start gap-4">
        {/* Identity column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${domainBadgeClass(atom.domain)}`}>
              {atom.domain}
            </Badge>
            <Badge
              variant="outline"
              className={
                atom.kind === 'universal'
                  ? 'bg-amber-500/10 text-amber-200 border-amber-400/30 text-[10px] uppercase tracking-wider'
                  : 'bg-violet-500/10 text-violet-200 border-violet-400/30 text-[10px] uppercase tracking-wider'
              }
            >
              {atom.kind}
            </Badge>
            <code className="text-xs font-mono text-slate-300">{atom.primitiveId}</code>
            <span className="text-slate-600">::</span>
            <code className="text-xs font-mono text-cyan-300">{evalMode.evalMode}</code>
          </div>

          <div className="mt-2 text-sm text-slate-100 font-medium">{evalMode.label}</div>
          <div className="mt-1 text-xs text-slate-400 leading-relaxed">{evalMode.description}</div>

          <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
            <span>
              β = <span className={`font-mono font-semibold ${band.className}`}>{evalMode.beta.toFixed(2)}</span>{' '}
              <span className="text-slate-600">({band.label})</span>
            </span>
            <span>
              scaffold = <span className="font-mono text-slate-300">{evalMode.scaffoldingMode}</span>
            </span>
            <span>
              challenges =
              <span className="font-mono text-slate-300 ml-1">
                {evalMode.challengeTypes.join(', ')}
              </span>
            </span>
          </div>
        </div>

        {/* Action column */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 justify-between gap-2"
            onClick={onEditEdges}
          >
            <span>Edges</span>
            <span
              className={
                edgeCount > 0
                  ? 'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-cyan-500/20 text-cyan-200 text-[10px] font-mono'
                  : 'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-700/40 text-slate-500 text-[10px] font-mono'
              }
            >
              {edgeCount}
            </span>
          </Button>
          {panel && onOpenTester && (
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={() => onOpenTester(panel)}
            >
              Open tester
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// EdgeEditorDialog — author edges from one atom (source) to others (target)
// ---------------------------------------------------------------------------

interface EdgeEditorDialogProps {
  atom: Atom | null;
  allAtoms: Atom[];
  edges: AtomEdge[];
  onAdd: (edge: Omit<AtomEdge, 'id' | 'createdAt'>) => void;
  onRemove: (edgeId: string) => void;
  onClose: () => void;
}

const EdgeEditorDialog: React.FC<EdgeEditorDialogProps> = ({
  atom,
  allAtoms,
  edges,
  onAdd,
  onRemove,
  onClose,
}) => {
  const [targetId, setTargetId] = useState<string>('');
  const [relation, setRelation] = useState<EdgeRelation>('prerequisite');
  const [rationale, setRationale] = useState<string>('');

  // Reset form when the focused atom changes.
  useEffect(() => {
    setTargetId('');
    setRelation('prerequisite');
    setRationale('');
  }, [atom?.id]);

  if (!atom) return null;

  const outgoingEdges = edges.filter(e => e.source === atom.id);
  const incomingEdges = edges.filter(e => e.target === atom.id);

  // Target candidates exclude self and atoms already linked with this relation.
  const candidateTargets = allAtoms.filter(a => {
    if (a.id === atom.id) return false;
    return !outgoingEdges.some(e => e.target === a.id && e.relation === relation);
  });

  const handleAdd = () => {
    if (!targetId) return;
    onAdd({
      source: atom.id,
      target: targetId,
      relation,
      rationale: rationale.trim() || undefined,
    });
    setTargetId('');
    setRationale('');
  };

  const atomById = (id: string) => allAtoms.find(a => a.id === id);

  return (
    <Dialog open={atom !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-950/95 border-white/10 text-slate-100 max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${domainBadgeClass(atom.domain)}`}>
              {atom.domain}
            </Badge>
            <code className="text-sm font-mono text-slate-300">{atom.primitiveId}</code>
            <span className="text-slate-600">::</span>
            <code className="text-sm font-mono text-cyan-300">{atom.evalMode.evalMode}</code>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {atom.evalMode.label} — author edges to other atoms. Stored locally; swap for Firestore later.
          </DialogDescription>
        </DialogHeader>

        {/* Add edge form */}
        <Card className="bg-slate-900/40 border-white/10 p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-slate-400">Add edge</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider">Relation</label>
              <Select value={relation} onValueChange={(v) => setRelation(v as EdgeRelation)}>
                <SelectTrigger className="bg-slate-950/40 border-white/10 text-slate-100 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-[10px] text-slate-500">{opt.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider">Target atom</label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="bg-slate-950/40 border-white/10 text-slate-100 mt-1">
                  <SelectValue placeholder="Pick a target atom..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {candidateTargets.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-mono text-xs">{t.primitiveId} :: {t.evalMode.evalMode}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-500 uppercase tracking-wider">Rationale (optional)</label>
            <Textarea
              value={rationale}
              onChange={e => setRationale(e.target.value)}
              placeholder="Why this edge? e.g. 'Missing-addend mode requires fluency with direct addition first.'"
              className="bg-slate-950/40 border-white/10 text-slate-100 placeholder:text-slate-600 mt-1 min-h-[60px]"
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="bg-cyan-500/15 border border-cyan-400/30 hover:bg-cyan-500/25 text-cyan-100 disabled:opacity-50"
              onClick={handleAdd}
              disabled={!targetId}
            >
              Add edge
            </Button>
          </div>
        </Card>

        {/* Outgoing edges */}
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
            Outgoing ({outgoingEdges.length})
          </div>
          {outgoingEdges.length === 0 ? (
            <div className="text-xs text-slate-500 italic">No outgoing edges yet.</div>
          ) : (
            <div className="space-y-2">
              {outgoingEdges.map(edge => {
                const target = atomById(edge.target);
                return (
                  <Card key={edge.id} className="bg-slate-900/40 border-white/10 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${relationBadgeClass(edge.relation)}`}>
                            {edge.relation}
                          </Badge>
                          <span className="text-slate-500 text-xs">→</span>
                          {target ? (
                            <code className="text-xs font-mono text-slate-300">
                              {target.primitiveId} :: <span className="text-cyan-300">{target.evalMode.evalMode}</span>
                            </code>
                          ) : (
                            <code className="text-xs font-mono text-red-300">{edge.target} (missing)</code>
                          )}
                        </div>
                        {edge.rationale && (
                          <div className="mt-1 text-xs text-slate-400 leading-relaxed">{edge.rationale}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"
                        onClick={() => onRemove(edge.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Incoming edges (read-only — managed from the other atom's perspective) */}
        {incomingEdges.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
              Incoming ({incomingEdges.length})
            </div>
            <div className="space-y-2">
              {incomingEdges.map(edge => {
                const source = atomById(edge.source);
                return (
                  <Card key={edge.id} className="bg-slate-900/20 border-white/5 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {source ? (
                        <code className="text-xs font-mono text-slate-300">
                          {source.primitiveId} :: <span className="text-cyan-300">{source.evalMode.evalMode}</span>
                        </code>
                      ) : (
                        <code className="text-xs font-mono text-red-300">{edge.source} (missing)</code>
                      )}
                      <span className="text-slate-500 text-xs">→</span>
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${relationBadgeClass(edge.relation)}`}>
                        {edge.relation}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AtomRegistry;
