function Display({ params, lumina }) {
  // Rocks and soils sit on a table. The child drags each one into a tray. Each tray shows the sorting rule as a
  // picture (a colour chip, a dashed outline, a bumpy or smooth outline, a grain cluster or a smear), or, with
  // params.ruleIcons false, only by one example already lying in it. No sample carries a word: its colour, size and
  // surface are drawn. Sand and clay look the same from the table; the magnifier shows grains or a smooth smear.
  // params.rule: 'color' | 'size' | 'texture'. params.trays: the rule value each tray takes, left to right.
  // params.samples: [{ id, kind: 'rock'|'sand'|'clay', color: 'light'|'dark'|'red', size: 'big'|'small', texture: 'rough'|'smooth' }].
  // params.magnifier: show the magnifier. params.examples: [{ tray, ...sample }] already placed, not movable.
  const DEFAULT_TRAYS = { color: ['light', 'dark'], size: ['big', 'small'], texture: ['rough', 'smooth'] };
  const rule = ['color', 'size', 'texture'].includes(params.rule) ? params.rule : 'color';
  const trayVals = (Array.isArray(params.trays) && params.trays.length >= 2 ? params.trays : DEFAULT_TRAYS[rule]).slice(0, 3);
  const norm = (s, i) => {
    const kind = s && ['rock', 'sand', 'clay'].includes(s.kind) ? s.kind : 'rock';
    return {
      id: s && s.id != null ? String(s.id) : String(i + 1),
      kind,
      color: s && ['light', 'dark', 'red'].includes(s.color) ? s.color : 'light',
      size: kind === 'rock' && s && s.size === 'small' ? 'small' : 'big',
      // Sand is gritty and clay is smooth: for soils the kind decides the feel.
      texture: kind === 'sand' ? 'rough' : kind === 'clay' ? 'smooth' : (s && s.texture === 'rough' ? 'rough' : 'smooth'),
    };
  };
  const samples = (Array.isArray(params.samples) && params.samples.length
    ? params.samples
    : [{ id: 1, color: 'light' }, { id: 2, color: 'dark' }, { id: 3, color: 'dark' }, { id: 4, color: 'light' }])
    .slice(0, 5).map(norm);
  const examples = (Array.isArray(params.examples) ? params.examples : []).slice(0, trayVals.length).map((e, i) => ({
    ...norm(e, i), id: `ex${i + 1}`, tray: Math.max(0, Math.min(trayVals.length - 1, Number(e && e.tray) || 0)),
  }));
  const showIcons = params.ruleIcons !== false;
  const hasLens = !!params.magnifier;
  const soils = samples.every(s => s.kind !== 'rock');
  const valueOf = s => (rule === 'color' ? s.color : rule === 'size' ? s.size : s.texture);

  // ---------- layout ----------
  const W = 720;
  const TABLE_Y = 8, TABLE_H = 232;
  const TRAY_Y = 254, TRAY_H = 332;
  const H = TRAY_Y + TRAY_H + 6;
  const LENS_R = 50;
  const PARK = { x: 652, y: 98 };
  const GAP = 12;
  const trayW = (W - GAP * (trayVals.length + 1)) / trayVals.length;
  const tray = t => ({ x: GAP + t * (trayW + GAP), y: TRAY_Y, w: trayW, h: TRAY_H });
  const COLS = trayVals.length === 2 ? 3 : 2;
  const SLOT_TOP = TRAY_Y + 88;
  const slot = (t, k) => {
    const r = tray(t), cw = r.w / COLS;
    return { x: r.x + cw * ((k % COLS) + 0.5), y: SLOT_TOP + 56 + Math.floor(k / COLS) * 118 };
  };
  const spotW = (hasLens ? 580 : 700) / samples.length;
  const spot = i => ({ x: 12 + spotW * (i + 0.5), y: TABLE_Y + 104 });
  const ext = s => (s.kind !== 'rock' ? { rx: 48, ry: 26 } : s.size === 'big' ? { rx: 46, ry: 36 } : { rx: 24, ry: 19 });

  // ---------- state ----------
  const [bins, setBins] = useState(() => trayVals.map(() => []));
  const [drag, setDrag] = useState(null); // { id, x, y, ox, oy }
  const [lens, setLens] = useState(PARK);
  const [lensHeld, setLensHeld] = useState(null); // { ox, oy }
  const [seen, setSeen] = useState([]);
  const svgRef = useRef(null);

  const trayOf = id => bins.findIndex(b => b.includes(id));
  const exCount = t => examples.filter(e => e.tray === t).length;
  const posOf = s => {
    if (s.id.startsWith('ex')) {
      const t = s.tray;
      return slot(t, examples.filter(e => e.tray === t).indexOf(s));
    }
    if (drag && drag.id === s.id && drag.x != null) return { x: drag.x, y: drag.y };
    const t = trayOf(s.id);
    if (t >= 0) return slot(t, exCount(t) + bins[t].indexOf(s.id));
    return spot(samples.indexOf(s));
  };
  const all = [...examples, ...samples];
  const lensHit = hasLens ? all.find(s => {
    const p = posOf(s), e = ext(s);
    return Math.abs(p.x - lens.x) <= e.rx + 6 && Math.abs(p.y - lens.y) <= e.ry + 10;
  }) : null;

  useEffect(() => {
    if (lensHit && !seen.includes(lensHit.id)) setSeen(prev => [...prev, lensHit.id]);
  }, [lensHit && lensHit.id]);

  const goalMet = samples.every(s => {
    const t = trayOf(s.id);
    return t >= 0 && trayVals[t] === valueOf(s);
  });

  // ---------- words for the tutor (facts that are drawn, never the verdict) ----------
  const SIDE = trayVals.length === 2 ? ['left', 'right'] : ['left', 'middle', 'right'];
  const describe = s => {
    if (s.kind === 'rock') {
      const c = { light: 'light gray', dark: 'dark gray', red: 'red-brown' }[s.color];
      return `${c} rock, ${s.size}, ${s.texture === 'rough' ? 'bumpy' : 'smooth'} surface`;
    }
    const c = s.color === 'dark' ? 'darker brown' : 'light brown';
    if (!seen.includes(s.id)) return `${c} soil pile, looks like the other piles from the table`;
    return `${c} soil pile; close up: ${s.kind === 'sand' ? 'many tiny separate grains' : 'smooth and sticky, no grains'}`;
  };
  const pictureWords = v => {
    if (rule === 'color') return `a ${v === 'dark' ? 'dark' : 'light'} color chip`;
    if (rule === 'size') return `a ${v === 'small' ? 'small' : 'big'} dashed outline`;
    if (soils) return v === 'rough' ? 'a cluster of separate grains' : 'a smooth smear';
    return v === 'rough' ? 'a bumpy outline' : 'a smooth outline';
  };
  const label = s => (s.kind === 'rock' ? `rock ${s.id}` : `pile ${s.id}`);

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      onTable: samples.filter(s => trayOf(s.id) < 0).map(s => `${label(s)}: ${describe(s)}`),
      trays: trayVals.map((v, t) => ({
        tray: SIDE[t],
        picture: showIcons ? pictureWords(v) : 'no picture',
        alreadyHeld: examples.filter(e => e.tray === t).map(e => describe(e)),
        holds: bins[t].map(id => { const s = samples.find(x => x.id === id); return `${label(s)}: ${describe(s)}`; }),
      })),
      ...(hasLens ? { magnifier: lensHit ? `over ${lensHit.id.startsWith('ex') ? 'the rock already in a tray' : label(lensHit)}` : (lens.x === PARK.x && lens.y === PARK.y ? 'resting in its corner' : 'over nothing') } : {}),
    });
  }, [goalMet, JSON.stringify(bins), lensHit && lensHit.id, seen.length, lens.x === PARK.x && lens.y === PARK.y]);

  // ---------- pointer ----------
  const at = e => svgPoint(svgRef.current, e);
  const sampleDown = (s, e) => {
    if (lensHeld) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = posOf(s), pt = at(e);
    setDrag({ id: s.id, ox: pt.x - p.x, oy: pt.y - p.y });
  };
  const lensDown = e => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = at(e);
    setLensHeld({ ox: pt.x - lens.x, oy: pt.y - lens.y });
  };
  const onMove = e => {
    if (!svgRef.current) return;
    const pt = at(e);
    if (lensHeld) {
      setLens({ x: Math.max(LENS_R, Math.min(W - LENS_R, pt.x - lensHeld.ox)), y: Math.max(LENS_R, Math.min(H - LENS_R - 56, pt.y - lensHeld.oy)) });
    } else if (drag) {
      setDrag(d => (d ? { ...d, x: pt.x - d.ox, y: pt.y - d.oy } : null));
    }
  };
  const lensUp = () => {
    if (!lensHeld) return;
    setLensHeld(null);
    // Dropped near its corner, it settles back into the corner.
    setLens(l => (Math.hypot(l.x - PARK.x, l.y - PARK.y) < 40 ? PARK : l));
  };
  const sampleUp = e => {
    if (!drag || !svgRef.current) return;
    const pt = at(e);
    const t = trayVals.findIndex((_, i) => { const r = tray(i); return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h; });
    const id = drag.id;
    setBins(prev => {
      const next = prev.map(b => b.filter(x => x !== id));
      if (t >= 0 && exCount(t) + next[t].length < COLS * 2) next[t] = [...next[t], id];
      return next;
    });
    setDrag(null);
  };

  // ---------- drawing ----------
  const hash = str => { let h = 2166136261; const s = String(str); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => { let a = seed || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const mix = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const to = f < 0 ? 0 : 255, p = Math.abs(f);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (to - v) * p));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };
  const ROCK = { light: ['#d6d3d1', '#e7e5e4', '#cfc8bc'], dark: ['#44403c', '#3f3f46', '#4b4038'], red: ['#b45a3c'] };
  const SOIL = { light: '#c49a6c', dark: '#a57d52', red: '#a57d52' };
  const fillOf = s => (s.kind === 'rock' ? ROCK[s.color][hash(s.id + s.color) % ROCK[s.color].length] : SOIL[s.color]);

  const roughPath = (rx, ry, r) => {
    let d = '';
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const f = (k % 2 ? 0.85 : 1) + (r() - 0.5) * 0.16;
      d += `${k ? 'L' : 'M'}${(Math.cos(a) * rx * f).toFixed(1)} ${(Math.sin(a) * ry * f).toFixed(1)}`;
    }
    return `${d}Z`;
  };

  // A sample as it looks from the table, centred on 0,0.
  const drawSample = s => {
    const base = fillOf(s), r = rng(hash(s.id + s.kind + s.texture));
    if (s.kind !== 'rock') {
      // Every pile is drawn the same way: from the table sand and clay differ only in shade.
      return (
        <g>
          <ellipse cx="0" cy="22" rx="50" ry="7" fill="rgba(0,0,0,0.28)" />
          <path d="M -48 22 Q -42 -18 0 -24 Q 42 -18 48 22 Z" fill={base} stroke={mix(base, -0.45)} strokeWidth="2" />
          {[[-22, 6], [-6, -10], [12, 2], [26, 12], [-30, 16], [4, 14]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill={mix(base, -0.3)} />
          ))}
        </g>
      );
    }
    const { rx, ry } = ext(s);
    const shadow = <ellipse cx="0" cy={ry * 0.9} rx={rx * 0.92} ry={ry * 0.22} fill="rgba(0,0,0,0.3)" />;
    if (s.texture === 'rough') {
      const bumps = Array.from({ length: 10 }, (_, i) => {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.55;
        return <circle key={i} cx={Math.cos(a) * rx * d} cy={Math.sin(a) * ry * d} r={Math.max(2.4, rx * 0.1)}
          fill={i % 2 ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.28)'} />;
      });
      return (
        <g>
          {shadow}
          <path d={roughPath(rx, ry, r)} fill={base} stroke="#1c1917" strokeWidth="2" strokeLinejoin="round" />
          {bumps}
          <path d={`M ${-rx * 0.4} ${-ry * 0.1} l ${rx * 0.18} ${ry * 0.2} l ${rx * 0.14} ${-ry * 0.08}`} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="1.6" />
        </g>
      );
    }
    const rot = (r() - 0.5) * 24;
    return (
      <g>
        {shadow}
        <g transform={`rotate(${rot.toFixed(1)})`}>
          <ellipse cx="0" cy="0" rx={rx} ry={ry} fill={base} stroke="#1c1917" strokeWidth="2" />
          <ellipse cx={rx * 0.15} cy={ry * 0.3} rx={rx * 0.7} ry={ry * 0.45} fill="rgba(0,0,0,0.12)" />
          <ellipse cx={-rx * 0.32} cy={-ry * 0.38} rx={rx * 0.32} ry={ry * 0.16} fill="rgba(255,255,255,0.4)" />
        </g>
      </g>
    );
  };

  // What the magnifier shows of a sample: its surface, filling the lens.
  const closeView = s => {
    const base = fillOf(s), r = rng(hash(`close${s.id}${s.kind}`)), R = LENS_R;
    if (s.kind === 'sand') {
      return (
        <g>
          <circle r={R} fill={mix(base, -0.55)} />
          {Array.from({ length: 58 }, (_, i) => {
            const x = (r() * 2 - 1) * R, y = (r() * 2 - 1) * R, gr = 4.5 + r() * 3.5;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={gr} fill={mix(base, (r() - 0.5) * 0.55)} stroke={mix(base, -0.5)} strokeWidth="1" />
                <circle cx={x - gr * 0.35} cy={y - gr * 0.35} r={gr * 0.3} fill="rgba(255,255,255,0.45)" />
              </g>
            );
          })}
        </g>
      );
    }
    if (s.kind === 'clay') {
      return (
        <g>
          <circle r={R} fill={base} />
          {[-26, -10, 6, 22].map((y, i) => (
            <path key={i} d={`M ${-R} ${y + 6} Q 0 ${y - 10} ${R} ${y + 4}`} fill="none" stroke={mix(base, -0.18)} strokeWidth="3" opacity="0.8" />
          ))}
          <ellipse cx="-10" cy="-24" rx="28" ry="6" fill="rgba(255,255,255,0.35)" transform="rotate(-10)" />
          <ellipse cx="14" cy="26" rx="16" ry="4" fill="rgba(255,255,255,0.22)" transform="rotate(-6)" />
        </g>
      );
    }
    if (s.texture === 'rough') {
      return (
        <g>
          <circle r={R} fill={base} />
          {Array.from({ length: 26 }, (_, i) => {
            const x = (r() * 2 - 1) * R, y = (r() * 2 - 1) * R, br = 5 + r() * 6;
            return (
              <g key={i}>
                <circle cx={x + 2} cy={y + 2.5} r={br} fill={mix(base, -0.45)} />
                <circle cx={x} cy={y} r={br} fill={mix(base, (r() - 0.5) * 0.3)} />
                <circle cx={x - br * 0.35} cy={y - br * 0.35} r={br * 0.35} fill="rgba(255,255,255,0.3)" />
              </g>
            );
          })}
          <path d="M -40 -6 L -22 4 L -10 -2 L 4 10" fill="none" stroke={mix(base, -0.6)} strokeWidth="2.5" />
        </g>
      );
    }
    return (
      <g>
        <circle r={R} fill={base} />
        <circle cx="16" cy="18" r={R * 0.9} fill="rgba(0,0,0,0.14)" />
        <ellipse cx="-14" cy="-20" rx="24" ry="10" fill="rgba(255,255,255,0.32)" transform="rotate(-20)" />
        <ellipse cx="-18" cy="-22" rx="9" ry="4" fill="rgba(255,255,255,0.6)" transform="rotate(-20)" />
      </g>
    );
  };

  // The rule picture on a tray. Never a sample: a chip, an outline, a cluster or a smear.
  const trayIcon = (v, cx, cy) => {
    const ink = '#f8fafc';
    if (rule === 'color') {
      return <rect x={cx - 34} y={cy - 22} width="68" height="44" rx="10" fill={v === 'dark' ? '#3f3f46' : '#e7e5e4'} stroke={ink} strokeWidth="2.5" />;
    }
    if (rule === 'size') {
      return v === 'small'
        ? <ellipse cx={cx} cy={cy + 8} rx="14" ry="11" fill="none" stroke={ink} strokeWidth="3" strokeDasharray="5 4" />
        : <ellipse cx={cx} cy={cy} rx="34" ry="25" fill="none" stroke={ink} strokeWidth="3" strokeDasharray="7 5" />;
    }
    if (soils) {
      if (v === 'rough') {
        return (
          <g>
            {[[-18, -8], [-4, -12], [10, -8], [22, -2], [-12, 4], [2, 2], [16, 8], [-22, 10], [-6, 14], [8, 16]].map(([x, y], i) => (
              <circle key={i} cx={cx + x} cy={cy + y} r="5" fill="none" stroke={ink} strokeWidth="2.2" />
            ))}
          </g>
        );
      }
      return (
        <g>
          <path d={`M ${cx - 32} ${cy + 6} Q ${cx} ${cy - 14} ${cx + 32} ${cy + 2}`} fill="none" stroke={ink} strokeWidth="12" strokeLinecap="round" opacity="0.9" />
          <path d={`M ${cx - 18} ${cy - 2} Q ${cx} ${cy - 10} ${cx + 14} ${cy - 6}`} fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    }
    if (v === 'rough') {
      const r = rng(7);
      return (
        <g transform={`translate(${cx} ${cy})`}>
          <path d={roughPath(32, 23, r)} fill="none" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          {[[-10, -5], [8, -7], [-2, 7], [14, 6]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill={ink} />)}
        </g>
      );
    }
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx="32" ry="23" fill="none" stroke={ink} strokeWidth="3" />
        <path d={`M ${cx - 18} ${cy - 9} Q ${cx - 8} ${cy - 16} ${cx + 4} ${cy - 15}`} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  };

  const sampleEl = s => {
    const p = posOf(s), e = ext(s);
    const fixed = s.id.startsWith('ex');
    return (
      <g key={s.id} id={fixed ? `example-${s.tray + 1}` : `s-${s.id}`} transform={`translate(${p.x} ${p.y})`}
        style={{ cursor: fixed ? 'default' : 'grab', touchAction: 'none' }}
        onPointerDown={fixed ? undefined : ev => sampleDown(s, ev)} onPointerUp={fixed ? undefined : sampleUp}
        onPointerCancel={() => setDrag(null)}>
        <rect x={-Math.max(e.rx, 30)} y={-Math.max(e.ry, 30)} width={Math.max(e.rx, 30) * 2} height={Math.max(e.ry, 30) * 2 + 8} fill="transparent" />
        {drawSample(s)}
        {!fixed && (
          <g>
            <circle cx="0" cy={e.ry + 14} r="10" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
            <text x="0" y={e.ry + 18.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#f8fafc">{s.id}</text>
          </g>
        )}
      </g>
    );
  };

  const lensEl = () => (
    <g transform={`translate(${lens.x} ${lens.y})`} style={{ cursor: lensHeld ? 'grabbing' : 'grab', touchAction: 'none' }}
      onPointerDown={lensDown} onPointerUp={lensUp} onPointerCancel={() => setLensHeld(null)}>
      <rect x="-9" y={LENS_R - 2} width="18" height="56" rx="7" fill="#b45309" stroke="#451a03" strokeWidth="2" />
      <g clipPath="url(#lens-clip)">
        {lensHit ? closeView(lensHit) : <circle r={LENS_R} fill="rgba(186,230,253,0.14)" />}
      </g>
      <circle id="magnifier" r={LENS_R} fill="transparent" />
      <circle r={LENS_R} fill="none" stroke="#e2e8f0" strokeWidth="7" />
      <circle r={LENS_R + 3.5} fill="none" stroke="#334155" strokeWidth="1.5" />
    </g>
  );

  const dragging = drag && drag.x != null ? samples.find(s => s.id === drag.id) : null;

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <defs>
          <clipPath id="lens-clip"><circle cx="0" cy="0" r={LENS_R} /></clipPath>
        </defs>
        {/* the table */}
        <rect x="0" y={TABLE_Y} width={W} height={TABLE_H} rx="14" fill="#7d8ba1" stroke="#cbd5e1" strokeWidth="1.5" />
        {hasLens && <circle id="lens-park" cx={PARK.x} cy={PARK.y} r={LENS_R + 4} fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="6 5" opacity="0.7" />}
        {/* the trays */}
        {trayVals.map((v, t) => {
          const r = tray(t);
          return (
            <g key={`tray-${t}`}>
              <rect id={`tray-${t + 1}`} x={r.x} y={r.y} width={r.w} height={r.h} rx="16" fill="#a3aebe" stroke="#e2e8f0" strokeWidth="3" />
              {showIcons && (
                <g>
                  <rect x={r.x + r.w / 2 - 62} y={r.y + 12} width="124" height="66" rx="12" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                  {trayIcon(v, r.x + r.w / 2, r.y + 45)}
                </g>
              )}
            </g>
          );
        })}
        {examples.map(sampleEl)}
        {samples.filter(s => !dragging || s.id !== dragging.id).map(sampleEl)}
        {dragging && sampleEl(dragging)}
        {hasLens && lensEl()}
      </svg>
    </Panel>
  );
}
