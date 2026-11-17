// Start at Zero (2.MD.A.1). A ribbon lies on a ruler. The child may slide the ribbon along the ruler and colours the
// unit spaces the ribbon covers, one tap per space. Length is the number of units between the two ends, so the work
// is the units under the ribbon, wherever it lies. Say and show: the length is one sayable whole number; the child
// shows it by colouring exactly the spaces under the ribbon. Nothing is counted for the child.
function Display({ params, lumina }) {
  const rulerFrom = Number(params.rulerFrom ?? 0), rulerTo = Number(params.rulerTo ?? 10);
  const startAt = Number(params.ribbonFrom ?? 0), len = Number(params.length ?? 4);
  const broken = !!params.broken, half = !!params.halfMarks;

  const [at, setAt] = useState(startAt); // the ruler number under the ribbon's left end
  const [lit, setLit] = useState([]); // the left numbers of the coloured unit spaces
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const U = 60, units = rulerTo - rulerFrom, X0 = (680 - units * U) / 2;
  const xOf = v => X0 + (v - rulerFrom) * U;
  const step = half ? 0.5 : 1;
  const RY = 104, RH = 64; // ruler body top and height
  const BY = 36, BH = 44; // ribbon top and height

  useEffect(() => {
    const key = len, far = startAt + len;
    const marks = half ? 2 * len + 1 : len + 1;
    const misrules = [
      { says: far, because: 'read the number at the far end, not the units between the ends' },
      { says: marks, because: 'counted the marks, not the spaces between them' },
      half ? { says: 2 * len, because: 'counted the half spaces as whole units' } : null,
    ].filter((m, i, all) => m && m.says !== key && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    const under = Number.isInteger(at) ? Array.from({ length: len }, (_, i) => at + i) : null;
    const same = !!under && lit.length === under.length && under.every(k => lit.includes(k));
    lumina.goal(same);
    const sorted = lit.slice().sort((a, b) => a - b);
    lumina.scene({
      rulerStartsAt: rulerFrom, rulerEndsAt: rulerTo, rulerBrokenOffAtTheLeft: broken, halfUnitMarks: half,
      ribbonLeftEndAt: at, ribbonRightEndAt: at + len,
      spacesColoured: sorted.map(k => k + ' to ' + (k + 1)),
    });
  }, [at, lit]);

  const toggle = k => setLit(l => (l.includes(k) ? l.filter(x => x !== k) : l.concat(k)));

  const grab = e => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    setDrag({ startX: p.x, from: at, dx: 0 });
  };
  const move = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e);
    setDrag({ ...drag, dx: p.x - drag.startX });
  };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e);
    const raw = drag.from + (p.x - drag.startX) / U;
    const snapped = Math.round(raw / step) * step;
    setAt(Math.max(rulerFrom, Math.min(rulerTo - len, snapped)));
    setDrag(null);
  };

  const ribbonX = drag
    ? Math.max(xOf(rulerFrom), Math.min(xOf(rulerTo - len), xOf(drag.from) + drag.dx))
    : xOf(at);

  const ticks = [];
  for (let v = rulerFrom; v <= rulerTo + 1e-9; v += step) ticks.push(v);

  // The broken left edge: wood teeth past the first mark instead of a straight end.
  const jag = () => {
    const x = xOf(rulerFrom), pts = [x + ',' + RY];
    for (let i = 0; i <= 6; i++) pts.push((x - (i % 2 ? 6 : 18)) + ',' + (RY + (RH * i) / 6));
    pts.push(x + ',' + (RY + RH));
    return pts.join(' ');
  };

  return (
    <Panel title="Ribbon Ruler" caption="Drag the ribbon to slide it. Tap a space on the ruler to colour it, or tap again to clear it.">
      <svg ref={svgRef} viewBox="0 0 680 240" onPointerMove={move} onPointerUp={drop}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="240" fill="#0f172a" />

        {/* The ruler body. */}
        <rect x={xOf(rulerFrom) - (broken ? 0 : 12)} y={RY} width={units * U + (broken ? 12 : 24)} height={RH} rx={broken ? 0 : 8} fill="#b45309" stroke="#78350f" strokeWidth="2" />
        {broken && <polygon points={jag()} fill="#b45309" stroke="#78350f" strokeWidth="2" />}

        {/* The unit spaces, each a tap target. */}
        {Array.from({ length: units }, (_, i) => {
          const k = rulerFrom + i, on = lit.includes(k);
          return (
            <rect key={'s' + k} id={'space-' + k} x={xOf(k) + 5} y={RY + 5} width={U - 10} height={RH - 10} rx="6"
              fill={on ? '#22d3ee' : '#d97706'} fillOpacity={on ? 0.85 : 0.0001} stroke={on ? '#e0f2fe' : 'none'} strokeWidth="2"
              onPointerDown={() => toggle(k)} style={{ cursor: 'pointer' }} />
          );
        })}

        {/* Marks and the whole numbers. */}
        {ticks.map(v => {
          const whole = Number.isInteger(v);
          return (
            <g key={'t' + v} style={{ pointerEvents: 'none' }}>
              <line x1={xOf(v)} y1={RY} x2={xOf(v)} y2={RY + (whole ? RH : 22)} stroke="#1c1917" strokeWidth={whole ? 3 : 2} />
              {whole && <text x={xOf(v)} y={RY + RH + 30} textAnchor="middle" fontSize="22" fontWeight="700" fill="#e2e8f0">{v}</text>}
            </g>
          );
        })}

        {/* Guide lines down from the ribbon's ends. */}
        <line x1={ribbonX} y1={BY + BH} x2={ribbonX} y2={RY} stroke="#f472b6" strokeWidth="2" strokeDasharray="5 4" style={{ pointerEvents: 'none' }} />
        <line x1={ribbonX + len * U} y1={BY + BH} x2={ribbonX + len * U} y2={RY} stroke="#f472b6" strokeWidth="2" strokeDasharray="5 4" style={{ pointerEvents: 'none' }} />

        {/* The ribbon. */}
        <g id="ribbon" onPointerDown={grab} style={{ cursor: 'grab', touchAction: 'none' }}>
          <rect x={ribbonX} y={BY} width={len * U} height={BH} rx="6" fill="#ec4899" stroke="#fbcfe8" strokeWidth="2" />
          {[-8, 0, 8].map(d => (
            <circle key={d} cx={ribbonX + (len * U) / 2 + d} cy={BY + BH / 2} r="2.5" fill="#fdf2f8" />
          ))}
        </g>
      </svg>
    </Panel>
  );
}
