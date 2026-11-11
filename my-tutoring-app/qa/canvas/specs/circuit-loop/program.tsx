function Display({ params, lumina }) {
  // Three wires, six terminals. params.prewired places wires at the start ([startTerminal, endTerminal] or null for a
  // wire left on the tray). params.showNames hides the terminal names on the last problem.
  const showNames = params.showNames !== false;
  const prewired = Array.isArray(params.prewired) ? params.prewired : [];

  const terminals = {
    bat_pos: { x: 120, y: 135, label: 'Battery (+)' },
    bat_neg: { x: 120, y: 255, label: 'Battery (-)' },
    switch_l: { x: 290, y: 65, label: 'Switch A' },
    switch_r: { x: 390, y: 65, label: 'Switch B' },
    bulb_side: { x: 510, y: 187, label: 'Bulb side' },
    bulb_foot: { x: 550, y: 255, label: 'Bulb tip' },
    bench_1a: { x: 230, y: 220 }, bench_1b: { x: 330, y: 220 },
    bench_2a: { x: 370, y: 220 }, bench_2b: { x: 470, y: 220 },
    bench_3a: { x: 280, y: 280 }, bench_3b: { x: 420, y: 280 },
  };
  const WIRE_COLORS = ['#3b82f6', '#f59e0b', '#ef4444'];
  const TERMINAL_KEYS = ['bat_pos', 'bat_neg', 'switch_l', 'switch_r', 'bulb_side', 'bulb_foot'];
  const trayKey = (i, endKey) => `bench_${i + 1}${endKey === 'start' ? 'a' : 'b'}`;
  const placed = (key, fallback) => (TERMINAL_KEYS.includes(key) ? key : fallback);

  const [wires, setWires] = useState(() => WIRE_COLORS.map((color, i) => {
    const p = Array.isArray(prewired[i]) ? prewired[i] : [];
    return { color, start: placed(p[0], trayKey(i, 'start')), end: placed(p[1], trayKey(i, 'end')) };
  }));
  const [switchClosed, setSwitchClosed] = useState(false);
  const [dragging, setDragging] = useState(null);
  const svgRef = useRef(null);

  // Is there a conducting path between the battery's terminals, with the switch and the bulb as given?
  const batteryJoined = (closed, throughBulb) => {
    const adj = {};
    const link = (u, v) => { (adj[u] = adj[u] || []).push(v); (adj[v] = adj[v] || []).push(u); };
    wires.forEach(w => { if (!w.start.startsWith('bench') && !w.end.startsWith('bench')) link(w.start, w.end); });
    if (closed) link('switch_l', 'switch_r');
    if (throughBulb) link('bulb_side', 'bulb_foot');
    const seen = new Set(['bat_pos']);
    const queue = ['bat_pos'];
    while (queue.length) {
      for (const n of adj[queue.shift()] || []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
    return seen.has('bat_neg');
  };

  // The switch controls the bulb: closing it completes the loop, opening it breaks the loop, and the loop runs
  // through the bulb. Which way the switch is left does not matter, so the lit bulb is not the verdict.
  const wiredRight = batteryJoined(true, true) && !batteryJoined(false, true) && !batteryJoined(true, false);
  const isShort = batteryJoined(switchClosed, false);
  const bulbLit = !isShort && batteryJoined(switchClosed, true);

  const wireFact = (w, i) => {
    const name = k => (k.startsWith('bench') ? 'the tray' : terminals[k].label);
    return `Wire ${i + 1}: ${name(w.start)} to ${name(w.end)}`;
  };

  useEffect(() => {
    lumina.goal(wiredRight);
    lumina.scene({
      switch: switchClosed ? 'closed' : 'open',
      bulb: bulbLit ? 'lit' : 'dark',
      battery: isShort ? 'hot' : 'normal',
      wires: wires.map(wireFact),
    });
  }, [wiredRight, switchClosed, bulbLit, isShort, wires]);

  const onHandleDown = (wireIdx, endKey, e) => {
    e.target.setPointerCapture(e.pointerId);
    setDragging({ wireIdx, endKey });
  };

  const onMove = e => {
    if (!dragging || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    setDragging(prev => (prev ? { ...prev, svgX: pt.x, svgY: pt.y } : null));
  };

  const onHandleUp = e => {
    if (!dragging || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    let nearest = null;
    let minDist = Infinity;
    TERMINAL_KEYS.forEach(key => {
      const dist = Math.hypot(terminals[key].x - pt.x, terminals[key].y - pt.y);
      if (dist < minDist) { minDist = dist; nearest = key; }
    });
    const finalKey = minDist <= 34 ? nearest : trayKey(dragging.wireIdx, dragging.endKey);
    setWires(prev => prev.map((w, i) => (i === dragging.wireIdx ? { ...w, [dragging.endKey]: finalKey } : w)));
    setDragging(null);
  };

  const getPos = (wireIdx, endKey) => {
    if (dragging && dragging.wireIdx === wireIdx && dragging.endKey === endKey && dragging.svgX !== undefined) {
      return { x: dragging.svgX, y: dragging.svgY };
    }
    return terminals[wires[wireIdx][endKey]];
  };

  const wirePath = (a, b, sag) => `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + sag} ${b.x} ${b.y}`;

  const terminal = (key, domId, textProps) => (
    <g transform={`translate(${terminals[key].x}, ${terminals[key].y})`}>
      <circle id={domId} r="16" fill="rgba(2,132,199,0.12)" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle r="7" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
      {showNames && <text textAnchor="middle" fill="#7dd3fc" fontSize="12" fontWeight="600" {...textProps}>{terminals[key].label}</text>}
    </g>
  );

  const handle = (idx, endKey, pos, color) => (
    <g
      id={`wire${idx + 1}-${endKey}`}
      transform={`translate(${pos.x}, ${pos.y})`}
      style={{ cursor: 'grab' }}
      onPointerDown={e => onHandleDown(idx, endKey, e)}
      onPointerUp={onHandleUp}
      onPointerCancel={() => setDragging(null)}
    >
      <circle r="22" fill="transparent" />
      <circle r="13" fill={color} stroke="#ffffff" strokeWidth="2.5" />
      <circle r="4" fill="#ffffff" />
    </g>
  );

  return (
    <Panel title="Circuit Workshop" caption="Drag the ends of each wire. Tap the switch lever to open or close it.">
      <Stack gap={12}>
        <svg
          ref={svgRef}
          viewBox="0 0 680 340"
          style={{ width: '100%', height: 'auto', background: '#090d16', borderRadius: 12, border: '1px solid #1e293b', touchAction: 'none', userSelect: 'none' }}
          onPointerMove={onMove}
        >
          {/* Tray */}
          <rect x="205" y="185" width="290" height="125" rx="10" fill="rgba(30,41,59,0.4)" stroke="#334155" strokeDasharray="4 4" />
          <text x="350" y="327" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="600">WIRE TRAY</text>

          {/* Battery */}
          <g transform="translate(80, 90)">
            {isShort && (
              <g stroke="#f87171" strokeWidth="3" fill="none" strokeLinecap="round">
                <path d="M 20 12 q -6 -8 0 -16 q 6 -8 0 -16" />
                <path d="M 40 8 q -6 -8 0 -16 q 6 -8 0 -16" />
                <path d="M 60 12 q -6 -8 0 -16 q 6 -8 0 -16" />
              </g>
            )}
            <rect x="0" y="30" width="80" height="150" rx="8" fill="#1e293b" stroke={isShort ? '#f87171' : '#475569'} strokeWidth="2" />
            <rect x="0" y="30" width="80" height="45" rx="4" fill="#2563eb" />
            <rect x="28" y="20" width="24" height="12" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
            <text x="12" y="52" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="18">+</text>
            <text x="40" y="112" textAnchor="middle" fill="#cbd5e1" fontWeight="600" fontSize="13">BATTERY</text>
            <text x="12" y="172" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="20">-</text>
          </g>

          {/* Switch */}
          <g transform="translate(260, 35)">
            <rect x="0" y="0" width="160" height="60" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            <circle cx="30" cy="30" r="9" fill="#0f172a" stroke="#475569" strokeWidth="2" />
            <circle cx="130" cy="30" r="9" fill="#0f172a" stroke="#475569" strokeWidth="2" />
            {switchClosed
              ? <path d="M 30 30 L 130 30" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
              : <path d="M 30 30 L 112 4" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />}
            <text x="80" y="52" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="700">SWITCH: {switchClosed ? 'CLOSED' : 'OPEN'}</text>
            <rect id="switch-lever" x="48" y="-8" width="64" height="66" fill="transparent" style={{ cursor: 'pointer' }} onClick={() => setSwitchClosed(v => !v)} />
          </g>

          {/* Bulb */}
          <g transform="translate(510, 70)">
            {bulbLit && <circle cx="40" cy="50" r="90" fill="#facc15" opacity="0.28" />}
            <text x="40" y="8" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="600">BULB</text>
            <path d="M 15 55 C 10 20, 70 20, 65 55 C 60 75, 55 85, 55 95 L 25 95 C 25 85, 20 75, 15 55 Z" fill={bulbLit ? '#fef9c3' : 'rgba(255,255,255,0.06)'} stroke={bulbLit ? '#fef08a' : '#64748b'} strokeWidth="2.5" />
            <path d="M 33 95 L 35 55 L 38 48 L 42 48 L 45 55 L 47 95" fill="none" stroke={bulbLit ? '#f59e0b' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
            <rect x="25" y="95" width="30" height="24" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
            <line x1="25" y1="102" x2="55" y2="102" stroke="#475569" strokeWidth="2" />
            <line x1="25" y1="110" x2="55" y2="110" stroke="#475569" strokeWidth="2" />
            <path d="M 32 119 Q 40 134 48 119 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
          </g>
          {/* Short leads from the bulb's two contacts to its terminals */}
          <line x1="535" y1="187" x2="510" y2="187" stroke="#94a3b8" strokeWidth="3" />
          <line x1="550" y1="200" x2="550" y2="255" stroke="#94a3b8" strokeWidth="3" />

          {terminal('bat_pos', 'term-bat-pos', { y: -33 })}
          {terminal('bat_neg', 'term-bat-neg', { y: 34 })}
          {terminal('switch_l', 'term-switch-l', { x: -38, y: 4, textAnchor: 'end' })}
          {terminal('switch_r', 'term-switch-r', { x: 38, y: 4, textAnchor: 'start' })}
          {terminal('bulb_side', 'term-bulb-side', { x: -6, y: -22, textAnchor: 'end' })}
          {terminal('bulb_foot', 'term-bulb-foot', { y: 34 })}

          {wires.map((w, idx) => {
            const a = getPos(idx, 'start');
            const b = getPos(idx, 'end');
            return (
              <g key={idx}>
                <path d={wirePath(a, b, idx === 2 ? -20 : 20)} fill="none" stroke={w.color} strokeWidth="5" strokeLinecap="round" />
                {handle(idx, 'start', a, w.color)}
                {handle(idx, 'end', b, w.color)}
              </g>
            );
          })}
        </svg>
      </Stack>
    </Panel>
  );
}
