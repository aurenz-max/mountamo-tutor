// What makes it (3.G.A.1). A four-sided shape sits on a dot grid. The child changes it the way the problem asks
// (drag a corner, slide a whole side, make it bigger, or paint it), then says whether it is still a rectangle (or,
// on the last problem, still a square). The shape's name comes from its sides and corners, not from how long it looks
// or what colour it is.
// Nothing marks a corner as square and no length is printed: the dots are the only measure, so the child judges the
// corners and sides themselves. Check judges only that the change asked for was made.
// Params: shape (four corners in grid units, top-left first, clockwise), task (grow | paint | corner | square | slide),
// star (where the moved corner goes), which (the corner pulled), factor (grow), fill and edge (paint colours),
// colour (the start colour), kind (rectangle | square: the name asked about).
function Display({ params, lumina }) {
  const parsePt = s => { const [x, y] = String(s).split(',').map(Number); return { x: x || 0, y: y || 0 }; };
  const start = String(params.shape || '2,1 6,1 6,3 2,3').trim().split(/\s+/).map(parsePt).slice(0, 4);
  const task = ['grow', 'paint', 'corner', 'square', 'slide'].includes(params.task) ? params.task : 'grow';
  const star = params.star ? parsePt(params.star) : null;
  const which = Number(params.which) || 1;
  const factor = Number(params.factor) || 2;
  const kind = params.kind === 'square' ? 'square' : 'rectangle';
  const PAINTS = { red: '#ef4444', yellow: '#facc15', green: '#22c55e', blue: '#3b82f6', purple: '#a855f7' };
  const fillWant = params.fill || 'yellow', edgeWant = params.edge || 'red';
  const startColour = params.colour || '#60a5fa';

  const COLS = 15, ROWS = 8, U = 40, OX = 40, OY = 36;
  const px = p => ({ x: OX + p.x * U, y: OY + p.y * U });

  const [verts, setVerts] = useState(start);
  const [fill, setFill] = useState(null);
  const [edges, setEdges] = useState([null, null, null, null]);
  const [pot, setPot] = useState(null);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  // Geometry of a four-sided shape, in grid units.
  const vec = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
  const sides = vs => vs.map((v, i) => vec(v, vs[(i + 1) % 4]));
  const len2 = v => v.x * v.x + v.y * v.y;
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const isRect = vs => { const s = sides(vs); return s.every(v => len2(v) > 0) && s.every((v, i) => dot(v, s[(i + 1) % 4]) === 0); };
  const isSquare = vs => isRect(vs) && sides(vs).every(v => len2(v) === len2(sides(vs)[0]));
  const allEqual = vs => sides(vs).every(v => len2(v) > 0 && len2(v) === len2(sides(vs)[0]));
  const looksLong = vs => { const l = sides(vs).map(v => Math.sqrt(len2(v))); return Math.max(...l) / Math.min(...l) >= 1.5; };
  const samePt = (a, b) => a.x === b.x && a.y === b.y;

  // The shape the asked change makes, worked out from params alone (the said answer is about it).
  const target = (() => {
    if (task === 'grow') return start.map(v => ({ x: start[0].x + (v.x - start[0].x) * factor, y: start[0].y + (v.y - start[0].y) * factor }));
    if (task === 'corner' && star) return start.map((v, i) => (i === which ? star : v));
    if (task === 'slide' && star) { const d = vec(start[0], star); return start.map((v, i) => (i < 2 ? { x: v.x + d.x, y: v.y + d.y } : v)); }
    if (task === 'square') { const w = Math.abs(start[1].x - start[0].x); const o = start[0]; return [o, { x: o.x + w, y: o.y }, { x: o.x + w, y: o.y + w }, { x: o.x, y: o.y + w }]; }
    return start;
  })();

  useEffect(() => {
    const yes = kind === 'square' ? isSquare(target) : isRect(target);
    const key = yes ? 'yes' : 'no';
    const misrules = (kind === 'square'
      ? [{ says: allEqual(target) ? 'yes' : 'no', because: 'thought four sides the same length make a square, whatever the corners are like' }]
      : [{ says: looksLong(target) ? 'yes' : 'no', because: looksLong(target)
        ? 'went by how it looks: it still has two long sides, so it looks like a rectangle, though its corners are not square'
        : 'thought a rectangle must be long and thin, so a square is not one' }]
    ).filter(m => m.says !== key);
    lumina.answer(key, misrules, ['yes', 'no']);
  }, []);

  const met = (() => {
    if (task === 'paint') return verts.every((v, i) => samePt(v, start[i])) && fill === fillWant && edges.every(e => e === edgeWant);
    if (task === 'grow') { const s = sides(verts), s0 = sides(start); return s.every((v, i) => v.x === s0[i].x * factor && v.y === s0[i].y * factor); }
    if (task === 'square') return isSquare(verts) && !verts.every((v, i) => samePt(v, start[i]));
    return verts.every((v, i) => samePt(v, target[i]));
  })();

  useEffect(() => {
    lumina.goal(met);
    const names = ['top left', 'top right', 'bottom right', 'bottom left'];
    lumina.scene({
      corners: verts.map((v, i) => names[i] + ' at (' + v.x + ', ' + v.y + ')').join('; '),
      startCorners: start.map((v, i) => names[i] + ' at (' + v.x + ', ' + v.y + ')').join('; '),
      ...(star ? { starAt: '(' + star.x + ', ' + star.y + ')' } : {}),
      ...(task === 'paint' ? { insideColour: fill || 'not painted', sideColours: edges.map(e => e || 'not painted').join(', '), potPicked: pot || 'none' } : {}),
      questionAbout: kind,
    });
  }, [verts, fill, edges, pot]);

  const clampPt = p => ({ x: Math.max(0, Math.min(COLS, p.x)), y: Math.max(0, Math.min(ROWS, p.y)) });
  const grab = (kindOf, i, e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ kindOf, i, from: svgPoint(svgRef.current, e), verts });
  };
  const move = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e);
    const d = { x: Math.round((p.x - drag.from.x) / U), y: Math.round((p.y - drag.from.y) / U) };
    const moved = drag.kindOf === 'corner' ? [drag.i] : [drag.i, (drag.i + 1) % 4];
    // A whole side moves only as far as both its ends can go.
    if (drag.kindOf === 'side') {
      for (const k of moved) { const v = drag.verts[k]; d.x = Math.max(-v.x, Math.min(COLS - v.x, d.x)); d.y = Math.max(-v.y, Math.min(ROWS - v.y, d.y)); }
    }
    setVerts(drag.verts.map((v, k) => (moved.includes(k) ? clampPt({ x: v.x + d.x, y: v.y + d.y }) : v)));
  };
  const drop = () => setDrag(null);

  const paintAt = part => {
    if (!pot) return;
    if (part === 'inside') setFill(pot);
    else setEdges(es => es.map((e, k) => (k === part ? pot : e)));
  };

  const P = verts.map(px);
  const poly = P.map(p => p.x + ',' + p.y).join(' ');
  const painting = task === 'paint';
  const H = painting ? 440 : 376;
  const dots = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) dots.push(<circle key={r + '-' + c} cx={OX + c * U} cy={OY + r * U} r="3" fill="#475569" />);
  const starPx = star ? px(star) : null;

  const sideHandle = i => {
    const a = P[i], b = P[(i + 1) % 4];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    return (
      <g key={'s' + i} id={'side-' + ['top', 'right', 'bottom', 'left'][i]} onPointerDown={e => grab('side', i, e)} onPointerUp={drop}
        style={{ cursor: 'grab', touchAction: 'none' }} transform={`translate(${mx}, ${my}) rotate(${ang})`}>
        <rect x="-24" y="-24" width="48" height="48" fill="transparent" />
        <rect x="-20" y="-8" width="40" height="16" rx="8" fill="#94a3b8" stroke="#334155" strokeWidth="2" />
      </g>
    );
  };
  const cornerHandle = i => (
    <g key={'c' + i} id={'corner-' + ['tl', 'tr', 'br', 'bl'][i]} onPointerDown={e => grab('corner', i, e)} onPointerUp={drop}
      style={{ cursor: 'grab', touchAction: 'none' }} transform={`translate(${P[i].x}, ${P[i].y})`}>
      <circle r="24" fill="transparent" />
      <circle r="13" fill="#e2e8f0" stroke="#64748b" strokeWidth="3" />
    </g>
  );

  const potNames = Object.keys(PAINTS);
  return (
    <Panel title="Shape Workshop" caption={painting ? 'Tap a paint pot, then tap the inside or a side to paint it.' : 'Drag a white corner to move it, or a grey bar to move a whole side.'}>
      <svg ref={svgRef} viewBox={`0 0 680 ${H}`} onPointerMove={move} onPointerUp={drop}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />
        {dots}
        {starPx && <text x={starPx.x} y={starPx.y + 2} textAnchor="middle" dominantBaseline="middle" fontSize="34" style={{ pointerEvents: 'none' }}>⭐</text>}
        <polygon id="inside" points={poly} fill={fill ? PAINTS[fill] : startColour} fillOpacity={fill ? 0.85 : 0.55}
          onPointerDown={() => painting && paintAt('inside')} style={{ cursor: painting ? 'pointer' : 'default' }} />
        {P.map((a, i) => { const b = P[(i + 1) % 4]; return (
          <line key={'e' + i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={edges[i] ? PAINTS[edges[i]] : '#e2e8f0'} strokeWidth="6" strokeLinecap="round" style={{ pointerEvents: 'none' }} />
        ); })}
        {painting && P.map((a, i) => {
          const b = P[(i + 1) % 4], L = Math.hypot(b.x - a.x, b.y - a.y), ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          return (
            <rect key={'h' + i} id={'edge-' + ['top', 'right', 'bottom', 'left'][i]} x="10" y="-22" width={Math.max(0, L - 20)} height="44" fill="transparent"
              transform={`translate(${a.x}, ${a.y}) rotate(${ang})`} onPointerDown={() => paintAt(i)} style={{ cursor: 'pointer' }} />
          );
        })}
        {!painting && [0, 1, 2, 3].map(sideHandle)}
        {!painting && [0, 1, 2, 3].map(cornerHandle)}
        {painting && (
          <g>
            <rect x="110" y={H - 76} width="460" height="68" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            {potNames.map((n, k) => (
              <g key={n} id={'pot-' + n} onPointerDown={() => setPot(n)} style={{ cursor: 'pointer' }}>
                <circle cx={160 + k * 90} cy={H - 42} r="26" fill={PAINTS[n]} stroke={pot === n ? '#e2e8f0' : '#334155'} strokeWidth={pot === n ? 5 : 2} />
              </g>
            ))}
          </g>
        )}
      </svg>
    </Panel>
  );
}
