function Display({ params, lumina }) {
  // One to three beams. Each beam: a flashlight, an empty holder, a wall with a card that shows the shadow asked for.
  // The child drags a sheet of material from the tray into each holder. The wall shows only a dashed outline of where
  // a shadow would fall, never the shadow itself, so the choice is a prediction.
  // params.beams: [{ want: 'dark' | 'faint' | 'none' }], 1-3 of them. params.tray: material keys, 3-5 of them.
  const beams = (Array.isArray(params.beams) && params.beams.length ? params.beams : [{ want: 'dark' }])
    .slice(0, 3)
    .map(b => ({ want: b && (b.want === 'faint' || b.want === 'none') ? b.want : 'dark' }));

  // The model. Each material has one number: how much of the light it lets through (0 to 1). The shadow follows from
  // it: almost none through is a dark shadow, nearly all through is no shadow, anything between is a faint shadow.
  const MATERIALS = {
    cardboard: { pass: 0.0, label: 'Cardboard' },
    whitecard: { pass: 0.02, label: 'White card' },
    foil: { pass: 0.0, label: 'Foil' },
    glass: { pass: 0.92, label: 'Glass' },
    block: { pass: 0.85, label: 'Glass block' },
    wrap: { pass: 0.9, label: 'Wrap' },
    wax: { pass: 0.4, label: 'Wax paper' },
    tissue: { pass: 0.5, label: 'Tissue' },
  };
  const DARK_BELOW = 0.15, NONE_ABOVE = 0.75;
  const shadowOf = key => {
    if (!key) return null;
    const p = MATERIALS[key].pass;
    return p < DARK_BELOW ? 'dark' : p > NONE_ABOVE ? 'none' : 'faint';
  };
  const tray = (Array.isArray(params.tray) ? params.tray : ['cardboard', 'glass', 'wrap'])
    .filter(k => MATERIALS[k]).slice(0, 5);

  const [inHolder, setInHolder] = useState(() => beams.map(() => null));
  const [drag, setDrag] = useState(null); // { key, x, y }
  const svgRef = useRef(null);

  const goalMet = beams.every((b, i) => shadowOf(inHolder[i]) === b.want);
  const WANT_WORDS = { dark: 'a dark shadow', faint: 'a faint shadow', none: 'no shadow' };
  const beamName = i => (beams.length === 1 ? 'the beam' : ['top beam', 'middle beam', 'bottom beam'][i]);

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      beams: beams.map((b, i) => ({
        beam: beamName(i),
        wallCardShows: WANT_WORDS[b.want],
        holder: inHolder[i] ? MATERIALS[inHolder[i]].label : 'empty',
      })),
      tray: tray.filter(k => !inHolder.includes(k)).map(k => MATERIALS[k].label),
      wall: 'each wall shows only a dashed outline where a shadow would fall',
    });
  }, [goalMet, inHolder]);

  // ---------- layout ----------
  const W = 680;
  const LANE_H = beams.length === 1 ? 260 : 150;
  const TRAY_Y = beams.length * LANE_H + 8;
  const TRAY_H = 136;
  const H = TRAY_Y + TRAY_H;
  const cy = i => i * LANE_H + LANE_H / 2 - 3;
  const holderAt = i => ({ x: 300, y: cy(i) });
  const slotX = i => (W / (tray.length + 1)) * (i + 1);
  const slot = i => ({ x: slotX(i), y: TRAY_Y + 56 });

  const where = key => {
    if (drag && drag.key === key && drag.x !== undefined) return { x: drag.x, y: drag.y };
    const h = inHolder.indexOf(key);
    return h >= 0 ? holderAt(h) : slot(tray.indexOf(key));
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
    beams.forEach((_, i) => {
      const h = holderAt(i);
      const d = Math.hypot(h.x - pt.x, h.y - pt.y);
      if (d < best) { best = d; target = i; }
    });
    setInHolder(prev => {
      const next = prev.map(k => (k === drag.key ? null : k));
      if (target >= 0) next[target] = drag.key;
      return next;
    });
    setDrag(null);
  };

  // ---------- pictures ----------
  // The patterned card each tray sheet stands on, so how much a sheet lets through can be seen, not read.
  const pattern = () => (
    <g>
      <rect x="-38" y="-42" width="76" height="84" rx="6" fill="#f8fafc" />
      <rect x="-30" y="-42" width="12" height="84" fill="#ef4444" />
      <rect x="-6" y="-42" width="12" height="84" fill="#2563eb" />
      <rect x="18" y="-42" width="12" height="84" fill="#16a34a" />
      <circle cx="0" cy="-20" r="7" fill="#111827" />
      <circle cx="0" cy="20" r="7" fill="#111827" />
    </g>
  );

  const SW = 46, SH = 62;
  const sheet = (key, onPattern) => {
    const r = { x: -SW / 2, y: -SH / 2, width: SW, height: SH };
    if (key === 'cardboard') return (
      <g>
        <rect {...r} rx="2" fill="#b45309" stroke="#78350f" strokeWidth="2" />
        {[-14, -4, 6, 16].map(y => <line key={y} x1={-SW / 2 + 4} y1={y} x2={SW / 2 - 4} y2={y} stroke="#92400e" strokeWidth="2" />)}
      </g>
    );
    if (key === 'whitecard') return (
      <g>
        <rect {...r} rx="2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
        <line x1={-SW / 2 + 5} y1={SH / 2 - 6} x2={SW / 2 - 5} y2={SH / 2 - 6} stroke="#e2e8f0" strokeWidth="2" />
      </g>
    );
    if (key === 'foil') return (
      <g>
        <rect {...r} rx="1" fill="url(#foil-shine)" stroke="#64748b" strokeWidth="1" />
        <path d="M -18 -20 L -6 -12 L -14 0 L 2 8 L -8 22" fill="none" stroke="#f8fafc" strokeWidth="1.5" opacity="0.8" />
        <path d="M 8 -26 L 16 -10 L 6 4 L 18 18" fill="none" stroke="#475569" strokeWidth="1.2" opacity="0.7" />
      </g>
    );
    if (key === 'glass') return (
      <g>
        <rect {...r} rx="2" fill="#e0f2fe" opacity="0.1" />
        <rect {...r} rx="2" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
        <line x1="-14" y1="-22" x2="-4" y2="-30" stroke="#ffffff" strokeWidth="2.5" opacity="0.9" />
        <line x1="-16" y1="-10" x2="2" y2="-26" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
      </g>
    );
    if (key === 'block') {
      const D = 12; // depth of the thick block
      return (
        <g>
          <path d={`M ${-SW / 2} ${-SH / 2} l ${D} ${-D} l ${SW} 0 l ${-D} ${D} Z`} fill="#bae6fd" opacity="0.5" stroke="#38bdf8" strokeWidth="2" />
          <path d={`M ${SW / 2} ${-SH / 2} l ${D} ${-D} l 0 ${SH} l ${-D} ${D} Z`} fill="#7dd3fc" opacity="0.5" stroke="#38bdf8" strokeWidth="2" />
          <rect {...r} fill="#e0f2fe" opacity="0.12" />
          <rect {...r} fill="none" stroke="#38bdf8" strokeWidth="3" />
          <line x1="-14" y1="-22" x2="-4" y2="-30" stroke="#ffffff" strokeWidth="2.5" opacity="0.9" />
        </g>
      );
    }
    if (key === 'wrap') return (
      <g>
        <rect {...r} rx="2" fill="#f1f5f9" opacity="0.08" />
        <path d={`M ${-SW / 2} ${-SH / 2 + 2} q 6 -4 12 0 t 12 0 t 12 0 t 10 0`} fill="none" stroke="#94a3b8" strokeWidth="1.5" opacity="0.9" />
        <path d={`M ${-SW / 2 + 2} ${-SH / 2} L ${-SW / 2 + 4} ${SH / 2} L ${SW / 2 - 2} ${SH / 2 - 2} L ${SW / 2} ${-SH / 2 + 2}`} fill="none" stroke="#94a3b8" strokeWidth="1.5" opacity="0.8" />
        <path d="M -12 -18 L -2 -6 M 6 10 L 14 20 M -10 14 L -4 22" stroke="#ffffff" strokeWidth="1.2" opacity="0.6" />
      </g>
    );
    // Frosted sheets: what is behind shows only as a blur.
    const tint = key === 'wax' ? '#fefce8' : '#fdf4ff';
    return (
      <g>
        {onPattern && <g clipPath="url(#sheet-clip)" filter="url(#frost)">{pattern()}</g>}
        <rect {...r} rx="2" fill={tint} opacity={onPattern ? 0.62 : 0.55} />
        <rect {...r} rx="2" fill="none" stroke="#f8fafc" strokeWidth="1.5" opacity="0.9" />
        {key === 'tissue'
          ? <path d="M -16 -24 L -8 -14 L -14 -2 M 4 -22 L 12 -8 M -6 8 L 4 18 L -2 26 M 10 6 L 16 20" fill="none" stroke="#e9d5ff" strokeWidth="1.2" />
          : <path d="M -18 -26 L 18 -26 M -18 26 L 18 26" stroke="#fef08a" strokeWidth="1" opacity="0.6" />}
      </g>
    );
  };

  const flashlight = y => (
    <g transform={`translate(52, ${y})`}>
      <rect x="-30" y="-13" width="56" height="26" rx="6" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
      <rect x="-14" y="-17" width="12" height="6" rx="2" fill="#f97316" />
      <path d="M 26 -13 L 44 -22 L 44 22 L 26 13 Z" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
      <rect x="42" y="-22" width="6" height="44" rx="2" fill="#fef9c3" />
    </g>
  );

  // A small picture of a shadow on a lit wall: the card the child matches, drawn not written.
  const shadowCard = (want, x, y) => (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-50" y="-48" width="100" height="96" rx="10" fill="#1e293b" stroke="#fbbf24" strokeWidth="2" />
      <rect x="-34" y="-38" width="68" height="56" rx="4" fill="#e7e5e4" />
      <ellipse cx="0" cy="-10" rx="30" ry="24" fill="#fde68a" />
      {want === 'dark' && <rect x="-11" y="-26" width="22" height="32" rx="2" fill="#111827" />}
      {want === 'faint' && <rect x="-11" y="-26" width="22" height="32" rx="2" fill="#78716c" opacity="0.45" />}
      <text x="0" y="38" textAnchor="middle" fill="#f8fafc" fontSize="16" fontWeight="700">
        {want === 'dark' ? 'Dark' : want === 'faint' ? 'Faint' : 'None'}
      </text>
    </g>
  );

  const lane = (b, i) => {
    const top = i * LANE_H;
    const y = cy(i);
    const half = Math.min(64, LANE_H / 2 - 22);
    const h = holderAt(i);
    const outW = 30, outH = 44;
    return (
      <g key={i}>
        <rect x="0" y={top} width={W} height={LANE_H - 6} rx="12" fill="#0b1224" />
        {/* the beam: the same whatever is in the holder */}
        <path d={`M 100 ${y - 14} L 100 ${y + 14} L 474 ${y + half} L 474 ${y - half} Z`} fill="#fde68a" opacity="0.16" />
        {flashlight(y)}
        {/* the holder: a stand with a clip */}
        <line x1={h.x} y1={y + 40} x2={h.x} y2={top + LANE_H - 14} stroke="#64748b" strokeWidth="5" />
        <rect x={h.x - 26} y={top + LANE_H - 18} width="52" height="8" rx="3" fill="#64748b" />
        <rect id={`holder-${i + 1}`} x={h.x - 32} y={y - 40} width="64" height="80" rx="6"
          fill="rgba(251,191,36,0.06)" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 4" />
        {/* the wall: lit, with only an outline where a shadow would fall */}
        <rect x="474" y={top + 10} width="74" height={LANE_H - 26} rx="4" fill="#d6d3d1" />
        <ellipse cx="511" cy={y} rx="34" ry={half} fill="#fde68a" opacity="0.55" />
        <rect x={511 - outW / 2} y={y - outH / 2} width={outW} height={outH} rx="2" fill="none"
          stroke="#57534e" strokeWidth="2" strokeDasharray="4 3" />
        {shadowCard(b.want, 616, y)}
      </g>
    );
  };

  const item = (key, idx) => {
    const at = where(key);
    const dragging = drag && drag.key === key && drag.x !== undefined;
    const inTray = inHolder.indexOf(key) < 0 && !dragging;
    return (
      <g key={key} id={`mat-${key}`} transform={`translate(${at.x}, ${at.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => onDown(key, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        <rect x="-34" y="-40" width="68" height="80" fill="transparent" />
        {sheet(key, inTray)}
      </g>
    );
  };

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <defs>
          <filter id="frost" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5" /></filter>
          <clipPath id="sheet-clip"><rect x={-SW / 2} y={-SH / 2} width={SW} height={SH} /></clipPath>
          <linearGradient id="foil-shine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e2e8f0" />
            <stop offset="0.5" stopColor="#94a3b8" />
            <stop offset="1" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>
        {beams.map(lane)}
        <rect x="0" y={TRAY_Y} width={W} height={TRAY_H - 6} rx="12" fill="rgba(30,41,59,0.6)" stroke="#334155" strokeDasharray="5 5" />
        {tray.map((k, i) => (
          <g key={`slot-${k}`} transform={`translate(${slot(i).x}, ${slot(i).y})`} opacity={inHolder.includes(k) ? 0.25 : 1}>
            {pattern()}
            {!inHolder.includes(k) && <text y="62" textAnchor="middle" fill="#e2e8f0" fontSize="15" fontWeight="600">{MATERIALS[k].label}</text>}
          </g>
        ))}
        {tray.map(item)}
      </svg>
    </Panel>
  );
}
