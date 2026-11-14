function Display({ params, lumina }) {
  // Left: a picture of a room or a block, drawn at a slant the way a child sees it. Right: the same place as a plan seen
  // from above, with a legend under it. The plan's top edge is the picture's back wall (or far street); the door or road
  // is drawn in both so the two can be lined up.
  //  make: drag symbols from the legend onto the plan where each thing is in the picture. Drag one off to take it away.
  //  read: the plan is already made and marks a hidden thing with a star; drag that thing into the picture where the map says.
  // params.task (make | read), params.place (room | block), params.legend [{ kind, pic, name, shape, color }],
  // params.things [{ kind, c, r }] (c: 0..cols-1 left to right, r: 0 is the back), params.cols, params.rows,
  // params.hidden { pic, name, c, r } (read only).
  const task = params.task === 'read' ? 'read' : 'make';
  const place = params.place === 'block' ? 'block' : 'room';
  const cols = Math.max(2, Math.min(5, Number(params.cols) || 4));
  const rows = Math.max(2, Math.min(4, Number(params.rows) || 3));
  const legend = (Array.isArray(params.legend) ? params.legend : [
    { kind: 'plant', pic: '🪴', name: 'plant', shape: 'circle', color: '#22c55e' },
    { kind: 'books', pic: '📚', name: 'bookshelf', shape: 'bar', color: '#3b82f6' },
  ]).slice(0, 6);
  const legendOf = k => legend.find(l => l.kind === k);
  const things = (Array.isArray(params.things) ? params.things : [{ kind: 'plant', c: 0, r: 0 }, { kind: 'books', c: 3, r: 0 }])
    .filter(t => legendOf(t.kind)).map(t => ({ kind: t.kind, c: Math.max(0, Math.min(cols - 1, Number(t.c) || 0)), r: Math.max(0, Math.min(rows - 1, Number(t.r) || 0)) }));
  const hidden = params.hidden && params.hidden.pic ? params.hidden : { pic: '⚽', name: 'ball', c: 1, r: 1 };
  const where = (c, r) => (r === 0 ? 'at the back' : r === rows - 1 ? 'at the front' : 'in the middle') + ', ' +
    (c === 0 ? 'far left' : c === cols - 1 ? 'far right' : c < cols / 2 ? 'left of the middle' : 'right of the middle');

  const W = 680, H = 500;
  const PLAN = { x: 372, y: 84, w: 288, h: 240 };
  const cw = PLAN.w / cols, ch = PLAN.h / rows;
  const [placed, setPlaced] = useState([]);   // make: [{ kind, c, r }]
  const [ball, setBall] = useState(null);     // read: { c, r }
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const key = t => t.kind + '@' + t.c + ',' + t.r;
  const goalMet = task === 'read'
    ? !!ball && ball.c === Number(hidden.c) && ball.r === Number(hidden.r)
    : placed.length === things.length && things.map(key).sort().join('|') === placed.map(key).sort().join('|');

  useEffect(() => {
    lumina.goal(goalMet);
    const scene = {
      place: place === 'room' ? 'a classroom, drawn at a slant with the back wall at the top' : 'a town block, drawn at a slant with the far street at the top',
      picture: things.map(t => legendOf(t.kind).name + ' ' + where(t.c, t.r)),
      legend: legend.map(l => l.shape + ' = ' + l.name),
    };
    if (task === 'make') scene.map = placed.length ? placed.map(t => legendOf(t.kind).name + ' symbol ' + where(t.c, t.r)) : 'empty';
    else { scene.map = 'every thing in the picture has its symbol; a star marks where the ' + hidden.name + ' is'; scene.ballInPicture = ball ? where(ball.c, ball.r) : 'not placed yet'; }
    lumina.scene(scene);
  }, [placed, ball, goalMet]);

  // ---- the picture: a floor seen at a slant ----
  const BACK = { y: 150, l: 92, r: 268 }, FRONT = { y: 330, l: 22, r: 338 };
  const pic = (c, r) => {
    const t = (r + 0.5) / rows, y = BACK.y + t * (FRONT.y - BACK.y);
    const l = BACK.l + t * (FRONT.l - BACK.l), rr = BACK.r + t * (FRONT.r - BACK.r);
    return { x: l + ((c + 0.5) / cols) * (rr - l), y, s: 0.75 + 0.5 * t };
  };
  const nearestPicCell = p => {
    let best = null, bd = 1e9;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const q = pic(c, r), d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; best = { c, r }; } }
    return p.y > BACK.y - 30 && p.y < FRONT.y + 30 && p.x > 0 && p.x < 360 ? best : null;
  };
  const picture = () => <g id="picture">
    {place === 'room'
      ? <g><rect x={BACK.l} y="64" width={BACK.r - BACK.l} height={BACK.y - 64} fill="#e7e5e4" opacity="0.85" />
        <path d={`M ${BACK.l} 64 L ${FRONT.l} 100 L ${FRONT.l} ${FRONT.y} L ${BACK.l} ${BACK.y} Z`} fill="#d6d3d1" opacity="0.7" />
        <path d={`M ${BACK.r} 64 L ${FRONT.r} 100 L ${FRONT.r} ${FRONT.y} L ${BACK.r} ${BACK.y} Z`} fill="#d6d3d1" opacity="0.7" />
        <rect x={(BACK.l + BACK.r) / 2 - 18} y={BACK.y - 58} width="36" height="58" rx="3" fill="#92400e" stroke="#451a03" strokeWidth="2" />
        <circle cx={(BACK.l + BACK.r) / 2 + 10} cy={BACK.y - 28} r="3" fill="#facc15" />
        <path d={`M ${BACK.l} ${BACK.y} L ${BACK.r} ${BACK.y} L ${FRONT.r} ${FRONT.y} L ${FRONT.l} ${FRONT.y} Z`} fill="#a8a29e" /></g>
      : <g><rect x="10" y="64" width="340" height={BACK.y - 64} fill="#38bdf8" opacity="0.35" />
        <path d={`M ${BACK.l} ${BACK.y} L ${BACK.r} ${BACK.y} L ${FRONT.r} ${FRONT.y} L ${FRONT.l} ${FRONT.y} Z`} fill="#4d7c0f" />
        <path d={`M ${BACK.l - 6} ${BACK.y - 14} L ${BACK.r + 6} ${BACK.y - 14} L ${BACK.r} ${BACK.y} L ${BACK.l} ${BACK.y} Z`} fill="#57534e" />
        <line x1={BACK.l} y1={BACK.y - 7} x2={BACK.r} y2={BACK.y - 7} stroke="#facc15" strokeWidth="2" strokeDasharray="8 8" /></g>}
    {task === 'read' && Array.from({ length: rows * cols }, (_, k) => { const c = k % cols, r = Math.floor(k / cols), q = pic(c, r); return <rect key={'spot' + k} id={'spot-' + c + '-' + r}
      x={q.x - 4} y={q.y - 4} width="8" height="8" fill="none" style={{ pointerEvents: 'none' }} />; })}
    {things.map((t, i) => { const p = pic(t.c, t.r); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={34 * p.s}>{legendOf(t.kind).pic}</text>; })}
  </g>;

  // ---- the plan and its symbols ----
  const symbol = (l, size) => {
    const s = size / 2;
    if (l.shape === 'circle') return <circle r={s} fill={l.color} stroke="#0f172a" strokeWidth="2" />;
    if (l.shape === 'triangle') return <path d={`M 0 ${-s} L ${s} ${s} L ${-s} ${s} Z`} fill={l.color} stroke="#0f172a" strokeWidth="2" />;
    if (l.shape === 'diamond') return <path d={`M 0 ${-s} L ${s} 0 L 0 ${s} L ${-s} 0 Z`} fill={l.color} stroke="#0f172a" strokeWidth="2" />;
    if (l.shape === 'bar') return <rect x={-s} y={-s * 0.45} width={s * 2} height={s * 0.9} rx="3" fill={l.color} stroke="#0f172a" strokeWidth="2" />;
    if (l.shape === 'cross') return <path d={`M ${-s * 0.35} ${-s} h ${s * 0.7} v ${s * 0.65} h ${s * 0.65} v ${s * 0.7} h ${-s * 0.65} v ${s * 0.65} h ${-s * 0.7} v ${-s * 0.65} h ${-s * 0.65} v ${-s * 0.7} h ${s * 0.65} Z`} fill={l.color} stroke="#0f172a" strokeWidth="2" />;
    return <rect x={-s} y={-s} width={s * 2} height={s * 2} rx="3" fill={l.color} stroke="#0f172a" strokeWidth="2" />;
  };
  const star = size => { const s = size / 2, pts = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? s * 0.45 : s; return (Math.cos(a) * rr).toFixed(1) + ',' + (Math.sin(a) * rr).toFixed(1); }).join(' '); return <polygon points={pts} fill="#facc15" stroke="#0f172a" strokeWidth="2" />; };
  const cellCenter = (c, r) => ({ x: PLAN.x + (c + 0.5) * cw, y: PLAN.y + (r + 0.5) * ch });
  const planCell = p => (p.x >= PLAN.x && p.x <= PLAN.x + PLAN.w && p.y >= PLAN.y && p.y <= PLAN.y + PLAN.h
    ? { c: Math.min(cols - 1, Math.floor((p.x - PLAN.x) / cw)), r: Math.min(rows - 1, Math.floor((p.y - PLAN.y) / ch)) } : null);
  const plan = () => <g id="plan">
    <rect x={PLAN.x} y={PLAN.y} width={PLAN.w} height={PLAN.h} fill={place === 'room' ? '#e7e5e4' : '#bef264'} />
    {Array.from({ length: cols - 1 }, (_, k) => <line key={'c' + k} x1={PLAN.x + (k + 1) * cw} y1={PLAN.y} x2={PLAN.x + (k + 1) * cw} y2={PLAN.y + PLAN.h} stroke="#78716c" strokeWidth="1" strokeDasharray="3 5" />)}
    {Array.from({ length: rows - 1 }, (_, k) => <line key={'r' + k} x1={PLAN.x} y1={PLAN.y + (k + 1) * ch} x2={PLAN.x + PLAN.w} y2={PLAN.y + (k + 1) * ch} stroke="#78716c" strokeWidth="1" strokeDasharray="3 5" />)}
    {place === 'room'
      ? <g><rect x={PLAN.x} y={PLAN.y} width={PLAN.w} height={PLAN.h} fill="none" stroke="#f8fafc" strokeWidth="6" />
        <rect x={PLAN.x + PLAN.w / 2 - 20} y={PLAN.y - 5} width="40" height="10" fill="#92400e" /></g>
      : <g><rect x={PLAN.x - 6} y={PLAN.y - 22} width={PLAN.w + 12} height="22" fill="#57534e" />
        <line x1={PLAN.x} y1={PLAN.y - 11} x2={PLAN.x + PLAN.w} y2={PLAN.y - 11} stroke="#facc15" strokeWidth="2" strokeDasharray="8 8" /></g>}
    {Array.from({ length: rows * cols }, (_, k) => { const c = k % cols, r = Math.floor(k / cols); return <rect key={'cell' + k} id={'cell-' + c + '-' + r}
      x={PLAN.x + c * cw + cw / 2 - 4} y={PLAN.y + r * ch + ch / 2 - 4} width="8" height="8" fill="none" style={{ pointerEvents: 'none' }} />; })}
    {task === 'read' && <g>
      {things.map((t, i) => { const p = cellCenter(t.c, t.r); return <g key={i} transform={`translate(${p.x}, ${p.y})`}>{symbol(legendOf(t.kind), 34)}</g>; })}
      <g id="map-star" transform={`translate(${cellCenter(Number(hidden.c), Number(hidden.r)).x}, ${cellCenter(Number(hidden.c), Number(hidden.r)).y})`}>{star(36)}</g>
    </g>}
  </g>;

  const pointOf = e => svgPoint(svgRef.current, e);
  const grab = (d, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(d); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e), d = drag;
    setDrag(null);
    if (d.from === 'ball') { const cell = nearestPicCell(p); setBall(cell); return; }
    const cell = planCell(p);
    setPlaced(list => {
      const rest = d.from === 'placed' ? list.filter((_, i) => i !== d.i) : list;
      if (!cell) return rest;
      return [...rest.filter(t => !(t.c === cell.c && t.r === cell.r)), { kind: d.kind, c: cell.c, r: cell.r }];
    });
  };
  const dragProps = d => ({ style: { cursor: 'grab', touchAction: 'none' }, onPointerDown: e => grab(d, e), onPointerUp: onUp, onPointerCancel: () => setDrag(null) });
  const heldAt = (match, home) => (drag && match(drag) && drag.x !== undefined ? { x: drag.x, y: drag.y } : home);

  // legend along the bottom: each symbol beside the picture of what it means
  const LG_Y = 352, nCols = legend.length + (task === 'read' ? 1 : 0), lgW = Math.min(150, (W - 40) / nCols);
  const colX = i => 20 + (W - 40 - lgW * nCols) / 2 + i * lgW + lgW / 2;
  const legendRow = () => <g id="legend">
    <rect x="20" y={LG_Y} width={W - 40} height="128" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
    {legend.map((l, i) => { const x = colX(i); return <g key={l.kind}>
      <text x={x} y={LG_Y + 98} textAnchor="middle" dominantBaseline="middle" fontSize="30">{l.pic}</text>
      <text x={x} y={LG_Y + 70} textAnchor="middle" dominantBaseline="middle" fontSize="18" fill="#94a3b8">=</text>
      {task === 'make'
        ? <g id={'legend-' + l.kind} transform={`translate(${x}, ${LG_Y + 36})`} {...dragProps({ from: 'legend', kind: l.kind })}>
          <rect x="-24" y="-24" width="48" height="48" fill="transparent" />{symbol(l, 34)}</g>
        : <g transform={`translate(${x}, ${LG_Y + 36})`}>{symbol(l, 34)}</g>}
    </g>; })}
    {task === 'read' && (() => { const x = colX(legend.length); return <g>
      <g transform={`translate(${x}, ${LG_Y + 36})`}>{star(36)}</g>
      <text x={x} y={LG_Y + 70} textAnchor="middle" dominantBaseline="middle" fontSize="18" fill="#94a3b8">=</text>
      <rect x={x - 26} y={LG_Y + 74} width="52" height="48" rx="10" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="5 5" /></g>; })()}
  </g>;

  const placedSymbols = () => placed.map((t, i) => {
    const p = heldAt(d => d.from === 'placed' && d.i === i, cellCenter(t.c, t.r));
    return <g key={i + key(t)} id={'placed-' + i} transform={`translate(${p.x}, ${p.y})`} {...dragProps({ from: 'placed', i, kind: t.kind })}>
      <rect x="-24" y="-24" width="48" height="48" fill="transparent" />{symbol(legendOf(t.kind), 34)}</g>;
  });
  const heldLegend = () => (drag && drag.from === 'legend' && drag.x !== undefined
    ? <g transform={`translate(${drag.x}, ${drag.y})`} style={{ pointerEvents: 'none' }}>{symbol(legendOf(drag.kind), 34)}</g> : null);

  // read: the hidden thing waits in a tray until it is dragged into the picture
  const TRAY = { x: colX(legend.length), y: LG_Y + 98 };
  const ballEl = () => {
    const home = ball ? pic(ball.c, ball.r) : { x: TRAY.x, y: TRAY.y, s: 1 };
    const p = heldAt(d => d.from === 'ball', home);
    return <g id="hidden-thing" transform={`translate(${p.x}, ${p.y})`} {...dragProps({ from: 'ball' })}>
      <circle r="24" fill="transparent" /><text textAnchor="middle" dominantBaseline="middle" fontSize={34 * (home.s || 1)}>{hidden.pic}</text></g>;
  };

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        {picture()}
        {plan()}
        {legendRow()}
        {task === 'make' && placedSymbols()}
        {task === 'make' && heldLegend()}
        {task === 'read' && ballEl()}
      </svg>
    </Panel>
  );
}
