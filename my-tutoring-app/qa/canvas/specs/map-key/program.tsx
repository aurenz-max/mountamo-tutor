// Map Key (grades 1-2, social studies). A town map: most of it is already drawn with symbols; one row is our street,
// and its plots are empty. Above the map is a picture of our street (the same five places, left to right). The child
// drags symbols from the key onto the street's plots so the map matches the picture, then says how many schools the
// WHOLE map shows. The schools already on the map can only be found through the key: one key symbol is drawn like a
// little schoolhouse (a building with a flag) and the key may say it means a library. A child who reads a symbol as a
// picture of how the thing looks counts the schoolhouse shapes. On the last problem the map has no key (a tray of
// bare symbols): the street is made with one symbol per kind of place, and the count cannot be told.
// params.things: the street, left to right ('school' | 'house' | 'library' | 'store'); params.street: the map row
// that is our street (0 top .. 2 bottom); params.rows: the other rows, each 5 cells of a shape name or null;
// params.key: [{ shape, thing }] or null for a map with no key; params.tray: the bare symbols when there is no key.
function Display({ params, lumina }) {
  const COLS = 5, ROWS = 3;
  const PLACES = {
    school: { pic: '🏫', name: 'school' }, house: { pic: '🏠', name: 'house' },
    library: { pic: '🏛️', name: 'library' }, store: { pic: '🏪', name: 'store' },
  };
  const SHAPES = ['star', 'square', 'circle', 'schoolhouse', 'triangle'];
  const things = (Array.isArray(params.things) ? params.things : ['school', 'house', 'house', 'school', 'house'])
    .slice(0, COLS).map(t => (PLACES[t] ? t : 'house'));
  const street = Math.max(0, Math.min(ROWS - 1, Number(params.street) || 0));
  const rowsIn = Array.isArray(params.rows) ? params.rows : [['star', null, 'square', null, null], [null, 'square', null, null, 'square']];
  const key = Array.isArray(params.key) ? params.key.filter(k => SHAPES.includes(k.shape) && PLACES[k.thing]) : null;
  const tray = key ? key.map(k => k.shape) : (Array.isArray(params.tray) ? params.tray : ['star', 'square', 'circle', 'schoolhouse']).filter(s => SHAPES.includes(s));
  // The map's rows: the street row is the child's; the others are already drawn.
  const grid = Array.from({ length: ROWS }, (_, r) => r === street ? null
    : Array.from({ length: COLS }, (_, c) => { const row = rowsIn[r < street ? r : r - 1] || []; return SHAPES.includes(row[c]) ? row[c] : null; }));
  const shapeFor = thing => (key ? (key.find(k => k.thing === thing) || {}).shape || null : null);

  const [placed, setPlaced] = useState(() => Array(COLS).fill(null));
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  // ---- the said answer, from params only ----
  const WORD = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
  const CHOICES = ['one', 'two', 'three', "can't tell"];
  const drawn = grid.flatMap(row => row || []);
  const streetSchools = things.filter(t => t === 'school').length;
  useEffect(() => {
    let answer, misrules;
    if (!key) {
      answer = "can't tell";
      misrules = [
        { says: WORD[drawn.filter(s => s === 'schoolhouse').length], because: 'counted the symbols shaped like a school building, but this map has no key to say what any symbol means' },
        { says: WORD[streetSchools], because: 'counted the schools in the picture of the street, not the schools the whole map shows' },
      ];
    } else {
      const schoolShape = shapeFor('school');
      answer = WORD[drawn.filter(s => s === schoolShape).length + streetSchools];
      const lookAlike = drawn.filter(s => s === 'schoolhouse').length + things.filter(t => shapeFor(t) === 'schoolhouse').length;
      misrules = [
        { says: WORD[lookAlike], because: 'counted the symbols that look like a school building, not the symbol the key says means school' },
        { says: WORD[streetSchools], because: 'counted only the schools in the picture of the street, not the ones already on the map' },
      ];
    }
    misrules = misrules.filter((m, i, all) => CHOICES.includes(m.says) && m.says !== answer && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(answer, misrules, CHOICES);
  }, []);

  // ---- the goal: the street on the map matches the picture ----
  const goalMet = key
    ? things.every((t, c) => placed[c] === shapeFor(t))
    : placed.every(s => s) && things.every((t, c) => things.every((u, d) => (t === u) === (placed[c] === placed[d])));
  const ROW_NAME = ['top row', 'middle row', 'bottom row'];
  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      picture: 'our street, left to right: ' + things.map(t => PLACES[t].name).join(', '),
      map: grid.map((row, r) => ROW_NAME[r] + ': ' + (row
        ? row.map(s => s || 'blank').join(', ')
        : 'our street, plots left to right: ' + placed.map(s => s || 'empty').join(', '))),
      key: key ? key.map(k => k.shape + ' = ' + PLACES[k.thing].name) : 'this map has no key; the symbols tray is: ' + tray.join(', '),
    });
  }, [placed, goalMet]);

  // ---- layout ----
  const W = 680, CELL = 80, MX = 40, MY = 168, PY = 20, H = MY + ROWS * CELL + 22;
  const KX = 466, KW = 196;
  const colX = c => MX + c * CELL + CELL / 2;
  const plotY = r => MY + r * CELL + 34;

  const symbol = (shape, size) => {
    const s = size / 2, st = { stroke: '#0f172a', strokeWidth: 2 };
    if (shape === 'star') {
      const pts = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? s * 0.45 : s; return (Math.cos(a) * rr).toFixed(1) + ',' + (Math.sin(a) * rr).toFixed(1); }).join(' ');
      return <polygon points={pts} fill="#facc15" {...st} />;
    }
    if (shape === 'circle') return <circle r={s * 0.8} fill="#ef4444" {...st} />;
    if (shape === 'triangle') return <path d={`M 0 ${-s * 0.85} L ${s * 0.85} ${s * 0.7} L ${-s * 0.85} ${s * 0.7} Z`} fill="#22c55e" {...st} />;
    if (shape === 'schoolhouse') return <g>
      <line x1={0} y1={-s * 0.55} x2={0} y2={-s * 1.05} stroke="#0f172a" strokeWidth="2" />
      <path d={`M 0 ${-s * 1.05} L ${s * 0.5} ${-s * 0.92} L 0 ${-s * 0.78} Z`} fill="#ef4444" stroke="#0f172a" strokeWidth="1.5" />
      <path d={`M ${-s * 0.8} ${s * 0.75} L ${-s * 0.8} ${-s * 0.1} L 0 ${-s * 0.6} L ${s * 0.8} ${-s * 0.1} L ${s * 0.8} ${s * 0.75} Z`} fill="#b45309" {...st} />
      <rect x={-s * 0.18} y={s * 0.25} width={s * 0.36} height={s * 0.5} fill="#451a03" />
      <rect x={-s * 0.6} y={s * 0.02} width={s * 0.26} height={s * 0.24} fill="#fde68a" />
      <rect x={s * 0.34} y={s * 0.02} width={s * 0.26} height={s * 0.24} fill="#fde68a" />
    </g>;
    return <rect x={-s * 0.75} y={-s * 0.75} width={s * 1.5} height={s * 1.5} rx="3" fill="#3b82f6" {...st} />;
  };

  const pointOf = e => svgPoint(svgRef.current, e);
  const grab = (d, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(d); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const plotAt = p => {
    const top = MY + street * CELL;
    if (p.y < top - 6 || p.y > top + CELL + 6 || p.x < MX || p.x > MX + COLS * CELL) return null;
    return Math.min(COLS - 1, Math.floor((p.x - MX) / CELL));
  };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e), d = drag, c = plotAt(p);
    setDrag(null);
    setPlaced(list => {
      const next = list.slice();
      if (d.from === 'placed') next[d.col] = null;
      if (c !== null) next[c] = d.shape;
      return next;
    });
  };
  const dragProps = d => ({ style: { cursor: 'grab', touchAction: 'none' }, onPointerDown: e => grab(d, e), onPointerUp: onUp, onPointerCancel: () => setDrag(null) });

  // the picture of our street: the same five places, over a road, lined up with the map's columns
  const picture = () => <g>
    <rect x={MX - 16} y={PY} width={COLS * CELL + 32} height="118" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
    <text x={MX} y={PY + 24} fontSize="16" fill="#cbd5e1">Our street</text>
    <rect x={MX - 4} y={PY + 88} width={COLS * CELL + 8} height="18" fill="#57534e" />
    <line x1={MX} y1={PY + 97} x2={MX + COLS * CELL} y2={PY + 97} stroke="#facc15" strokeWidth="2" strokeDasharray="10 8" />
    {things.map((t, c) => <text key={c} x={colX(c)} y={PY + 64} textAnchor="middle" dominantBaseline="middle" fontSize="44">{PLACES[t].pic}</text>)}
  </g>;

  // the map: paper, a road under each row, symbols already drawn, our street's plots dashed
  const map = () => <g>
    <text x={MX} y={MY - 10} fontSize="16" fill="#cbd5e1">Map</text>
    <rect x={MX} y={MY} width={COLS * CELL} height={ROWS * CELL} rx="6" fill="#e7e5e4" stroke="#f8fafc" strokeWidth="3" />
    {Array.from({ length: ROWS }, (_, r) => <rect key={'road' + r} x={MX + 3} y={MY + r * CELL + 68} width={COLS * CELL - 6} height="9" fill="#a8a29e" />)}
    {grid.map((row, r) => row
      ? row.map((s, c) => s ? <g key={r + '-' + c} transform={`translate(${colX(c)}, ${plotY(r)})`}>{symbol(s, 40)}</g> : null)
      : Array.from({ length: COLS }, (_, c) => <rect key={'plot' + c} id={'plot-' + c} x={colX(c) - 30} y={plotY(r) - 30} width="60" height="60" rx="8"
        fill="#f5f5f4" stroke="#64748b" strokeWidth="2.5" strokeDasharray="6 5" />))}
  </g>;

  // the key (or, with no key, a tray of bare symbols)
  const n = tray.length, rowH = Math.min(68, (ROWS * CELL - 34) / Math.max(1, n));
  const keyPanel = () => <g>
    <rect x={KX} y={MY - 30} width={KW} height={ROWS * CELL + 30} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
    <text x={KX + 16} y={MY - 6} fontSize="18" fontWeight="600" fill="#e2e8f0">{key ? 'Key' : 'Symbols'}</text>
    {tray.map((shape, i) => {
      const y = key ? MY + 18 + i * rowH + rowH / 2 : MY + 60 + Math.floor(i / 2) * 96;
      const sx = key ? KX + 44 : KX + 54 + (i % 2) * 88, k = key && key[i];
      return <g key={shape}>
        <g id={'key-' + shape} transform={`translate(${sx}, ${y})`} {...dragProps({ from: 'key', shape })}>
          <rect x="-26" y="-26" width="52" height="52" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />{symbol(shape, 36)}</g>
        {k && <g>
          <text x={KX + 88} y={y + 2} textAnchor="middle" dominantBaseline="middle" fontSize="20" fill="#94a3b8">=</text>
          <text x={KX + 126} y={y - 8} textAnchor="middle" dominantBaseline="middle" fontSize="32">{PLACES[k.thing].pic}</text>
          <text x={KX + 126} y={y + 22} textAnchor="middle" dominantBaseline="middle" fontSize="15" fill="#cbd5e1">{PLACES[k.thing].name}</text>
        </g>}
      </g>;
    })}
  </g>;

  const placedSymbols = () => placed.map((s, c) => {
    if (!s) return null;
    const held = drag && drag.from === 'placed' && drag.col === c && drag.x !== undefined;
    const p = held ? { x: drag.x, y: drag.y } : { x: colX(c), y: plotY(street) };
    return <g key={'placed' + c + s} id={'placed-' + c} transform={`translate(${p.x}, ${p.y})`} {...dragProps({ from: 'placed', col: c, shape: s })}>
      <rect x="-27" y="-27" width="54" height="54" fill="transparent" />{symbol(s, 40)}</g>;
  });
  const heldKey = () => (drag && drag.from === 'key' && drag.x !== undefined
    ? <g transform={`translate(${drag.x}, ${drag.y})`} style={{ pointerEvents: 'none' }}>{symbol(drag.shape, 40)}</g> : null);

  return (
    <Panel title="Map Key" caption="Drag a symbol onto a dashed plot on the map. Drag it off the map to take it away.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        {picture()}
        {map()}
        {keyPanel()}
        {placedSymbols()}
        {heldKey()}
      </svg>
    </Panel>
  );
}
