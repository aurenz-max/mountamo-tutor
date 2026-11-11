function Display({ params, lumina }) {
  // One or two lanes. Each lane holds one thing (a toy car, a feather, a boat...) and a star at one end. The child
  // drags a mover from the tray (a magnet, a fan, a water squirter) to the left or right end of a lane. Nothing moves
  // unless params.test gives a Try it button: the placement is a prediction and Check judges it.
  // params.lanes: [{ obj, goal: 'left' | 'right', water: boolean }], 1-2. params.tray: mover keys. params.test: boolean.
  const THINGS = {
    car: { label: 'toy car', iron: true, light: false, floats: false },
    ball: { label: 'steel ball', iron: true, light: false, floats: false },
    key: { label: 'key', iron: true, light: false, floats: false },
    feather: { label: 'feather', iron: false, light: true, floats: true },
    leaf: { label: 'leaf', iron: false, light: true, floats: true },
    block: { label: 'wood block', iron: false, light: false, floats: true },
    boat: { label: 'plastic boat', iron: false, light: true, floats: true },
  };
  const MOVERS = {
    magnet: { label: 'Magnet' },
    fan: { label: 'Fan' },
    hose: { label: 'Water squirter' },
  };
  const lanes = (Array.isArray(params.lanes) && params.lanes.length ? params.lanes : [{ obj: 'car', goal: 'right', water: false }])
    .slice(0, 2)
    .map(l => ({ obj: THINGS[l && l.obj] ? l.obj : 'car', goal: l && l.goal === 'left' ? 'left' : 'right', water: !!(l && l.water) }));
  const tray = (Array.isArray(params.tray) ? params.tray : ['magnet', 'fan']).filter(k => MOVERS[k]).slice(0, 3);
  const canTest = !!params.test;

  // placed[k] = { lane, side } or undefined. One mover per lane: a new one pushes the old one back to the tray.
  const [placed, setPlaced] = useState({});
  const [ran, setRan] = useState(false);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  // The model. A magnet pulls iron and steel to itself. Moving air (the fan) pushes light things away from it.
  // Squirted water pushes a thing that floats on the water away from it. Anything else stays where it is.
  const moverIn = i => Object.keys(placed).find(k => placed[k] && placed[k].lane === i);
  const endOf = i => {
    const l = lanes[i];
    const t = THINGS[l.obj];
    const k = moverIn(i);
    if (!k) return 'middle';
    const side = placed[k].side;
    const away = side === 'left' ? 'right' : 'left';
    if (k === 'magnet') return t.iron ? side : 'middle';
    if (k === 'fan') return t.light ? away : 'middle';
    if (k === 'hose') return l.water && t.floats ? away : 'middle';
    return 'middle';
  };
  const goalMet = lanes.every((l, i) => endOf(i) === l.goal);

  const laneName = i => (lanes.length === 1 ? 'the lane' : ['top lane', 'bottom lane'][i]);
  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      lanes: lanes.map((l, i) => {
        const k = moverIn(i);
        return {
          lane: laneName(i),
          thing: THINGS[l.obj].label,
          on: l.water ? 'water' : 'a table',
          star: `${l.goal} end`,
          mover: k ? `${MOVERS[k].label} at the ${placed[k].side} end` : 'none',
          ...(ran ? { thingNow: endOf(i) === 'middle' ? 'did not move' : `moved to the ${endOf(i)} end` } : {}),
        };
      }),
      tray: tray.filter(k => !placed[k]).map(k => MOVERS[k].label),
      ...(canTest ? { tryIt: ran ? 'ran' : 'not yet' } : {}),
    });
  }, [goalMet, placed, ran]);

  // ---------- layout ----------
  const W = 680;
  const LANE_H = lanes.length === 1 ? 230 : 176;
  const TRAY_Y = lanes.length * LANE_H + 6;
  const TRAY_H = 120;
  const H = TRAY_Y + TRAY_H;
  const SLOT_X = { left: 62, right: W - 62 };
  const END_X = { left: 168, middle: W / 2, right: W - 168 };
  const groundY = i => i * LANE_H + LANE_H - 54;
  const slotAt = (i, side) => ({ x: SLOT_X[side], y: groundY(i) - 34 });
  const traySlot = j => ({ x: (W / (tray.length + 1)) * (j + 1), y: TRAY_Y + 46 });

  const onDown = (key, e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ key });
  };
  const onMove = e => {
    if (!drag || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    setDrag(d => (d ? { ...d, x: pt.x, y: pt.y } : null));
  };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    let hit = null;
    lanes.forEach((_, i) => ['left', 'right'].forEach(side => {
      const s = slotAt(i, side);
      if (Math.abs(pt.x - s.x) <= 60 && Math.abs(pt.y - s.y) <= 60) hit = { lane: i, side };
    }));
    setPlaced(prev => {
      const next = { ...prev };
      delete next[drag.key];
      if (hit) {
        Object.keys(next).forEach(k => { if (next[k] && next[k].lane === hit.lane) delete next[k]; });
        next[drag.key] = hit;
      }
      return next;
    });
    setRan(false);
    setDrag(null);
  };

  // ---------- pictures ----------
  const thing = key => {
    if (key === 'car') return (
      <g>
        <rect x="-34" y="-30" width="68" height="22" rx="6" fill="#94a3b8" stroke="#334155" strokeWidth="2" />
        <rect x="-20" y="-46" width="36" height="18" rx="5" fill="#cbd5e1" stroke="#334155" strokeWidth="2" />
        <circle cx="-20" cy="-6" r="8" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
        <circle cx="20" cy="-6" r="8" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      </g>
    );
    if (key === 'ball') return (
      <g>
        <circle cx="0" cy="-20" r="20" fill="url(#steelBall)" stroke="#334155" strokeWidth="2" />
        <circle cx="-7" cy="-27" r="5" fill="#f8fafc" opacity="0.8" />
      </g>
    );
    if (key === 'block') return (
      <g>
        <rect x="-26" y="-48" width="52" height="48" rx="3" fill="#b45309" stroke="#78350f" strokeWidth="2" />
        <path d="M -18 -36 H 18 M -18 -22 H 12" stroke="#92400e" strokeWidth="2" />
      </g>
    );
    if (key === 'boat') return (
      <g>
        <path d="M -40 -22 L 40 -22 L 28 2 L -28 2 Z" fill="#f97316" stroke="#9a3412" strokeWidth="2" />
        <rect x="-14" y="-34" width="28" height="12" rx="3" fill="#fde68a" stroke="#9a3412" strokeWidth="2" />
      </g>
    );
    if (key === 'key') return (
      <g>
        <circle cx="-20" cy="-14" r="12" fill="none" stroke="#cbd5e1" strokeWidth="6" />
        <path d="M -8 -14 H 30 M 22 -14 V -4 M 14 -14 V -6" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
      </g>
    );
    if (key === 'leaf') return (
      <g>
        <path d="M -30 -10 Q -8 -42 30 -20 Q 6 8 -30 -10 Z" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
        <path d="M -30 -10 Q 0 -20 30 -20" stroke="#14532d" strokeWidth="2" fill="none" />
      </g>
    );
    return <text x="0" y="-4" textAnchor="middle" fontSize="44">🪶</text>;
  };

  // A mover drawn facing +x (toward the lane's middle when it sits at the left end); flipped at the right end.
  const mover = key => {
    if (key === 'magnet') return (
      <g>
        <path d="M 22 -26 H -8 A 26 26 0 0 0 -8 26 H 22 V 12 H -8 A 12 12 0 0 1 -8 -12 H 22 Z"
          fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
        <rect x="10" y="-26" width="12" height="14" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
        <rect x="10" y="12" width="12" height="14" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
      </g>
    );
    if (key === 'fan') return (
      <g>
        <rect x="-26" y="16" width="20" height="18" rx="3" fill="#475569" />
        <circle cx="-8" cy="-4" r="26" fill="#1e293b" stroke="#94a3b8" strokeWidth="3" />
        {[0, 120, 240].map(a => (
          <ellipse key={a} cx="-8" cy="-16" rx="7" ry="12" fill="#38bdf8" transform={`rotate(${a} -8 -4)`} />
        ))}
        <circle cx="-8" cy="-4" r="4" fill="#e2e8f0" />
      </g>
    );
    return (
      <g>
        <rect x="-30" y="-8" width="34" height="18" rx="6" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
        <path d="M 4 -6 L 26 -11 L 26 11 L 4 8 Z" fill="#facc15" stroke="#a16207" strokeWidth="2" />
        <path d="M -30 2 q -10 0 -10 16" stroke="#16a34a" strokeWidth="7" fill="none" strokeLinecap="round" />
      </g>
    );
  };

  const star = (x, y) => (
    <path transform={`translate(${x}, ${y})`}
      d="M 0 -16 L 4.7 -5 L 16 -5 L 7 2 L 10 13 L 0 6.5 L -10 13 L -7 2 L -16 -5 L -4.7 -5 Z"
      fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" />
  );

  const lane = (l, i) => {
    const top = i * LANE_H;
    const gy = groundY(i);
    const at = ran ? endOf(i) : 'middle';
    const gx = END_X[l.goal];
    return (
      <g key={i}>
        <rect x="0" y={top} width={W} height={LANE_H - 8} rx="12" fill="#0b1224" />
        {l.water ? (
          <rect x="8" y={gy - 14} width={W - 16} height={top + LANE_H - 16 - (gy - 14)} rx="8" fill="#1d4ed8" opacity="0.55" />
        ) : (
          <rect x="8" y={gy} width={W - 16} height="16" rx="4" fill="#a16207" />
        )}
        {/* the star the thing should reach */}
        <rect x={gx - 46} y={gy - 70} width="92" height="70" rx="10" fill="rgba(251,191,36,0.06)" stroke="#fbbf24"
          strokeWidth="2" strokeDasharray="6 5" />
        {star(gx, top + 26)}
        {/* the two ends where a mover can go */}
        {['left', 'right'].map(side => {
          const s = slotAt(i, side);
          return (
            <rect key={side} id={`end-${i + 1}-${side}`} x={s.x - 44} y={s.y - 44} width="88" height="88" rx="12"
              fill="rgba(148,163,184,0.06)" stroke="#475569" strokeWidth="2" strokeDasharray="5 5" />
          );
        })}
        <g style={{ transform: `translate(${END_X[at]}px, ${gy}px)`, transition: 'transform 1.2s ease-in-out' }}>
          {thing(l.obj)}
        </g>
      </g>
    );
  };

  const moverItem = key => {
    const dragging = drag && drag.key === key && drag.x !== undefined;
    const p = placed[key];
    let at, flip = false;
    if (dragging) at = { x: drag.x, y: drag.y };
    else if (p) { at = slotAt(p.lane, p.side); flip = p.side === 'right'; }
    else at = traySlot(tray.indexOf(key));
    return (
      <g key={key} id={`mover-${key}`} transform={`translate(${at.x}, ${at.y}) scale(${flip ? -1 : 1}, 1)`}
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => onDown(key, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        <rect x="-44" y="-40" width="88" height="80" fill="transparent" />
        {mover(key)}
      </g>
    );
  };

  const anyPlaced = Object.keys(placed).length > 0;
  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <defs>
          <radialGradient id="steelBall" cx="0.35" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#f1f5f9" />
            <stop offset="0.6" stopColor="#94a3b8" />
            <stop offset="1" stopColor="#475569" />
          </radialGradient>
        </defs>
        {lanes.map(lane)}
        <rect x="0" y={TRAY_Y} width={W} height={TRAY_H - 6} rx="12" fill="rgba(30,41,59,0.6)" stroke="#334155" strokeDasharray="5 5" />
        {tray.map((k, j) => !placed[k] && (
          <text key={`label-${k}`} x={traySlot(j).x} y={TRAY_Y + 102} textAnchor="middle" fill="#e2e8f0" fontSize="15" fontWeight="600">
            {MOVERS[k].label}
          </text>
        ))}
        {tray.map(moverItem)}
      </svg>
      {canTest && anyPlaced && (
        <Row>
          <Button label={ran ? 'Try it again' : 'Try it'} onClick={() => { setRan(false); setTimeout(() => setRan(true), 30); }} />
        </Row>
      )}
    </Panel>
  );
}
