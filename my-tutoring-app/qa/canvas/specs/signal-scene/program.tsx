function Display({ params, lumina }) {
  // One or more paths, each a sender on the left and a far-off receiver on the right, with what lies between them
  // ('clear', 'fog', 'waterfall', 'crowd', 'hill'). The child drags a device from the tray onto each sender.
  // params.sky: 'night' | 'day'. params.paths: [{ between, distance }]. params.tray: device keys, 3-4 of them.
  const sky = params.sky === 'day' ? 'day' : 'night';
  const paths = (Array.isArray(params.paths) && params.paths.length ? params.paths : [{ between: 'clear', distance: 3 }])
    .slice(0, 2)
    .map(p => ({ between: p.between || 'clear', distance: typeof p.distance === 'number' ? p.distance : 3 }));

  // The model. A device has a kind and a power. Light and things that must be seen are stopped by a hill and cut by
  // fog; a flag needs daylight to be seen; a lamp carries further in the dark. Sound goes over a hill and through fog
  // but is drowned by loud noise. A device works on a path when its reach is at least the path's distance.
  const DEVICES = {
    lantern: { kind: 'light', power: 2, label: 'Lantern' },
    lamp: { kind: 'light', power: 3, label: 'Big lamp' },
    flag: { kind: 'seen', power: 3, label: 'Flag' },
    whistle: { kind: 'sound', power: 1, label: 'Whistle' },
    drum: { kind: 'sound', power: 2, label: 'Drum' },
    horn: { kind: 'sound', power: 3, label: 'Horn' },
  };
  const FOG_CUT = 5, NOISE_CUT = 3, DARK_BOOST = 2;
  const tray = (Array.isArray(params.tray) ? params.tray : ['flag', 'lantern', 'whistle', 'drum']).filter(k => DEVICES[k]).slice(0, 4);

  const reach = (dev, path) => {
    const noisy = path.between === 'waterfall' || path.between === 'crowd';
    if (dev.kind === 'sound') return dev.power - (noisy ? NOISE_CUT : 0);
    if (path.between === 'hill') return 0;
    let r = dev.kind === 'light' ? dev.power + (sky === 'night' ? DARK_BOOST : 0) : (sky === 'night' ? 0 : dev.power);
    if (path.between === 'fog') r -= FOG_CUT;
    return r;
  };
  const works = (key, path) => !!key && reach(DEVICES[key], path) >= path.distance;

  const [onSender, setOnSender] = useState(() => paths.map(() => null)); // device key held by each sender
  const [drag, setDrag] = useState(null); // { key, x, y }
  const svgRef = useRef(null);

  const goalMet = paths.every((p, i) => works(onSender[i], p));
  const NAMES = { clear: 'clear air', fog: 'thick fog', waterfall: 'a loud waterfall', crowd: 'a loud crowd', hill: 'a big hill' };

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      sky: sky === 'night' ? 'dark night' : 'daytime',
      paths: paths.map((p, i) => ({
        sender: paths.length > 1 ? (i === 0 ? 'top sender' : 'bottom sender') : 'sender',
        between: NAMES[p.between] || p.between,
        holding: onSender[i] ? DEVICES[onSender[i]].label : 'nothing',
      })),
      tray: tray.filter(k => !onSender.includes(k)).map(k => DEVICES[k].label),
    });
  }, [goalMet, onSender]);

  const LANE_H = 190;
  const TRAY_Y = paths.length * LANE_H + 8;
  const H = TRAY_Y + 118;
  const W = 680;
  const hand = i => ({ x: 128, y: i * LANE_H + 104 });
  const slotX = i => (W / (tray.length + 1)) * (i + 1);
  const slot = i => ({ x: slotX(i), y: TRAY_Y + 50 });

  const where = key => {
    if (drag && drag.key === key && drag.x !== undefined) return { x: drag.x, y: drag.y };
    const s = onSender.indexOf(key);
    return s >= 0 ? hand(s) : slot(tray.indexOf(key));
  };

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
    let target = -1, best = 70;
    paths.forEach((_, i) => {
      const h = hand(i);
      const d = Math.hypot(h.x - pt.x, h.y - pt.y);
      if (d < best) { best = d; target = i; }
    });
    setOnSender(prev => {
      const next = prev.map(k => (k === drag.key ? null : k));
      if (target >= 0) next[target] = drag.key;
      return next;
    });
    setDrag(null);
  };

  // ---------- pictures ----------
  const person = (x, y, shirt, flip, size) => (
    <g transform={`translate(${x}, ${y}) scale(${flip ? -(size || 1) : size || 1}, ${size || 1})`}>
      <circle cx="0" cy="-58" r="12" fill="#f5c9a0" />
      <rect x="-11" y="-45" width="22" height="32" rx="7" fill={shirt} />
      <line x1="-6" y1="-14" x2="-8" y2="0" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
      <line x1="6" y1="-14" x2="8" y2="0" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
      <line x1="9" y1="-40" x2="24" y2="-52" stroke={shirt} strokeWidth="6" strokeLinecap="round" />
      <line x1="-9" y1="-40" x2="-16" y2="-24" stroke={shirt} strokeWidth="6" strokeLinecap="round" />
    </g>
  );

  const stars = top => [[60, 24], [190, 40], [260, 18], [420, 30], [470, 56], [560, 22], [640, 48], [330, 50]].map(([x, y], i) => (
    <circle key={i} cx={x} cy={top + y} r={i % 3 === 0 ? 2 : 1.4} fill="#e2e8f0" opacity="0.85" />
  ));

  const zig = (x, y, k) => (
    <path key={k} d={`M ${x} ${y} l 8 -8 l 8 8 l 8 -8 l 8 8`} fill="none" stroke="#fde047" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  );

  const between = (kind, top) => {
    const g = top + 160; // ground line
    if (kind === 'fog') return (
      <g opacity="0.92">
        {[[260, 70, 90, 40], [380, 60, 100, 46], [320, 120, 130, 44], [470, 115, 80, 44], [230, 130, 70, 32], [440, 82, 80, 36]].map(([cx, cy, rx, ry], i) => (
          <ellipse key={i} cx={cx} cy={top + cy} rx={rx} ry={ry} fill={i % 2 ? '#cbd5e1' : '#94a3b8'} opacity="0.9" />
        ))}
      </g>
    );
    if (kind === 'waterfall') return (
      <g>
        <path d={`M 300 ${g} L 312 ${top + 14} L 418 ${top + 14} L 430 ${g} Z`} fill="#57534e" />
        <rect x="336" y={top + 14} width="58" height={g - top - 14} fill="#7dd3fc" />
        {[346, 360, 374, 386].map((x, i) => <line key={i} x1={x} y1={top + 18 + i * 6} x2={x} y2={g - 6} stroke="#f0f9ff" strokeWidth="3" opacity="0.8" />)}
        <ellipse cx="365" cy={g} rx="62" ry="12" fill="#e0f2fe" />
        {zig(250, top + 60, 'z1')}{zig(250, top + 96, 'z2')}{zig(448, top + 60, 'z3')}{zig(448, top + 96, 'z4')}
      </g>
    );
    if (kind === 'crowd') return (
      <g>
        {[230, 268, 306, 344, 382, 420, 458].map((x, i) => (
          <g key={i} transform={`translate(${x}, ${g - (i % 2 ? 4 : 0)})`}>
            <circle cx="0" cy="-44" r="10" fill={['#f5c9a0', '#c68642', '#8d5524', '#f1c27d'][i % 4]} />
            <ellipse cx="0" cy="-40" rx="4" ry="4" fill="#1e1b4b" />
            <rect x="-9" y="-33" width="18" height="30" rx="6" fill={['#a855f7', '#22c55e', '#ef4444', '#eab308'][i % 4]} />
            <line x1="-8" y1="-30" x2="-16" y2="-50" stroke={['#a855f7', '#22c55e', '#ef4444', '#eab308'][i % 4]} strokeWidth="5" strokeLinecap="round" />
            <line x1="8" y1="-30" x2="16" y2="-50" stroke={['#a855f7', '#22c55e', '#ef4444', '#eab308'][i % 4]} strokeWidth="5" strokeLinecap="round" />
          </g>
        ))}
        {zig(240, top + 40, 'z1')}{zig(320, top + 30, 'z2')}{zig(400, top + 40, 'z3')}
      </g>
    );
    if (kind === 'hill') return (
      <path d={`M 190 ${g} C 260 ${top + 10}, 440 ${top + 10}, 510 ${g} Z`} fill="#166534" stroke="#22c55e" strokeWidth="2" />
    );
    return (
      <g>
        {[260, 420].map((x, i) => <ellipse key={i} cx={x} cy={g - 6} rx="22" ry="10" fill="#14532d" />)}
      </g>
    );
  };

  const lane = (p, i) => {
    const top = i * LANE_H;
    const night = sky === 'night';
    return (
      <g key={i}>
        <rect x="0" y={top} width={W} height={LANE_H - 6} rx="12" fill={night ? '#0b1026' : '#7dd3fc'} />
        {night ? stars(top) : <circle cx="600" cy={top + 34} r="20" fill="#fde047" />}
        {night && i === 0 && <path d={`M 120 ${top + 22} a 14 14 0 1 0 14 22 a 11 11 0 1 1 -14 -22 Z`} fill="#fef9c3" />}
        <rect x="0" y={top + 160} width={W} height={LANE_H - 166} fill={night ? '#14321f' : '#4ade80'} />
        {between(p.between, top)}
        {person(76, top + 168, '#f97316', false, 1)}
        {person(616, top + 164, '#3b82f6', true, 0.7)}
        <circle id={`sender-${i + 1}`} cx={hand(i).x} cy={hand(i).y} r="30" fill="rgba(251,191,36,0.10)" stroke="#fbbf24" strokeWidth="2" strokeDasharray="5 4" />
      </g>
    );
  };

  const icon = key => {
    if (key === 'lantern') return (
      <g>
        <path d="M -8 -22 Q 0 -32 8 -22" fill="none" stroke="#cbd5e1" strokeWidth="3" />
        <rect x="-13" y="-22" width="26" height="6" rx="2" fill="#78350f" />
        <rect x="-11" y="-16" width="22" height="26" rx="4" fill="#fde68a" stroke="#78350f" strokeWidth="3" />
        <rect x="-13" y="10" width="26" height="6" rx="2" fill="#78350f" />
      </g>
    );
    if (key === 'lamp') return (
      <g>
        {[-40, -20, 0, 20, 40].map(a => (
          <line key={a} x1="16" y1="0" x2={16 + 18 * Math.cos(a * Math.PI / 180)} y2={18 * Math.sin(a * Math.PI / 180)} stroke="#fde047" strokeWidth="3" strokeLinecap="round" />
        ))}
        <rect x="-22" y="-12" width="30" height="24" rx="5" fill="#475569" stroke="#cbd5e1" strokeWidth="2" />
        <path d="M 8 -16 L 18 -20 L 18 20 L 8 16 Z" fill="#fef9c3" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="-14" y="12" width="8" height="12" fill="#475569" />
      </g>
    );
    if (key === 'flag') return (
      <g>
        <line x1="-10" y1="-26" x2="-10" y2="24" stroke="#d6d3d1" strokeWidth="4" strokeLinecap="round" />
        <path d="M -8 -24 L 20 -16 L -8 -6 Z" fill="#ef4444" />
      </g>
    );
    if (key === 'whistle') return (
      <g>
        <rect x="-16" y="-8" width="22" height="14" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
        <circle cx="8" cy="2" r="10" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
        <circle cx="8" cy="2" r="3" fill="#64748b" />
      </g>
    );
    if (key === 'drum') return (
      <g>
        <ellipse cx="0" cy="12" rx="20" ry="7" fill="#b91c1c" />
        <rect x="-20" y="-10" width="40" height="22" fill="#dc2626" />
        <ellipse cx="0" cy="-10" rx="20" ry="7" fill="#fef3c7" stroke="#b91c1c" strokeWidth="2" />
        <path d="M -20 -6 L -10 10 L 0 -6 L 10 10 L 20 -6" fill="none" stroke="#fde68a" strokeWidth="2" />
      </g>
    );
    return (
      <g>
        <path d="M -24 -4 L 6 -6 L 22 -20 L 22 20 L 6 6 L -24 4 Z" fill="#f59e0b" stroke="#92400e" strokeWidth="2" strokeLinejoin="round" />
        <rect x="-28" y="-5" width="6" height="10" rx="2" fill="#92400e" />
      </g>
    );
  };

  const device = key => {
    const at = where(key);
    const inTray = onSender.indexOf(key) < 0 && !(drag && drag.key === key && drag.x !== undefined);
    return (
      <g key={key} id={`dev-${key}`} transform={`translate(${at.x}, ${at.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => onDown(key, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        <circle r="32" fill="transparent" />
        {icon(key)}
        {inTray && <text y="48" textAnchor="middle" fill="#e2e8f0" fontSize="15" fontWeight="600">{DEVICES[key].label}</text>}
      </g>
    );
  };

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        {paths.map(lane)}
        <rect x="0" y={TRAY_Y} width={W} height="108" rx="12" fill="rgba(30,41,59,0.6)" stroke="#334155" strokeDasharray="5 5" />
        {tray.map(device)}
      </svg>
    </Panel>
  );
}
