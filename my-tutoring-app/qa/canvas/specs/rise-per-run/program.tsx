// Rise per run (8.EE.B.5). A line on a grid (or a table of points); the child drags pins A and B onto grid corners of
// the line, and the run and rise steps between them are drawn with no numbers. The child counts the spaces and says the
// slope: the rise for each one unit of run. Say and show: Check tests that both pins sit on the line at grid corners
// (on the table problem, that the child plotted the table's line); speech carries the rule.
function Display({ params, lumina }) {
  const rise = Number(params.rise) || 3, run = Number(params.run) || 4; // the line's smallest corner-to-corner step
  const x0 = Number(params.x0) || 0, y0 = Number(params.y0) || 0; // one grid corner the line passes through
  const table = !!params.table, rowStep = Number(params.rowStep) || run; // table problems: x goes up by rowStep a row
  const startA = { x: Number(params.ax) || 0, y: Number(params.ay) || 0 };
  const startB = { x: Number(params.bx) || 0, y: Number(params.by) || 0 };

  const [ptA, setPtA] = useState(startA);
  const [ptB, setPtB] = useState(startB);

  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const fmt = (p, q) => {
    if (q < 0) { p = -p; q = -q; }
    const g = gcd(p, q) || 1, n = p / g, d = q / g;
    return d === 1 ? String(n) : (n < 0 ? '-' : '') + Math.abs(n) + '/' + d;
  };
  const sign = rise < 0 ? -1 : 1;
  const rows = [0, 1, 2].map(k => ({ x: x0 + k * rowStep, y: y0 + (rise * rowStep * k) / run }));

  useEffect(() => {
    const answer = fmt(rise, run);
    const misrules = [
      { says: fmt(run, rise), because: 'divided the run by the rise, not the rise by the run' },
      table ? { says: fmt((rise * rowStep) / run, 1), because: 'took the rise for each row of the table, not for each one unit of x' } : null,
      { says: fmt(rise + sign, run + 1), because: 'counted the grid corners along each step, not the spaces between them' },
    ].filter((m, i, all) => m && m.says !== answer && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(answer, misrules);
  }, []);

  const onLine = p => (p.y - y0) * run === rise * (p.x - x0);
  const same = ptA.x === ptB.x && ptA.y === ptB.y;
  const left = ptA.x <= ptB.x ? ptA : ptB, right = ptA.x <= ptB.x ? ptB : ptA;

  // The grid: x 0..8, y 0..7, 50 units a space.
  const CELL = 50, GX = table ? 50 : 160, TOP = 24, XN = 8, YN = 7, W = 680, H = TOP + YN * CELL + 46;
  const sx = gx => GX + gx * CELL, sy = gy => TOP + (YN - gy) * CELL;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const corners = [];
  for (let k = -16; k <= 16; k++) {
    const p = { x: x0 + k * run, y: y0 + k * rise };
    if (p.x >= 0 && p.x <= XN && p.y >= 0 && p.y <= YN) corners.push([p.x, p.y]);
  }

  useEffect(() => {
    lumina.goal(!same && onLine(ptA) && onLine(ptB));
    lumina.scene({
      ...(table
        ? { tableRows: rows.map(r => `x ${r.x}, y ${r.y}`), lineDrawn: 'the line through your two pins' }
        : { lineCrossesGridCornersAt: corners.map(c => `(${c[0]}, ${c[1]})`) }),
      pinA: `(${ptA.x}, ${ptA.y})`,
      pinB: `(${ptB.x}, ${ptB.y})`,
      stepsDrawn: same ? 'none: the pins are on one corner' : left.x === right.x ? 'only a rise: the pins are one above the other' : 'a run to the right, then a rise or a fall, with no numbers',
    });
  }, [ptA, ptB]);

  const svgRef = useRef(null);
  const holding = useRef(null);
  const grab = key => e => { holding.current = key; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = e => {
    if (!holding.current || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e);
    const g = { x: clamp(Math.round((p.x - GX) / CELL), 0, XN), y: clamp(Math.round(YN - (p.y - TOP) / CELL), 0, YN) };
    (holding.current === 'A' ? setPtA : setPtB)(g);
  };
  const drop = () => { holding.current = null; };

  // The line: given (the line problems) or through the child's pins (the table problem). Clipped to the grid.
  const through = (p, q) => {
    if (p.x === q.x) return p.y === q.y ? null : { x1: sx(p.x), y1: sy(0), x2: sx(p.x), y2: sy(YN) };
    const m = (q.y - p.y) / (q.x - p.x), b = p.y - m * p.x;
    return { x1: sx(-1), y1: sy(m * -1 + b), x2: sx(XN + 1), y2: sy(m * (XN + 1) + b) };
  };
  const line = table ? through(ptA, ptB) : through({ x: x0, y: y0 }, { x: x0 + run, y: y0 + rise });

  const pin = (id, key, p, fill, name) => (
    <g id={id} onPointerDown={grab(key)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
      <circle cx={sx(p.x)} cy={sy(p.y)} r="24" fill={fill} opacity="0.22" />
      <circle cx={sx(p.x)} cy={sy(p.y)} r="10" fill={fill} stroke="#f8fafc" strokeWidth="2.5" />
      <text x={sx(p.x) + 16} y={sy(p.y) - 14} fontSize="18" fontWeight="700" fill={fill}>{name}</text>
    </g>
  );

  return (
    <Panel title={table ? 'Table to Line' : 'Rise and Run'} caption="Drag pin A and pin B onto grid corners.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={drop}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <defs>
          <clipPath id="grid-clip"><rect x={sx(0)} y={sy(YN)} width={XN * CELL} height={YN * CELL} /></clipPath>
        </defs>
        {Array.from({ length: XN + 1 }, (_, i) => (
          <g key={'x' + i}>
            <line x1={sx(i)} y1={sy(0)} x2={sx(i)} y2={sy(YN)} stroke={i === 0 ? '#64748b' : '#334155'} strokeWidth={i === 0 ? 2.5 : 1.2} />
            <text x={sx(i)} y={sy(0) + 26} textAnchor="middle" fontSize="15" fill="#94a3b8">{i}</text>
          </g>
        ))}
        {Array.from({ length: YN + 1 }, (_, i) => (
          <g key={'y' + i}>
            <line x1={sx(0)} y1={sy(i)} x2={sx(XN)} y2={sy(i)} stroke={i === 0 ? '#64748b' : '#334155'} strokeWidth={i === 0 ? 2.5 : 1.2} />
            <text x={sx(0) - 14} y={sy(i) + 5} textAnchor="end" fontSize="15" fill="#94a3b8">{i}</text>
          </g>
        ))}

        {line && <line {...line} stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" clipPath="url(#grid-clip)" />}

        {!same && left.x !== right.x && (
          <g>
            <line x1={sx(left.x)} y1={sy(left.y)} x2={sx(right.x)} y2={sy(left.y)} stroke="#22d3ee" strokeWidth="5" strokeLinecap="round" />
            <line x1={sx(right.x)} y1={sy(left.y)} x2={sx(right.x)} y2={sy(right.y)} stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" />
          </g>
        )}

        {table && (
          <g>
            <rect x="500" y={TOP + 40} width="150" height="196" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <text x="545" y={TOP + 76} textAnchor="middle" fontSize="20" fontWeight="700" fill="#cbd5e1">x</text>
            <text x="605" y={TOP + 76} textAnchor="middle" fontSize="20" fontWeight="700" fill="#cbd5e1">y</text>
            <line x1="512" y1={TOP + 90} x2="638" y2={TOP + 90} stroke="#475569" strokeWidth="2" />
            <line x1="575" y1={TOP + 52} x2="575" y2={TOP + 224} stroke="#475569" strokeWidth="2" />
            {rows.map((r, i) => (
              <g key={i}>
                <text x="545" y={TOP + 128 + i * 42} textAnchor="middle" fontSize="22" fill="#e2e8f0">{r.x}</text>
                <text x="605" y={TOP + 128 + i * 42} textAnchor="middle" fontSize="22" fill="#e2e8f0">{r.y}</text>
              </g>
            ))}
          </g>
        )}

        {pin('pin-a', 'A', ptA, '#f472b6', 'A')}
        {pin('pin-b', 'B', ptB, '#818cf8', 'B')}
      </svg>
    </Panel>
  );
}
