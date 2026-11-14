function Display({ params, lumina }) {
  // A street of neighbours. Each one holds some goods on their porch and thinks of one thing they need (a picture in a
  // thought bubble). Drag one good onto another neighbour's good to TRADE (the two swap owners). Drag a good onto
  // another neighbour's house to GIVE it (for a neighbour who has nothing to trade). Nothing says who is done.
  // params.goods: { kind: emoji }. params.neighbours: [{ id, pic, name, need, has: [kind] }]. params.story: for the tutor.
  const goods = params.goods || { bread: '🍞', milk: '🥛' };
  const nbrs = (Array.isArray(params.neighbours) ? params.neighbours : [
    { id: 'ana', pic: '👩', name: 'Ana', need: 'milk', has: ['bread'] },
    { id: 'ben', pic: '👨', name: 'Ben', need: 'bread', has: ['milk'] },
  ]).slice(0, 4);
  const story = params.story || 'neighbours trading';
  const W = 680, H = 470, colW = W / nbrs.length;

  const start = () => {
    const o = {};
    nbrs.forEach(n => (n.has || []).forEach((k, i) => { o[n.id + '-' + k + '-' + i] = n.id; }));
    return o;
  };
  const [owner, setOwner] = useState(start);
  const [drag, setDrag] = useState(null);
  const [last, setLast] = useState(null);
  const svgRef = useRef(null);
  const kindOf = id => id.split('-')[1];
  const nameOf = nid => nbrs.find(n => n.id === nid).name;
  const holds = nid => Object.keys(owner).filter(id => owner[id] === nid);
  const goalMet = nbrs.every(n => holds(n.id).some(id => kindOf(id) === n.need));

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      story,
      neighbours: nbrs.map(n => ({ name: n.name, thinksOf: n.need, porch: holds(n.id).map(kindOf) })),
      lastMove: last,
    });
  }, [owner, last, goalMet]);

  const colX = i => colW * i + colW / 2;
  const HOUSE_Y = 150, PORCH_Y = 360;
  const slotAt = (i, k, n) => ({ x: colX(i) + (k - (n - 1) / 2) * 62, y: PORCH_Y });
  const pos = {};
  nbrs.forEach((n, i) => { const h = holds(n.id); h.forEach((id, k) => { pos[id] = slotAt(i, k, h.length); }); });

  const pointOf = e => svgPoint(svgRef.current, e);
  const grab = (id, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id }); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e), id = drag.id, from = owner[id];
    setDrag(null);
    const hit = Object.keys(pos).find(o => o !== id && owner[o] !== from && Math.abs(pos[o].x - p.x) < 30 && Math.abs(pos[o].y - p.y) < 32);
    if (hit) {
      const to = owner[hit];
      setOwner(w => ({ ...w, [id]: to, [hit]: from }));
      setLast(nameOf(from) + ' traded ' + kindOf(id) + ' to ' + nameOf(to) + ' for ' + kindOf(hit));
      return;
    }
    const col = Math.floor(p.x / colW);
    if (col >= 0 && col < nbrs.length && p.y > 40 && p.y < H - 20 && nbrs[col].id !== from) {
      const to = nbrs[col].id;
      setOwner(w => ({ ...w, [id]: to }));
      setLast(nameOf(from) + ' gave ' + kindOf(id) + ' to ' + nameOf(to) + ' and got nothing back');
    }
  };

  const house = (n, i) => {
    const x = colX(i);
    return <g key={n.id}>
      <path d={`M ${x - 70} ${HOUSE_Y} L ${x} ${HOUSE_Y - 60} L ${x + 70} ${HOUSE_Y} Z`} fill="#b91c1c" stroke="#7f1d1d" strokeWidth="3" />
      <rect id={'house-' + n.id} x={x - 58} y={HOUSE_Y} width="116" height="130" fill="#334155" stroke="#1e293b" strokeWidth="3" />
      <rect x={x - 22} y={HOUSE_Y + 60} width="44" height="70" rx="4" fill="#78350f" />
      <text x={x} y={HOUSE_Y + 32} textAnchor="middle" dominantBaseline="middle" fontSize="40">{n.pic}</text>
      {/* thought bubble: what this neighbour needs */}
      <circle cx={x + 30} cy={HOUSE_Y - 66} r="5" fill="#e2e8f0" />
      <circle cx={x + 40} cy={HOUSE_Y - 80} r="8" fill="#e2e8f0" />
      <ellipse cx={x + 48} cy={HOUSE_Y - 112} rx="34" ry="26" fill="#e2e8f0" />
      <text x={x + 48} y={HOUSE_Y - 110} textAnchor="middle" dominantBaseline="middle" fontSize="30">{goods[n.need]}</text>
      <text x={x} y={HOUSE_Y + 152} textAnchor="middle" fontSize="18" fill="#cbd5e1">{n.name}</text>
      <rect x={x - 80} y={PORCH_Y - 36} width="160" height="72" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
    </g>;
  };

  const good = id => {
    const held = drag && drag.id === id && drag.x !== undefined;
    const p = held ? { x: drag.x, y: drag.y } : pos[id];
    return <g key={id} id={'good-' + id} transform={`translate(${p.x}, ${p.y}) scale(${held ? 1.15 : 1})`}
      style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={e => grab(id, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      <circle r="27" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
      <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="34">{goods[kindOf(id)]}</text>
    </g>;
  };

  const ids = Object.keys(owner);
  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        <rect x="0" y={PORCH_Y + 46} width={W} height="40" fill="#1f2937" />
        {nbrs.map(house)}
        {ids.filter(id => !(drag && drag.id === id)).map(good)}
        {ids.filter(id => drag && drag.id === id).map(good)}
      </svg>
    </Panel>
  );
}
