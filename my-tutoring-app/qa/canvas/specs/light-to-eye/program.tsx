// Light to the eye (4-PS4-2). A room (or the sky) with a light source, a thing to see, an eye and sometimes a wall, a
// mirror or the Earth in the way. The child draws light: a drag from one thing to another lays an arrow from the first
// to the second (arrows snap between things). An arrow whose straight line crosses a wall or the Earth is not laid.
// Goal: the source is giving light and the arrows are exactly the path light takes from the source to the thing and on
// to the eye (by way of the mirror when the straight way is walled off), in that direction and order. Arrows drawn out
// of the eye fail.
// Said answer: where the light the eye uses starts: the source's name, or "nowhere" when the source is switched off at
// the start. Computed from params; the misrules come from the scene's things and are kept to the problem's choices.
// params.points: [{ id, name, kind, x, y }] kind: lamp | flashlight | candle | sun | moon | apple | teddy | eye |
// mirror | cup | book | star. params.source, params.object, params.eye: point ids. params.lit: the source starts lit
// (default true). params.switch: draw a switch for the source. params.walls: [{ x1, y1, x2, y2, between }].
// params.earth: { x, y, r, between } a round Earth that blocks light. params.choices: the words the ask offers.
// params.h: the picture height.
function Display({ params, lumina }) {
  const points = Array.isArray(params.points) && params.points.length ? params.points : [
    { id: 'lamp', name: 'lamp', kind: 'lamp', x: 120, y: 100 },
    { id: 'apple', name: 'apple', kind: 'apple', x: 330, y: 250 },
    { id: 'eye', name: 'eye', kind: 'eye', x: 580, y: 110 },
  ];
  const source = params.source || 'lamp', object = params.object || 'apple', eyeId = params.eye || 'eye';
  const walls = Array.isArray(params.walls) ? params.walls : [];
  const earth = params.earth || null;
  const hasSwitch = params.switch === true;
  const choices = Array.isArray(params.choices) && params.choices.length ? params.choices : ['lamp', 'apple', 'eye', 'nowhere'];
  const H = Number(params.h) || 340, W = 680;
  const byId = {};
  points.forEach(p => { byId[p.id] = p; });
  const nameOf = id => (byId[id] ? byId[id].name : id);
  // Things that can give light. Only the source is lit; any other one is drawn off.
  const LIGHTS = ['lamp', 'flashlight', 'candle'];

  const [lit, setLit] = useState(params.lit !== false);
  const [arrows, setArrows] = useState([]); // [{ from, to }]
  const [drag, setDrag] = useState(null); // { from, x, y }
  const svgRef = useRef(null);

  // ---------- geometry: does the straight line between two things cross a wall or the Earth? ----------
  const R = 30; // the part of each end that belongs to the thing itself
  const trimmed = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    return { x1: a.x + ux * R, y1: a.y + uy * R, x2: b.x - ux * R, y2: b.y - uy * R };
  };
  const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const segsMeet = (s, w) => {
    const d1 = cross(w.x1, w.y1, w.x2, w.y2, s.x1, s.y1), d2 = cross(w.x1, w.y1, w.x2, w.y2, s.x2, s.y2);
    const d3 = cross(s.x1, s.y1, s.x2, s.y2, w.x1, w.y1), d4 = cross(s.x1, s.y1, s.x2, s.y2, w.x2, w.y2);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  const hitsDisc = (s, c) => {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((c.x - s.x1) * dx + (c.y - s.y1) * dy) / L2));
    return Math.hypot(s.x1 + t * dx - c.x, s.y1 + t * dy - c.y) < c.r;
  };
  const blocked = (aId, bId) => {
    const a = byId[aId], b = byId[bId];
    if (!a || !b) return true;
    const s = trimmed(a, b);
    return walls.some(w => segsMeet(s, w)) || (earth ? hitsDisc(s, earth) : false);
  };

  // The path light takes to let the eye see the thing: source, thing, (a mirror when the straight way is walled), eye.
  const chain = (() => {
    if (!blocked(object, eyeId)) return [source, object, eyeId];
    const m = points.find(p => p.kind === 'mirror' && !blocked(object, p.id) && !blocked(p.id, eyeId));
    return m ? [source, object, m.id, eyeId] : [source, object, eyeId];
  })();
  const chainPairs = chain.slice(1).map((to, i) => chain[i] + '>' + to);

  // ---------- the said answer ----------
  useEffect(() => {
    const startsLit = params.lit !== false;
    const key = startsLit ? nameOf(source) : 'nowhere';
    const has = w => choices.some(c => String(c).toLowerCase() === String(w).toLowerCase());
    const mirror = points.find(p => p.kind === 'mirror');
    const unlit = points.filter(p => p.id !== source && LIGHTS.includes(p.kind));
    const cand = [
      { says: nameOf(eyeId), because: 'thinks sight goes out from the eye to the thing' },
      !startsLit ? { says: nameOf(source), because: 'thinks a lamp still gives light when it is switched off' } : null,
      ...unlit.map(p => ({ says: p.name, because: `thinks the ${p.name} gives light though it is not lit` })),
      mirror ? { says: mirror.name, because: 'thinks the mirror makes the light it shows' } : null,
      { says: nameOf(object), because: `thinks the ${nameOf(object)} gives off its own light because it looks bright` },
    ].filter(Boolean);
    const misrules = cand.filter((m, i, all) => has(m.says) && m.says.toLowerCase() !== key.toLowerCase()
      && all.findIndex(x => x.says.toLowerCase() === m.says.toLowerCase()) === i).slice(0, 3);
    lumina.answer(key, misrules, choices);
  }, []);

  // ---------- goal and scene ----------
  const drawn = arrows.map(a => a.from + '>' + a.to);
  const goalMet = lit && drawn.length === chainPairs.length && chainPairs.every(p => drawn.includes(p));
  useEffect(() => {
    lumina.goal(goalMet);
    const state = p => {
      if (p.id === source) return p.kind === 'sun' ? 'shining' : lit ? 'switched on, glowing' : 'switched off, dark';
      if (LIGHTS.includes(p.kind)) return p.kind === 'candle' ? 'not lit' : 'switched off, dark';
      if (p.kind === 'star') return 'shining';
      if (p.kind === 'moon') return 'looks bright';
      return null;
    };
    lumina.scene({
      things: points.map(p => (state(p) ? `${p.name} (${state(p)})` : p.name)),
      inTheWay: [...walls.map(w => `a wall between the ${w.between}`), ...(earth ? [`the Earth between the ${earth.between}`] : [])],
      lightSwitch: hasSwitch ? (lit ? `the ${nameOf(source)} is on` : `the ${nameOf(source)} is off`) : 'none',
      lightArrowsDrawn: arrows.map(a => `from the ${nameOf(a.from)} to the ${nameOf(a.to)}`),
    });
  }, [goalMet, lit, arrows]);

  // ---------- drawing arrows ----------
  const nearest = (x, y, not) => {
    let best = null, bd = 46;
    points.forEach(p => { const d = Math.hypot(p.x - x, p.y - y); if (p.id !== not && d < bd) { bd = d; best = p.id; } });
    return best;
  };
  const grab = (id, e) => {
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: id, x: byId[id].x, y: byId[id].y });
  };
  const move = e => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e);
    setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null));
  };
  const drop = e => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e);
    const from = drag.from, to = nearest(p.x, p.y, from);
    setDrag(null);
    if (!to || blocked(from, to)) return;
    setArrows(list => {
      const rest = list.filter(a => !((a.from === from && a.to === to) || (a.from === to && a.to === from)));
      return rest.length >= 8 ? rest : [...rest, { from, to }];
    });
  };
  const removeArrow = (a) => setArrows(list => list.filter(x => !(x.from === a.from && x.to === a.to)));

  // ---------- pictures ----------
  const glow = (x, y, r) => (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={r * 1.7} fill="#fde68a" opacity="0.12" />
      <circle cx={x} cy={y} r={r * 1.2} fill="#fde68a" opacity="0.18" />
    </g>
  );
  const emoji = (ch, size) => <text x="0" y="2" textAnchor="middle" dominantBaseline="middle" fontSize={size || 34}>{ch}</text>;
  const thing = p => {
    const on = p.id === source && lit;
    if (p.kind === 'lamp') return (
      <g>
        {on && glow(0, -4, 30)}
        <rect x="-4" y="6" width="8" height="22" fill="#94a3b8" />
        <ellipse cx="0" cy="29" rx="18" ry="5" fill="#64748b" />
        <path d="M -24 6 L -13 -22 L 13 -22 L 24 6 Z" fill={on ? '#fde68a' : '#475569'} stroke={on ? '#fbbf24' : '#64748b'} strokeWidth="2" />
      </g>
    );
    if (p.kind === 'flashlight') {
      const o = byId[object] || { x: p.x + 1, y: p.y };
      const ang = (Math.atan2(o.y - p.y, o.x - p.x) * 180) / Math.PI;
      return (
        <g>
          {on && glow(0, 0, 28)}
          <g transform={`rotate(${ang})`}>
            <rect x="-26" y="-8" width="34" height="16" rx="4" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
            <path d="M 8 -8 L 22 -14 L 22 14 L 8 8 Z" fill="#64748b" stroke="#94a3b8" strokeWidth="2" />
            <rect x="21" y="-13" width="4" height="26" rx="2" fill={on ? '#fef08a' : '#57534e'} />
          </g>
        </g>
      );
    }
    if (p.kind === 'candle') return (
      <g>
        {on && glow(0, -18, 22)}
        <rect x="-9" y="-6" width="18" height="34" rx="3" fill="#f1f5f9" />
        <line x1="0" y1="-6" x2="0" y2="-12" stroke="#1e293b" strokeWidth="2" />
        <path d="M 0 -30 C 7 -20 6 -13 0 -12 C -6 -13 -7 -20 0 -30 Z" fill={on ? '#fbbf24' : '#57534e'} />
      </g>
    );
    if (p.kind === 'sun') return (
      <g>
        {glow(0, 0, 36)}
        <circle r="34" fill="#fbbf24" />
        <circle r="24" fill="#fde047" />
      </g>
    );
    if (p.kind === 'moon') return (
      <g>
        <circle r="26" fill="#e2e8f0" />
        <circle cx="-8" cy="-6" r="5" fill="#cbd5e1" />
        <circle cx="9" cy="8" r="4" fill="#cbd5e1" />
      </g>
    );
    if (p.kind === 'mirror') return (
      <g>
        <rect x="-44" y="-9" width="88" height="18" rx="3" fill="#78350f" />
        <rect x="-40" y="-3" width="80" height="9" fill="#bae6fd" />
        <line x1="-30" y1="0" x2="-18" y2="5" stroke="#f0f9ff" strokeWidth="2" />
      </g>
    );
    if (p.kind === 'eye') return (
      <g>
        <path d="M -30 0 Q 0 -24 30 0 Q 0 24 -30 0 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx="0" cy="0" r="10" fill="#0ea5e9" />
        <circle cx="0" cy="0" r="5" fill="#0f172a" />
      </g>
    );
    const ch = { apple: '🍎', teddy: '🧸', cup: '☕', book: '📕', star: '⭐' }[p.kind] || '❓';
    return emoji(ch, 36);
  };
  const LABEL_DY = { lamp: 50, flashlight: 42, candle: 48, sun: 56, moon: -36, mirror: -20, eye: 40 };

  const arrowLine = (a, i) => {
    const s = trimmed(byId[a.from], byId[a.to]);
    const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1, ux = (s.x2 - s.x1) / L, uy = (s.y2 - s.y1) / L;
    const hx = s.x2 - ux * 16, hy = s.y2 - uy * 16;
    return (
      <g key={a.from + a.to} id={`arrow-${a.from}-${a.to}`} onClick={() => removeArrow(a)} style={{ cursor: 'pointer' }}>
        <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" strokeWidth="30" />
        <line x1={s.x1} y1={s.y1} x2={hx} y2={hy} stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" />
        <path d={`M ${s.x2} ${s.y2} L ${hx - uy * 11} ${hy + ux * 11} L ${hx + uy * 11} ${hy - ux * 11} Z`} fill="#fbbf24" />
      </g>
    );
  };

  const caption = hasSwitch
    ? `Drag from one thing to another to draw light going that way. Tap a light line to take it away. Tap the switch to turn the ${nameOf(source)} on or off.`
    : 'Drag from one thing to another to draw light going that way. Tap a light line to take it away.';
  const sw = hasSwitch ? { x: byId[source].x - 26, y: byId[source].y + 76 } : null;

  return (
    <Panel title="Light Paths" caption={caption}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={drop} onPointerCancel={() => setDrag(null)}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        {earth && (
          <g pointerEvents="none">
            <circle cx={earth.x} cy={earth.y} r={earth.r} fill="#1d4ed8" />
            <path d={`M ${earth.x} ${earth.y - earth.r} A ${earth.r} ${earth.r} 0 0 1 ${earth.x} ${earth.y + earth.r} Z`} fill="#0b1e4a" opacity="0.85" />
            <path d={`M ${earth.x - 40} ${earth.y - 20} q 20 -24 40 -6 q -8 26 -34 22 Z`} fill="#16a34a" opacity="0.9" />
            <text x={earth.x} y={earth.y + earth.r + 22} textAnchor="middle" fontSize="16" fill="#cbd5e1">Earth</text>
          </g>
        )}
        {walls.map((w, i) => (
          <g key={'w' + i} pointerEvents="none">
            <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#78716c" strokeWidth="16" strokeLinecap="round" />
            <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#a8a29e" strokeWidth="4" strokeDasharray="10 8" />
            <text x={Math.max(w.x1, w.x2) + 16} y={Math.max(w.y1, w.y2) - 6} fontSize="16" fill="#cbd5e1">wall</text>
          </g>
        ))}
        {arrows.map(arrowLine)}
        {drag && (
          <line x1={byId[drag.from].x} y1={byId[drag.from].y} x2={drag.x} y2={drag.y} stroke="#fbbf24" strokeWidth="3"
            strokeDasharray="6 5" opacity="0.7" pointerEvents="none" />
        )}
        {points.map(p => (
          <g key={p.id} id={`pt-${p.id}`} transform={`translate(${p.x}, ${p.y})`} onPointerDown={e => grab(p.id, e)}
            style={{ cursor: 'grab', touchAction: 'none' }}>
            <circle r="34" fill="#1e293b" fillOpacity="0.01" stroke={drag && drag.from === p.id ? '#64748b' : 'none'} strokeWidth="2" strokeDasharray="6 5" />
            {thing(p)}
            <text y={LABEL_DY[p.kind] || 44} textAnchor="middle" fontSize="16" fill="#cbd5e1" pointerEvents="none">{p.name}</text>
          </g>
        ))}
        {sw && (
          <g id="switch" onClick={() => setLit(v => !v)} style={{ cursor: 'pointer' }}>
            <rect x={sw.x} y={sw.y} width="52" height="56" rx="8" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
            <rect x={sw.x + 16} y={sw.y + 8} width="20" height="40" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
            <rect x={sw.x + 18} y={lit ? sw.y + 10 : sw.y + 28} width="16" height="18" rx="4" fill={lit ? '#fde047' : '#94a3b8'} />
          </g>
        )}
      </svg>
    </Panel>
  );
}
