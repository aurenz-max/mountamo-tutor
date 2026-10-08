'use client';

/**
 * Screen-share lab (2026-10-06): one count -> total -> numeral item, run by code.
 *
 * The stage is a <canvas> so the same pixels the child sees go to Gemini Live
 * as JPEG frames. Two voices to compare:
 *   - "script": code says fixed lines with the browser voice (free, instant).
 *   - "live":   Gemini Live sees the frames, hears the mic, and can point.
 * In both, CODE owns the steps: the glowing next truck, the number badge on each
 * touch, the loop around the group, and hiding the numbers until the total is said.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

type Step = 'idle' | 'count' | 'total' | 'choose' | 'done';
type Voice = 'script' | 'live';

const W = 960;
const H = 540;
const ITEMS = [3, 2, 4, 1, 5, 3, 4, 2, 5, 1];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const TRUCK_W = 110;
const TRUCK_H = 70;

interface Truck { x: number; y: number; touchedAs: number; popAt: number }
interface Card { value: number; x: number; y: number; w: number; h: number; state: 'plain' | 'right' | 'wrong'; at: number }

function layout(n: number, itemIndex: number): Truck[] {
  const scattered = itemIndex % 2 === 1;
  const gap = 40;
  const total = n * TRUCK_W + (n - 1) * gap;
  const x0 = (W - total) / 2;
  const jitter = [[0, -40], [0, 50], [0, -20], [0, 40], [0, -50]];
  return Array.from({ length: n }, (_, i) => ({
    x: x0 + i * (TRUCK_W + gap),
    y: 150 + (scattered ? jitter[(i + itemIndex) % 5][1] : 0),
    touchedAs: 0,
    popAt: 0,
  }));
}

function makeCards(n: number, itemIndex: number): Card[] {
  const other = n === 1 ? 2 : n === 5 ? 4 : (itemIndex % 3 === 0 ? n + 1 : n - 1);
  const values = itemIndex % 2 === 0 ? [n, other] : [other, n];
  return values.map((value, i) => ({ value, x: 290 + i * 220, y: 360, w: 160, h: 150, state: 'plain', at: 0 }));
}

function drawTruck(ctx: CanvasRenderingContext2D, x: number, y: number, fill: string, stroke: string) {
  ctx.lineWidth = 4;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.beginPath(); // dump bed
  ctx.moveTo(x, y); ctx.lineTo(x + 70, y); ctx.lineTo(x + 62, y + 45); ctx.lineTo(x + 8, y + 45); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); // cab
  ctx.moveTo(x + 72, y + 12); ctx.lineTo(x + 92, y + 12); ctx.lineTo(x + 108, y + 30); ctx.lineTo(x + 108, y + 50); ctx.lineTo(x + 72, y + 50); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(x + 78, y + 18, 14, 12);
  ctx.beginPath(); ctx.moveTo(x, y + 52); ctx.lineTo(x + 108, y + 52); ctx.stroke();
  for (const wx of [x + 22, x + 88]) {
    ctx.beginPath(); ctx.arc(wx, y + 60, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b'; ctx.fill(); ctx.stroke();
  }
}

function drawPip(ctx: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number, t: number) {
  const bob = Math.sin(t / 300) * 4;
  const y = py + bob;
  const angle = Math.atan2(ty - y, tx - px);
  const reach = Math.min(70, Math.hypot(tx - px, ty - y) - 10);
  const hx = px + Math.cos(angle) * reach;
  const hy = y + Math.sin(angle) * reach;
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(hx, hy, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(px, y, 34, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ca8a04'; ctx.lineWidth = 3; ctx.stroke();
  const look = { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 };
  ctx.fillStyle = '#fff';
  for (const ex of [-11, 11]) { ctx.beginPath(); ctx.arc(px + ex, y - 6, 8, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#0f172a';
  for (const ex of [-11, 11]) { ctx.beginPath(); ctx.arc(px + ex + look.x, y - 6 + look.y, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(px, y + 8, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
}

function b64FromBytes(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(s);
}

export default function ScreenCountLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [voice, setVoice] = useState<Voice>('script');
  const [name, setName] = useState('Sawyer');
  const [step, setStepState] = useState<Step>('idle');
  const [itemIndex, setItemIndex] = useState(0);
  const [status, setStatus] = useState('Not connected');
  const [log, setLog] = useState<{ role: string; text: string }[]>([]);
  const [score, setScore] = useState({ right: 0, tries: 0 });

  const st = useRef({
    step: 'idle' as Step,
    n: 0,
    item: 0,
    trucks: [] as Truck[],
    cards: [] as Card[],
    counted: 0,
    loopAt: 0,
    lastTouchAt: 0,
    nudged: false,
    pip: { x: 80, y: 460 },
    override: null as null | { target: string; until: number },
    celebrateAt: 0,
  });
  const ws = useRef<WebSocket | null>(null);
  const mic = useRef<{ ctx: AudioContext; stream: MediaStream; node: ScriptProcessorNode } | null>(null);
  const play = useRef<{ ctx: AudioContext; at: number; sources: AudioBufferSourceNode[] } | null>(null);
  const timers = useRef<number[]>([]);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const addLog = useCallback((role: string, text: string) => {
    setLog(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && role !== 'screen') return [...prev.slice(0, -1), { role, text: last.text + text }];
      return [...prev.slice(-60), { role, text }];
    });
  }, []);

  const setStep = (s: Step) => { st.current.step = s; setStepState(s); };
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const say = useCallback((text: string) => {
    if (voiceRef.current !== 'script' || typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85; u.pitch = 1.15;
    speechSynthesis.speak(u);
    addLog('pip', text + ' ');
  }, [addLog]);

  const event = useCallback((text: string) => {
    addLog('screen', text);
    if (voiceRef.current === 'live' && ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'event', text }));
    }
  }, [addLog]);

  // ---- item flow (code owns every step) ----
  const startItem = useCallback((index: number) => {
    clearTimers();
    const n = ITEMS[index % ITEMS.length];
    Object.assign(st.current, {
      n, item: index, trucks: layout(n, index), cards: makeCards(n, index), counted: 0,
      loopAt: 0, lastTouchAt: performance.now(), nudged: false, override: null, celebrateAt: 0,
    });
    setItemIndex(index);
    setStep('count');
    say('Touch each truck.');
    event(`New item: ${n} truck${n > 1 ? 's' : ''}. Say "Let's count the trucks!" and call point_at("truck-1"). Then stay quiet while ${name} touches them.`);
  }, [event, name, say]);

  const revealNumbers = useCallback(() => {
    if (st.current.step !== 'total') return;
    setStep('choose');
    say(`Which number says ${WORDS[st.current.n]}?`);
    if (voiceRef.current === 'live') addLog('screen', 'Numbers shown.');
  }, [addLog, say]);

  const finishCount = useCallback(() => {
    const s = st.current;
    setStep('total');
    s.loopAt = performance.now();
    if (voiceRef.current === 'script') {
      later(900, () => say('How many altogether?'));
      later(4500, () => { say(`${WORDS[s.n]} altogether!`); s.loopAt = performance.now(); });
      later(7000, revealNumbers);
    } else {
      event(`${name} touched all the trucks. The loop is around the group. There are ${s.n}. Ask how many altogether.`);
    }
  }, [event, name, revealNumbers, say]);

  const onTap = useCallback((x: number, y: number) => {
    const s = st.current;
    if (s.step === 'count') {
      const hit = s.trucks.find(t => t.touchedAs === 0 && x >= t.x - 10 && x <= t.x + TRUCK_W + 10 && y >= t.y - 15 && y <= t.y + TRUCK_H + 15);
      if (!hit) return;
      s.counted += 1;
      hit.touchedAs = s.counted;
      hit.popAt = performance.now();
      s.lastTouchAt = performance.now();
      s.nudged = false;
      say(WORDS[s.counted]);
      if (s.counted === s.n) later(700, finishCount);
    } else if (s.step === 'choose') {
      const card = s.cards.find(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
      if (!card) return;
      card.at = performance.now();
      setScore(prev => ({ right: prev.right + (card.value === s.n ? 1 : 0), tries: prev.tries + 1 }));
      if (card.value === s.n) {
        card.state = 'right';
        s.celebrateAt = performance.now();
        setStep('done');
        say(`Yes! ${WORDS[s.n]} trucks.`);
        event(`${name} tapped ${card.value}. Correct! Celebrate in 3 words, like "Yes! ${WORDS[s.n]} trucks!"`);
      } else {
        card.state = 'wrong';
        say(`That says ${WORDS[card.value]}. Find ${WORDS[s.n]}.`);
        event(`${name} tapped ${card.value}, but there are ${s.n}. Call point_at("number-${s.cards[0].value === s.n ? 'left' : 'right'}") and say "This one says ${WORDS[s.n]}."`);
        later(900, () => { card.state = 'plain'; });
      }
    }
  }, [event, finishCount, name, say]);

  // Idle nudge while counting: code notices, voice responds.
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = st.current;
      if (s.step === 'count' && !s.nudged && performance.now() - s.lastTouchAt > 9000) {
        s.nudged = true;
        say('Touch the shiny truck.');
        event(`${name} has not touched a truck for 9 seconds. Call point_at on the glowing truck and say "Touch this one."`);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [event, name, say]);

  // ---- render loop ----
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) { raf = requestAnimationFrame(draw); return; }
      const s = st.current;
      const t = performance.now();
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, W, H);

      const next = s.step === 'count' ? s.trucks.find(tr => tr.touchedAs === 0) : undefined;
      for (const tr of s.trucks) {
        const isNext = tr === next;
        const dim = s.step === 'count' && tr.touchedAs === 0 && !isNext;
        if (isNext) {
          ctx.fillStyle = `rgba(250, 204, 21, ${0.25 + 0.2 * Math.sin(t / 250)})`;
          ctx.beginPath(); ctx.ellipse(tr.x + 54, tr.y + 35, 78, 58, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = dim ? 0.35 : 1;
        drawTruck(ctx, tr.x, tr.y, tr.touchedAs ? '#fb923c' : '#ffffff', '#1e293b');
        ctx.globalAlpha = 1;
        if (tr.touchedAs) {
          const k = Math.min(1, (t - tr.popAt) / 250);
          const r = 22 * (k < 1 ? 0.6 + 0.6 * k : 1);
          ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(tr.x + 35, tr.y - 28, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(tr.touchedAs), tr.x + 35, tr.y - 27);
        }
      }

      // The loop around the whole group = "that many altogether".
      if (s.loopAt && s.trucks.length) {
        const xs = s.trucks.map(tr => tr.x), ys = s.trucks.map(tr => tr.y);
        const cx = (Math.min(...xs) + Math.max(...xs) + TRUCK_W) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys) + TRUCK_H) / 2 - 10;
        const rx = (Math.max(...xs) - Math.min(...xs) + TRUCK_W) / 2 + 45;
        const ry = (Math.max(...ys) - Math.min(...ys) + TRUCK_H) / 2 + 60;
        const k = Math.min(1, (t - s.loopAt) / 1100);
        ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 6; ctx.setLineDash([14, 10]);
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }

      if (s.step === 'choose' || s.step === 'done') {
        for (const card of s.cards) {
          const shake = card.state === 'wrong' ? Math.sin((t - card.at) / 30) * 8 : 0;
          ctx.fillStyle = card.state === 'right' ? '#dcfce7' : card.state === 'wrong' ? '#fee2e2' : '#ffffff';
          ctx.strokeStyle = card.state === 'right' ? '#16a34a' : '#334155'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.roundRect(card.x + shake, card.y, card.w, card.h, 20); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#0f172a'; ctx.font = 'bold 110px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(card.value), card.x + card.w / 2 + shake, card.y + card.h / 2 + 6);
        }
      }

      if (s.celebrateAt) {
        const k = (t - s.celebrateAt) / 1000;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          ctx.fillStyle = ['#facc15', '#fb923c', '#22c55e', '#3b82f6'][i % 4];
          ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * k * 260, 300 + Math.sin(a) * k * 180 + k * k * 60, 9, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Pip: code target by step; a Live point_at overrides for a few seconds.
      let target = { x: 120, y: 380 };
      const ov = s.override && s.override.until > t ? s.override.target : null;
      const centerOf = (tr: Truck) => ({ x: tr.x + 54, y: tr.y + 30 });
      if (ov) {
        const m = /^truck-(\d+)$/.exec(ov);
        if (m && s.trucks[+m[1] - 1]) target = centerOf(s.trucks[+m[1] - 1]);
        else if (ov === 'group' && s.trucks.length) target = { x: W / 2, y: 110 };
        else if (ov === 'number-left') target = { x: s.cards[0].x + 80, y: s.cards[0].y + 20 };
        else if (ov === 'number-right') target = { x: s.cards[1].x + 80, y: s.cards[1].y + 20 };
      } else if (next) target = centerOf(next);
      else if (s.step === 'total' && s.trucks.length) target = { x: W / 2, y: 110 };
      // choose/done: Pip waits off to the side, hand up — never near or over a card.
      const waiting = !ov && (s.step === 'choose' || s.step === 'done');
      if (waiting) target = { x: 110, y: 300 };
      const home = waiting
        ? { x: 110, y: 400 }
        : ov?.startsWith('number-')
          ? { x: target.x, y: 300 }
          : { x: Math.max(70, Math.min(W - 70, target.x - 70)), y: Math.max(330, Math.min(H - 60, target.y + 120)) };
      s.pip.x += (home.x - s.pip.x) * 0.08; s.pip.y += (home.y - s.pip.y) * 0.08;
      drawPip(ctx, s.pip.x, s.pip.y, target.x, target.y, t);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- Live connection ----
  const playAudio = (b64: string, rate: number) => {
    if (!play.current) {
      const ctx = new AudioContext({ sampleRate: rate });
      play.current = { ctx, at: 0, sources: [] };
    }
    const p = play.current;
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    const pcm = new Int16Array(bytes.buffer, 0, bytes.byteLength >> 1);
    const buf = p.ctx.createBuffer(1, pcm.length, rate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = p.ctx.createBufferSource();
    src.buffer = buf; src.connect(p.ctx.destination);
    p.at = Math.max(p.at, p.ctx.currentTime + 0.03);
    src.start(p.at); p.at += buf.duration;
    p.sources.push(src);
    src.onended = () => { p.sources = p.sources.filter(x => x !== src); };
  };

  const disconnect = useCallback(() => {
    ws.current?.close(); ws.current = null;
    if (mic.current) { mic.current.node.disconnect(); mic.current.stream.getTracks().forEach(tr => tr.stop()); mic.current.ctx.close(); mic.current = null; }
    setStatus('Not connected');
  }, []);

  const connect = useCallback(async () => {
    setStatus('Signing in…');
    const { getAuth } = await import('firebase/auth');
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) { setStatus('Sign in to the app first (any Lumina page), then reload.'); return; }
    const base = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const socket = new WebSocket(`${base}/api/lab/screen-tutor`);
    ws.current = socket;
    socket.onopen = () => { socket.send(JSON.stringify({ token, name })); setStatus('Connecting to Live…'); };
    socket.onclose = ev => { setStatus(`Closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ''})`); };
    socket.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'ready') setStatus(`Live: ${msg.model}`);
      else if (msg.type === 'audio') playAudio(msg.data, msg.sampleRate || 24000);
      else if (msg.type === 'transcript') addLog(msg.role, msg.text);
      else if (msg.type === 'interrupted') { play.current?.sources.forEach(sr => sr.stop()); if (play.current) play.current.at = 0; }
      else if (msg.type === 'error') setStatus(`Error: ${msg.message}`);
      else if (msg.type === 'tool') {
        addLog('screen', `Pip tool: ${msg.name}(${JSON.stringify(msg.args)})`);
        if (msg.name === 'point_at') st.current.override = { target: String(msg.args.target), until: performance.now() + 3500 };
        if (msg.name === 'point_at' && msg.args.target === 'group') st.current.loopAt = performance.now();
        if (msg.name === 'reveal_numbers') revealNumbers();
        socket.send(JSON.stringify({ type: 'tool_result', id: msg.id, name: msg.name, result: 'ok' }));
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    const ctx = new AudioContext({ sampleRate: 16000 });
    const node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = e => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const f = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(f.length);
      const p = play.current;
      if (!(p && p.at > p.ctx.currentTime - 0.25)) for (let i = 0; i < f.length; i++) pcm[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff;
      socket.send(JSON.stringify({ type: 'audio', data: b64FromBytes(new Uint8Array(pcm.buffer)) }));
    };
    ctx.createMediaStreamSource(stream).connect(node);
    node.connect(ctx.destination);
    mic.current = { ctx, stream, node };
  }, [addLog, name, revealNumbers]);

  // Frames: the stage, ~1 per second, only while Live is open.
  useEffect(() => {
    const small = document.createElement('canvas');
    small.width = 640; small.height = 360;
    const id = window.setInterval(() => {
      const socket = ws.current, c = canvasRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !c || st.current.step === 'idle') return;
      small.getContext('2d')!.drawImage(c, 0, 0, 640, 360);
      const data = small.toDataURL('image/jpeg', 0.6).split(',')[1];
      socket.send(JSON.stringify({ type: 'frame', data }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => { clearTimers(); disconnect(); }, [disconnect]);

  const tapCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onTap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  };

  const live = status.startsWith('Live');
  return (
    <div className="mx-auto max-w-6xl p-4 text-slate-100">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">Screen-count lab</span>
        <label className="flex items-center gap-1">Voice
          <select className="rounded bg-slate-800 px-2 py-1" value={voice} onChange={e => { disconnect(); setVoice(e.target.value as Voice); }}>
            <option value="script">Script (browser voice, free)</option>
            <option value="live">Gemini Live (sees screen, paid)</option>
          </select>
        </label>
        <label className="flex items-center gap-1">Name
          <input className="w-24 rounded bg-slate-800 px-2 py-1" value={name} onChange={e => setName(e.target.value)} />
        </label>
        {voice === 'live' && (live
          ? <button className="rounded bg-rose-600 px-3 py-1" onClick={disconnect}>Hang up</button>
          : <button className="rounded bg-emerald-600 px-3 py-1" onClick={connect}>Connect mic + Live</button>)}
        <button className="rounded bg-sky-600 px-3 py-1 disabled:opacity-40" disabled={voice === 'live' && !live}
          onClick={() => startItem(step === 'idle' ? 0 : itemIndex + 1)}>{step === 'idle' ? 'Start' : 'Next item'}</button>
        {step === 'total' && <button className="rounded bg-slate-700 px-3 py-1" onClick={revealNumbers}>Show numbers (grown-up)</button>}
        <span className="text-slate-400">{voice === 'live' ? status : 'Script mode'} · {score.right}/{score.tries} right · step: {step}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <canvas ref={canvasRef} width={W} height={H} onPointerDown={tapCanvas}
          className="w-full touch-none rounded-2xl border border-white/10 bg-white" style={{ aspectRatio: `${W} / ${H}` }} />
        <div className="h-[540px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs">
          {log.map(l => ({ ...l, text: l.text.replace(/<no speech>|\{pause\}|​/g, '').trim() })).filter(l => l.text).map((l, i) => (
            <div key={i} className={l.role === 'screen' ? 'text-slate-500' : l.role === 'child' ? 'text-sky-300' : 'text-amber-200'}>
              <b>{l.role}:</b> {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
