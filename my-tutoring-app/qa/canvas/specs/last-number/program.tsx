// Last number (K.CC.B.4b). A few things sit on a table (scattered, in one row, or in two rows). The child counts them
// by dragging each one onto the shelf below, one at a time; nothing on screen is ever numbered. Then the child says how
// many. The rule: the last number counted says how many.
// Say and show: the count is one sayable number, the same whatever the child does. Check judges that every thing was
// moved onto the shelf (and, on a row with a pointing hand, moved in order from the hand's end), so a tap moves
// nothing and tapping every thing never meets the goal.
function Display({ params, lumina }) {
  const n = Math.max(1, Math.min(10, Number(params.n) || 3));
  const thing = String(params.thing || '🍎');
  const name = String(params.name || 'things');
  const layout = ['scatter', 'row', 'rows'].includes(params.layout) ? params.layout : 'scatter';
  const seed = Number(params.seed) || 1;
  const start = params.start === 'left' || params.start === 'right' ? params.start : '';
  const [order, setOrder] = useState([]);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  // Where each thing sits on the table.
  const FY = 16;
  const FH = layout === 'row' ? 120 : layout === 'rows' ? 200 : n <= 3 ? 180 : 260;
  const home = useMemo(() => {
    if (layout === 'row') {
      const gap = n > 1 ? Math.min(84, 440 / (n - 1)) : 84, x0 = 340 - ((n - 1) * gap) / 2;
      return Array.from({ length: n }, (_, i) => ({ x: x0 + i * gap, y: FY + FH / 2 }));
    }
    if (layout === 'rows') {
      const per = Math.ceil(n / 2), gap = 96, x0 = 340 - ((per - 1) * gap) / 2;
      return Array.from({ length: n }, (_, i) => ({ x: x0 + (i % per) * gap, y: FY + 54 + Math.floor(i / per) * 92 }));
    }
    let s = (seed * 2654435761) >>> 0 || 1;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const pts = [];
    for (let tries = 0; pts.length < n && tries < 2000; tries++) {
      const p = { x: 70 + rand() * 540, y: FY + 44 + rand() * (FH - 88) };
      if (pts.every(q => Math.hypot(q.x - p.x, q.y - p.y) > 92)) pts.push(p);
    }
    while (pts.length < n) pts.push({ x: 70 + (pts.length % 7) * 90, y: FY + 44 + Math.floor(pts.length / 7) * 90 });
    return pts;
  }, [n, layout, seed]);

  const SHELF = { x: 20, y: FY + FH + 20, w: 640, h: 88 };
  const H = SHELF.y + SHELF.h + 16;
  const path = start === 'right' ? home.map((_, i) => n - 1 - i) : home.map((_, i) => i);

  useEffect(() => {
    const misrules = [
      { says: n + 1, because: 'said the number after the last one counted' },
      layout === 'rows' && n > 2 ? { says: Math.ceil(n / 2), because: 'counted only one row' } : null,
    ].filter((m, k, all) => m && m.says !== n && all.findIndex(x => x && x.says === m.says) === k);
    lumina.answer(n, misrules);
  }, []);

  const rowPlace = i => {
    const fromLeft = i + 1;
    const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    return words[fromLeft - 1] + ' from the left';
  };
  useEffect(() => {
    const inOrder = !start || order.every((id, k) => id === path[k]);
    lumina.goal(order.length === n && inOrder);
    const where = layout === 'row'
      ? 'in one row on the table' + (start ? ', a hand points at the ' + start + ' end of the row' : ', no hand')
      : layout === 'rows' ? 'in two rows on the table, one above the other' : 'scattered over the table';
    lumina.scene({
      counting: name,
      laidOut: where,
      onShelf: order.length,
      stillOnTable: order.length === n ? 'none' : 'some',
      ...(layout === 'row' ? { movedToShelfInThisOrder: order.map(rowPlace) } : {}),
    });
  }, [order]);

  const grab = (id, e) => { e.currentTarget.setPointerCapture(e.pointerId); const p = svgPoint(svgRef.current, e); setDrag({ id, x: p.x, y: p.y, moved: false }); };
  const move = e => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag({ ...drag, x: p.x, y: p.y, moved: true }); } };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e), id = drag.id, moved = drag.moved;
    setDrag(null);
    if (!moved) return; // a tap moves nothing
    const onShelf = p.y > SHELF.y - 16 && p.x > SHELF.x - 10 && p.x < SHELF.x + SHELF.w + 10;
    setOrder(o => (onShelf ? (o.includes(id) ? o : [...o, id]) : o.filter(x => x !== id)));
  };
  const at = id => {
    if (drag && drag.id === id && drag.moved) return { x: drag.x, y: drag.y };
    const k = order.indexOf(id);
    return k >= 0 ? { x: SHELF.x + 36 + k * 63, y: SHELF.y + SHELF.h / 2 } : home[id];
  };

  const ids = home.map((_, i) => i);
  const drawn = [...ids.filter(i => !(drag && drag.id === i)), ...ids.filter(i => drag && drag.id === i)];
  const item = i => {
    const p = at(i), held = drag && drag.id === i;
    return (
      <g key={i} id={'thing-' + i} transform={`translate(${p.x}, ${p.y})`} onPointerDown={e => grab(i, e)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
        <circle r="30" fill={held ? '#334155' : '#1e293b'} stroke="#64748b" strokeWidth="2" />
        <text y="3" textAnchor="middle" dominantBaseline="middle" fontSize="38">{thing}</text>
      </g>
    );
  };
  const hand = () => {
    if (layout !== 'row' || !start) return null;
    const first = home[path[0]];
    const x = start === 'left' ? first.x - 62 : first.x + 62;
    return <text x={x} y={first.y + 3} textAnchor="middle" dominantBaseline="middle" fontSize="40">{start === 'left' ? '👉' : '👈'}</text>;
  };

  return (
    <Panel title="Count and Move" caption="Drag each one down to the shelf.">
      <svg ref={svgRef} viewBox={`0 0 680 ${H}`} onPointerMove={move} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />
        <rect x="20" y={FY} width="640" height={FH} rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <rect id="shelf" x={SHELF.x} y={SHELF.y} width={SHELF.w} height={SHELF.h} rx="14" fill="#0f172a" stroke="#475569" strokeWidth="2.5" strokeDasharray="6 5" />
        {hand()}
        {drawn.map(item)}
      </svg>
    </Panel>
  );
}
