// Through zero (7.RP.A.2). A first-quadrant grid with plotted dots (or, on the transfer, a table and three loose dots
// the child plots). The child lays a straight line by dragging its two pins; the line runs edge to edge across the
// grid, so once it lies on the dots the child sees where it meets the axes: at the corner (0, 0) or somewhere else.
// Nothing marks the corner and nothing changes when the line lies on the dots: Check judges the line.
// Say and show: the child says whether the relationship is proportional (yes or no); Check judges the line (and, on
// the transfer, the plotted table).
function Display({ params, lumina }) {
  const parsePts = s => String(s || '').split(';').map(p => p.split(',').map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite)).map(([x, y]) => ({ x, y }));
  const dots = parsePts(params.dots != null ? params.dots : '1,2;2,4;3,6');
  const table = parsePts(params.table || '');
  const isTable = table.length > 0;
  // The points the relationship is made of: the plotted dots, or the table's rows.
  const data = isTable ? table : dots;
  // `anyTwo`: a curve has no line through all its points, so the line must lie on any two of them (the child's
  // choice). For points in a straight row, two on the line puts all of them on it, so the goal reads the same.
  const anyTwo = !!params.anyTwo;
  const startPins = parsePts(params.pins || '5,1;7,2');

  const XMAX = 8, YMAX = 12;
  const PL = 56, PT = 24, UY = 28;
  const PR = isTable ? 456 : 648;
  const UX = (PR - PL) / XMAX;
  const PB = PT + YMAX * UY;
  const H = PB + 40;
  const sx = x => PL + x * UX, sy = y => PB - y * UY;
  const gx = px => Math.max(0, Math.min(XMAX, Math.round((px - PL) / UX)));
  const gy = py => Math.max(0, Math.min(YMAX, Math.round((PB - py) / UY)));
  const inPlot = p => p.x > PL - UX / 2 && p.x < PR + UX / 2 && p.y > PT - UY / 2 && p.y < PB + UY / 2;

  const [pins, setPins] = useState([startPins[0] || { x: 5, y: 1 }, startPins[1] || { x: 7, y: 2 }]);
  // Transfer: three loose dots, null while in the tray.
  const [placed, setPlaced] = useState(table.map(() => null));
  const [drag, setDrag] = useState(null); // { kind: 'pin'|'token', i, x, y }
  const svgRef = useRef(null);

  const [A, B] = pins;
  const distinct = A.x !== B.x || A.y !== B.y;
  const onLine = p => distinct && (B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x) === 0;
  const plottedRight = !isTable || table.every(t => placed.some(q => q && q.x === t.x && q.y === t.y));
  const met = distinct && plottedRight && (anyTwo ? data.filter(onLine).length >= 2 : data.every(onLine));

  // The key: through (0, 0) with one rate, i.e. every point is y = k x for one k.
  const collinear = data.every(p => (data[1].x - data[0].x) * (p.y - data[0].y) - (data[1].y - data[0].y) * (p.x - data[0].x) === 0);
  const k = data.find(p => p.x !== 0);
  const proportional = !!k && data.every(p => p.y * k.x === k.y * p.x);
  const throughZero = collinear
    ? (data[1].x - data[0].x) * (0 - data[0].y) - (data[1].y - data[0].y) * (0 - data[0].x) === 0
    : data.some(p => p.x === 0 && p.y === 0);

  useEffect(() => {
    const key = proportional ? 'yes' : 'no';
    const misrules = [];
    if (collinear) misrules.push({ says: 'yes', because: 'thought any straight line shows a proportional relationship, even one that does not start at zero' });
    if (!collinear && throughZero) misrules.push({ says: 'yes', because: 'thought a graph that starts at zero is proportional, even when it curves and the rate changes' });
    const seen = new Set();
    lumina.answer(key, misrules.filter(m => m.says !== key && !seen.has(m.says) && seen.add(m.says)), ['yes', 'no']);
  }, []);

  useEffect(() => {
    lumina.goal(met);
    const pt = p => '(' + p.x + ', ' + p.y + ')';
    lumina.scene({
      grid: 'x from 0 to ' + XMAX + ', y from 0 to ' + YMAX,
      ...(isTable
        ? { table: table.map(p => 'x ' + p.x + ', y ' + p.y).join('; '), dotsPlottedByChild: placed.filter(Boolean).map(pt).join(', ') || 'none yet', dotsInTray: placed.filter(q => !q).length }
        : { plottedDots: dots.map(pt).join(', '), dotsLookLike: collinear ? 'they lie in a straight row' : 'they bend upward, not in a straight row' }),
      childsLinePins: distinct ? pt(A) + ' and ' + pt(B) : 'both pins on one point (no line)',
    });
  }, [pins, placed]);

  const grabPin = (i, e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ kind: 'pin', i }); };
  const grabToken = (i, e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ kind: 'token', i }); };
  const move = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e);
    if (drag.kind === 'pin') setPins(ps => ps.map((q, j) => (j === drag.i ? { x: gx(p.x), y: gy(p.y) } : q)));
    else setDrag({ ...drag, x: p.x, y: p.y });
  };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e);
    if (drag.kind === 'token') {
      const at = inPlot(p) ? { x: gx(p.x), y: gy(p.y) } : null;
      setPlaced(list => list.map((q, j) => (j === drag.i ? at : q)));
    }
    setDrag(null);
  };

  // The child's line, extended across the whole grid (clipped to the plot).
  const lineEnds = () => {
    if (!distinct) return null;
    if (A.x === B.x) return [sx(A.x), sy(0), sx(A.x), sy(YMAX)];
    const m = (B.y - A.y) / (B.x - A.x), b = A.y - m * A.x;
    return [sx(-1), sy(b - m), sx(XMAX + 1), sy(b + m * (XMAX + 1))];
  };
  const L = lineEnds();

  const TRAY = { x: 488, y: 236, w: 176, h: 76 };
  const tokenAt = i => {
    if (drag && drag.kind === 'token' && drag.i === i && drag.x !== undefined) return { x: drag.x, y: drag.y };
    const q = placed[i];
    return q ? { x: sx(q.x), y: sy(q.y) } : { x: TRAY.x + 34 + i * 54, y: TRAY.y + TRAY.h / 2 };
  };

  const xs = Array.from({ length: XMAX + 1 }, (_, i) => i), ys = Array.from({ length: YMAX + 1 }, (_, i) => i);
  return (
    <Panel title="Rate Graph" caption={isTable ? 'Drag a dot from the tray onto the grid. Drag the two blue pins to move the line.' : 'Drag the two blue pins to move the line.'}>
      <svg ref={svgRef} viewBox={'0 0 680 ' + H} onPointerMove={move} onPointerUp={drop} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />
        <defs><clipPath id="plot-clip"><rect x={PL} y={PT} width={PR - PL} height={PB - PT} /></clipPath></defs>
        <rect x={PL} y={PT} width={PR - PL} height={PB - PT} fill="#1e293b" />
        {xs.map(x => <line key={'gx' + x} x1={sx(x)} x2={sx(x)} y1={PT} y2={PB} stroke="#334155" strokeWidth="1" />)}
        {ys.map(y => <line key={'gy' + y} y1={sy(y)} y2={sy(y)} x1={PL} x2={PR} stroke="#334155" strokeWidth="1" />)}
        <line x1={PL} x2={PR} y1={PB} y2={PB} stroke="#94a3b8" strokeWidth="2.5" />
        <line x1={PL} x2={PL} y1={PT} y2={PB} stroke="#94a3b8" strokeWidth="2.5" />
        {xs.map(x => <text key={'tx' + x} x={sx(x)} y={PB + 22} textAnchor="middle" fontSize="15" fill="#94a3b8">{x}</text>)}
        {ys.map(y => <text key={'ty' + y} x={PL - 10} y={sy(y) + 5} textAnchor="end" fontSize="15" fill="#94a3b8">{y}</text>)}
        <text x={PR} y={PB + 22} dx="18" textAnchor="start" fontSize="16" fill="#cbd5e1">x</text>
        <text x={PL} y={PT - 6} dx="10" fontSize="16" fill="#cbd5e1">y</text>

        {L && <line x1={L[0]} y1={L[1]} x2={L[2]} y2={L[3]} stroke="#22d3ee" strokeWidth="3" clipPath="url(#plot-clip)" />}

        {!isTable && dots.map((p, i) => <circle key={'d' + i} cx={sx(p.x)} cy={sy(p.y)} r="8" fill="#fbbf24" stroke="#0f172a" strokeWidth="2" />)}

        {isTable && (
          <g>
            <rect x="488" y="24" width="176" height={44 + table.length * 40} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <text x="532" y="54" textAnchor="middle" fontSize="20" fill="#e2e8f0">x</text>
            <text x="620" y="54" textAnchor="middle" fontSize="20" fill="#e2e8f0">y</text>
            <line x1="576" x2="576" y1="34" y2={58 + table.length * 40} stroke="#475569" strokeWidth="2" />
            <line x1="498" x2="654" y1="66" y2="66" stroke="#475569" strokeWidth="2" />
            {table.map((p, i) => (
              <g key={'r' + i}>
                <text x="532" y={96 + i * 40} textAnchor="middle" fontSize="20" fill="#e2e8f0">{p.x}</text>
                <text x="620" y={96 + i * 40} textAnchor="middle" fontSize="20" fill="#e2e8f0">{p.y}</text>
              </g>
            ))}
            <rect x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx="12" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
            {table.map((_, i) => { const p = tokenAt(i); return (
              <g key={'t' + i} id={'dot-' + i} onPointerDown={e => grabToken(i, e)} style={{ cursor: 'grab', touchAction: 'none' }}>
                <circle cx={p.x} cy={p.y} r="23" fill="transparent" />
                <circle cx={p.x} cy={p.y} r="9" fill="#fbbf24" stroke="#64748b" strokeWidth="2" />
              </g>); })}
          </g>
        )}

        {pins.map((p, i) => (
          <g key={'p' + i} id={'pin-' + (i ? 'b' : 'a')} onPointerDown={e => grabPin(i, e)} style={{ cursor: 'grab', touchAction: 'none' }}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r="23" fill="transparent" />
            <circle cx={sx(p.x)} cy={sy(p.y)} r="13" fill="rgba(34,211,238,0.3)" stroke="#22d3ee" strokeWidth="3" />
          </g>
        ))}
      </svg>
    </Panel>
  );
}
