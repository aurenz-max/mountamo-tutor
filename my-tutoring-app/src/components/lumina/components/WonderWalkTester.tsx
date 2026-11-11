'use client';

/**
 * Wonder Walk tester: generate a walk with the real author agent, read what the agent did (turns, tool calls, the
 * independent solve, advisories), inspect every stop as an adult (key, traps, scene, image), and play it in the
 * teaching workspace — offline (real runtime, free) or with the Live tutor (paid).
 *
 * The inspector shows the key on purpose: it is the reviewer's view, beside the preview, never inside it.
 */
import { orderKey, sortKey } from '../primitives/visual-primitives/core/wonder-walk/wonderWalkWords';
import React, { useMemo, useState } from 'react';
import { getPrimitive } from '../config/primitiveRegistry';
import { EvaluationProvider, useEvaluationContext, type PrimitiveEvaluationResult } from '../evaluation';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { TesterWorkspace } from './live-activity/TesterWorkspace';
import type { WonderWalkData, WonderWalkStop } from '../primitives/visual-primitives/core/wonder-walk/WonderWalk';

interface WonderWalkTesterProps {
  onBack: () => void;
}

/** K topics by strand. Science is the pilot; language and math rows show where the walk grows next. */
const TOPIC_PRESETS: Array<{ domain: string; topics: string[] }> = [
  { domain: 'Science', topics: ['Living and nonliving things', 'What plants need to grow', 'What animals need', 'Animals and their homes', 'Weather and the seasons', 'Day and night sky', 'Our five senses', 'Push and pull'] },
  { domain: 'Social studies', topics: ['Community helpers', 'Rules at school and home'] },
  { domain: 'Math', topics: ['Counting to 5', 'Counting to 10', 'How many? Counting objects to 20', 'More and fewer', 'Comparing groups within 10', 'One more: the next number', 'Count out a number of objects', 'Adding and taking away within 10', 'Ways to make 5', 'Make ten', 'Teen numbers: ten and some more', 'Sort and count by colour', 'Count on from a number'] },
  { domain: 'Language', topics: ['Rhyming words', 'Beginning sounds', 'Ending sounds', 'Middle vowel sounds in CVC words', 'Clapping syllables', 'Blending sounds into words', 'Changing the first sound', 'Capital and lowercase letters', 'Letter sounds', 'Spelling CVC words', 'Sorting words: animals and foods', 'One and more than one', 'Position words: in, on, under, next to', 'Story details: who, what, where', 'Retelling a story in order'] },
];

/** Eval-mode pins: Auto lets the intent pick (the manifest's path); a pin skips the resolver. */
const MODES = ['auto', 'which-one', 'how-many', 'more-fewer', 'count-out', 'add-take', 'parts', 'teens', 'sort-count', 'count-on',
  'rhyme', 'first-sound', 'last-sound', 'middle-sound', 'syllables', 'blend', 'change-sound', 'letter-name', 'letter-sound', 'spell-word',
  'word-kinds', 'one-many', 'where-is', 'story-detail', 'story-order', 'sentence'] as const;
const TIERS = ['easy', 'medium', 'hard'] as const;

interface AgentDebug {
  turns?: number;
  seconds?: number;
  toolCalls?: Array<{ turn: number; name: string; ok: boolean; note?: string }>;
  review?: Array<{ stop: number; pick: string; alsoFits: string[]; note: string }>;
  advisories?: string[];
}

const TRAP_STYLE: Record<string, string> = {
  looks_like: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  goes_with: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  other: 'bg-slate-600/30 text-slate-300 border-slate-500/30',
  one_off: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  far_off: 'bg-slate-600/30 text-slate-300 border-slate-500/30',
  reversed: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

const timesOf = (emoji: string, n?: number) => (n === undefined ? emoji : `${emoji}×${n}`);

// ── Panels ───────────────────────────────────────────────────────────

const TracePanel: React.FC<{ debug: AgentDebug; ms: number | null }> = ({ debug, ms }) => {
  const calls = debug.toolCalls ?? [];
  const failed = calls.filter(c => !c.ok).length;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ['Turns', debug.turns ?? '—'],
          ['Agent s', debug.seconds ?? '—'],
          ['Round trip s', ms != null ? (ms / 1000).toFixed(1) : '—'],
          ['Tool errors', `${failed}/${calls.length}`],
        ].map(([label, value]) => (
          <div key={label as string} className="p-2 bg-slate-800/60 rounded">
            <div className="text-lg font-bold text-white">{value}</div>
            <div className="text-[10px] text-slate-500">{label}</div>
          </div>
        ))}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-400">Tool calls ({calls.length})</summary>
        <ul className="mt-2 space-y-1 max-h-48 overflow-auto">
          {calls.map((c, i) => (
            <li key={i} className={c.ok ? 'text-slate-400' : 'text-rose-300'}>
              <span className="text-slate-500">t{c.turn}</span> {c.ok ? '✓' : '✗'} {c.name}{c.note ? ` — ${c.note}` : ''}
            </li>
          ))}
        </ul>
      </details>
      {!!debug.review?.length && (
        <div className="text-xs">
          <div className="text-slate-400 mb-1">Independent solve (first finish)</div>
          <ul className="space-y-1">
            {debug.review.map(v => (
              <li key={v.stop} className="text-slate-300">
                Stop {v.stop + 1}: picked <b>{v.pick}</b>{v.alsoFits.length ? <span className="text-amber-300"> · also fits {v.alsoFits.join(', ')}</span> : null}
                {v.note ? <span className="text-slate-500"> — {v.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!debug.advisories?.length && (
        <div className="text-xs">
          <div className="text-slate-400 mb-1">Advisories</div>
          <ul className="list-disc pl-4 space-y-1 text-amber-200/80">{debug.advisories.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
    </div>
  );
};

const StopInspector: React.FC<{ stop: WonderWalkStop; index: number }> = ({ stop, index }) => (
  <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700 space-y-2 text-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-300">Stop {index + 1} <span className="text-slate-500 font-normal">· {stop.challengeType}{stop.standards ? ` · ${stop.standards}` : ''}{stop.world ? ` · ${stop.world.answer.kind}` : ''}</span></span>
      <span className="text-[10px] text-slate-500">{stop.sceneImage ? 'scene image ✓' : stop.world ? 'world' : 'emoji scene'}{stop.difficulty ? ` · ${stop.difficulty.band} (${stop.difficulty.score})` : ''}</span>
    </div>
    <div className="text-xs text-violet-300">Idea: {stop.idea}</div>
    <div className="flex gap-3">
      {stop.sceneImage
        ? <img src={stop.sceneImage} alt="" className="w-28 aspect-video object-cover rounded" />
        : <div className="w-28 aspect-video rounded bg-slate-800 flex items-center justify-center text-xl gap-2">{stop.sceneEmoji.map((e, i) => <span key={i}>{e}</span>)}</div>}
      <div className="flex-1 space-y-1">
        <p className="text-slate-200"><span className="text-slate-500 text-xs">Narration · </span>{stop.narration}</p>
        <p className="text-slate-200"><span className="text-slate-500 text-xs">Ask · </span>{stop.ask}</p>
        <p className="text-slate-400 text-xs"><span className="text-slate-500">Why-card · </span>{stop.why}</p>
        <p className="text-slate-500 text-[11px]">Scene shows: {stop.world ? stop.world.places.map(p => `${p.id} ${p.kind}${p.color ? ` (${p.color})` : ''} ${p.arrangement}: ${stop.world!.objects.filter(o => o.place === p.id).map(o => `${o.event === 'join' ? '+' : o.event === 'leave' ? '-' : ''}${o.color ? `${o.color} ` : ''}${o.word}`).join(' ') || 'empty'}`).join(' | ') : stop.sceneWords.join(', ')}</p>
        {stop.words && <p className="text-slate-500 text-[11px]">Cards: {stop.words.things.map(t => `${t.id} ${t.letter ?? t.word}${t.count ? `×${t.count}` : ''}${t.rel ? ` ${t.rel} ${t.landmark?.word}` : ''}`).join(' | ')}{stop.words.refs.length ? ` · refs ${stop.words.refs.map(r => r.letter ?? r.word).join(', ')}` : ''}{stop.words.say ? ` · says "${stop.words.say}"` : ''}</p>}
        {stop.words && <p className="text-emerald-300/80 text-[11px]">Key: {stop.words.answer.kind === 'tap' ? `${stop.correctOptionId} (${JSON.stringify(stop.words.answer.rule)})` : stop.words.answer.kind === 'sort' ? JSON.stringify(sortKey(stop.words)) : JSON.stringify(orderKey(stop.words))}</p>}
        {stop.world && <p className="text-emerald-300/80 text-[11px]">Key: {stop.world.answer.kind === 'move' ? `goal ${JSON.stringify(stop.world.answer.goal)}` : stop.correctOptionId}{stop.world.answer.kind === 'number' ? ` of ${stop.world.answer.choices.join('/')}` : ''}</p>}
        {stop.difficulty && <p className="text-slate-500 text-[11px]">Difficulty: {stop.difficulty.reasons.join(' · ')}</p>}
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {stop.options.map((o, k) => {
        const right = o.id === stop.correctOptionId;
        return (
          <span key={o.id} className={`px-2 py-1 rounded border text-xs ${right ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : TRAP_STYLE[o.trap ?? 'other']}`}>
            <span className="text-slate-500 mr-1">{k + 1}.</span>{o.emoji} {o.word} {right ? '✓ key' : `· ${o.trap}`}
          </span>
        );
      })}
    </div>
  </div>
);

const EvaluationResultsPanel: React.FC = () => {
  const context = useEvaluationContext();
  if (!context) return null;
  const last = context.submittedResults.at(-1);
  if (!last) return <p className="text-slate-500 text-xs text-center py-2">Finish the walk to see its evaluation</p>;
  const m = last.metrics as unknown as Record<string, number>;
  return (
    <div className={`p-3 rounded border text-xs space-y-1 ${last.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
      <div className="flex justify-between text-slate-200"><span>wonder-walk</span><span>{Math.round(last.score)}%</span></div>
      <div className="grid grid-cols-2 gap-1 text-slate-400">
        <span>Correct: {m.correctCount}/{m.totalChallenges}</span>
        <span>First try: {m.firstTryCount}</span>
        <span>Attempts: {m.attemptsCount}</span>
        <span>Avg attempts: {Number(m.averageAttemptsPerChallenge ?? 0).toFixed(1)}</span>
      </div>
    </div>
  );
};

// ── Tester ───────────────────────────────────────────────────────────

const WonderWalkTesterInner: React.FC<WonderWalkTesterProps> = ({ onBack }) => {
  const [topic, setTopic] = useState('Living and nonliving things');
  const [intent, setIntent] = useState('');
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState<(typeof MODES)[number]>('auto');
  const [tier, setTier] = useState<(typeof TIERS)[number]>('medium');
  const [images, setImages] = useState(true);
  const [tutorMode, setTutorMode] = useState<'offline' | 'live'>('offline');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WonderWalkData | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const evaluationContext = useEvaluationContext();
  const Component = getPrimitive('wonder-walk')?.component;
  // One instance per generated walk: the workspace keys its session on it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previewInstanceId = useMemo(() => `wonder-walk-${Date.now()}`, [data]);

  const generate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setData(null);
    const started = Date.now();
    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: 'wonder-walk',
            topic,
            gradeLevel: 'kindergarten',
            config: {
              intent: intent.trim() || `A Kindergarten picture walk on "${topic}"`,
              images,
              difficulty: tier,
              ...(mode !== 'auto' ? { targetEvalMode: mode } : {}),
              ...(seed.trim() ? { seed: Number(seed) } : {}),
            },
          },
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${response.statusText}`);
      }
      const result = await response.json();
      setData((result.data || result) as WonderWalkData);
      setMs(Date.now() - started);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyJson = async () => {
    if (!data) return;
    const shown = JSON.stringify(data, (k, v) => (k === 'sceneImage' && v ? '[image]' : v), 2);
    await navigator.clipboard.writeText(shown).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onEvaluationSubmit = (result: PrimitiveEvaluationResult) => console.log('[WonderWalkTester] evaluation', result);
  const debug = (data?.agentDebug ?? {}) as AgentDebug;

  return (
    <div className="min-h-screen">
      <div className="mb-4 text-center">
        <button onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all">
          ← Back to Home
        </button>
      </div>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white">🚶 Wonder Walk</h1>
        <p className="text-slate-400 text-sm mt-1">Agent-authored Kindergarten picture walk · one scene, one idea, tap the picture that fits</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        {/* Left: controls, trace, inspector */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 space-y-3">
            <label className="block text-xs font-semibold text-slate-400">Topic</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void generate(); }}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm" placeholder="A Kindergarten idea" />
            <div className="space-y-2">
              {TOPIC_PRESETS.map(group => (
                <div key={group.domain}>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{group.domain}</div>
                  <div className="flex flex-wrap gap-1">
                    {group.topics.map(t => (
                      <button key={t} type="button" onClick={() => setTopic(t)}
                        className={`px-2 py-1 rounded-full text-[11px] border ${topic === t ? 'bg-violet-600/40 border-violet-400/50 text-violet-100' : 'bg-slate-900/40 border-slate-600 text-slate-400 hover:text-slate-200'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <label className="block text-xs font-semibold text-slate-400">Lesson job (optional)</label>
            <input value={intent} onChange={e => setIntent(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Tell living from nonliving things" />
            <div className="flex items-center gap-2 text-xs">
              <select value={mode} onChange={e => setMode(e.target.value as typeof mode)} aria-label="Eval mode"
                className="px-2 py-1 bg-slate-900/60 border border-slate-600 rounded text-white">
                {MODES.map(m => <option key={m} value={m}>{m === 'auto' ? 'Auto (intent picks)' : m}</option>)}
              </select>
              <select value={tier} onChange={e => setTier(e.target.value as typeof tier)} aria-label="Support tier"
                className="px-2 py-1 bg-slate-900/60 border border-slate-600 rounded text-white">
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400 flex items-center gap-2">
                <input type="checkbox" checked={images} onChange={e => setImages(e.target.checked)} />
                Scene images (one per stop)
              </label>
              <input value={seed} onChange={e => setSeed(e.target.value.replace(/\D/g, ''))}
                className="w-24 px-2 py-1 bg-slate-900/60 border border-slate-600 rounded text-white text-xs" placeholder="seed" />
            </div>
            <button type="button" onClick={() => void generate()} disabled={isGenerating || !topic.trim()}
              className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm">
              {isGenerating ? 'Authoring the walk…' : 'Generate walk'}
            </button>
            <p className="text-[10px] text-slate-500">Paid: ~3-6 author turns + 1 review + {images ? 'one image per stop' : 'no images'}. Spend: <code>node scripts/gemini-spend.mjs</code></p>
            {error && <p className="text-xs text-rose-300 break-words">{error}</p>}
          </div>

          {data && (
            <>
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200">{data.title}</h3>
                  <button type="button" onClick={() => void copyJson()} className="text-[11px] text-slate-400 hover:text-slate-200">{copied ? 'Copied' : 'Copy JSON'}</button>
                </div>
                <p className="text-xs text-slate-400">Big idea: {data.bigIdea} · <span className="text-slate-500">{data.domain}</span></p>
                <TracePanel debug={debug} ms={ms} />
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 space-y-2">
                <h3 className="text-xs font-bold text-slate-300">Stops (reviewer view — shows the key)</h3>
                {data.challenges.map((s, i) => <StopInspector key={s.id} stop={s} index={i} />)}
              </div>
            </>
          )}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700"><EvaluationResultsPanel /></div>
        </div>

        {/* Right: the walk as the child meets it */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 min-h-[calc(100vh-200px)]">
          {data && Component ? (
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
                <TesterWorkspace primitiveId="wonder-walk" instanceId={previewInstanceId} evalMode={data.challengeType} offline={tutorMode === 'offline'}
                  data={data} topic={topic} gradeLevel="kindergarten" onEvaluationSubmit={onEvaluationSubmit}>
                  <Component data={{ ...data, instanceId: previewInstanceId, exhibitId: evaluationContext?.exhibitId, onEvaluationSubmit }} />
                </TesterWorkspace>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center">
              {isGenerating ? (
                <>
                  <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-400 rounded-full animate-spin mb-3" />
                  <p className="text-slate-300">The author is planning ideas and writing stops…</p>
                  <p className="text-xs mt-1">Code checks every stop; a second reader solves them before it ships.</p>
                </>
              ) : (
                <>
                  <span className="text-6xl mb-3">🚶</span>
                  <p>Pick a topic and generate a walk</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const WonderWalkTester: React.FC<WonderWalkTesterProps> = ({ onBack }) => (
  <LuminaAIProvider>
    <EvaluationProvider studentId="tester" exhibitId={`wonder-walk-test-${Date.now()}`}>
      <WonderWalkTesterInner onBack={onBack} />
    </EvaluationProvider>
  </LuminaAIProvider>
);

export default WonderWalkTester;
