// Complete loop (4-PS3-2). A battery, one or two bulbs and a few wires on a bench. The child first drags the guess tag
// to YES (it lights) or NO (it stays dark); the tag then stays put, and only then can the wire ends be dragged to the
// contacts to build the set-up the ask names (or to finish a circuit with a gap). A bulb glows only once the guess is
// placed, and only when it sits on a complete loop from the plus end back to the minus end. Nothing marks the guess
// right or wrong: Check judges it (tag matches whether the named set-up lights, and the wires are that set-up).
// Params: bulbs (1 | 2), wires (how many wires, 1-3), prewired ([[a, b] | null] per wire; b may be 'gap', a spot near
// the minus end that touches nothing), target ([[a, b]] the set-up the ask names), guessAbout ('build' | 'start':
// whether the guess is about the target set-up or the wires as they start).
function Display({ params, lumina }) {
  const nBulbs = Number(params.bulbs) === 2 ? 2 : 1;
  const nWires = Math.max(1, Math.min(3, Number(params.wires) || 2));
  const prewired = Array.isArray(params.prewired) ? params.prewired : [];
  const guessAbout = params.guessAbout === 'start' ? 'start' : 'build';
  const W = 680, H = 400;

  // ---------- the bench ----------
  const BULB_CX = nBulbs === 2 ? [320, 460] : [430];
  const T = {
    bat_pos: { x: 150, y: 110 },
    bat_neg: { x: 150, y: 270 },
  };
  BULB_CX.forEach((cx, i) => {
    const s = i === 0 ? 'bulb' : 'bulb2';
    T[s + '_side'] = { x: cx - 58, y: 180 };
    T[s + '_base'] = { x: cx, y: 250 };
  });
  const TERMS = Object.keys(T);
  const GAP = { x: 214, y: 236 };
  const bulbPairs = BULB_CX.map((_, i) => (i === 0 ? ['bulb_side', 'bulb_base'] : ['bulb2_side', 'bulb2_base']));
  const WIRE_COLORS = ['#fbbf24', '#22d3ee', '#f472b6'];
  const span = (nWires - 1) * 110 + 60;
  const trayPos = (i, end) => ({ x: 360 - span / 2 + i * 110 + (end === 'start' ? 0 : 60), y: end === 'start' ? 318 : 366 });

  const valid = k => TERMS.includes(k) || k === 'gap';
  const startWires = () => Array.from({ length: nWires }, (_, i) => {
    const p = Array.isArray(prewired[i]) ? prewired[i] : [];
    return { start: valid(p[0]) && p[0] !== 'gap' ? p[0] : 'tray', end: valid(p[1]) ? p[1] : 'tray' };
  });
  const pairsOf = ws => ws.filter(w => TERMS.includes(w.start) && TERMS.includes(w.end) && w.start !== w.end).map(w => [w.start, w.end]);

  // Which bulbs glow for a set of wire pairs: a bulb glows when it sits on a path from plus to minus that runs through
  // wires and bulbs, unless a wire alone joins plus to minus (all dark) or a wire joins its own two contacts.
  const glowing = pairs => {
    const adj = {};
    TERMS.forEach(k => { adj[k] = []; });
    pairs.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    const paths = throughBulbs => {
      const out = [], seen = new Set();
      const dfs = (cur, path) => {
        if (cur === 'bat_neg') { out.push(path); return; }
        seen.add(cur);
        const next = [...adj[cur]];
        if (throughBulbs) bulbPairs.forEach(([s, b]) => { if (cur === s) next.push(b); if (cur === b) next.push(s); });
        next.forEach(n => { if (!seen.has(n)) dfs(n, [...path, n]); });
        seen.delete(cur);
      };
      dfs('bat_pos', ['bat_pos']);
      return out;
    };
    if (paths(false).length) return bulbPairs.map(() => false);
    const loops = paths(true);
    const bypassed = (s, b) => pairs.some(([x, y]) => (x === s && y === b) || (x === b && y === s));
    return bulbPairs.map(([s, b]) => !bypassed(s, b) && loops.some(p => {
      const i = p.indexOf(s), j = p.indexOf(b);
      return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
    }));
  };

  const target = (Array.isArray(params.target) ? params.target : [])
    .filter(p => Array.isArray(p) && TERMS.includes(p[0]) && TERMS.includes(p[1]));
  const askedPairs = guessAbout === 'start' ? pairsOf(startWires()) : target;
  const key = glowing(askedPairs).every(Boolean) ? 'yes' : 'no';

  // ---------- the said answer ----------
  useEffect(() => {
    const isBat = k => k === 'bat_pos' || k === 'bat_neg';
    const isBulb = k => k.startsWith('bulb');
    const misrules = [];
    // A wire from plus and a wire back to minus make a loop, even when both meet the bulb at one contact.
    const touches = k => askedPairs.some(p => p.includes(k));
    if (key === 'no' && touches('bat_pos') && touches('bat_neg')) {
      misrules.push({ says: 'yes', because: 'thinks a wire from the plus end and a wire back to the minus end make a loop, even when both join the bulb at the same contact' });
    }
    // One wire from the battery to the bulb is enough.
    if (askedPairs.some(([a, b]) => (isBat(a) && isBulb(b)) || (isBat(b) && isBulb(a)))) {
      misrules.push({ says: 'yes', because: 'thinks one wire from the battery to the bulb is enough' });
    }
    // Every bulb needs its own wire from the plus end.
    if (nBulbs === 2 && bulbPairs.some(bp => !askedPairs.some(([a, b]) => (a === 'bat_pos' && bp.includes(b)) || (b === 'bat_pos' && bp.includes(a))))) {
      misrules.push({ says: 'no', because: 'thinks each bulb needs its own wire from the plus end of the battery' });
    }
    const seen = new Set();
    lumina.answer(key, misrules.filter(m => m.says !== key && !seen.has(m.says) && seen.add(m.says)), ['yes', 'no']);
  }, []);

  // ---------- state ----------
  const [wires, setWires] = useState(startWires);
  const [guess, setGuess] = useState(null); // null | 'yes' | 'no'
  const [drag, setDrag] = useState(null); // { kind: 'tag' } | { kind: 'wire', i, end, x?, y? }
  const svgRef = useRef(null);

  const nowPairs = pairsOf(wires);
  const lit = glowing(nowPairs);
  const shown = lit.map(l => l && !!guess);
  const sameSet = (a, b) => {
    const norm = ps => ps.map(([x, y]) => [x, y].sort().join('|')).sort().join(',');
    return norm(a) === norm(b);
  };
  const loose = wires.some(w => (w.start === 'tray') !== (w.end === 'tray') || w.end === 'gap');
  const met = guess === key && !loose && sameSet(nowPairs, target);

  const NAMES = {
    bat_pos: 'the plus end of the battery',
    bat_neg: 'the minus end of the battery',
    bulb_side: nBulbs === 2 ? "the left bulb's side" : "the bulb's side",
    bulb_base: nBulbs === 2 ? "the left bulb's bottom" : "the bulb's bottom",
    bulb2_side: "the right bulb's side",
    bulb2_base: "the right bulb's bottom",
    gap: 'nothing (it stops short of the minus end)',
    tray: 'the tray',
  };

  useEffect(() => {
    lumina.goal(met);
    lumina.scene({
      guessTag: guess ? (guess === 'yes' ? 'placed on YES, it lights' : 'placed on NO, it stays dark') : 'not placed yet',
      wires: wires.map((w, i) => (w.start === 'tray' && w.end === 'tray'
        ? `Wire ${i + 1}: on the tray`
        : `Wire ${i + 1}: from ${NAMES[w.start]} to ${NAMES[w.end]}`)),
      bulbs: nBulbs === 2
        ? ['left bulb', 'right bulb'].map((n, i) => `${n}: ${shown[i] ? 'glowing' : 'dark'}`)
        : [`bulb: ${shown[0] ? 'glowing' : 'dark'}`],
    });
  }, [wires, guess, met]);

  // ---------- drag ----------
  const onDown = (d, e) => {
    if (d.kind === 'tag' && guess) return;
    if (d.kind === 'wire' && !guess) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(d);
  };
  const onMove = e => {
    if (!drag || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    setDrag(d => (d ? { ...d, x: pt.x, y: pt.y } : null));
  };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    const d = drag;
    setDrag(null);
    if (d.kind === 'tag') {
      if (pt.x < 552 || pt.x > 678) return;
      const k = pt.y >= 44 && pt.y <= 166 ? 'yes' : pt.y >= 170 && pt.y <= 292 ? 'no' : null;
      if (k) setGuess(k);
      return;
    }
    let near = null, best = 40;
    TERMS.forEach(k => {
      const dist = Math.hypot(T[k].x - pt.x, T[k].y - pt.y);
      if (dist < best) { best = dist; near = k; }
    });
    setWires(ws => ws.map((w, i) => (i === d.i ? { ...w, [d.end]: near || 'tray' } : w)));
  };

  // Several wire ends on one contact fan out, so each stays tappable.
  const OFFSETS = [{ x: 0, y: 0 }, { x: 0, y: 36 }, { x: 34, y: 24 }];
  const endAt = (i, end) => {
    if (drag && drag.kind === 'wire' && drag.i === i && drag.end === end && drag.x !== undefined) return { x: drag.x, y: drag.y };
    const k = wires[i][end];
    if (k === 'tray') return trayPos(i, end);
    if (k === 'gap') return GAP;
    let n = 0;
    wires.forEach((w, j) => ['start', 'end'].forEach(e2 => {
      if ((j < i || (j === i && e2 === 'start' && end === 'end')) && w[e2] === k) n++;
    }));
    const o = OFFSETS[Math.min(n, 2)];
    return { x: T[k].x + o.x, y: T[k].y + o.y };
  };

  // ---------- pictures ----------
  const terminal = (k, label, lx, ly, anchor) => (
    <g key={k}>
      <circle id={'term-' + k.replace('_', '-')} cx={T[k].x} cy={T[k].y} r="18" fill="rgba(15,23,42,0.6)" stroke="#64748b" strokeWidth="2" strokeDasharray="6 5" />
      <circle cx={T[k].x} cy={T[k].y} r="7" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="2" />
      {label && <text x={T[k].x + lx} y={T[k].y + ly} textAnchor={anchor || 'middle'} fill="#cbd5e1" fontSize="15" fontWeight="600">{label}</text>}
    </g>
  );

  const bulbPic = (cx, i) => {
    const on = shown[i];
    const s = i === 0 ? 'bulb' : 'bulb2';
    return (
      <g key={'bulb' + i}>
        {on && <circle cx={cx} cy="100" r="72" fill="url(#glow)" />}
        <path d={`M ${cx - 38} 100 C ${cx - 38} 52, ${cx + 38} 52, ${cx + 38} 100 C ${cx + 38} 124, ${cx + 20} 136, ${cx + 18} 152 L ${cx - 18} 152 C ${cx - 20} 136, ${cx - 38} 124, ${cx - 38} 100 Z`}
          fill={on ? '#fef9c3' : 'rgba(148,163,184,0.12)'} stroke={on ? '#facc15' : '#64748b'} strokeWidth="2.5" />
        <path d={`M ${cx - 10} 152 L ${cx - 8} 104 L ${cx - 3} 94 L ${cx + 3} 94 L ${cx + 8} 104 L ${cx + 10} 152`} fill="none" stroke={on ? '#f59e0b' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
        <rect x={cx - 18} y="152" width="36" height="34" rx="3" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
        {[162, 172].map(y => <line key={y} x1={cx - 18} y1={y} x2={cx + 18} y2={y} stroke="#475569" strokeWidth="2" />)}
        <path d={`M ${cx - 9} 186 L ${cx + 9} 186 L ${cx + 5} 196 L ${cx - 5} 196 Z`} fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
        {/* leads from the side of the metal base and from the tip to the two contacts */}
        <line x1={cx - 18} y1="180" x2={T[s + '_side'].x} y2={T[s + '_side'].y} stroke="#94a3b8" strokeWidth="3" />
        <line x1={cx} y1="196" x2={T[s + '_base'].x} y2={T[s + '_base'].y} stroke="#94a3b8" strokeWidth="3" />
        {nBulbs === 2 && <text x={cx} y="40" textAnchor="middle" fill="#cbd5e1" fontSize="15" fontWeight="600">{i === 0 ? 'left' : 'right'}</text>}
      </g>
    );
  };

  const wirePath = (a, b, sag) => `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + sag} ${b.x} ${b.y}`;
  const handle = (i, end, p) => (
    <g key={i + end} id={`wire${i + 1}-${end}`} onPointerDown={e => onDown({ kind: 'wire', i, end }, e)} onPointerUp={onUp}
      onPointerCancel={() => setDrag(null)} opacity={guess ? 1 : 0.55}
      style={{ cursor: guess ? 'grab' : 'default', touchAction: 'none' }} transform={`translate(${p.x}, ${p.y})`}>
      <circle r="24" fill="transparent" />
      <circle r="12" fill={WIRE_COLORS[i]} stroke="#ffffff" strokeWidth="2.5" />
      <circle r="4" fill="#ffffff" />
    </g>
  );

  const tagAt = () => {
    if (drag && drag.kind === 'tag' && drag.x !== undefined) return { x: drag.x, y: drag.y };
    if (guess === 'yes') return { x: 616, y: 132 };
    if (guess === 'no') return { x: 616, y: 258 };
    return { x: 616, y: 346 };
  };
  const slot = (k, y, big, small) => (
    <g key={k}>
      <rect id={'slot-' + k} x="560" y={y} width="112" height="116" rx="12" fill="rgba(15,23,42,0.5)" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
      <text x="616" y={y + 28} textAnchor="middle" fill="#e2e8f0" fontSize="20" fontWeight="700">{big}</text>
      <text x="616" y={y + 50} textAnchor="middle" fill="#cbd5e1" fontSize="14">{small}</text>
    </g>
  );
  const tp = tagAt();
  const tagMoving = drag && drag.kind === 'tag' && drag.x !== undefined;

  return (
    <Panel title="Light the Bulb" caption="Drag the guess tag to YES or NO first. Then drag the wire ends onto the dots.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#eab308" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ca8a04" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="#0f172a" />

        {/* battery */}
        <rect x="58" y="74" width="32" height="14" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
        <rect x="40" y="86" width="68" height="200" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <rect x="40" y="86" width="68" height="56" rx="8" fill="#b45309" />
        <text x="74" y="124" textAnchor="middle" fill="#ffffff" fontSize="30" fontWeight="700">+</text>
        <text x="74" y="270" textAnchor="middle" fill="#ffffff" fontSize="34" fontWeight="700">−</text>
        <line x1="108" y1="110" x2={T.bat_pos.x} y2={T.bat_pos.y} stroke="#94a3b8" strokeWidth="3" />
        <line x1="108" y1="270" x2={T.bat_neg.x} y2={T.bat_neg.y} stroke="#94a3b8" strokeWidth="3" />

        {BULB_CX.map((cx, i) => bulbPic(cx, i))}

        {/* wire tray */}
        <rect x="190" y="292" width="340" height="100" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />

        {/* contacts */}
        {terminal('bat_pos', '+', 0, -28)}
        {terminal('bat_neg', '−', 0, 40)}
        {BULB_CX.map((_, i) => {
          const s = i === 0 ? 'bulb' : 'bulb2';
          return (
            <g key={'c' + i}>
              {terminal(s + '_side', 'side', -26, 5, 'end')}
              {terminal(s + '_base', 'bottom', 26, 5, 'start')}
            </g>
          );
        })}

        {/* the guess */}
        <text x="616" y="30" textAnchor="middle" fill="#cbd5e1" fontSize="15" fontWeight="600">Will it light?</text>
        {slot('yes', 44, 'YES', 'it lights')}
        {slot('no', 172, 'NO', 'it stays dark')}

        {/* wires */}
        {wires.map((w, i) => {
          const a = endAt(i, 'start'), b = endAt(i, 'end');
          return (
            <g key={'w' + i}>
              <path d={wirePath(a, b, i === 1 ? -18 : 18)} fill="none" stroke={WIRE_COLORS[i]} strokeWidth="5" strokeLinecap="round" opacity={guess ? 1 : 0.7} />
              {/* an end fanned out beside a shared contact keeps a short lead to that contact, so it reads as joined */}
              {[['start', a], ['end', b]].map(([e2, p]) => {
                const k = w[e2];
                return T[k] && Math.hypot(T[k].x - p.x, T[k].y - p.y) > 2 && !(drag && drag.kind === 'wire' && drag.i === i && drag.end === e2)
                  ? <line key={e2} x1={T[k].x} y1={T[k].y} x2={p.x} y2={p.y} stroke={WIRE_COLORS[i]} strokeWidth="5" strokeLinecap="round" pointerEvents="none" />
                  : null;
              })}
              {handle(i, 'start', a)}
              {handle(i, 'end', b)}
            </g>
          );
        })}

        <g id="guess-tag" onPointerDown={e => onDown({ kind: 'tag' }, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}
          style={{ cursor: guess ? 'default' : 'grab', touchAction: 'none', transform: `translate(${tp.x}px, ${tp.y}px)`, transition: tagMoving ? 'none' : 'transform 0.3s ease-out' }}>
          <rect x="-46" y="-26" width="92" height="52" rx="10" fill={tagMoving ? '#334155' : '#1e293b'} stroke="#818cf8" strokeWidth="3" />
          <text x="-14" y="10" textAnchor="middle" fontSize="28">💡</text>
          <text x="18" y="11" textAnchor="middle" fill="#e2e8f0" fontSize="28" fontWeight="700">?</text>
        </g>
      </svg>
    </Panel>
  );
}
