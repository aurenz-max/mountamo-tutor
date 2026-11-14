function Display({ params, lumina }) {
  // A workbench with a battery, a knife switch and one or two bulbs. Drag from one terminal to another to string a
  // wire; tap a wire's x to cut it; tap the switch blade to open or close it. The bulb glows only when current can go
  // round a loop through it; a wire straight across the battery makes the battery hot and every bulb dark.
  // params.bulbs: 1 or 2 bulbs in the loop. params.prewired: [[termA, termB]] wires already on the bench (a fault to
  // fix). params.switchClosed: the blade's starting position. params.showNames: false hides the contact names.
  const nBulbs = Number(params.bulbs) === 2 ? 2 : 1;
  const showNames = params.showNames !== false;
  const bulbAt = nBulbs === 2 ? [{ cx: 600, top: 235 }, { cx: 380, top: 280 }] : [{ cx: 580, top: 240 }];

  const TERMINALS = {
    bat_pos: { id: 'bat_pos', x: 120, y: 170, label: '+', color: '#ef4444' },
    bat_neg: { id: 'bat_neg', x: 120, y: 350, label: '−', color: '#3b82f6' },
    sw_a: { id: 'sw_a', x: 330, y: 150, label: 'A', color: '#eab308' },
    sw_b: { id: 'sw_b', x: 430, y: 150, label: 'B', color: '#eab308' },
  };
  bulbAt.forEach((b, i) => {
    const s = i === 0 ? '' : '2';
    TERMINALS['bulb' + s + '_side'] = { id: 'bulb' + s + '_side', x: b.cx - 30, y: b.top + 90, label: 'Side', color: '#a855f7' };
    TERMINALS['bulb' + s + '_base'] = { id: 'bulb' + s + '_base', x: b.cx, y: b.top + 140, label: 'Bottom', color: '#ec4899' };
  });
  const bulbs = bulbAt.map((b, i) => (i === 0 ? ['bulb_side', 'bulb_base'] : ['bulb2_side', 'bulb2_base']));

  const startWires = () => (Array.isArray(params.prewired) ? params.prewired : [])
    .filter(w => TERMINALS[w[0]] && TERMINALS[w[1]]).map(w => ({ id: w[0] + '-' + w[1], from: w[0], to: w[1] }));
  const [wires, setWires] = useState(startWires);
  const [activeDrag, setActiveDrag] = useState(null);
  const [switchClosed, setSwitchClosed] = useState(params.switchClosed === true);
  const svgRef = useRef(null);
  const pt = e => svgPoint(svgRef.current, e);

  const onDownTerm = (termId, e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    setActiveDrag({ fromTerm: termId, currentPos: pt(e) });
  };
  const onMove = e => { if (activeDrag) { const p = pt(e); setActiveDrag(prev => (prev ? { ...prev, currentPos: p } : null)); } };
  const onUp = e => {
    if (!activeDrag) return;
    const p = pt(e);
    let closest = null, minDist = 38;
    Object.values(TERMINALS).forEach(t => {
      if (t.id === activeDrag.fromTerm) return;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < minDist) { minDist = d; closest = t.id; }
    });
    if (closest) {
      const a = activeDrag.fromTerm;
      const exists = wires.some(w => (w.from === a && w.to === closest) || (w.from === closest && w.to === a));
      if (!exists) setWires(prev => [...prev, { id: a + '-' + closest, from: a, to: closest }]);
    }
    setActiveDrag(null);
  };
  const cut = (id, e) => { e.stopPropagation(); setWires(prev => prev.filter(w => w.id !== id)); };

  // A bulb glows when current can go from + to − along wires (and through the closed switch) passing in one contact
  // and out the other, and no wire path runs straight from + to − around every bulb (that makes the battery hot).
  const analyse = closed => {
    const adj = {};
    Object.keys(TERMINALS).forEach(k => { adj[k] = []; });
    wires.forEach(({ from, to }) => { adj[from].push(to); adj[to].push(from); });
    const paths = throughBulbs => {
      const out = [], seen = new Set();
      const dfs = (cur, path) => {
        if (cur === 'bat_neg') { out.push(path); return; }
        seen.add(cur);
        const next = [...adj[cur]];
        if (closed && cur === 'sw_a') next.push('sw_b');
        if (closed && cur === 'sw_b') next.push('sw_a');
        if (throughBulbs) bulbs.forEach(([s, b]) => { if (cur === s) next.push(b); if (cur === b) next.push(s); });
        next.forEach(n => { if (!seen.has(n)) dfs(n, [...path, n]); });
        seen.delete(cur);
      };
      dfs('bat_pos', ['bat_pos']);
      return out;
    };
    const short = paths(false).length > 0;
    const loops = short ? [] : paths(true);
    const bypassed = (s, b) => wires.some(w => (w.from === s && w.to === b) || (w.from === b && w.to === s));
    return { short, lit: bulbs.map(([s, b]) => !bypassed(s, b) && loops.some(p => { const i = p.indexOf(s), j = p.indexOf(b); return i >= 0 && j >= 0 && Math.abs(i - j) === 1; })) };
  };
  const now = analyse(switchClosed), ifClosed = analyse(true), ifOpen = analyse(false);
  const switchControls = ifClosed.lit.every(Boolean) && !ifOpen.lit.some(Boolean);
  const goalMet = switchClosed && switchControls;

  const nameOf = id => {
    if (id === 'bat_pos') return 'battery +';
    if (id === 'bat_neg') return 'battery −';
    if (id === 'sw_a') return 'switch post A';
    if (id === 'sw_b') return 'switch post B';
    const which = id.startsWith('bulb2') ? (nBulbs === 2 ? 'second bulb' : 'bulb') : (nBulbs === 2 ? 'first bulb' : 'bulb');
    return which + (id.endsWith('side') ? ' side contact' : ' bottom contact');
  };
  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      switchBlade: switchClosed ? 'closed' : 'open',
      wires: wires.map(w => nameOf(w.from) + ' to ' + nameOf(w.to)),
      bulbsGlowing: nBulbs === 2 ? ['first bulb', 'second bulb'].filter((n, i) => now.lit[i]) : (now.lit[0] ? ['bulb'] : []),
      batteryHot: now.short,
    });
  }, [wires, switchClosed, goalMet]);

  const bulbPic = (b, i) => {
    const { cx, top } = b, lit = now.lit[i];
    return <g key={'bulb' + i}>
      {lit && <circle cx={cx} cy={top} r="90" fill="url(#bulbGlow)" />}
      <path d={`M ${cx - 45} ${top} C ${cx - 45} ${top - 50} ${cx + 45} ${top - 50} ${cx + 45} ${top} C ${cx + 45} ${top + 30} ${cx + 25} ${top + 50} ${cx + 25} ${top + 70} L ${cx - 25} ${top + 70} C ${cx - 25} ${top + 50} ${cx - 45} ${top + 30} ${cx - 45} ${top} Z`}
        fill={lit ? '#fef9c3' : '#334155'} opacity={lit ? 0.95 : 0.4} stroke={lit ? '#facc15' : '#64748b'} strokeWidth="2.5" />
      <path d={`M ${cx - 15} ${top + 70} L ${cx - 12} ${top + 10} L ${cx - 5} ${top - 5} L ${cx} ${top + 5} L ${cx + 5} ${top - 5} L ${cx + 12} ${top + 10} L ${cx + 15} ${top + 70}`}
        fill="none" stroke={lit ? '#ffffff' : '#64748b'} strokeWidth={lit ? 3 : 2} strokeLinejoin="round" />
      <rect x={cx - 25} y={top + 70} width="50" height="40" rx="3" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
      {[80, 90, 100].map(d => <line key={d} x1={cx - 25} y1={top + d} x2={cx + 25} y2={top + d} stroke="#64748b" strokeWidth="2" />)}
      <rect x={cx - 15} y={top + 110} width="30" height="12" fill="#0f172a" />
      <path d={`M ${cx - 10} ${top + 122} L ${cx + 10} ${top + 122} L ${cx + 5} ${top + 134} L ${cx - 5} ${top + 134} Z`} fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
    </g>;
  };

  return (
    <Panel title="Electric Circuit Lab">
      <div style={{ position: 'relative', width: '100%', background: '#090d16', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}>
        <svg ref={svgRef} viewBox="0 0 720 480" style={{ width: '100%', height: 'auto', display: 'block', cursor: activeDrag ? 'crosshair' : 'default' }}
          onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          <defs>
            <radialGradient id="bulbGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#eab308" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ca8a04" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="batHeat" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="batteryBody" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#334155" /><stop offset="50%" stopColor="#64748b" /><stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="brass" gradientUnits="userSpaceOnUse" x1="330" y1="80" x2="430" y2="160">
              <stop offset="0%" stopColor="#fef08a" /><stop offset="60%" stopColor="#ca8a04" /><stop offset="100%" stopColor="#854d0e" />
            </linearGradient>
            <pattern id="workbenchGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.8" opacity="0.6" />
            </pattern>
          </defs>
          <rect width="720" height="480" fill="url(#workbenchGrid)" />

          {/* battery: a wire straight across it makes it hot */}
          <g id="battery-component">
            {now.short && <ellipse cx="120" cy="260" rx="95" ry="130" fill="url(#batHeat)" />}
            <rect x="70" y="160" width="100" height="200" rx="12" fill="url(#batteryBody)" stroke={now.short ? '#f97316' : '#94a3b8'} strokeWidth="2" />
            <rect x="100" y="146" width="40" height="14" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
            <rect x="70" y="195" width="100" height="45" fill="#ef4444" opacity="0.9" />
            <text x="120" y="225" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="bold">1.5V D-CELL</text>
            <text x="120" y="186" textAnchor="middle" fill="#fca5a5" fontSize="22" fontWeight="900">+</text>
            <text x="120" y="335" textAnchor="middle" fill="#93c5fd" fontSize="26" fontWeight="900">−</text>
            {now.short && <text x="120" y="290" textAnchor="middle" fontSize="28">🔥</text>}
          </g>

          {/* knife switch: tap the blade */}
          <g id="switch-component">
            <rect x="290" y="125" width="180" height="85" rx="8" fill="#292524" stroke="#57534e" strokeWidth="2" />
            <text x="380" y="195" textAnchor="middle" fill="#a8a29e" fontSize="12" fontWeight="600">KNIFE SWITCH</text>
            <circle cx="330" cy="150" r="14" fill="#78350f" stroke="#ca8a04" strokeWidth="2" />
            <circle cx="430" cy="150" r="14" fill="#78350f" stroke="#ca8a04" strokeWidth="2" />
            <g id="switch-handle" onClick={() => setSwitchClosed(c => !c)} style={{ cursor: 'pointer' }}>
              <rect x="320" y={switchClosed ? 128 : 70} width="120" height={switchClosed ? 44 : 90} fill="transparent" />
              {switchClosed
                ? <g><line x1="330" y1="150" x2="430" y2="150" stroke="url(#brass)" strokeWidth="8" strokeLinecap="round" />
                    <circle cx="430" cy="150" r="10" fill="#dc2626" stroke="#fca5a5" strokeWidth="2" /></g>
                : <g><line x1="330" y1="150" x2="415" y2="85" stroke="url(#brass)" strokeWidth="8" strokeLinecap="round" />
                    <circle cx="415" cy="85" r="12" fill="#ef4444" stroke="#fca5a5" strokeWidth="2" /></g>}
            </g>
          </g>

          {bulbAt.map(bulbPic)}

          {wires.map(w => {
            const t1 = TERMINALS[w.from], t2 = TERMINALS[w.to];
            const midX = (t1.x + t2.x) / 2, midY = (t1.y + t2.y) / 2 + 30;
            const d = `M ${t1.x} ${t1.y} Q ${midX} ${midY} ${t2.x} ${t2.y}`;
            return <g key={w.id} id={'wire-' + w.id}>
              <path d={d} fill="none" stroke="#0f172a" strokeWidth="8" strokeLinecap="round" />
              <path d={d} fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
              <g id={'cut-' + w.id} transform={`translate(${midX}, ${midY})`} style={{ cursor: 'pointer' }} onClick={e => cut(w.id, e)}>
                <circle r="22" fill="transparent" />
                <circle r="11" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                <text x="0" y="4" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="bold">✕</text>
              </g>
            </g>;
          })}

          {activeDrag && <g pointerEvents="none">
            <line x1={TERMINALS[activeDrag.fromTerm].x} y1={TERMINALS[activeDrag.fromTerm].y} x2={activeDrag.currentPos.x} y2={activeDrag.currentPos.y}
              stroke="#38bdf8" strokeWidth="4" strokeDasharray="6,4" strokeLinecap="round" />
            <circle cx={activeDrag.currentPos.x} cy={activeDrag.currentPos.y} r="9" fill="#38bdf8" opacity="0.8" />
          </g>}

          {Object.values(TERMINALS).map(t => (
            <g key={t.id} id={t.id} transform={`translate(${t.x}, ${t.y})`} style={{ cursor: 'crosshair' }} onPointerDown={e => onDownTerm(t.id, e)}>
              <circle r="22" fill="transparent" />
              <circle r="14" fill="#0f172a" stroke={t.color} strokeWidth="3" />
              <circle r="8" fill={activeDrag && activeDrag.fromTerm === t.id ? '#ffffff' : t.color} />
              {(showNames || t.id.startsWith('bat')) && <text x="0" y="-18" textAnchor="middle" fill="#f1f5f9" fontSize="12" fontWeight="700">{t.label}</text>}
            </g>))}

          <text x="360" y="466" textAnchor="middle" fill="#64748b" fontSize="13">Drag from one dot to another to add a wire. Tap ✕ to cut a wire.</text>
        </svg>
      </div>
    </Panel>
  );
}
