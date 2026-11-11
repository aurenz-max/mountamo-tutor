'use client';

/**
 * Tester for the agent canvas (service/agent-kit/canvas): an agent writes a program the child operates, plays it
 * itself in a headless browser, and ships it when its own playthrough reaches the goal.
 *
 * Left: the objective and the live trace. Right: the gallery of every saved canvas (its first screen, its problems
 * on hover, whether it is a checked spec and whether lessons can get it). Opening one shows every problem's three
 * screenshots (start, a wrong attempt, solved), then the canvas as a lesson hosts it (the registered `agent-canvas`
 * primitive on the teaching workspace, with the evaluation it submits), then the run: what the agent planned, every
 * time it ran the canvas with what it did and saw, what the blind reader sent back, and the program.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getPrimitive } from '../config/primitiveRegistry';
import { EvaluationProvider, useEvaluationContext, type PrimitiveEvaluationResult } from '../evaluation';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { TesterWorkspace } from './live-activity/TesterWorkspace';
import type { AgentCanvasData } from '../primitives/visual-primitives/core/agent-canvas/AgentCanvas';
import type { CanvasData, PlayRecord } from '../service/agent-kit/canvas/canvasAuthor';
import type { PlayStep } from '../service/agent-kit/canvas/stage';
import type { KitEvent } from '../service/agent-kit/trace';
import { EventLine, RunProgress, readKitStream } from './KitRunProgress';

const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];
const PRESETS: Array<{ label: string; grade: string; topic: string; objective: string }> = [
  { label: 'Math: area of a rectangle', grade: '3', topic: 'Area of rectangles', objective: 'Find the area of a rectangle by tiling it with unit squares, and relate the count to multiplying its side lengths (3.MD.C.7)' },
  { label: 'Math: slope of a line', grade: '8', topic: 'Slope of a line', objective: 'Make a line through two points with a given slope, and see slope as rise over run (8.EE.B.5)' },
  { label: 'Science: balanced forces', grade: '3', topic: 'Balanced and unbalanced forces', objective: 'Predict and test how balanced and unbalanced forces change the motion of an object (3-PS2-1)' },
  { label: 'Science: food web', grade: '5', topic: 'Energy in a food web', objective: 'Build a food web that shows how energy moves from the sun through producers to consumers (5-LS2-1)' },
  { label: 'Engineering: lever', grade: '4', topic: 'Levers', objective: 'Place the fulcrum and the effort so a small force lifts a heavy load, and explain the trade between force and distance' },
  { label: 'Engineering: gear train', grade: '5', topic: 'Gears', objective: 'Build a gear train that turns an output gear at a target speed, and explain how tooth counts set the ratio' },
];

type ShotKind = 'rest' | 'miss' | 'proof';
const SHOT_WORDS: Record<ShotKind, string> = { rest: 'Start', miss: 'A wrong attempt', proof: 'Solved' };
interface SavedRun {
  name: string; title: string; topic: string; grade: string; objective: string;
  /** `spec`: several problems on one program, each played both ways by canvas-check. `run`: one authored run. */
  kind: 'spec' | 'run'; library: boolean; modified: number; costUsd?: number; seconds?: number;
  problems: Array<{ ask: string; goal: string; shots: ShotKind[] }>;
}
interface Frame { problem: number; kind: ShotKind; label: string }
interface LookLine { item: number; round: number; screenshot: boolean; answer?: string | null; shortcut?: string | null; issues?: string | null; offObjective?: string | null; disagrees?: string | null; error?: string }
interface CanvasDebug {
  turns?: number; seconds?: number; costUsd?: number; plays?: number; versions?: number;
  plan?: { idea: string; childDoes: string }; advisories?: string[];
  toolCalls?: Array<{ turn: number; name: string; ok: boolean; note?: string }>;
  playLog?: PlayRecord[]; look?: LookLine[];
}
type Loaded = CanvasData & { savedAs?: string; request?: { topic: string; grade: string; objective?: string }; lesson?: AgentCanvasData; lessonError?: string };
type Filter = 'all' | 'spec' | 'run' | 'library';

const gradeWords = (g: string) => (g === 'K' ? 'Kindergarten' : `grade ${g}`);
const gradeShort = (g: string) => (/kinder/i.test(g) ? 'K' : g.replace(/grade\s*/i, 'G'));
const stepWords = (s: PlayStep) => s.do === 'wait' ? `wait ${s.ms ?? 300}ms` : s.do === 'press' ? `press ${s.key}` : s.do === 'set' ? `set "${s.label}" to ${JSON.stringify(s.value)}`
  : s.do === 'click' ? `click ${s.target}` : `drag ${s.target} ${s.to ? `to ${s.to}` : `by (${s.dx ?? 0}, ${s.dy ?? 0})`}`;
const goalWords = (g: boolean | null) => (g === null ? 'not reported' : g ? 'met' : 'not met');
const shotUrl = (run: SavedRun, f: { problem: number; kind: ShotKind }) =>
  `/api/lumina/canvas?shot=${encodeURIComponent(run.name)}&problem=${f.problem}&kind=${f.kind}&v=${Math.round(run.modified)}`;
const agoWords = (ms: number) => {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 60 * 24 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`;
};
/** The frames a card steps through: a spec shows each problem's first screen; one run shows start, wrong attempt, solved. */
const cardFrames = (run: SavedRun): Frame[] => run.kind === 'spec'
  ? run.problems.flatMap((p, i) => { const kind = p.shots.includes('rest') ? 'rest' : p.shots[0]; return kind ? [{ problem: i + 1, kind, label: `Problem ${i + 1} of ${run.problems.length}` }] : []; })
  : (run.problems[0]?.shots ?? []).map(kind => ({ problem: 1, kind, label: SHOT_WORDS[kind] }));

const Tag: React.FC<{ tone?: 'slate' | 'cyan' | 'emerald' | 'violet'; children: React.ReactNode }> = ({ tone = 'slate', children }) => (
  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
    tone === 'cyan' ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : tone === 'emerald' ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
    : tone === 'violet' ? 'border-violet-400/40 bg-violet-500/15 text-violet-100' : 'border-white/10 bg-slate-900/60 text-slate-300'}`}>{children}</span>
);
const RunTags: React.FC<{ run: SavedRun }> = ({ run }) => (
  <>
    {run.grade && <Tag>{gradeShort(run.grade)}</Tag>}
    {run.kind === 'spec' ? <Tag tone="cyan">Checked spec · {run.problems.length} problems</Tag> : <Tag tone="violet">Agent run{typeof run.costUsd === 'number' ? ` · $${run.costUsd.toFixed(2)}` : ''}</Tag>}
    {run.library && <Tag tone="emerald">In lessons</Tag>}
  </>
);

/** One saved canvas in the gallery. Hovering (or focusing) steps through its frames; the dots pick one. */
const CanvasCard: React.FC<{ run: SavedRun; onOpen: () => void }> = ({ run, onOpen }) => {
  const frames = useMemo(() => cardFrames(run), [run]);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!active || pinned || frames.length < 2) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % frames.length), 1100);
    return () => clearInterval(timer);
  }, [active, pinned, frames.length]);
  const leave = () => { setActive(false); setPinned(false); setIndex(0); };
  const frame = frames[index];
  const ask = run.problems[(frame?.problem ?? 1) - 1]?.ask ?? '';

  return (
    <div data-canvas-card={run.name} onMouseEnter={() => setActive(true)} onMouseLeave={leave} onFocus={() => setActive(true)} onBlur={leave}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/50 hover:shadow-[0_12px_40px_-12px_rgba(34,211,238,0.35)]">
      <button type="button" onClick={onOpen} aria-label={`Open ${run.title}`} className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
        <div className="relative aspect-[3/2] overflow-hidden bg-[#0f172a]">
          {!frames.length && <div className="flex h-full items-center justify-center text-xs text-slate-500">No screenshot saved</div>}
          {/* Only the first frame loads until the card is hovered. */}
          {frames.map((f, i) => (i === 0 || active) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${f.problem}-${f.kind}`} alt={i === 0 ? `${run.title}: ${f.label}` : ''} loading="lazy" src={shotUrl(run, f)}
              className={`absolute inset-x-0 top-0 w-full transition-opacity duration-300${i === index ? 'opacity-100' : 'opacity-0'}`} />
          ))}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/90 to-transparent" />
          {frame && frames.length > 1 && (
            <span className={`pointer-events-none absolute bottom-2 left-3 text-[11px] font-medium text-slate-100 transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}>{frame.label}</span>
          )}
        </div>
        <div className="space-y-2 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-100">{run.title}</h3>
            <span className="shrink-0 text-[10px] text-slate-500">{agoWords(run.modified)}</span>
          </div>
          <p className="line-clamp-2 min-h-[2.5em] text-xs leading-snug text-slate-400">{ask}</p>
          <div className="flex flex-wrap gap-1"><RunTags run={run} /></div>
        </div>
      </button>
      {frames.length > 1 && (
        <div className="absolute right-2 top-2 flex gap-1 rounded-full bg-slate-950/70 px-1.5 py-1 backdrop-blur">
          {frames.map((f, i) => (
            <button key={i} type="button" aria-label={`${run.title}: show ${f.label}`} onMouseEnter={() => { setPinned(true); setIndex(i); }} onFocus={() => { setPinned(true); setIndex(i); }} onClick={onOpen}
              className={`h-2 w-2 rounded-full transition ${i === index ? 'bg-cyan-300' : 'bg-slate-500 hover:bg-slate-300'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

/** Every saved canvas, by its first screen. */
const Gallery: React.FC<{ runs: SavedRun[]; loaded: boolean; filter: Filter; setFilter: (f: Filter) => void; search: string; setSearch: (s: string) => void; shown: SavedRun[]; onOpen: (name: string) => void }> =
({ runs, loaded, filter, setFilter, search, setSearch, shown, onOpen }) => {
  const tabs: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: runs.length },
    { id: 'spec', label: 'Checked specs', count: runs.filter(r => r.kind === 'spec').length },
    { id: 'run', label: 'Agent runs', count: runs.filter(r => r.kind === 'run').length },
    { id: 'library', label: 'In lessons', count: runs.filter(r => r.library).length },
  ];
  return (
    <section aria-label="Saved canvases" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Which canvases" className="flex rounded-full border border-white/10 bg-slate-900/50 p-1 text-xs">
          {tabs.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={filter === t.id} onClick={() => setFilter(t.id)}
              className={`rounded-full px-3 py-1.5 transition ${filter === t.id ? 'bg-cyan-600/40 text-cyan-50' : 'text-slate-400 hover:text-slate-200'}`}>
              {t.label} <span className="text-slate-500">{t.count}</span>
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, topic, objective" aria-label="Search saved canvases"
          className="min-w-[200px] flex-1 rounded-full border border-white/10 bg-slate-900/50 px-4 py-2 text-xs text-white placeholder:text-slate-500" />
      </div>
      {loaded && !shown.length && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-sm text-slate-500">
          {runs.length ? 'No saved canvas matches.' : 'No canvas saved yet. Author one on the left.'}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {shown.map(r => <CanvasCard key={r.name} run={r} onOpen={() => onOpen(r.name)} />)}
      </div>
      <p className="text-[11px] text-slate-500">Opening a saved canvas is free. Hover a card to step through its problems. A checked spec passed <code>canvas-check</code> on every problem; an agent run is one authored draft.</p>
    </section>
  );
};

/** One problem's screenshots: one picture at the column's width, and a row that switches it between start, wrong attempt and solved. */
const ProblemShots: React.FC<{ run: SavedRun; problem: number; shots: ShotKind[]; wide: boolean; onZoom: (kind: ShotKind) => void }> = ({ run, problem, shots, wide, onZoom }) => {
  const [kind, setKind] = useState<ShotKind>(shots[0]);
  if (!shots.length) return <p className="text-[11px] text-slate-500">No screenshot saved.</p>;
  return (
    <div className={wide ? 'max-w-xl' : ''}>
      <button type="button" onClick={() => onZoom(kind)} aria-label={`Enlarge problem ${problem}: ${SHOT_WORDS[kind]}`}
        className="relative block aspect-[3/2] w-full overflow-hidden rounded-t-lg border border-white/10 bg-[#0f172a] transition hover:border-cyan-400/50">
        {shots.map(k => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={k} alt="" src={shotUrl(run, { problem, kind: k })} className={`absolute inset-x-0 top-0 w-full transition-opacity duration-200 ${k === kind ? 'opacity-100' : 'opacity-0'}`} />
        ))}
      </button>
      <div role="radiogroup" aria-label={`Problem ${problem} screenshot`} className="flex overflow-hidden rounded-b-lg border border-t-0 border-white/10 text-[10px]">
        {shots.map(k => (
          <button key={k} type="button" role="radio" aria-checked={k === kind} onMouseEnter={() => setKind(k)} onFocus={() => setKind(k)} onClick={() => setKind(k)}
            className={`flex-1 px-1 py-1.5 transition ${k === kind ? (k === 'proof' ? 'bg-emerald-500/20 text-emerald-200' : k === 'miss' ? 'bg-amber-500/20 text-amber-100' : 'bg-cyan-600/30 text-cyan-100') : 'text-slate-400 hover:text-slate-200'}`}>
            {SHOT_WORDS[k]}
          </button>
        ))}
      </div>
    </div>
  );
};

/** Every problem of the open canvas: its first screen, a wrong attempt and the solved screen, as the check saw them. */
const ProblemStrip: React.FC<{ run: SavedRun }> = ({ run }) => {
  const shots = useMemo(() => run.problems.flatMap((p, i) => p.shots.map(kind => ({ problem: i + 1, kind, label: `${run.problems.length > 1 ? `Problem ${i + 1}: ` : ''}${SHOT_WORDS[kind]}` }))), [run]);
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    if (zoom === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(null);
      if (e.key === 'ArrowRight') setZoom(z => (z === null ? z : (z + 1) % shots.length));
      if (e.key === 'ArrowLeft') setZoom(z => (z === null ? z : (z - 1 + shots.length) % shots.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom, shots.length]);
  if (!shots.length) return null;
  const at = (problem: number, kind: ShotKind) => shots.findIndex(s => s.problem === problem && s.kind === kind);
  const zoomed = zoom === null ? null : shots[zoom];

  return (
    <section aria-label="Problems" className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
      <div className={`grid grid-cols-1 gap-4 ${run.problems.length > 1 ? 'md:grid-cols-2 2xl:grid-cols-4' : ''}`}>
        {run.problems.map((p, i) => (
          <div key={i} className="space-y-2">
            <p className="text-xs text-slate-200">{run.problems.length > 1 && <span className="mr-1.5 rounded-full bg-cyan-600/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">{i + 1}</span>}{p.ask}</p>
            <ProblemShots run={run} problem={i + 1} shots={p.shots} wide={run.problems.length === 1} onZoom={kind => setZoom(at(i + 1, kind))} />
            <p className="text-[11px] leading-snug text-slate-500">Checks: {p.goal}</p>
          </div>
        ))}
      </div>
      {zoomed && (
        <div role="dialog" aria-modal="true" aria-label={zoomed.label} onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-6 backdrop-blur">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={zoomed.label} src={shotUrl(run, zoomed)} className="max-h-[82vh] max-w-full rounded-xl border border-white/10" />
          <p className="text-sm text-slate-200">{zoomed.label} <span className="text-slate-500">· {zoom! + 1} of {shots.length} · arrow keys to step, Esc to close</span></p>
        </div>
      )}
    </section>
  );
};

/** The canvas as a lesson hosts it: the registered `agent-canvas` primitive on the teaching workspace, and the record it submits. */
const LessonHost: React.FC<{ data: Loaded }> = ({ data }) => {
  const evaluationContext = useEvaluationContext();
  const Component = getPrimitive('agent-canvas')?.component;
  const [record, setRecord] = useState<PrimitiveEvaluationResult | null>(null);
  const [tutorMode, setTutorMode] = useState<'offline' | 'live'>('offline');
  const lesson = data.lesson;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const instanceId = useMemo(() => `agent-canvas-${Date.now()}`, [lesson]);
  useEffect(() => { setRecord(null); }, [lesson, tutorMode]);

  if (!lesson || !Component) {
    return <div className="rounded-2xl border border-amber-500/40 bg-amber-900/20 p-4 text-sm text-amber-100">This run cannot be played as a lesson: {data.lessonError ?? 'it has no lesson payload'}.</div>;
  }
  const metrics = record?.metrics as { attemptsCount?: number; firstTryCount?: number; totalChallenges?: number } | undefined;
  return (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <div role="radiogroup" aria-label="Tutor" className="flex w-fit rounded-lg border border-slate-600 text-xs">
        {(['offline', 'live'] as const).map(m => (
          <button key={m} type="button" role="radio" aria-checked={tutorMode === m} onClick={() => setTutorMode(m)}
            className={`px-3 py-1 ${tutorMode === m ? 'bg-cyan-600/40 text-cyan-100' : 'text-slate-400'}`}>
            {m === 'offline' ? 'Offline (free)' : 'Live tutor (paid)'}
          </button>
        ))}
      </div>
      <div key={`${instanceId}-${tutorMode}`} data-primitive-instance-id={instanceId}>
        <TesterWorkspace primitiveId="agent-canvas" instanceId={instanceId} evalMode={lesson.challengeType} offline={tutorMode === 'offline'}
          data={lesson} topic={data.request?.topic ?? data.title} gradeLevel={data.request?.grade ?? 'grade 4'} onEvaluationSubmit={setRecord}>
          <Component data={{ ...lesson, instanceId, exhibitId: evaluationContext?.exhibitId, onEvaluationSubmit: setRecord }} />
        </TesterWorkspace>
      </div>
      <p className="border-t border-slate-700 pt-3 text-xs text-slate-400" data-canvas-record="">
        {record
          ? <>Evaluation submitted: <span className="text-slate-200">{record.success ? 'passed' : 'not passed'}, score {record.score}</span>, {metrics?.attemptsCount ?? '?'} check(s), {metrics?.firstTryCount ?? '?'} of {metrics?.totalChallenges ?? '?'} right on the first check.</>
          : 'No evaluation submitted yet: it is sent when the canvas is solved.'}
      </p>
      <p className="text-xs text-slate-500">The program checks: <span className="text-slate-300">{data.goal}</span> (never shown to the child or sent to the tutor)</p>
    </div>
  );
};

/** The run: what the agent planned, every time it ran its canvas, what the reader sent back, and the program. */
const RunRecord: React.FC<{ data: Loaded }> = ({ data }) => {
  const d = (data.agentDebug ?? {}) as CanvasDebug;
  const plays = d.playLog ?? [];
  return (
    <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/40 p-4 text-sm text-slate-300">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <span>{d.turns ?? '?'} turns</span><span>{d.seconds ?? '?'} s</span><span>${(d.costUsd ?? 0).toFixed(2)}</span>
        <span>{d.versions ?? '?'} version(s) of the program</span><span>{d.plays ?? plays.length} play(s) of the last version</span>
        <span>{data.source.length.toLocaleString()} characters of source</span>{data.savedAs && <span>saved as qa/canvas/{data.savedAs}.json</span>}
      </div>
      {d.plan && <div className="text-xs"><p><span className="text-slate-500">Idea:</span> {d.plan.idea}</p><p><span className="text-slate-500">The child:</span> {d.plan.childDoes}</p></div>}
      {!!d.advisories?.length && <ul className="list-disc pl-5 text-xs text-amber-200">{d.advisories.map((a, i) => <li key={i}>{a}</li>)}</ul>}

      <details>
        <summary className="cursor-pointer text-xs font-semibold text-slate-200">The agent's own plays ({plays.length})</summary>
        {!plays.length && <p className="mt-2 text-xs text-slate-500">This run was saved before plays were recorded.</p>}
        <ol className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {plays.map((p, i) => (
            <li key={i} className="rounded-xl border border-slate-700 bg-slate-900/50 p-2 text-xs">
              <p className="text-slate-400">Play {i + 1}, version {p.version}: goal {goalWords(p.restGoal)} at rest, <span className={p.afterGoal ? 'text-emerald-300' : 'text-slate-200'}>{goalWords(p.afterGoal)}</span> after. <span className="text-slate-500">{p.kept}</span></p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`What the agent saw after play ${i + 1}`} src={`data:image/png;base64,${p.png}`} className="mt-2 w-full rounded-lg border border-slate-700" />
              <ol className="mt-2 list-decimal pl-5 text-slate-300">{p.steps.map((s, j) => <li key={j}>{stepWords(s)}</li>)}</ol>
              {!p.steps.length && <p className="mt-1 text-slate-500">No steps: the canvas at rest.</p>}
              {[...p.stepErrors, ...p.errors].map((e, j) => <p key={j} className="mt-1 text-rose-300">{e}</p>)}
            </li>
          ))}
        </ol>
      </details>

      <details open>
        <summary className="cursor-pointer text-xs font-semibold text-slate-200">The blind reader ({d.look?.length ?? 0} read(s) of the first screen)</summary>
        <ul className="mt-2 space-y-2 text-xs">
          {(d.look ?? []).map((l, i) => {
            const found = [l.disagrees, l.shortcut && `Shortcut: ${l.shortcut}`, l.issues && `Issue: ${l.issues}`, l.offObjective && `Off the objective: ${l.offObjective}`, l.error && `The reader failed: ${l.error}`].filter(Boolean) as string[];
            return (
              <li key={i} className="rounded-lg bg-slate-900/50 p-2">
                <p className="text-slate-400">Round {l.round}{l.screenshot ? '' : ' (no browser, read in words)'}: it would {l.answer ?? 'not say'}</p>
                {found.length ? found.map((f, j) => <p key={j} className="text-amber-200">{f}</p>) : <p className="text-emerald-300">Nothing to fix.</p>}
              </li>
            );
          })}
        </ul>
      </details>

      <details>
        <summary className="cursor-pointer text-xs font-semibold text-slate-200">Tool calls ({d.toolCalls?.length ?? 0})</summary>
        <ol className="mt-2 space-y-0.5 text-xs">{(d.toolCalls ?? []).map((t, i) => <li key={i} className={t.ok ? 'text-slate-400' : 'text-rose-300'}>turn {t.turn} {t.name}{t.note ? `: ${t.note}` : ''}</li>)}</ol>
      </details>
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-slate-200">The program</summary>
        <pre className="mt-2 max-h-[480px] overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-slate-300">{data.source}</pre>
      </details>
    </div>
  );
};

const CanvasTesterInner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [topic, setTopic] = useState(PRESETS[4].topic);
  const [objective, setObjective] = useState(PRESETS[4].objective);
  const [grade, setGrade] = useState(PRESETS[4].grade);
  const [data, setData] = useState<Loaded | null>(null);
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<KitEvent[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const loadRuns = useCallback(async () => {
    try { setRuns(((await (await fetch('/api/lumina/canvas')).json()) as { runs?: SavedRun[] }).runs ?? []); } catch { /* the list is a convenience */ }
    setRunsLoaded(true);
  }, []);
  useEffect(() => { void loadRuns(); }, [loadRuns]);

  useEffect(() => {
    if (!isGenerating) return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  const shown = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return runs.filter(r => (filter === 'all' || (filter === 'library' ? r.library : r.kind === filter))
      && words.every(w => [r.title, r.topic, r.objective, r.grade, r.name, ...r.problems.map(p => p.ask)].join(' ').toLowerCase().includes(w)));
  }, [runs, filter, search]);

  const generate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true); setError(null); setData(null); setEvents([]);
    try {
      const response = await fetch('/api/lumina/canvas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, grade: gradeWords(grade), objective }) });
      setData(await readKitStream<Loaded>(response, event => setEvents(prev => [...prev, event])));
      void loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to author the canvas');
    } finally {
      setIsGenerating(false);
    }
  };

  const open = async (name: string) => {
    if (!name) return;
    setError(null); setEvents([]); setOpening(name);
    try {
      const response = await fetch(`/api/lumina/canvas?name=${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error('Could not open that saved canvas');
      setData({ ...(await response.json() as Loaded), savedAs: name });
      window.scrollTo({ top: 0 });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not open that saved canvas'); }
    finally { setOpening(null); }
  };

  const openRun = data?.savedAs ? runs.find(r => r.name === data.savedAs) : undefined;
  // Previous and next step through the gallery as it is filtered, so a batch of new canvases can be played in a row.
  const position = openRun ? shown.findIndex(r => r.name === openRun.name) : -1;
  const neighbour = (step: number) => (position < 0 || shown.length < 2 ? undefined : shown[(position + step + shown.length) % shown.length]);

  return (
    <div className="min-h-screen">
      <div className="mb-4 text-center">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600">← Back to Home</button>
      </div>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white">🛠️ Canvas</h1>
        <p className="text-slate-400 text-sm mt-1">An agent writes a program the child operates, runs and plays it itself, and ships it when its own playthrough reaches the goal</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 space-y-3">
            <label className="block text-xs font-semibold text-slate-400" htmlFor="cv-topic">Topic</label>
            <input id="cv-topic" value={topic} onChange={e => setTopic(e.target.value)} className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm" />
            <label className="block text-xs font-semibold text-slate-400" htmlFor="cv-objective">Objective</label>
            <textarea id="cv-objective" value={objective} onChange={e => setObjective(e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm" />
            <div className="flex flex-wrap gap-1">
              {PRESETS.map(p => (
                <button key={p.label} type="button" onClick={() => { setTopic(p.topic); setObjective(p.objective); setGrade(p.grade); }}
                  className={`px-2 py-1 rounded-full text-[11px] border ${topic === p.topic ? 'bg-cyan-600/40 border-cyan-400/50 text-cyan-100' : 'bg-slate-900/40 border-slate-600 text-slate-400 hover:text-slate-200'}`}>
                  G{p.grade} {p.label}
                </button>
              ))}
            </div>
            <select value={grade} onChange={e => setGrade(e.target.value)} aria-label="Grade" className="px-2 py-1 bg-slate-900/60 border border-slate-600 rounded text-white text-xs">
              {GRADES.map(g => <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>)}
            </select>
            <button type="button" onClick={() => void generate()} disabled={isGenerating || !topic.trim()}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm">
              {isGenerating ? 'Writing, playing, fixing… (2-4 min)' : 'Author a canvas'}
            </button>
            <p className="text-[10px] text-slate-500">Paid: the first three runs cost $0.08-0.20 each. Needs Chromium on this machine. Spend: <code>node scripts/gemini-spend.mjs</code></p>
          </div>

          {!!events.length && (
            <details open={!data} className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 text-xs">
              <summary className="cursor-pointer font-semibold text-slate-300">Trace ({events.length})</summary>
              <ol className="mt-2 space-y-1">{events.map((e, i) => <EventLine key={i} event={e} />)}</ol>
            </details>
          )}
        </div>

        <div className={`space-y-4 transition-opacity ${opening ? 'opacity-60' : ''}`}>
          {error && <div className="rounded-2xl border border-rose-500/40 bg-rose-900/20 p-4 text-sm text-rose-200">{error}</div>}
          {isGenerating && <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-8"><RunProgress events={events} elapsed={elapsed} /></div>}
          {!isGenerating && !data && (
            <Gallery runs={runs} loaded={runsLoaded} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} shown={shown} onOpen={name => void open(name)} />
          )}
          {data && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setData(null)} className="rounded-full border border-white/10 bg-slate-900/50 px-4 py-2 text-xs text-slate-200 hover:border-cyan-400/50">← All canvases</button>
                <h2 className="text-lg font-semibold text-white">{data.title}</h2>
                {openRun && <div className="flex flex-wrap gap-1"><RunTags run={openRun} /></div>}
                {neighbour(1) && (
                  <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                    <button type="button" onClick={() => void open(neighbour(-1)!.name)} aria-label="Previous canvas" className="rounded-full border border-white/10 bg-slate-900/50 px-3 py-2 hover:border-cyan-400/50 hover:text-slate-100">←</button>
                    <span>{position + 1} of {shown.length}</span>
                    <button type="button" onClick={() => void open(neighbour(1)!.name)} aria-label="Next canvas" className="rounded-full border border-white/10 bg-slate-900/50 px-3 py-2 hover:border-cyan-400/50 hover:text-slate-100">→</button>
                  </div>
                )}
              </div>
              {data.request?.objective && <p className="text-xs text-slate-400">{data.request.grade ? `${data.request.grade}: ` : ''}{data.request.objective}</p>}
              {openRun && <ProblemStrip key={openRun.name} run={openRun} />}
              <LessonHost data={data} />
              <RunRecord data={data} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CanvasTester: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <LuminaAIProvider>
    <EvaluationProvider studentId="tester" exhibitId={`agent-canvas-test-${Date.now()}`}>
      <CanvasTesterInner onBack={onBack} />
    </EvaluationProvider>
  </LuminaAIProvider>
);

export default CanvasTester;
