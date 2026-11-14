function Display({ params, lumina }) {
  // Picture cards wait in a tray. A row of empty boxes runs along an arrow from one end mark to the other. Drag a card
  // into a box; drop it on a full box to swap; drag a card back to the tray to take it out. The tray order is not the
  // answer, and a card's drawn size can differ from the size of the thing (params items[].draw).
  // params.items: [{ id, pic, name, draw }] in the true order (the key, for code only). params.extra: cards that do not
  // belong. params.tray: ids in tray order. params.ends: 'size' (a small and a big dot) or [leftPic, rightPic].
  // params.scale: what the order is along, for the tutor.
  const items = (Array.isArray(params.items) ? params.items : [
    { id: 'a', pic: '🐟', name: 'small fish', draw: 0.6 }, { id: 'b', pic: '🐟', name: 'middle fish', draw: 0.9 }, { id: 'c', pic: '🐟', name: 'big fish', draw: 1.3 },
  ]).slice(0, 5);
  const extra = (Array.isArray(params.extra) ? params.extra : []).slice(0, 2);
  const all = [...items, ...extra];
  const trayIds = (Array.isArray(params.tray) ? params.tray : all.map(i => i.id).reverse()).filter(id => all.some(i => i.id === id));
  const ends = params.ends || 'size';
  const scaleName = params.scale || 'smallest to biggest';
  const N = items.length, W = 680, H = 440, SLOT_Y = 140, TRAY_Y = 350;

  const [slots, setSlots] = useState(() => Array(N).fill(null));
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const byId = id => all.find(i => i.id === id);
  const goalMet = slots.every((s, i) => s === items[i].id);

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      orderAlong: scaleName,
      boxes: slots.map((s, i) => (i + 1) + ': ' + (s ? byId(s).name : 'empty')),
      tray: trayIds.filter(id => !slots.includes(id)).map(id => byId(id).name),
    });
  }, [slots, goalMet]);

  const slotW = Math.min(124, 560 / N), sx0 = (W - N * slotW) / 2 + 10;
  const slotX = i => sx0 + i * slotW + slotW / 2;
  const trayW = Math.min(124, (W - 40) / trayIds.length), tx0 = (W - trayIds.length * trayW) / 2;
  const trayX = k => tx0 + k * trayW + trayW / 2;
  const posOf = id => {
    const s = slots.indexOf(id);
    if (s >= 0) return { x: slotX(s), y: SLOT_Y };
    return { x: trayX(trayIds.indexOf(id)), y: TRAY_Y };
  };

  const pointOf = e => svgPoint(svgRef.current, e);
  const grab = (id, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id }); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e), id = drag.id;
    setDrag(null);
    const from = slots.indexOf(id);
    if (Math.abs(p.y - SLOT_Y) < 70) {
      const i = Math.floor((p.x - sx0) / slotW);
      if (i < 0 || i >= N || i === from) return;
      setSlots(s => { const n = [...s]; const was = n[i]; n[i] = id; if (from >= 0) n[from] = was; return n; });
    } else if (from >= 0) setSlots(s => s.map(v => (v === id ? null : v)));
  };

  const endMark = (x, right) => {
    if (ends === 'size') return <circle cx={x} cy={SLOT_Y + 90} r={right ? 16 : 6} fill="#94a3b8" />;
    const pics = Array.isArray(ends) ? ends : ['', ''];
    return <text x={x} y={SLOT_Y + 92} textAnchor="middle" dominantBaseline="middle" fontSize="30">{right ? pics[1] : pics[0]}</text>;
  };

  const card = id => {
    const it = byId(id);
    const held = drag && drag.id === id && drag.x !== undefined;
    const p = held ? { x: drag.x, y: drag.y } : posOf(id);
    const fs = 54 * Math.max(0.5, Math.min(1.5, Number(it.draw) || 1));
    return <g key={id} id={'card-' + id} transform={`translate(${p.x}, ${p.y}) scale(${held ? 1.08 : 1})`}
      style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={e => grab(id, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      <rect x="-50" y="-50" width="100" height="100" rx="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text y="3" textAnchor="middle" dominantBaseline="middle" fontSize={fs}>{it.pic}</text>
    </g>;
  };

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        <defs><marker id="pc-arr" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" /></marker></defs>
        <line x1={sx0 + 20} y1={SLOT_Y + 90} x2={sx0 + N * slotW - 24} y2={SLOT_Y + 90} stroke="#94a3b8" strokeWidth="3" markerEnd="url(#pc-arr)" />
        {endMark(sx0 - 8, false)}
        {endMark(sx0 + N * slotW + 12, true)}
        {slots.map((s, i) => <rect key={i} id={'box-' + i} x={slotX(i) - 54} y={SLOT_Y - 54} width="108" height="108" rx="16"
          fill="none" stroke="#475569" strokeWidth="2.5" strokeDasharray="8 6" />)}
        <rect x="16" y={TRAY_Y - 66} width={W - 32} height="132" rx="18" fill="#1e1b4b" opacity="0.6" />
        {all.map(i => i.id).filter(id => !(drag && drag.id === id)).map(card)}
        {drag ? card(drag.id) : null}
      </svg>
    </Panel>
  );
}
