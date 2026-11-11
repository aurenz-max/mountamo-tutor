'use client';

/**
 * Practice Studio tester: generate a session with the real author (the kit's write, look, revise loop), read what the
 * loop did per item (rounds, the blind solver's tier, what is left), inspect every item as an adult (key, misconceptions,
 * levers), and play it in the teaching workspace, offline (free) or with the Live tutor (paid).
 *
 * The bench runs chosen review settings on one first draft, so they differ only in their review; pick a row to inspect
 * and play that setting's items.
 *
 * The inspector shows the key on purpose: it is the reviewer's view, beside the preview, never inside it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { getPrimitive } from '../config/primitiveRegistry';
import { EvaluationProvider, useEvaluationContext, type PrimitiveEvaluationResult } from '../evaluation';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { TesterWorkspace } from './live-activity/TesterWorkspace';
import type { PracticeStudioData } from '../primitives/visual-primitives/core/practice-studio/PracticeStudio';
import type { SurfaceItem } from '../service/agent-kit/surfaces';
import type { KitEvent } from '../service/agent-kit/trace';
import { EventLine, RunProgress, readKitStream } from './KitRunProgress';
import { FULL_REVIEW_ID, KIT_MODEL, REVIEW_VARIANTS } from '../service/agent-kit/reviewVariants';
import { DISPLAY_KINDS } from '../service/agent-kit/displays';
import { ACT_WORDS, EVIDENCE_ACTS, type EvidenceAct, type EvidenceRecord } from '../service/agent-kit/evidence';
import { setControlSpecs } from '../service/agent-kit/setting';
import { CurriculumBrowser } from './CurriculumBrowser';
import { useAuth } from '@/contexts/AuthContext';

interface EvidenceForm { act: EvidenceAct | ''; on: string; credit: string; notCredit: string; observed: boolean }
const NO_EVIDENCE: EvidenceForm = { act: '', on: '', credit: '', notCredit: '', observed: false };

// Presets with `evidence` are the cases of `scripts/evidence-spec-probe.mjs`: they are what makes the author build a
// tray (`make`) or a board (`set`) and not a choice. A lesson gets no spec until the manifest emits one (EV-6).
const PRESETS: Array<{ grade: string; topic: string; evidence?: EvidenceForm }> = [
  { grade: 'K', topic: 'Compare two groups: which has more, fewer or the same (K.CC.C.6)' },
  { grade: '1', topic: 'Monarch butterflies: young animals are like, but not exactly like, their parents (1-LS3-1)' },
  { grade: '1', topic: 'Retell a short story in order: beginning, middle and end (RL.1.2)' },
  { grade: '2', topic: 'Bar graphs: solve put-together and compare problems from a bar graph (2.MD.D.10)' },
  { grade: '2', topic: 'Sort materials by observable properties: hard or soft, bendy or stiff (2-PS1-1)' },
  { grade: '3', topic: 'Fractions on a number line from 0 to 1 (3.NF.A.2)' },
  { grade: '2', topic: 'Cut a circle: partition circles into equal shares for halves, thirds and fourths, and name each share',
    evidence: { act: 'set', on: 'a whole, uncut circle', credit: "the child's cuts make 2, 3 or 4 equal shares", notCredit: 'picking a pre-cut circle; typing 1/4', observed: false } },
  { grade: '2', topic: 'Set the clock: set an analog clock to a requested time (8:00, 7:30, 12:15, 6:45)',
    evidence: { act: 'set', on: 'an analog clock whose hands the child moves', credit: "the child's hands show the requested time", notCredit: 'picking a clock that already shows the time; reading a time aloud', observed: false } },
  { grade: '2', topic: 'Add with blocks: add two two-digit numbers with place value blocks, no regrouping (24+12, 33+45)',
    evidence: { act: 'set', on: 'place value blocks the child adds to', credit: "the child's tens and ones blocks show the sum", notCredit: 'picking a ready-made set of blocks; typing the sum', observed: false } },
  { grade: '2', topic: 'Make an amount with coins: make a target amount with a stated number of coins (35 cents with exactly 5 coins)',
    evidence: { act: 'build', on: 'an empty tray and bins of pennies, nickels, dimes and quarters', credit: "the child's own set of coins totals the target amount and uses the stated number of coins", notCredit: 'picking a ready-made set of coins; typing a total', observed: false } },
  { grade: 'K', topic: 'Weather graph: compare weather between places and times using simple graphs',
    evidence: { act: 'set', on: 'a graph of sunny, rainy and cloudy days that the child fills in', credit: "the child's graph shows what the weather record says, or a comparison the tutor asks for", notCredit: 'picking a finished graph', observed: false } },
  // A bare topic with no spec: the loop plans the evidence, and only a working model (a `system` board) fits.
  { grade: '2', topic: 'excavators' },
  { grade: 'K', topic: 'Sun test: test how sunlight warms different colored surfaces',
    evidence: { act: 'run-read', on: 'two surfaces that differ in one way, in the same sun for the same time', credit: 'the child says which will be warmer, then reads which one did get warmer from a result shown on screen', notCredit: 'a correct prediction alone; recalling that dark things get hot without seeing a result', observed: true } },
];
const GRADES = ['K', '1', '2', '3', '4', '5'];
const TIERS = ['auto', 'easy', 'medium', 'hard'] as const;

interface DebugItem { id: string; tier: string; computed: string; solver?: string; rounds: number; changed?: boolean; kept?: boolean; advisory: string[]; refusedLevers: string[]; drawnByHand?: Array<{ what: string; chars: number }>; evidenceGap?: string | null }
interface RunDebug { seconds?: number; costUsd?: number; items?: DebugItem[]; bench?: BenchRow[]; model?: { requested: string; served?: string }; evidence?: EvidenceRecord }
interface BenchRow { id: string; label: string; data?: PracticeStudioData; error?: string }

const debugOf = (d: PracticeStudioData | null | undefined) => (d?.agentDebug ?? {}) as RunDebug;

/** A curriculum grade ("K", "Kindergarten", "1", "Grade 5") as this tester's grade, or null when it has none for it. */
const testerGrade = (g?: string): string | null => {
  const value = (g ?? '').trim().toLowerCase();
  if (value === 'k' || value.includes('kindergarten')) return 'K';
  const n = value.match(/\d+/)?.[0];
  return n && GRADES.includes(n) ? n : null;
};

const keyText = (c: SurfaceItem) => {
  const name = (id: string) => c.options.find(o => o.id === id)?.label ?? id;
  if (c.surface === 'point') return `the part ${String(c.key)}`;
  if (c.surface === 'choose') return name(c.key as string);
  if (c.surface === 'order') return (c.key as string[]).map(name).join(' → ');
  // make and set are judged by a goal, never by a key: show the goal, and for make one set that meets it.
  if (c.surface === 'make') return `goal ${JSON.stringify(c.goal ?? {})} · one right set: ${(c.key as string[]).map(name).join(' + ') || 'none found'}`;
  if (c.surface === 'set') return `goal ${JSON.stringify(c.setGoal ?? {})}`;
  return Object.entries(c.key as Record<string, string>).map(([id, cat]) => `${name(id)}: ${cat}`).join(' · ');
};

/** A set item's board as the reviewer reads it: the display it starts as and what the child can change on it. */
const boardText = (c: SurfaceItem) => {
  const controls = setControlSpecs(c).map(k => `${k.label ?? k.field} (${k.toggle ? `toggle ${k.toggle.join(', ')}` : `${k.min} to ${k.max}${k.step && k.step !== 1 ? ` by ${k.step}` : ''}`})`);
  return `${JSON.stringify(c.board)} · the child changes: ${controls.join('; ') || 'nothing'}`;
};

const SURFACE_TONE: Record<string, string> = { make: 'text-emerald-300', set: 'text-emerald-300' };

/** What the run did about the evidence spec: how many items collect it, and why the others do not. */
const EvidenceSummary: React.FC<{ evidence: EvidenceRecord }> = ({ evidence }) => (
  <div className={`rounded-lg border p-2 text-xs ${evidence.met === evidence.items ? 'border-emerald-500/40 bg-emerald-900/20' : 'border-amber-500/40 bg-amber-900/20'}`}>
    <p className="font-semibold text-slate-100">Evidence: {evidence.met} of {evidence.items} items collect it ({evidence.spec.act})</p>
    {evidence.unsupported && <p className="mt-1 text-amber-200">Kit gap: {evidence.unsupported}</p>}
    {evidence.gaps.length > 0 && <ul className="mt-1 list-disc pl-4 text-amber-200/80">{evidence.gaps.map(g => <li key={g.id}>{g.id}: {g.gap}</li>)}</ul>}
  </div>
);

const ItemInspector: React.FC<{ item: SurfaceItem; index: number; debug?: DebugItem }> = ({ item, index, debug }) => (
  <details className="rounded-lg border border-slate-700 bg-slate-900/40 p-2 text-xs" open={index === 0}>
    <summary className="cursor-pointer text-slate-200">
      {index + 1}. <span className={SURFACE_TONE[item.surface] ?? 'text-cyan-300'}>{item.surface}</span> · aimed {item.tier} · computed {item.difficulty.band} ({item.difficulty.score})
      {debug?.solver ? ` · solver ${debug.solver}` : ''}{debug ? ` · ${debug.rounds} revise round${debug.rounds === 1 ? '' : 's'}` : ''}
    </summary>
    <div className="mt-2 space-y-1 text-slate-400">
      <p className="text-slate-200">{item.prompt}</p>
      <p><span className="text-slate-500">Shown:</span> {item.stimulus.map(s => s.kind).join(', ') || 'nothing above the cards'} · <span className="text-slate-500">cards:</span> {item.options.map(o => o.display ? `${o.label ?? ''}[${o.display.kind}]` : o.label).join(' / ')}</p>
      {item.surface === 'set' && <p className="break-words"><span className="text-slate-500">Board:</span> {boardText(item)}</p>}
      <p className="break-words"><span className="text-emerald-400">{item.surface === 'make' || item.surface === 'set' ? 'Judged by:' : 'Key:'}</span> {keyText(item)}</p>
      {debug?.evidenceGap && <p className="text-amber-200">Evidence gap: {debug.evidenceGap}</p>}
      {item.misconceptions && <ul className="list-disc pl-4">{Object.entries(item.misconceptions).map(([id, m]) => <li key={id}><span className="text-amber-300">{item.options.find(o => o.id === id)?.label ?? id}</span>: {m}</li>)}</ul>}
      <p><span className="text-slate-500">Difficulty:</span> {item.difficulty.reasons.join('; ')}</p>
      <p><span className="text-slate-500">Levers:</span> {(item.levers ?? []).map(l => `${l.id} (${l.kind}): "${l.says}"`).join(' · ') || 'none'}</p>
      {!!debug?.drawnByHand?.length && <p><span className="text-slate-500">Drawn by hand:</span> {debug.drawnByHand.map(d => `${d.what} (${d.chars.toLocaleString()} chars)`).join(' · ')}</p>}
      {!!debug?.refusedLevers.length && <p className="text-rose-300">Refused levers: {debug.refusedLevers.join('; ')}</p>}
      {!!debug?.advisory.length && <ul className="list-disc pl-4 text-amber-200/80">{debug.advisory.map((a, i) => <li key={i}>{a}</li>)}</ul>}
    </div>
  </details>
);

const itemOutcome = (x: DebugItem, n: number) =>
  `${n + 1}: ${x.kept === false ? 'dropped' : x.changed ? `revised (${x.rounds})` : x.rounds ? `first draft kept (${x.rounds} looked)` : 'first draft'}`;

/** One row per review setting: what it cost, what happened to each item. Picking a row shows that setting's session. */
const BenchTable: React.FC<{ rows: BenchRow[]; picked: string; onPick: (id: string) => void }> = ({ rows, picked, onPick }) => (
  <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 space-y-2">
    <h3 className="text-sm font-bold text-slate-200">Bench: one first draft, each review setting</h3>
    <p className="text-[11px] text-slate-500">Cost is what a run with only that setting would cost (the first write plus its own review). Pick a row to inspect and play it.</p>
    {rows.map(row => {
      const debug = debugOf(row.data);
      return (
        <button key={row.id} type="button" disabled={!row.data} onClick={() => onPick(row.id)} aria-pressed={picked === row.id}
          className={`block w-full rounded-lg border px-3 py-2 text-left text-xs ${picked === row.id ? 'border-cyan-400/60 bg-cyan-600/20' : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'}`}>
          <span className="flex flex-wrap justify-between gap-2 text-slate-100">
            <span className="font-semibold">{row.label}</span>
            {row.data && <span className="tabular-nums text-cyan-200">${(debug.costUsd ?? 0).toFixed(3)} · {debug.seconds ?? '—'}s · {row.data.challenges.length} items</span>}
          </span>
          {row.data
            ? <span className="mt-1 block text-slate-400">{(debug.items ?? []).map(itemOutcome).join(' · ')}</span>
            : <span className="mt-1 block break-words text-rose-300">{row.error}</span>}
        </button>
      );
    })}
  </div>
);

const PracticeStudioTesterInner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [topic, setTopic] = useState(PRESETS[3].topic);
  const [grade, setGrade] = useState('2');
  const [intent, setIntent] = useState('');
  const [tier, setTier] = useState<typeof TIERS[number]>('auto');
  const [review, setReview] = useState(FULL_REVIEW_ID);
  const [benchIds, setBenchIds] = useState<string[]>(REVIEW_VARIANTS.map(v => v.id));
  const [hideDisplay, setHideDisplay] = useState('');
  const [evidence, setEvidence] = useState<EvidenceForm>(NO_EVIDENCE);
  const evidenceReady = !!evidence.act && !!evidence.credit.trim();
  const [data, setData] = useState<PracticeStudioData | null>(null);
  const [pickedRow, setPickedRow] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [events, setEvents] = useState<KitEvent[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [tutorMode, setTutorMode] = useState<'offline' | 'live'>('offline');
  const [browseOpen, setBrowseOpen] = useState(false);
  const { user } = useAuth();
  const evaluationContext = useEvaluationContext();
  const Component = getPrimitive('practice-studio')?.component;

  const benchRows = debugOf(data).bench;
  const firstRow = benchRows?.find(r => r.data)?.id ?? '';
  const shown = benchRows?.find(r => r.id === (pickedRow ?? firstRow))?.data ?? data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previewInstanceId = useMemo(() => `practice-studio-${Date.now()}`, [shown]);

  useEffect(() => {
    if (!isGenerating) return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  const generate = async (bench: boolean) => {
    if (!topic.trim()) return;
    // One non-default setting runs as a bench of one; the default takes the same path a lesson does.
    const reviewBench = bench ? benchIds : review !== FULL_REVIEW_ID ? [review] : null;
    setIsGenerating(true); setError(null); setData(null); setPickedRow(null); setEvents([]);
    const started = Date.now();
    try {
      const response = await fetch('/api/lumina', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generateComponentContent', params: {
          stream: true,
          componentId: 'practice-studio', topic, gradeLevel: grade === 'K' ? 'kindergarten' : `grade ${grade}`,
          config: { intent: intent.trim() || topic, grade, ...(tier !== 'auto' ? { difficulty: tier } : {}), ...(reviewBench ? { reviewBench } : {}), ...(hideDisplay ? { withoutDisplays: [hideDisplay] } : {}),
            ...(evidenceReady ? { evidence: { act: evidence.act, on: evidence.on.trim(), credit: evidence.credit.trim(), notCredit: evidence.notCredit.trim(), observed: evidence.observed } } : {}) },
        } }),
      });
      const result = await readKitStream<{ data?: unknown }>(response, event => setEvents(prev => [...prev, event]));
      setData((result.data || result) as PracticeStudioData);
      setMs(Date.now() - started);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  };

  const onEvaluationSubmit = (result: PrimitiveEvaluationResult) => console.log('[PracticeStudioTester] evaluation', result);
  const debugItems = debugOf(shown).items ?? [];

  return (
    <div className="min-h-screen">
      <div className="mb-4 text-center">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600">← Back to Home</button>
      </div>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white">🧩 Practice Studio</h1>
        <p className="text-slate-400 text-sm mt-1">An agent assembles items from shared surfaces and displays, looks at each one as the child will, and revises it</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 space-y-3">
            <label className="block text-xs font-semibold text-slate-400" htmlFor="ps-topic">Objective</label>
            <textarea id="ps-topic" value={topic} onChange={e => setTopic(e.target.value)} rows={2}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm" />
            <div className="flex flex-wrap gap-1">
              {PRESETS.map(p => (
                <button key={p.topic} type="button" onClick={() => { setTopic(p.topic); setGrade(p.grade); setEvidence(p.evidence ?? NO_EVIDENCE); }}
                  className={`px-2 py-1 rounded-full text-[11px] border ${topic === p.topic ? 'bg-cyan-600/40 border-cyan-400/50 text-cyan-100' : 'bg-slate-900/40 border-slate-600 text-slate-400 hover:text-slate-200'}`}>
                  {p.grade === 'K' ? 'K' : `G${p.grade}`}: {p.topic.split(':')[0]}{p.evidence ? ` · ${p.evidence.act}` : ''}
                </button>
              ))}
            </div>
            <details open={browseOpen} onToggle={e => setBrowseOpen(e.currentTarget.open)} className="rounded-lg border border-slate-700 p-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-300">Pick from the curriculum</summary>
              <div className="mt-3">
                {user ? (
                  <CurriculumBrowser
                    onActiveSubjectChange={subject => { const g = testerGrade(subject?.grade); if (g) setGrade(g); }}
                    onSelectTopic={picked => { setTopic(picked); setBrowseOpen(false); }}
                  />
                ) : <p className="text-xs text-slate-500">Sign in to browse the curriculum.</p>}
              </div>
            </details>
            <label className="block text-xs font-semibold text-slate-400" htmlFor="ps-intent">Lesson job (optional)</label>
            <input id="ps-intent" value={intent} onChange={e => setIntent(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm" placeholder="defaults to the objective" />
            <div className="flex items-center gap-2 text-xs">
              <select id="ps-grade" value={grade} onChange={e => setGrade(e.target.value)} aria-label="Grade" className="px-2 py-1 bg-slate-900/60 border border-slate-600 rounded text-white">
                {GRADES.map(g => <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>)}
              </select>
              <select id="ps-tier" value={tier} onChange={e => setTier(e.target.value as typeof tier)} aria-label="Support tier" className="px-2 py-1 bg-slate-900/60 border border-slate-600 rounded text-white">
                {TIERS.map(t => <option key={t} value={t}>{t === 'auto' ? 'Tier: easy to hard' : t}</option>)}
              </select>
            </div>
            <fieldset className="space-y-2 rounded-lg border border-slate-700 p-2 text-xs text-slate-300">
              <legend className="px-1 font-semibold text-slate-400">Evidence the lesson must collect</legend>
              <select id="ps-ev-act" aria-label="What the child does" value={evidence.act} onChange={e => setEvidence(v => ({ ...v, act: e.target.value as EvidenceForm['act'] }))}
                className="w-full px-2 py-1.5 bg-slate-900/60 border border-slate-600 rounded text-white">
                <option value="">Planned from the objective (a lesson today)</option>
                {EVIDENCE_ACTS.map(a => <option key={a} value={a}>{a}: the child {ACT_WORDS[a]}</option>)}
              </select>
              {evidence.act && (
                <>
                  <input aria-label="What they do it on" value={evidence.on} onChange={e => setEvidence(v => ({ ...v, on: e.target.value }))} placeholder="on what (a whole, uncut circle)"
                    className="w-full px-2 py-1.5 bg-slate-900/60 border border-slate-600 rounded text-white" />
                  <textarea aria-label="Credit only when" value={evidence.credit} onChange={e => setEvidence(v => ({ ...v, credit: e.target.value }))} rows={2} placeholder="credit only when (required)"
                    className="w-full px-2 py-1.5 bg-slate-900/60 border border-slate-600 rounded text-white" />
                  <input aria-label="Does not count" value={evidence.notCredit} onChange={e => setEvidence(v => ({ ...v, notCredit: e.target.value }))} placeholder="does not count (picking a finished one)"
                    className="w-full px-2 py-1.5 bg-slate-900/60 border border-slate-600 rounded text-white" />
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={evidence.observed} onChange={e => setEvidence(v => ({ ...v, observed: e.target.checked }))} />
                    The result must happen on the screen
                  </label>
                  {!evidenceReady && <p className="text-amber-200">Fill in "credit only when", or the spec is not sent.</p>}
                </>
              )}
            </fieldset>
            <label className="block text-xs font-semibold text-slate-400" htmlFor="ps-review">Review setting</label>
            <select id="ps-review" value={review} onChange={e => setReview(e.target.value)} className="w-full px-2 py-1.5 bg-slate-900/60 border border-slate-600 rounded text-xs text-white">
              {REVIEW_VARIANTS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <label className="block text-xs font-semibold text-slate-400" htmlFor="ps-hide">Hide a display from the author (to measure it)</label>
            <select id="ps-hide" value={hideDisplay} onChange={e => setHideDisplay(e.target.value)} className="w-full px-2 py-1.5 bg-slate-900/60 border border-slate-600 rounded text-xs text-white">
              <option value="">None: the author can use every display</option>
              {DISPLAY_KINDS.filter(k => k !== 'svg').map(k => <option key={k} value={k}>Hide {k}</option>)}
            </select>
            <button type="button" onClick={() => void generate(false)} disabled={isGenerating || !topic.trim()}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm">
              {isGenerating ? 'Writing, looking, revising… (1-3 min)' : 'Generate session'}
            </button>
            <p className="text-[11px] text-slate-400">Model (author and solver): <code className="text-cyan-200">{debugOf(shown).model?.served ?? KIT_MODEL}</code>{debugOf(shown).model?.served ? ` (requested as ${KIT_MODEL})` : ''}</p>
            <p className="text-[10px] text-slate-500">Paid: $0.02-0.06 for a first draft with no review, up to $0.30 with solver and difficulty notes. Spend: <code>node scripts/gemini-spend.mjs</code></p>
            <fieldset className="space-y-1 rounded-lg border border-slate-700 p-2 text-xs text-slate-300">
              <legend className="px-1 font-semibold text-slate-400">Compare settings side by side</legend>
              {REVIEW_VARIANTS.map(v => (
                <label key={v.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={benchIds.includes(v.id)}
                    onChange={e => setBenchIds(ids => e.target.checked ? [...ids, v.id] : ids.filter(id => id !== v.id))} />
                  {v.label}
                </label>
              ))}
              <button type="button" onClick={() => void generate(true)} disabled={isGenerating || !topic.trim() || !benchIds.length}
                className="mt-1 w-full py-2 rounded-lg border border-cyan-500/50 bg-slate-900/60 hover:bg-slate-800 disabled:opacity-50 text-cyan-100 font-semibold">
                Bench on one draft
              </button>
              <p className="text-[10px] text-slate-500">Paid: one write shared by every setting, then each setting's own review (~$0.20-0.35 for all four).</p>
            </fieldset>
            {error && <p className="text-xs text-rose-300 break-words">{error}</p>}
            {!isGenerating && events.length > 0 && (
              <details open={!!error} className="text-[11px]">
                <summary className="cursor-pointer text-slate-300">Run log: {events.length} steps, {events[events.length - 1].seconds}s, about ${events[events.length - 1].costUsd.toFixed(2)}</summary>
                <ol className="mt-2 space-y-1">{events.map((e, i) => <EventLine key={i} event={e} />)}</ol>
              </details>
            )}
          </div>

          {benchRows && benchRows.length > 1 && <BenchTable rows={benchRows} picked={pickedRow ?? firstRow} onPick={setPickedRow} />}

          {shown && (
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 space-y-2">
              <h3 className="text-sm font-bold text-slate-200">{shown.title}</h3>
              <p className="text-xs text-slate-400">{shown.description}</p>
              <p className="text-[11px] text-slate-500">Author loop {String(debugOf(shown).seconds ?? '—')} s · round trip {ms != null ? (ms / 1000).toFixed(0) : '—'} s</p>
              <p className="text-[11px] text-slate-400">Surfaces: {shown.challenges.map(c => c.surface).join(', ')}</p>
              {debugOf(shown).evidence
                ? <EvidenceSummary evidence={debugOf(shown).evidence!} />
                : <p className="text-[11px] text-slate-500">No evidence spec was sent and none could be planned, so nothing asked the author for a tray or a board.</p>}
              <h4 className="pt-2 text-xs font-bold text-slate-300">Items (reviewer view: shows the key)</h4>
              {shown.challenges.map((c, i) => <ItemInspector key={c.id} item={c} index={i} debug={debugItems.find(d => d.id === c.id)} />)}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 min-h-[calc(100vh-200px)]">
          {shown && Component ? (
            <div className="space-y-3">
              <div role="radiogroup" aria-label="Tutor" className="flex w-fit rounded-lg border border-slate-600 text-xs">
                {(['offline', 'live'] as const).map(m => (
                  <button key={m} type="button" role="radio" aria-checked={tutorMode === m} onClick={() => setTutorMode(m)}
                    className={`px-3 py-1 ${tutorMode === m ? 'bg-cyan-600/40 text-cyan-100' : 'text-slate-400'}`}>
                    {m === 'offline' ? 'Offline (free)' : 'Live tutor (paid)'}
                  </button>
                ))}
              </div>
              <div key={`${previewInstanceId}-${tutorMode}`} data-primitive-instance-id={previewInstanceId} className="bg-slate-900/50 rounded-xl overflow-hidden p-4">
                <TesterWorkspace primitiveId="practice-studio" instanceId={previewInstanceId} evalMode={shown.challengeType} offline={tutorMode === 'offline'}
                  data={shown} topic={topic} gradeLevel={grade === 'K' ? 'kindergarten' : `grade ${grade}`} onEvaluationSubmit={onEvaluationSubmit}>
                  <Component data={{ ...shown, instanceId: previewInstanceId, exhibitId: evaluationContext?.exhibitId, onEvaluationSubmit }} />
                </TesterWorkspace>
              </div>
            </div>
          ) : (
            <div className={`flex flex-col h-full text-slate-500 text-center ${isGenerating ? 'justify-start' : 'items-center justify-center'}`}>
              {isGenerating ? (
                <RunProgress events={events} elapsed={elapsed} />
              ) : (
                <><span className="text-6xl mb-3">🧩</span><p>Pick an objective and generate a session</p></>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PracticeStudioTester: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <LuminaAIProvider>
    <EvaluationProvider studentId="tester" exhibitId={`practice-studio-test-${Date.now()}`}>
      <PracticeStudioTesterInner onBack={onBack} />
    </EvaluationProvider>
  </LuminaAIProvider>
);

export default PracticeStudioTester;
