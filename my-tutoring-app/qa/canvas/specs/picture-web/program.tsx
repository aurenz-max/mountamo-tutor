function Display({ params, lumina }) {
  // A web: a centre card with lines out to empty places. Picture cards wait in the tray. Drag a card into a place;
  // drop it on a full place to swap; drag it back to the tray to take it out. When the centre is empty, one of the
  // tray cards goes in the centre too.
  // params.center: { pic, name, label } or null (the centre is an empty place). params.slots: how many places (2-4).
  // params.cards: [{ id, pic, name }] in tray order. params.members: the ids that belong (the key, for code only).
  // params.topic: the id that belongs in an empty centre (the key, for code only).
  const cards = (Array.isArray(params.cards) ? params.cards : [
    { id: 'cow', pic: '🐄', name: 'cow' }, { id: 'pig', pic: '🐖', name: 'pig' }, { id: 'car', pic: '🚗', name: 'car' },
  ]).slice(0, 7);
  const N = Math.max(2, Math.min(4, Number(params.slots) || 2));
  const center = params.center === null ? null : (params.center || { pic: '🚜', name: 'farm' });
  const members = Array.isArray(params.members) ? params.members : ['cow', 'pig'];
  const topic = params.topic || null;
  const W = 680, H = 470, CX = 340, CY = 186, TRAY_Y = 400;
  const LAYOUT = {
    2: [[-210, 0], [210, 0]],
    3: [[-220, 34], [220, 34], [0, -128]],
    4: [[-220, -62], [220, -62], [-220, 82], [220, 82]],
  }[N];

  const [spots, setSpots] = useState(() => ({}));   // place key ('s0'.., 'c') -> card id
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const byId = id => cards.find(c => c.id === id);
  const keys = [...LAYOUT.map((_, i) => 's' + i), ...(center ? [] : ['c'])];
  const inSpokes = LAYOUT.map((_, i) => spots['s' + i]).filter(Boolean);
  const goalMet = inSpokes.length === members.length && members.every(m => inSpokes.includes(m)) &&
    (center ? true : spots.c === topic);

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      centre: center ? (center.label ? center.name + ' (shown: ' + center.label + ')' : center.name) : (spots.c ? byId(spots.c).name : 'empty'),
      places: LAYOUT.map((_, i) => spots['s' + i] ? byId(spots['s' + i]).name : 'empty'),
      tray: cards.filter(c => !Object.values(spots).includes(c.id)).map(c => c.name),
    });
  }, [spots, goalMet]);

  const spotXY = k => (k === 'c' ? { x: CX, y: CY } : { x: CX + LAYOUT[+k.slice(1)][0], y: CY + LAYOUT[+k.slice(1)][1] });
  const trayW = Math.min(96, 640 / cards.length), tx0 = (W - cards.length * trayW) / 2;
  const posOf = id => {
    const k = keys.find(k => spots[k] === id);
    if (k) return spotXY(k);
    return { x: tx0 + cards.findIndex(c => c.id === id) * trayW + trayW / 2, y: TRAY_Y };
  };

  const pointOf = e => svgPoint(svgRef.current, e);
  const grab = (id, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id }); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const pt = pointOf(e), id = drag.id;
    setDrag(null);
    if (drag.x === undefined) return;
    const from = keys.find(k => spots[k] === id);
    const to = keys.find(k => { const s = spotXY(k); return Math.abs(pt.x - s.x) < 62 && Math.abs(pt.y - s.y) < 62; });
    setSpots(s => {
      const n = { ...s };
      if (to) { if (to === from) return s; const was = n[to]; n[to] = id; if (from) { if (was) n[from] = was; else delete n[from]; } }
      else if (from && pt.y > TRAY_Y - 70) delete n[from];
      return n;
    });
  };

  const card = id => {
    const it = byId(id);
    const held = drag && drag.id === id && drag.x !== undefined;
    const p = held ? { x: drag.x, y: drag.y } : posOf(id);
    return <g key={id} id={'card-' + id} transform={`translate(${p.x}, ${p.y}) scale(${held ? 1.08 : 1})`}
      style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={e => grab(id, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      <rect x="-42" y="-42" width="84" height="84" rx="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text y="3" textAnchor="middle" dominantBaseline="middle" fontSize="50">{it.pic}</text>
    </g>;
  };

  return (
    <Panel title={params.title || 'Picture Web'} caption="Drag a picture into a place. Drag it back to take it out.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        {LAYOUT.map(([dx, dy], i) => <line key={i} x1={CX} y1={CY} x2={CX + dx} y2={CY + dy} stroke="#475569" strokeWidth="4" />)}
        {LAYOUT.map(([dx, dy], i) => <rect key={i} id={'place-' + i} x={CX + dx - 48} y={CY + dy - 48} width="96" height="96" rx="16"
          fill="#0f172a" stroke="#475569" strokeWidth="2.5" strokeDasharray="6 5" />)}
        {center
          ? <g id="centre">
              <circle cx={CX} cy={CY} r="62" fill="#334155" stroke="#64748b" strokeWidth="3" />
              <text x={CX} y={CY + (center.label ? -10 : 3)} textAnchor="middle" dominantBaseline="middle" fontSize={center.label ? 46 : 60}>{center.pic}</text>
              {center.label ? <text x={CX} y={CY + 38} textAnchor="middle" fontSize="22" fontWeight="700" fill="#e2e8f0">{center.label}</text> : null}
            </g>
          : <circle id="place-c" cx={CX} cy={CY} r="62" fill="#0f172a" stroke="#475569" strokeWidth="2.5" strokeDasharray="6 5" />}
        <rect x="16" y={TRAY_Y - 56} width={W - 32} height="112" rx="18" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {cards.map(c => c.id).filter(id => !(drag && drag.id === id)).map(card)}
        {drag ? card(drag.id) : null}
      </svg>
    </Panel>
  );
}
