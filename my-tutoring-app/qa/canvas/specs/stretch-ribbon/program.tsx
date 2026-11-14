function Display({ params, lumina }) {
  const n = Number(params.start) || 8;
  const cardsIn = Array.isArray(params.cards) && params.cards.length ? params.cards : ['3/4', '3/2'];
  const ticks = params.ticks || 'numbers'; // 'numbers' | 'marks' | 'none'
  const judge = params.judge || 'exact'; // 'exact' | 'compare'
  const step = Number(params.step) || 1;

  const parse = s => {
    const m = String(s).trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
    if (m) return (m[1] ? Number(m[1]) : 0) + Number(m[2]) / Number(m[3]);
    return Number(s);
  };
  const cards = cardsIn.map(s => ({ label: String(s), f: parse(s) }));

  const W = 680, H = 400;
  const X0 = 50, X1 = 640, MAX = n * 2;
  const xOf = v => X0 + ((X1 - X0) * v) / MAX;
  const vOf = x => Math.max(0, Math.min(MAX, ((x - X0) / (X1 - X0)) * MAX));
  const LINE_Y = 340, START_Y = 128, LANE0 = 172, LANE_GAP = 40;
  const TRAY_Y = 30;

  const [at, setAt] = useState(() => cards.map(() => null)); // value on the line, or null in the tray
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const near = (a, b) => Math.abs(a - b) < 1e-6;
  useEffect(() => {
    const placed = at.every(v => v !== null);
    let met = false;
    if (placed && judge === 'exact') met = cards.every((c, i) => near(at[i], c.f * n));
    if (placed && judge === 'compare') {
      const sideOk = cards.every((c, i) => Math.sign(Math.round((c.f - 1) * 1e6)) === Math.sign(Math.round((at[i] - n) * 1e6)));
      let orderOk = true;
      for (let i = 0; i < cards.length; i++) for (let j = 0; j < cards.length; j++) {
        if (cards[i].f < cards[j].f - 1e-9 && !(at[i] < at[j] - 1e-9)) orderOk = false;
      }
      met = sideOk && orderOk;
    }
    lumina.goal(met);
    const where = v => (v === null ? 'not placed yet' : near(v, n) ? 'ends level with the start ribbon' : v < n ? 'ends short of the start ribbon' : 'ends past the start ribbon');
    lumina.scene({
      startRibbon: ticks === 'none' ? 'drawn from 0, length not marked' : `${n} long`,
      tickMarks: ticks,
      cards: cards.map((c, i) => ({
        card: '× ' + c.label,
        ribbon: where(at[i]),
        ...(ticks === 'numbers' && at[i] !== null ? { endsAt: at[i] } : {}),
      })),
    });
  }, [at]);

  const trayX = i => 84 + i * 112;
  const grab = (i, e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    setDrag({ i, x: p.x, y: p.y });
  };
  const move = e => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag({ ...drag, x: p.x, y: p.y }); } };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e), i = drag.i;
    setDrag(null);
    if (p.y < 104) { setAt(a => a.map((v, k) => (k === i ? null : v))); return; }
    const v = Math.round(vOf(p.x) / step) * step;
    setAt(a => a.map((old, k) => (k === i ? Math.round(v * 1e6) / 1e6 : old)));
  };

  const cardBox = (c, i, x, y, small, extra) => (
    <g key={'card' + i} id={'card-' + i} transform={`translate(${x}, ${y})`} {...extra}>
      <rect x={small ? -38 : -46} y={small ? -17 : -24} width={small ? 76 : 92} height={small ? 34 : 48} rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <text y={small ? 6 : 8} textAnchor="middle" fontSize={small ? 18 : 22} fontWeight="700" fill="#e2e8f0">× {c.label}</text>
    </g>
  );

  const LANE_COLORS = ['#22d3ee', '#f472b6', '#34d399', '#818cf8', '#fb7185'];
  const tickVals = [];
  for (let v = 0; v <= MAX + 1e-9; v += 1) tickVals.push(Math.round(v * 1e6) / 1e6);
  const targetVals = [];
  for (let v = 0; v <= MAX + 1e-9; v += step) targetVals.push(Math.round(v * 1e6) / 1e6);

  return (
    <Panel title="Stretch and Shrink" caption="Drag a card onto the line to stretch or shrink a copy of the ribbon. Drag it back up to take it off.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="14" y={TRAY_Y - 8} width={W - 28} height="72" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />

        {/* the start ribbon */}
        <text x={X0 - 8} y={START_Y + 6} textAnchor="end" fontSize="28">🧶</text>
        <rect x={X0} y={START_Y - 9} width={xOf(n) - X0} height="18" rx="5" fill="#fbbf24" />
        <line x1={xOf(n)} y1={START_Y - 16} x2={xOf(n)} y2={LINE_Y} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.7" />

        {/* lanes and the copies the child made */}
        {cards.map((c, i) => {
          const y = LANE0 + i * LANE_GAP;
          const v = at[i];
          const held = drag && drag.i === i;
          return (
            <g key={'lane' + i}>
              <line x1={X0} y1={y} x2={X1} y2={y} stroke="#334155" strokeWidth="1" />
              {v !== null && !held && <rect x={X0} y={y - 7} width={Math.max(0, xOf(v) - X0)} height="14" rx="5" fill={LANE_COLORS[i % LANE_COLORS.length]} opacity="0.85" />}
            </g>
          );
        })}

        {/* the number line */}
        <line x1={X0} y1={LINE_Y} x2={X1} y2={LINE_Y} stroke="#64748b" strokeWidth="3" />
        {ticks !== 'none' && tickVals.map(v => (
          <line key={'t' + v} x1={xOf(v)} y1={LINE_Y - 8} x2={xOf(v)} y2={LINE_Y + 8} stroke="#94a3b8" strokeWidth="2" />
        ))}
        {(ticks === 'numbers' ? tickVals : [0, n]).map(v => (
          <text key={'l' + v} x={xOf(v)} y={LINE_Y + 30} textAnchor="middle" fontSize={v === 0 || v === n ? 16 : 14} fill={v === n ? '#fbbf24' : '#cbd5e1'}>{ticks === 'none' && v === n ? 'start' : v}</text>
        ))}
        {targetVals.map(v => <circle key={'g' + v} id={'tick-' + String(v).replace('.', '_')} cx={xOf(v)} cy={LINE_Y} r="2" fill="transparent" pointerEvents="none" />)}

        {/* cards: in the tray, at the end of their copy, or in the hand */}
        {cards.map((c, i) => {
          const held = drag && drag.i === i && drag.x !== undefined;
          const v = at[i];
          const x = held ? drag.x : v === null ? trayX(i) : xOf(v) + 44;
          const y = held ? drag.y : v === null ? TRAY_Y + 28 : LANE0 + i * LANE_GAP;
          return cardBox(c, i, x, y, v !== null && !held, {
            onPointerDown: e => grab(i, e),
            onPointerUp: drop,
            style: { cursor: 'grab', touchAction: 'none' },
          });
        })}
      </svg>
    </Panel>
  );
}
