'use client';

/**
 * LessonBenchRail — the human label, taken while the replayed lesson runs.
 *
 * Mounts over the playing exhibit whenever a Lesson Package is active
 * (lessonBenchSession registry) and renders nothing otherwise, so the
 * student flow never sees it.
 *
 * SHAPE OF THE ASK (user ruling 2026-09-03: "just feels like buttons — answer
 * leak? subskill fidelity? what do these even mean?"): the reviewer is asked
 * what a teacher actually thinks — one score for the lesson, keep / fix / cut
 * per block — and offered plain-language reasons only when something is off.
 * The rubric's check ids never appear here; every reason carries its check id
 * underneath (lessonPackage.ts BLOCK_REASONS / LESSON_REASONS), so the label
 * still joins the machine judge's citations block-for-block.
 *
 * Autosaves to localStorage per package id; Download writes the package back
 * out with `human` filled — that file IS the calibration row.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BLOCK_REASONS,
  HOLISTIC_ANCHORS,
  LESSON_REASONS,
  type BlockReaction,
  type LessonBenchBlockLabel,
  type LessonBenchHumanLabel,
} from '../service/qa/lessonBench/lessonPackage';
import {
  loadHumanLabel,
  saveHumanLabel,
  useActiveLessonPackage,
} from '../service/qa/lessonBench/lessonBenchSession';

const REACTIONS: Array<{ r: BlockReaction; label: string; on: string }> = [
  { r: 'keep', label: 'keep', on: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100' },
  { r: 'fix', label: 'fix', on: 'border-amber-400/60 bg-amber-500/20 text-amber-100' },
  { r: 'cut', label: 'cut', on: 'border-rose-400/60 bg-rose-500/20 text-rose-100' },
];

const chipClass = (selected: boolean, tone: 'amber' | 'rose' | 'cyan' = 'cyan') => {
  const on = tone === 'rose'
    ? 'border-rose-400/60 bg-rose-500/20 text-rose-100'
    : tone === 'amber'
      ? 'border-amber-400/60 bg-amber-500/20 text-amber-100'
      : 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100';
  return `rounded-full border px-2 py-0.5 text-[11px] leading-tight transition-colors ${
    selected ? on : 'border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30 hover:text-slate-200'
  }`;
};

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function LessonBenchRail() {
  const pkg = useActiveLessonPackage();
  const [open, setOpen] = useState(true);
  const [label, setLabel] = useState<LessonBenchHumanLabel | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showLessonWhy, setShowLessonWhy] = useState(false);

  const blocks = useMemo(
    () => (pkg?.manifest.layout ?? []).filter((i) => i.componentId !== 'curator-brief'),
    [pkg],
  );

  useEffect(() => {
    if (!pkg) { setLabel(null); return; }
    setLabel(loadHumanLabel(pkg.id, pkg.human));
    setSavedAt(null);
    setShowLessonWhy(false);
  }, [pkg]);

  const commit = useCallback(
    (next: LessonBenchHumanLabel) => {
      if (!pkg) return;
      const saved = saveHumanLabel(pkg.id, next);
      setLabel(saved);
      setSavedAt(saved.labeledAt);
    },
    [pkg],
  );

  if (!pkg || !label) return null;

  const setBlock = (instanceId: string, patch: Partial<LessonBenchBlockLabel> | null) => {
    const blocksNext = { ...label.blocks };
    if (patch === null) {
      delete blocksNext[instanceId];
    } else {
      const base: LessonBenchBlockLabel = blocksNext[instanceId] ?? { reaction: 'keep', reasons: [], note: '' };
      blocksNext[instanceId] = { ...base, ...patch };
    }
    commit({ ...label, blocks: blocksNext });
  };

  const react = (instanceId: string, r: BlockReaction) => {
    const cur = label.blocks[instanceId];
    if (cur?.reaction === r) { setBlock(instanceId, null); return; }
    setBlock(instanceId, { reaction: r, reasons: r === 'keep' ? [] : cur?.reasons ?? [] });
  };

  const labeledPackage = () => ({ ...pkg, human: label });

  const download = () => {
    const blob = new Blob([JSON.stringify(labeledPackage(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.id}.labeled.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = () => {
    void navigator.clipboard?.writeText(JSON.stringify(labeledPackage(), null, 2));
  };

  const machine = pkg.scores;
  const machineFlags = machine
    ? [...Object.entries(machine.gates), ...Object.entries(machine.checks)].filter(([, v]) => !v).map(([id]) => id)
    : [];
  const machineCitesFor = (instanceId: string) =>
    (machine?.citations ?? []).filter((c) => c.instanceId === instanceId).map((c) => c.checkId);

  const lessonWhyOpen = showLessonWhy || (label.holistic !== null && label.holistic <= 3) || label.lessonReasons.length > 0;
  const kept = blocks.filter((b) => label.blocks[b.instanceId]?.reaction === 'keep').length;
  const flagged = blocks.filter((b) => { const r = label.blocks[b.instanceId]?.reaction; return r === 'fix' || r === 'cut'; }).length;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/3 z-40 rounded-l-xl border border-r-0 border-cyan-400/40 bg-slate-950/90 px-2 py-3 text-[11px] font-semibold uppercase tracking-wide text-cyan-200 shadow-lg backdrop-blur-xl [writing-mode:vertical-rl]"
        title="Open the Lesson Bench rail"
      >
        Bench
      </button>
    );
  }

  return (
    <aside className="fixed bottom-3 right-3 top-16 z-40 flex w-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 text-xs text-slate-200 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-cyan-300">Lesson Bench</div>
          <div className="truncate text-sm font-semibold text-slate-100" title={pkg.id}>{pkg.manifest.topic}</div>
          <div className="text-[10px] text-slate-500">
            {pkg.manifest.gradeLevel} · {blocks.length} blocks
            {machine?.bucket && <> · machine says <span className="font-semibold text-slate-300">{machine.bucket}</span>{machineFlags.length > 0 && <> ({machineFlags.join(' ')})</>}</>}
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-full border border-white/10 px-2 py-0.5 text-slate-400 hover:text-white" title="Collapse">–</button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {/* The lesson */}
        <section>
          <div className="mb-1.5 text-[11px] font-medium text-slate-300">Would you run this lesson as-is?</div>
          <div className="flex items-center gap-1">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                onClick={() => commit({ ...label, holistic: label.holistic === n ? null : n })}
                title={HOLISTIC_ANCHORS[n]}
                className={`h-8 w-8 rounded-full border text-sm font-semibold transition-colors ${
                  label.holistic === n ? 'border-cyan-400/60 bg-cyan-500/25 text-cyan-100' : 'border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30'
                }`}
              >
                {n}
              </button>
            ))}
            {!lessonWhyOpen && (
              <button onClick={() => setShowLessonWhy(true)} className="ml-auto text-[11px] text-slate-500 hover:text-slate-300">
                something off?
              </button>
            )}
          </div>
          <div className="mt-1 min-h-[1.4em] text-[11px] leading-snug text-slate-400">
            {label.holistic ? HOLISTIC_ANCHORS[label.holistic as 1 | 2 | 3 | 4 | 5] : 'Hover a number to see what it means.'}
          </div>
          {lessonWhyOpen && (
            <div className="mt-2 flex flex-wrap gap-1">
              {LESSON_REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => commit({ ...label, lessonReasons: toggle(label.lessonReasons, r.id) })}
                  className={chipClass(label.lessonReasons.includes(r.id), 'amber')}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* The blocks */}
        <section>
          <div className="mb-1.5 flex items-baseline justify-between">
            <div className="text-[11px] font-medium text-slate-300">The blocks, in order</div>
            <div className="text-[10px] text-slate-500">{kept} kept · {flagged} flagged</div>
          </div>
          <ol className="space-y-1.5">
            {blocks.map((b, i) => {
              const bl = label.blocks[b.instanceId];
              const cites = machineCitesFor(b.instanceId);
              const showWhy = bl && bl.reaction !== 'keep';
              return (
                <li key={b.instanceId} className={`rounded-xl border px-2 py-1.5 ${
                  bl?.reaction === 'cut' ? 'border-rose-400/30 bg-rose-500/5'
                    : bl?.reaction === 'fix' ? 'border-amber-400/30 bg-amber-500/5'
                      : bl?.reaction === 'keep' ? 'border-emerald-400/30 bg-emerald-500/5'
                        : 'border-white/5 bg-slate-900/40'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-right text-[10px] text-slate-500">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] text-slate-100" title={b.title}>{b.title}</div>
                      <div className="truncate font-mono text-[10px] text-slate-500">
                        {b.componentId}
                        {cites.length > 0 && <span className="ml-1 text-rose-300" title="the machine judge flagged this block">· machine {cites.join(' ')}</span>}
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {REACTIONS.map(({ r, label: txt, on }) => (
                        <button
                          key={r}
                          onClick={() => react(b.instanceId, r)}
                          className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                            bl?.reaction === r ? on : 'border-white/10 bg-slate-900/60 text-slate-500 hover:border-white/30 hover:text-slate-200'
                          }`}
                        >
                          {txt}
                        </button>
                      ))}
                    </div>
                  </div>
                  {showWhy && (
                    <div className="mt-1.5 pl-6">
                      <div className="flex flex-wrap gap-1">
                        {BLOCK_REASONS.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setBlock(b.instanceId, { reasons: toggle(bl.reasons, r.id) })}
                            className={chipClass(bl.reasons.includes(r.id), bl.reaction === 'cut' ? 'rose' : 'amber')}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      <input
                        value={bl.note}
                        onChange={(e) => setLabel({ ...label, blocks: { ...label.blocks, [b.instanceId]: { ...bl, note: e.target.value } } })}
                        onBlur={() => commit(label)}
                        placeholder="in your own words (optional)"
                        className="mt-1 w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* Anything else */}
        <section>
          <div className="mb-1 text-[11px] font-medium text-slate-300">Anything else</div>
          <textarea
            value={label.note}
            onChange={(e) => setLabel({ ...label, note: e.target.value })}
            onBlur={() => commit(label)}
            rows={3}
            placeholder="What you'd tell the person who built this."
            className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
          />
        </section>
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
        <button onClick={download} className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/30">
          Download labeled JSON
        </button>
        <button onClick={copy} className="rounded-full border border-white/10 bg-slate-800/60 px-3 py-1 text-[11px] text-slate-300 hover:bg-slate-700/60">
          Copy
        </button>
        <span className="ml-auto text-[10px] text-slate-600">{savedAt ? `saved ${new Date(savedAt).toLocaleTimeString()}` : 'autosaves'}</span>
      </div>
    </aside>
  );
}
