'use client';

/**
 * LessonBenchPanel — drop a Lesson Package JSON, inspect it, play it.
 *
 * The dev-panel half of the Lesson Bench (the rail that takes the human
 * label lives in LessonBenchRail.tsx and mounts over the playing lesson).
 * Loading is client-only: FileReader → parseLessonPackage → onReplay, which
 * is App.startGenerate({ replay }) — the one launch verb. No server round
 * trip, no regeneration: what plays is what the file holds.
 *
 * Produce a package with
 *   GET /api/lumina/topic-trace?topic=<t>&gradeLevel=<g>&package=true
 * and save the response's `package` field as a .json file.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LESSON_BENCH_CHECKS,
  LessonPackageError,
  isLabelTouched,
  packageFidelity,
  parseLessonPackage,
  type LessonPackage,
} from '../service/qa/lessonBench/lessonPackage';
import {
  loadHumanLabel,
  loadRecentPackages,
  rememberRecentPackage,
  type RecentPackageSummary,
} from '../service/qa/lessonBench/lessonBenchSession';

interface LessonBenchPanelProps {
  onBack: () => void;
  onReplay: (pkg: LessonPackage) => void;
}

const bucketClass: Record<string, string> = {
  BROKEN: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  RUNNABLE: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  CLEAN: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
};

export default function LessonBenchPanel({ onBack, onReplay }: LessonBenchPanelProps) {
  const [pkg, setPkg] = useState<LessonPackage | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [recent, setRecent] = useState<RecentPackageSummary[]>([]);
  const [showRubric, setShowRubric] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(loadRecentPackages());
  }, [pkg]);

  const loadText = useCallback((text: string, name: string) => {
    setError(null);
    setFileName(name);
    try {
      const parsed = parseLessonPackage(JSON.parse(text));
      setPkg(parsed);
      rememberRecentPackage(parsed);
    } catch (e) {
      setPkg(null);
      if (e instanceof LessonPackageError) setError(e.message);
      else if (e instanceof SyntaxError) setError(`Not valid JSON: ${e.message}`);
      else setError(String(e));
    }
  }, []);

  const loadFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      loadText(await file.text(), file.name);
    },
    [loadText],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      void loadFile(e.dataTransfer.files?.[0]);
    },
    [loadFile],
  );

  const fidelity = useMemo(() => (pkg ? packageFidelity(pkg) : []), [pkg]);
  const missing = fidelity.filter((f) => !f.present).length;
  const label = useMemo(() => (pkg ? loadHumanLabel(pkg.id, pkg.human) : null), [pkg]);
  const labeled = isLabelTouched(label);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm text-white transition-all hover:bg-slate-700/50"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Lesson Bench</h1>
          <p className="text-xs text-slate-400">
            Drop a Lesson Package and play the exact lesson it holds — no regeneration. Rate it in the rail while it runs; the live tutor connects as in production.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        className={`mb-4 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? 'border-cyan-400/70 bg-cyan-500/10' : 'border-white/15 bg-slate-900/40 hover:border-white/30'
        }`}
      >
        <div className="text-3xl">📦</div>
        <div className="mt-2 text-sm text-slate-200">Drop a lesson package JSON here, or click to choose</div>
        <div className="mt-1 text-xs text-slate-500">
          Produce one with <code className="text-slate-400">/api/lumina/topic-trace?topic=…&amp;gradeLevel=…&amp;package=true</code> and save the <code className="text-slate-400">package</code> field.
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => { void loadFile(e.target.files?.[0]); e.currentTarget.value = ''; }}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <span className="font-semibold">{fileName ?? 'file'}</span> — {error}
        </div>
      )}

      {pkg && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-mono text-[11px] text-slate-500">{pkg.id}</div>
              <h2 className="mt-0.5 text-lg font-semibold text-slate-100">{pkg.manifest.topic}</h2>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 px-2 py-0.5">{pkg.manifest.gradeLevel}</span>
                {pkg.subskill?.id && <span className="rounded-full border border-white/10 px-2 py-0.5">subskill {pkg.subskill.id}</span>}
                <span className="rounded-full border border-white/10 px-2 py-0.5">{pkg.provenance.source}</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5">{new Date(pkg.provenance.generatedAt).toLocaleString()}</span>
                {pkg.scores?.bucket && (
                  <span className={`rounded-full border px-2 py-0.5 font-semibold ${bucketClass[pkg.scores.bucket] ?? ''}`}>{pkg.scores.bucket}</span>
                )}
                {labeled && <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">human label saved</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setPkg(null); setFileName(null); setError(null); }}
                className="rounded-full border border-white/10 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/60"
              >
                Clear
              </button>
              <button
                onClick={() => onReplay(pkg)}
                className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-5 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/30"
              >
                ▶ Play this lesson
              </button>
            </div>
          </div>

          {missing > 0 && (
            <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {missing} block{missing === 1 ? '' : 's'} in the layout carry no data in this package and will be skipped on replay.
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1 pr-3">#</th>
                  <th className="py-1 pr-3">Primitive</th>
                  <th className="py-1 pr-3">Title</th>
                  <th className="py-1 pr-3">Instance</th>
                  <th className="py-1">Data</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {fidelity.map((f, i) => (
                  <tr key={f.instanceId} className="border-t border-white/5">
                    <td className="py-1.5 pr-3 text-slate-500">{i + 1}</td>
                    <td className="py-1.5 pr-3 font-mono text-cyan-200">{f.componentId}</td>
                    <td className="py-1.5 pr-3">{f.title}</td>
                    <td className="py-1.5 pr-3 font-mono text-slate-500">{f.instanceId}</td>
                    <td className="py-1.5">{f.present ? <span className="text-emerald-300">✓</span> : <span className="text-amber-300">missing</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pkg.scores && (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Machine gates</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Object.entries(pkg.scores.gates).map(([id, v]) => (
                    <span key={id} className={`rounded-full border px-2 py-0.5 text-[11px] ${v ? 'border-emerald-400/40 text-emerald-200' : 'border-rose-400/40 text-rose-200'}`}>{id} {v ? '✓' : '✗'}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Machine checks · holistic {pkg.scores.holistic.join(' / ') || '—'}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Object.entries(pkg.scores.checks).map(([id, v]) => (
                    <span key={id} className={`rounded-full border px-2 py-0.5 text-[11px] ${v ? 'border-emerald-400/40 text-emerald-200' : 'border-rose-400/40 text-rose-200'}`}>{id} {v ? '✓' : '✗'}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Recently loaded</div>
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-slate-500">{r.id}</span>
                <span className="text-slate-300">{r.topic}</span>
                <span>· {r.gradeLevel}</span>
                <span>· {r.blocks} blocks</span>
                {r.labeled && <span className="text-cyan-300">· labeled</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-600">Packages are not stored in the browser (they carry images); drop the file again to replay. Labels are kept per package id.</p>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <button onClick={() => setShowRubric((s) => !s)} className="text-xs text-slate-400 hover:text-slate-200">
          {showRubric ? '▾' : '▸'} What the machine checks ({LESSON_BENCH_CHECKS.length}) — the plain-language reasons in the rail map onto these underneath
        </button>
        {showRubric && (
          <ul className="mt-3 space-y-1.5 text-xs">
            {LESSON_BENCH_CHECKS.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span className={`w-8 shrink-0 font-mono ${c.kind === 'gate' ? 'text-rose-300' : 'text-cyan-300'}`}>{c.id}</span>
                <span className="w-40 shrink-0 text-slate-200">{c.label}</span>
                <span className="text-slate-400">{c.passesWhen}</span>
                <span className="ml-auto shrink-0 text-[10px] uppercase text-slate-600">{c.judge}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
