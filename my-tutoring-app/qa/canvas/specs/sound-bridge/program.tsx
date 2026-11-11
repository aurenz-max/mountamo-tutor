function Display({ params, lumina }) {
  // One or two lanes. Each lane: a squirrel taps softly on a post, a listener is at a second post, and there is a gap
  // between the posts. The child drags a bridge from the tray into the gap. Nothing shows whether the taps arrive:
  // the choice is a prediction.
  // params.lanes: [{ want: 'hear' | 'quiet', far: boolean }], 1-2 of them. params.tray: material keys, 2-4 of them.
  const lanes = (Array.isArray(params.lanes) && params.lanes.length ? params.lanes : [{ want: 'hear', far: false }])
    .slice(0, 2)
    .map(l => ({ want: l && l.want === 'quiet' ? 'quiet' : 'hear', far: !!(l && l.far) }));

  // The model. Each bridge has one number: how much of a tap it carries along (0 to 1). An empty gap is air.
  // A long gap loses more on the way. The listener hears the tap when what arrives is at least HEARD.
  const MATERIALS = {
    metal: { carry: 0.9, label: 'Metal' },
    wire: { carry: 0.85, label: 'Wire' },
    wood: { carry: 0.65, label: 'Wood' },
    cloth: { carry: 0.1, label: 'Blanket' },
    foam: { carry: 0.05, label: 'Sponge' },
    fatfoam: { carry: 0.03, label: 'Big sponge' },
  };
  const AIR = 0.2, FAR_LOSS = 0.3, HEARD = 0.4;
  const arrives = (key, far) => (key ? MATERIALS[key].carry : AIR) - (far ? FAR_LOSS : 0);
  const tray = (Array.isArray(params.tray) ? params.tray : ['foam', 'wood', 'cloth']).filter(k => MATERIALS[k]).slice(0, 4);

  const [inGap, setInGap] = useState(() => lanes.map(() => null));
  const [drag, setDrag] = useState(null); // { key, x, y }
  const svgRef = useRef(null);

  // A sleeper's lane needs a bridge too: the goal is a bridge that does not carry the taps, not an empty gap.
  const laneMet = (l, i) => (l.want === 'hear'
    ? arrives(inGap[i], l.far) >= HEARD
    : !!inGap[i] && arrives(inGap[i], l.far) < HEARD);
  const goalMet = lanes.every(laneMet);
  const laneName = i => (lanes.length === 1 ? 'the lane' : ['top lane', 'bottom lane'][i]);

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      lanes: lanes.map((l, i) => ({
        lane: laneName(i),
        listener: l.want === 'hear' ? 'a bunny who wants to hear the taps' : 'a sleeping cat who must not be woken',
        gap: l.far ? 'long' : 'short',
        bridge: inGap[i] ? MATERIALS[inGap[i]].label : 'empty',
      })),
      tray: tray.filter(k => !inGap.includes(k)).map(k => MATERIALS[k].label),
    });
  }, [goalMet, inGap]);

  // ---------- layout ----------
  const W = 680;
  const LANE_H = lanes.length === 1 ? 230 : 168;
  const TRAY_Y = lanes.length * LANE_H + 8;
  const TRAY_H = 124;
  const H = TRAY_Y + TRAY_H;
  const POST_L = 128;
  const postR = l => (l.far ? 548 : 388);
  const barY = i => i * LANE_H + LANE_H / 2 + 6;
  const gapOf = i => ({ x1: POST_L + 9, x2: postR(lanes[i]) - 9, y: barY(i) });
  const slot = i => ({ x: (W / (tray.length + 1)) * (i + 1), y: TRAY_Y + 44 });
  const TRAY_LEN = 116;

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
    const target = lanes.findIndex((_, i) => {
      const g = gapOf(i);
      return pt.x >= g.x1 - 24 && pt.x <= g.x2 + 24 && Math.abs(pt.y - g.y) <= 52;
    });
    setInGap(prev => {
      const next = prev.map(k => (k === drag.key ? null : k));
      if (target >= 0) next[target] = drag.key;
      return next;
    });
    setDrag(null);
  };

  // ---------- pictures ----------
  // A bridge of a given length, centred on 0,0.
  const bar = (key, len) => {
    const x = -len / 2;
    if (key === 'metal') return (
      <g>
        <rect x={x} y="-11" width={len} height="22" rx="2" fill="url(#steel)" stroke="#334155" strokeWidth="2" />
        <rect x={x} y="-11" width={len} height="5" fill="#f1f5f9" opacity="0.7" />
        {[0.12, 0.5, 0.88].map(f => <circle key={f} cx={x + len * f} cy="3" r="3" fill="#475569" />)}
      </g>
    );
    if (key === 'wire') return (
      <g>
        <line x1={x} y1="0" x2={x + len} y2="0" stroke="#e2e8f0" strokeWidth="3.5" />
        <circle cx={x + 4} cy="0" r="6" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle cx={x + len - 4} cy="0" r="6" fill="none" stroke="#e2e8f0" strokeWidth="3" />
      </g>
    );
    if (key === 'wood') return (
      <g>
        <rect x={x} y="-12" width={len} height="24" rx="3" fill="#b45309" stroke="#78350f" strokeWidth="2" />
        <path d={`M ${x + 8} -4 H ${x + len - 8} M ${x + 14} 5 H ${x + len - 20}`} stroke="#92400e" strokeWidth="2" fill="none" />
        <ellipse cx={x + len * 0.3} cy="0" rx="6" ry="3" fill="none" stroke="#78350f" strokeWidth="1.5" />
      </g>
    );
    if (key === 'cloth') {
      const n = Math.max(3, Math.round(len / 26));
      const w = len / n;
      return (
        <g>
          <rect x={x} y="-14" width={len} height="28" rx="14" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
          {Array.from({ length: n - 1 }, (_, j) => (
            <path key={j} d={`M ${x + w * (j + 1)} -14 q 6 14 0 28`} fill="none" stroke="#fecaca" strokeWidth="2.5" />
          ))}
        </g>
      );
    }
    const fat = key === 'fatfoam';
    const h = fat ? 26 : 13;
    const n = Math.max(4, Math.round(len / 16));
    return (
      <g>
        <rect x={x} y={-h} width={len} height={h * 2} rx="8" fill="#facc15" stroke="#a16207" strokeWidth="2" />
        {Array.from({ length: n }, (_, j) => (
          <circle key={j} cx={x + (len / n) * (j + 0.5)} cy={(j % 2 ? 0.4 : -0.35) * h} r={fat ? 4.5 : 3} fill="#a16207" opacity="0.75" />
        ))}
        {fat && Array.from({ length: n - 1 }, (_, j) => (
          <circle key={`b${j}`} cx={x + (len / n) * (j + 1)} cy={(j % 2 ? -0.6 : 0.65) * h} r="3" fill="#a16207" opacity="0.6" />
        ))}
      </g>
    );
  };

  const post = (x, y) => (
    <g>
      <rect x={x - 9} y={y - 46} width="18" height="92" rx="3" fill="#78716c" stroke="#d6d3d1" strokeWidth="2" />
      <rect x={x - 16} y={y + 44} width="32" height="8" rx="3" fill="#57534e" />
    </g>
  );

  const lane = (l, i) => {
    const top = i * LANE_H;
    const y = barY(i);
    const g = gapOf(i);
    const pr = postR(l);
    return (
      <g key={i}>
        <rect x="0" y={top} width={W} height={LANE_H - 6} rx="12" fill="#0b1224" />
        <rect x="0" y={y + 52} width={W} height={top + LANE_H - 6 - (y + 52)} rx="0" fill="#14532d" opacity="0.55" />
        {/* the tapper */}
        <text x="56" y={y + 14} textAnchor="middle" fontSize="44">🐿️</text>
        <g transform={`translate(${POST_L - 22}, ${y - 26}) rotate(-35)`}>
          <rect x="-3" y="0" width="6" height="26" rx="2" fill="#d6d3d1" />
          <rect x="-9" y="-8" width="18" height="10" rx="2" fill="#94a3b8" />
        </g>
        <path d={`M ${POST_L - 30} ${y - 46} l -7 -7 M ${POST_L - 20} ${y - 50} l 0 -10 M ${POST_L - 10} ${y - 46} l 7 -7`}
          stroke="#fde68a" strokeWidth="2.5" strokeLinecap="round" />
        {post(POST_L, y)}
        {post(pr, y)}
        {/* the gap between the posts */}
        <rect id={`gap-${i + 1}`} x={g.x1} y={y - 24} width={g.x2 - g.x1} height="48" rx="8"
          fill="rgba(251,191,36,0.05)" stroke="#fbbf24" strokeWidth="2" strokeDasharray="7 5" />
        {/* the listener */}
        {l.want === 'hear' ? (
          <g>
            <text x={pr + 42} y={y + 16} textAnchor="middle" fontSize="44">🐰</text>
            <text x={pr + 84} y={y - 20} textAnchor="middle" fontSize="28">👂</text>
          </g>
        ) : (
          <g>
            <ellipse cx={pr + 50} cy={y + 30} rx="40" ry="14" fill="#7c3aed" opacity="0.7" />
            <text x={pr + 50} y={y + 26} textAnchor="middle" fontSize="40">🐱</text>
            <text x={pr + 92} y={y - 16} textAnchor="middle" fontSize="28">💤</text>
          </g>
        )}
      </g>
    );
  };

  const item = key => {
    const dragging = drag && drag.key === key && drag.x !== undefined;
    const lane_i = inGap.indexOf(key);
    let at, len;
    if (dragging) { at = { x: drag.x, y: drag.y }; len = TRAY_LEN; }
    else if (lane_i >= 0) { const g = gapOf(lane_i); at = { x: (g.x1 + g.x2) / 2, y: g.y }; len = g.x2 - g.x1; }
    else { at = slot(tray.indexOf(key)); len = TRAY_LEN; }
    return (
      <g key={key} id={`mat-${key}`} transform={`translate(${at.x}, ${at.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => onDown(key, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        <rect x={-len / 2} y="-30" width={len} height="60" fill="transparent" />
        {bar(key, len)}
      </g>
    );
  };

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <defs>
          <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e2e8f0" />
            <stop offset="0.5" stopColor="#94a3b8" />
            <stop offset="1" stopColor="#64748b" />
          </linearGradient>
        </defs>
        {lanes.map(lane)}
        <rect x="0" y={TRAY_Y} width={W} height={TRAY_H - 6} rx="12" fill="rgba(30,41,59,0.6)" stroke="#334155" strokeDasharray="5 5" />
        {tray.map((k, i) => !inGap.includes(k) && (
          <text key={`label-${k}`} x={slot(i).x} y={TRAY_Y + 98} textAnchor="middle" fill="#e2e8f0" fontSize="15" fontWeight="600">
            {MATERIALS[k].label}
          </text>
        ))}
        {tray.map(item)}
      </svg>
    </Panel>
  );
}
