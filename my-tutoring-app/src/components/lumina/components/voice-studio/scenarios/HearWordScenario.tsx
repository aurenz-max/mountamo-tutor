'use client';

/**
 * Hear-the-word scenario — a bench for judging a spoken answer from AUDIO with gemini-decision-1.
 *
 * Three modes: read a printed WORD, say a letter's SOUND, say a letter's NAME. Pick the target, pick what you will
 * actually say (the right answer or a wrong one), and speak. Each clip goes to `/api/lumina/audio-judge-bench`, which
 * asks three questions in parallel:
 *   told  — "the answer is X; is the learner right?" (the 11-11 bench's `item_score` shape)
 *   miss  — the app's `spoken_miss_audio` today: task + answer + the item's known misses
 *   blind — "which of these did the child say?" with no answer given (`hearBlind`); code reads the pick
 * The scoreboard counts each against what you said. Rows stay in this browser; Copy JSON exports them.
 * The studio's Judge Model picker does not apply here: every call is gemini-decision-1.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuminaButton, LuminaPanel, LuminaStat } from '../../../ui';
import { SoundManager } from '../../../utils/SoundManager';
import { useVoiceCapture, type CapturedUtterance, type VoiceCapture } from '../../../hooks/useVoiceCapture';
import { blindLetterCandidates, blindWordCandidates } from '../../../service/typesafe/blindWordCandidates';
import { childSound, LETTER_NAME } from '../../../primitives/visual-primitives/literacy/spokenReadingMisses';
import { PRESET_WORDS, type StudioScenarioProps } from '../types';
import CaptureSurface from '../CaptureSurface';

type Kind = 'word' | 'letter_sound' | 'letter_name';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'word', label: 'Read a word' },
  { id: 'letter_sound', label: 'Say the letter’s sound' },
  { id: 'letter_name', label: 'Say the letter’s name' },
];
const PRESET_LETTERS = ['s', 'm', 't', 'a', 'p', 'n', 'f', 'b', 'c', 'i'];

/** What you will say, and whether it is the right answer (the truth the scoreboard grades against). */
interface Said { label: string; right: boolean }
interface HearContext { kind: Kind; target: string; said: Said }

interface BenchResult {
  told: { pRight: number | null; ms: number; error?: string };
  miss: { reading: string | null; miss: string | null; p: number | null; ms: number; error?: string };
  blind: { heard: string | null; p: number | null; reading: string | null; top: { key: string; p: number }[]; ms: number; error?: string };
}

interface Row extends BenchResult {
  id: number;
  at: string;
  kind?: Kind;
  target: string;
  said: string;
  saidRight?: boolean;
  clipMs: number;
  clipUrl?: string;
}

const STORAGE_KEY = 'lumina.audioJudgeBench.rows';
const loadRows = (): Row[] => {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
};

const rowKind = (r: Row): Kind => r.kind ?? 'word';
const rightSaid = (r: Row) => r.saidRight ?? r.said === r.target;
/** Did this shape get right vs wrong correct, given what was said? null = no answer. */
const toldOk = (r: Row) => (r.told.pRight === null ? null : (r.told.pRight >= 0.5) === rightSaid(r));
const missOk = (r: Row) => (r.miss.reading === null ? null : (r.miss.reading === 'correct') === rightSaid(r));
const blindOk = (r: Row) => (r.blind.reading === null ? null : (r.blind.reading === 'correct') === rightSaid(r));

function score(rows: Row[], ok: (r: Row) => boolean | null) {
  const judged = rows.map(r => ({ r, ok: ok(r) })).filter(x => x.ok !== null);
  const wrongSaid = judged.filter(x => !rightSaid(x.r));
  return { right: judged.filter(x => x.ok).length, n: judged.length,
    falseRight: wrongSaid.filter(x => !x.ok).length, wrongN: wrongSaid.length };
}

/** A blind option key as a person reads it: `name_s` → "ess" (name), `sound_m` → "mmm" (sound). */
function optionLabel(key: string | null): string {
  if (!key) return '–';
  const m = key.match(/^(sound|name)_([a-z])(_with_vowel)?$/);
  if (!m) return key.replace(/^said_/, '').replace(/_/g, ' ');
  if (m[3]) return `"${m[2]}uh" (sound + vowel)`;
  return m[1] === 'name' ? `"${LETTER_NAME[m[2]]}" (name)` : `"${childSound(m[2])}" (sound)`;
}

/** The say-options for a target: the right answer first, then the common wrong ones. */
function sayOptions(kind: Kind, target: string, wordChoices: string[]): Said[] {
  if (kind === 'word') return [{ label: target, right: true }, ...wordChoices.map(w => ({ label: w, right: false }))];
  const sound = childSound(target), name = LETTER_NAME[target] ?? target;
  const others = PRESET_LETTERS.filter(l => l !== target && childSound(l) !== sound).slice(0, 3);
  if (kind === 'letter_sound') return [
    { label: sound, right: true },
    { label: name, right: false },
    ...(sound.length > 2 && sound[0] === sound[1] ? [{ label: `${target}uh`, right: false }] : []),
    ...others.map(l => ({ label: childSound(l), right: false })),
  ];
  return [{ label: name, right: true }, { label: sound, right: false }, ...others.map(l => ({ label: LETTER_NAME[l], right: false }))];
}

const Mark: React.FC<{ ok: boolean | null }> = ({ ok }) =>
  ok === null ? <span className="text-slate-500">–</span> : ok ? <span className="text-emerald-300">✓</span> : <span className="text-rose-300 font-bold">✗</span>;

const SCENARIO_ID = 'hear-word';

const HearWordScenario: React.FC<StudioScenarioProps> = ({ config }) => {
  const [kind, setKind] = useState<Kind>('word');
  const [target, setTarget] = useState('mat');
  const [customTarget, setCustomTarget] = useState('');
  const [said, setSaid] = useState<Said>({ label: 'mat', right: true });
  const [customSaid, setCustomSaid] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { setRows(loadRows()); }, []);
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.map(({ clipUrl: _u, ...r }) => r))); } catch { /* storage blocked */ }
  }, [rows]);

  const isWord = kind === 'word';
  const rawTarget = (customTarget.trim() || target).toLowerCase();
  const resolvedTarget = isWord ? rawTarget : rawTarget.slice(0, 1);
  const candidates = useMemo(() => (isWord ? blindWordCandidates(resolvedTarget)
    : /^[a-z]$/.test(resolvedTarget) ? blindLetterCandidates(resolvedTarget, kind === 'letter_name' ? 'name' : 'sound') : []),
  [isWord, kind, resolvedTarget]);
  const wordChoices = isWord ? candidates.filter(c => c.reading !== 'correct' && !c.key.startsWith('said_')).map(c => c.key) : [];
  const options = sayOptions(kind, resolvedTarget, wordChoices);
  const resolvedSaid: Said = customSaid.trim()
    ? { label: customSaid.trim().toLowerCase(), right: customSaid.trim().toLowerCase() === options[0]?.label }
    : said;

  const pickTarget = (k: Kind, t: string) => {
    setKind(k); setTarget(t); setCustomTarget(''); setCustomSaid('');
    setSaid(sayOptions(k, t, [])[0]);
  };

  const ctxRef = useRef<HearContext>({ kind, target: resolvedTarget, said: resolvedSaid });
  ctxRef.current = { kind, target: resolvedTarget, said: resolvedSaid };
  const voiceRef = useRef<VoiceCapture | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const judge = useCallback(async (utt: CapturedUtterance<HearContext>): Promise<BenchResult | null> => {
    setNote('Judging three ways…');
    try {
      const res = await fetch('/api/lumina/audio-judge-bench', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: utt.context.kind, target: utt.context.target, audioBase64: utt.base64 }) });
      const data = await res.json();
      if (!res.ok) { setNote(data?.error ?? `HTTP ${res.status}`); return null; }
      return data as BenchResult;
    } catch (e) { setNote(String((e as Error).message ?? e)); return null; }
  }, []);

  const onSettle = useCallback((result: BenchResult | null, utt: CapturedUtterance<HearContext>) => {
    if (!result) { SoundManager.invalid(); return; }
    setNote('');
    const { kind: k, target: t, said: s } = utt.context;
    const row: Row = { ...result, id: Date.now(), at: new Date().toISOString(), kind: k, target: t, said: s.label, saidRight: s.right,
      clipMs: utt.ms, clipUrl: utt.url };
    setRows(prev => [row, ...prev]);
    if (blindOk(row)) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    if (configRef.current.modality === 'turn') voiceRef.current?.stop();
  }, []);

  const voice = useVoiceCapture<BenchResult, HearContext>({
    modality: config.modality,
    getContext: () => ctxRef.current,
    judge,
    // One call per clip: the bench compares question shapes, not the escalation ladder.
    isConfident: () => true,
    onSettle,
    onNoSpeech: () => { SoundManager.invalid(); setNote('No speech detected — try again closer to the mic.'); },
    autoStart: config.autoArm,
    activationKey: `${SCENARIO_ID}:${kind}:${resolvedTarget}:${resolvedSaid.label}`,
    armDelayMs: config.armDelayMs,
    cooldownMs: config.cooldownMs,
  });
  voiceRef.current = voice;

  const kindRows = rows.filter(r => rowKind(r) === kind);
  const scores = [
    { label: 'Told the answer (item_score)', s: score(kindRows, toldOk) },
    { label: 'App today (spoken_miss)', s: score(kindRows, missOk) },
    { label: 'Blind (which one?)', s: score(kindRows, blindOk) },
  ];

  const chip = (active: boolean, tone: 'emerald' | 'rose' | 'cyan') =>
    `px-3 py-1.5 rounded-xl border-2 font-bold text-sm transition-all ${active
      ? tone === 'emerald' ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
        : tone === 'rose' ? 'bg-rose-500/20 border-rose-400/50 text-rose-200' : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
      : 'bg-slate-700/40 border-slate-500/30 text-slate-300 hover:bg-slate-600/40'}`;
  const shown = isWord ? resolvedTarget : kind === 'letter_name' ? resolvedTarget.toUpperCase() : resolvedTarget;

  return (
    <div className="space-y-4">
      <LuminaPanel className="space-y-3">
        <p className="text-xs text-amber-300/80">Every call here is gemini-decision-1; the Judge Model picker above does not apply.</p>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(k => (
            <button key={k.id} className={chip(kind === k.id, 'cyan')}
              onClick={() => pickTarget(k.id, k.id === 'word' ? 'mat' : 's')}>{k.label}</button>
          ))}
        </div>

        <p className="text-xs text-slate-500 uppercase tracking-wider pt-1">1 · {isWord ? 'Target word' : 'Target letter'} (what the screen shows)</p>
        <div className="flex flex-wrap gap-2">
          {(isWord ? ['mat', ...PRESET_WORDS.filter(w => w !== 'mat')] : PRESET_LETTERS).map(w => (
            <button key={w} onClick={() => pickTarget(kind, w)} className={chip(resolvedTarget === w, 'emerald')}>
              {kind === 'letter_name' ? w.toUpperCase() : w}
            </button>
          ))}
          <input value={customTarget} maxLength={isWord ? 12 : 1}
            onChange={e => { const v = e.target.value.toLowerCase(); setCustomTarget(v); setCustomSaid('');
              if (v.trim()) setSaid(sayOptions(kind, isWord ? v.trim() : v.trim().slice(0, 1), [])[0]); }}
            placeholder={isWord ? 'custom…' : 'letter'}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/20 text-slate-200 text-sm w-24 focus:outline-none focus:border-emerald-400/50" />
        </div>

        <p className="text-xs text-slate-500 uppercase tracking-wider pt-2">2 · What you will actually say (the truth for scoring)</p>
        <div className="flex flex-wrap gap-2">
          {options.map((o, i) => (
            <button key={`${o.label}-${i}`} onClick={() => { setSaid(o); setCustomSaid(''); }}
              className={chip(!customSaid.trim() && resolvedSaid.label === o.label, o.right ? 'emerald' : 'rose')}>
              {o.label}{o.right ? ' (right)' : ''}
            </button>
          ))}
          <input value={customSaid} onChange={e => setCustomSaid(e.target.value)} placeholder={isWord ? 'other word…' : 'other (e.g. snake)…'}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/20 text-slate-200 text-sm w-36 focus:outline-none focus:border-rose-400/50" />
        </div>
        <p className="text-xs text-slate-500">
          {isWord
            ? <>The blind question chooses among {candidates.length} options, never told which is right. A word off this list (say “sit” for “sun”) tests the “something else” option.</>
            : <>The blind question chooses among {candidates.length} options — every letter’s sound and every letter’s name, a sound with a vowel after it, a whole word, something else — never told which is wanted.</>}
        </p>
      </LuminaPanel>

      <LuminaPanel className="text-center py-6">
        <CaptureSurface
          voice={voice}
          modality={config.modality}
          idleLabel={`Say “${resolvedSaid.label}”`}
          listeningLabel={`Say “${resolvedSaid.label}” now`}
          startLabel={config.modality === 'open' ? 'Open mic' : `Start — say “${resolvedSaid.label}”`}
          statusNote={note}
        />
        <p className="mt-2 text-xs text-slate-500">
          Screen shows <span className="text-emerald-300 font-bold">{shown}</span>
          {!isWord && <> ({kind === 'letter_sound' ? 'asks for its sound' : 'asks for its name'})</>} · you say{' '}
          <span className={resolvedSaid.right ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>{resolvedSaid.label}</span>
          {resolvedSaid.right ? ' (right)' : ' (wrong)'}
        </p>
      </LuminaPanel>

      <LuminaPanel className="space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Scoreboard · {KINDS.find(k => k.id === kind)?.label} ({kindRows.length} clips)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {scores.map(({ label, s }) => (
            <LuminaStat key={label} label={label} accent={s.n && s.right / s.n >= 0.85 ? 'emerald' : 'amber'}
              value={s.n ? `${s.right}/${s.n}` : '–'}
              unit={s.wrongN ? `· ${s.falseRight}/${s.wrongN} wrong answers passed` : undefined} />
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <LuminaButton onClick={() => { void navigator.clipboard?.writeText(JSON.stringify(rows.map(({ clipUrl: _u, ...r }) => r), null, 1)); setNote('Copied rows as JSON.'); }}
            disabled={!rows.length}>Copy JSON</LuminaButton>
          <LuminaButton onClick={() => setRows([])} disabled={!rows.length}>Clear</LuminaButton>
        </div>
      </LuminaPanel>

      {rows.length > 0 && (
        <LuminaPanel className="overflow-x-auto">
          <table className="w-full text-sm text-slate-300">
            <thead className="text-xs text-slate-500 uppercase tracking-wider">
              <tr className="text-left">
                <th className="py-2 pr-3">Mode</th><th className="pr-3">Screen</th><th className="pr-3">Said</th><th className="pr-3">Clip</th>
                <th className="pr-3">Told: P(right)</th><th className="pr-3">App today: reading</th><th className="pr-3">Blind: heard → reading</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-white/10 align-top">
                  <td className="py-2 pr-3 text-xs text-slate-400">{rowKind(r).replace('_', ' ')}</td>
                  <td className="pr-3 font-bold text-emerald-200">{rowKind(r) === 'letter_name' ? r.target.toUpperCase() : r.target}</td>
                  <td className={`pr-3 font-bold ${rightSaid(r) ? 'text-emerald-200' : 'text-rose-200'}`}>{r.said}</td>
                  <td className="pr-3">
                    {r.clipUrl ? <button className="text-cyan-300 hover:underline" onClick={() => void new Audio(r.clipUrl).play()}>▶ {(r.clipMs / 1000).toFixed(1)}s</button>
                      : <span className="text-slate-600">{(r.clipMs / 1000).toFixed(1)}s</span>}
                  </td>
                  <td className="pr-3"><Mark ok={toldOk(r)} /> {r.told.pRight?.toFixed(2) ?? r.told.error ?? '–'}
                    <span className="text-slate-600 text-xs"> {r.told.ms}ms</span></td>
                  <td className="pr-3"><Mark ok={missOk(r)} /> {r.miss.reading ?? r.miss.error ?? '–'}{r.miss.p !== null ? ` ${r.miss.p.toFixed(2)}` : ''}
                    <span className="text-slate-600 text-xs"> {r.miss.ms}ms</span></td>
                  <td className="pr-3"><Mark ok={blindOk(r)} /> {optionLabel(r.blind.heard) ?? r.blind.error} → {r.blind.reading ?? '–'}
                    {r.blind.p !== null ? ` ${r.blind.p.toFixed(2)}` : ''}
                    <span className="text-slate-600 text-xs"> {r.blind.ms}ms</span>
                    {r.blind.error && <div className="text-xs text-rose-300">{r.blind.error}</div>}
                    {r.blind.top.length > 1 && (
                      <div className="text-xs text-slate-500">{r.blind.top.map(t => `${optionLabel(t.key)} ${t.p.toFixed(2)}`).join(' · ')}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </LuminaPanel>
      )}
    </div>
  );
};

export default HearWordScenario;
