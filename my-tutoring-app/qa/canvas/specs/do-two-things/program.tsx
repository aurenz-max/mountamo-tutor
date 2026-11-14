function Display({ params, lumina }) {
  // A room with places (animals, cups, a box, a basket) and a shelf of things. The child hears the steps once (the
  // lesson speaks the ask) and does them: drag a thing onto a place, tap the box to open or close it. A closed box
  // will not take a thing: it slides back to the shelf. Nothing on the page repeats or numbers the steps.
  // params.places: [{ id, kind: animal|cup|box|spot, pic, name, x, head, color, size }] (cup: color + size small|big;
  //   animal: head = [dx, dy] where a thing sits on its head).
  // params.items: [{ id, pic, name }] on the shelf in this order.
  // params.steps: the actions in order, as 'put:<item>:<place>' or 'open:<box>' (the key, for code only).
  const places = (Array.isArray(params.places) ? params.places : [
    { id: 'dog', kind: 'animal', pic: '🐕', name: 'dog', x: 220 },
    { id: 'cat', kind: 'animal', pic: '🐈', name: 'cat', x: 460 },
  ]).slice(0, 5);
  const items = (Array.isArray(params.items) ? params.items : [{ id: 'hat', pic: '🎩', name: 'hat' }]).slice(0, 5);
  const steps = Array.isArray(params.steps) ? params.steps : ['put:hat:dog'];
  const W = 680, H = 460, FLOOR = 260, SHELF_Y = 380;

  const [at, setAt] = useState(() => ({}));       // item id -> place id
  const [open, setOpen] = useState(() => ({}));   // box id -> true when open
  const [log, setLog] = useState(() => []);       // every change the child made, in order
  const [drag, setDrag] = useState(null);
  const [bump, setBump] = useState(null);         // a box that refused a thing, for a short shake
  const svgRef = useRef(null);
  const byPlace = id => places.find(p => p.id === id);
  const byItem = id => items.find(i => i.id === id);
  const goalMet = log.length === steps.length && log.every((a, i) => a === steps[i]);

  const placeName = p => p.kind === 'cup' ? (p.size === 'big' ? 'big ' : 'small ') + (p.colorName || '') + ' cup' : p.name;
  const say = a => {
    const [verb, x, y] = a.split(':');
    if (verb === 'put') return 'put the ' + byItem(x).name + ' ' + (byPlace(y).kind === 'animal' ? 'on the ' : 'in the ') + placeName(byPlace(y));
    if (verb === 'take') return 'took the ' + byItem(x).name + ' back to the shelf';
    return (verb === 'open' ? 'opened the ' : 'closed the ') + placeName(byPlace(x));
  };

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      places: places.map(p => placeName(p) + (p.kind === 'box' ? (open[p.id] ? ' (open)' : ' (closed)') : '') + ': ' +
        (items.filter(i => at[i.id] === p.id).map(i => i.name).join(', ') || 'nothing')),
      onShelf: items.filter(i => !at[i.id]).map(i => i.name),
      doneSoFar: log.map(say),
    });
  }, [at, open, log, goalMet]);

  const slotW = 600 / places.length;
  const px = (p, i) => (typeof p.x === 'number' ? p.x : 40 + slotW * i + slotW / 2);
  const placeXY = p => ({ x: px(p, places.indexOf(p)), y: FLOOR });
  const shelfW = Math.min(110, 560 / items.length), sx0 = (W - items.length * shelfW) / 2;
  const itemXY = it => {
    const pid = at[it.id];
    if (!pid) { const k = items.indexOf(it); return { x: sx0 + k * shelfW + shelfW / 2, y: SHELF_Y }; }
    const p = byPlace(pid), c = placeXY(p);
    const here = items.filter(i => at[i.id] === pid), k = here.indexOf(it), off = (k - (here.length - 1) / 2) * 34;
    if (p.kind === 'animal') { const hd = Array.isArray(p.head) ? p.head : [-24, -110]; return { x: c.x + hd[0] + off, y: c.y + hd[1] }; }
    if (p.kind === 'cup') return { x: c.x + off, y: c.y - (p.size === 'big' ? 96 : 62) };
    if (p.kind === 'box') return { x: c.x + off, y: c.y - 70 };
    return { x: c.x + off, y: c.y - 70 };
  };

  const pointOf = e => svgPoint(svgRef.current, e);
  const grab = (id, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id }); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const pt = pointOf(e), id = drag.id;
    setDrag(null);
    if (drag.x === undefined) return;
    let best = null, bestD = 95;
    places.forEach(p => { const c = placeXY(p), d = Math.hypot(pt.x - c.x, pt.y - (c.y - 50)); if (d < bestD) { best = p; bestD = d; } });
    const from = at[id];
    if (best && best.kind === 'box' && !open[best.id]) { setBump(best.id); setTimeout(() => setBump(null), 400); return; }
    if (best) {
      if (from === best.id) return;
      setAt(a => ({ ...a, [id]: best.id }));
      setLog(l => [...l, 'put:' + id + ':' + best.id]);
    } else if (from && pt.y > SHELF_Y - 70) {
      setAt(a => { const n = { ...a }; delete n[id]; return n; });
      setLog(l => [...l, 'take:' + id]);
    }
  };
  const toggleBox = p => {
    const now = !open[p.id];
    setOpen(o => ({ ...o, [p.id]: now }));
    setLog(l => [...l, (now ? 'open:' : 'close:') + p.id]);
  };

  const place = (p, i) => {
    const c = placeXY(p);
    if (p.kind === 'cup') {
      const big = p.size === 'big', w = big ? 96 : 62, h = big ? 104 : 66;
      return <g key={p.id} id={'place-' + p.id}>
        <path d={`M ${c.x - w / 2} ${c.y - h} L ${c.x + w / 2} ${c.y - h} L ${c.x + w * 0.36} ${c.y} L ${c.x - w * 0.36} ${c.y} Z`}
          fill={p.color || '#ef4444'} stroke="#0f172a" strokeWidth="2" />
        <ellipse cx={c.x} cy={c.y - h} rx={w / 2} ry="7" fill="#0f172a" opacity="0.45" />
      </g>;
    }
    if (p.kind === 'box') {
      const isOpen = !!open[p.id], shake = bump === p.id ? 6 : 0;
      return <g key={p.id} id={'place-' + p.id} onClick={() => toggleBox(p)} style={{ cursor: 'pointer' }} transform={`translate(${shake}, 0)`}>
        <rect x={c.x - 62} y={c.y - 80} width="124" height="80" rx="6" fill="#b45309" stroke="#78350f" strokeWidth="3" />
        <line x1={c.x} y1={c.y - 80} x2={c.x} y2={c.y} stroke="#78350f" strokeWidth="2" opacity="0.5" />
        {isOpen
          ? <rect x={c.x - 62} y={c.y - 140} width="16" height="62" rx="4" fill="#d97706" stroke="#78350f" strokeWidth="3" />
          : <rect x={c.x - 68} y={c.y - 96} width="136" height="20" rx="6" fill="#d97706" stroke="#78350f" strokeWidth="3" />}
      </g>;
    }
    return <g key={p.id} id={'place-' + p.id}>
      <text x={c.x} y={c.y - 44} textAnchor="middle" dominantBaseline="middle" fontSize={p.kind === 'animal' ? 96 : 84}>{p.pic}</text>
    </g>;
  };

  const thing = it => {
    const held = drag && drag.id === it.id && drag.x !== undefined;
    const p = held ? { x: drag.x, y: drag.y } : itemXY(it);
    const onShelf = !at[it.id] && !held;
    return <g key={it.id} id={'item-' + it.id} transform={`translate(${p.x}, ${p.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
      onPointerDown={e => grab(it.id, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      {onShelf ? <rect x="-42" y="-42" width="84" height="84" rx="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" /> : <circle r="30" fill="transparent" />}
      <text y="3" textAnchor="middle" dominantBaseline="middle" fontSize="48">{it.pic}</text>
    </g>;
  };

  return (
    <Panel title="Listen and Do" caption="Drag a thing onto a place. Tap the box to open it.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        <rect x="16" y={FLOOR} width={W - 32} height="14" rx="7" fill="#334155" />
        {places.map(place)}
        <rect x="16" y={SHELF_Y - 56} width={W - 32} height="112" rx="18" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {items.filter(i => !(drag && drag.id === i.id)).map(thing)}
        {drag ? thing(byItem(drag.id)) : null}
      </svg>
    </Panel>
  );
}
