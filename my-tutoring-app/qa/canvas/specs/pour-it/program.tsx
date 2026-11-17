// Pour It (K.MD.A.2, 2-PS1). Juice in glasses of different shapes, measured in cups the child pours. A glass pours
// only into the row of cups (one cup each) and a cup pours only into a glass or back into the jug, so every amount that
// moves between glasses is counted in cups by the child. Rule: pouring into a different container does not change
// how much there is. Misrule: taller means more. No glass has level marks; the only count is the cups the child fills.
// Two goals (params.mode):
//   'same' (default): put as much juice in the other glass(es) as the first glass holds. Key: the number of cups.
//          The misrule fills each glass to the first glass's height, which in a wider or second glass is a different count.
//   'move': move all of the first glass into the other one through the cups, then say more, less or same.
//          The misrule reads the lower level (or the longer clay snake) as less (or more).
// params.material 'clay' redraws the world as a lump of clay, balls of clay and a long snake mold (the transfer item).
function Display({ params, lumina }) {
  const clay = params.material === 'clay';
  const mode = params.mode === 'move' ? 'move' : 'same';
  const hasJug = params.jug !== false && !clay;
  const SLOTS = Number(params.cups) || 10;
  const raw = Array.isArray(params.glasses) && params.glasses.length >= 2 ? params.glasses : [
    { name: 'tall glass', looks: 'tall and thin', w: 1, cap: 8, start: 5, x: 200 },
    { name: 'wide glass', looks: 'short and wide', w: 2, cap: 16, start: 0, x: 400 },
  ];
  const glasses = raw.map((g, i) => ({
    name: String(g.name || 'glass ' + (i + 1)), looks: String(g.looks || ''), w: Number(g.w) || 1, cap: Number(g.cap) || 8,
    start: Number(g.start) || 0, x: Number(g.x) || 160 + i * 180, y: Number(g.y) || 0, dir: g.dir === 'right' ? 'right' : 'up',
  }));
  const N = glasses[0].start;
  const targets = glasses.slice(1);

  const U = 24, GW = 48, BASE = 300;
  const geo = (g) => (g.dir === 'right'
    ? { x: g.x, y: g.y - (GW * g.w) / 2, w: (g.cap * U) / g.w, h: GW * g.w }
    : { x: g.x, y: BASE - (g.cap * U) / g.w, w: GW * g.w, h: (g.cap * U) / g.w });
  const extent = (g, amt) => (amt * U) / g.w;

  const [amts, setAmts] = useState(glasses.map(g => g.start));
  const [cups, setCups] = useState(Array.from({ length: SLOTS }, () => false));
  const [poured, setPoured] = useState(glasses.map(() => 0));
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    if (mode === 'move') {
      const t = targets[0], src = extent(glasses[0], N), tgt = extent(t, N);
      const says = tgt > src ? 'more' : tgt < src ? 'less' : null;
      const because = clay
        ? 'thinks the longer snake has more clay, but rolling it long does not add any clay'
        : says === 'less'
          ? 'thinks the lower level means less juice, but the same cups went in'
          : 'thinks the higher level means more juice, but the same cups went in';
      lumina.answer('same', says ? [{ says, because }] : [], ['more', 'less', 'same']);
      return;
    }
    const sameHeight = targets.reduce((s, t) => s + (N * t.w) / glasses[0].w, 0);
    const because = targets.length > 1
      ? 'filled each glass up to the height of the first glass: thinks a taller level means more juice'
      : 'filled the glass up to the height of the first glass: thinks a taller level means more juice';
    const misrules = [{ says: sameHeight, because }].filter(m => Number.isInteger(m.says) && m.says > 0 && m.says !== N);
    lumina.answer(N, misrules);
  }, []);

  useEffect(() => {
    const inTargets = amts.slice(1);
    const sum = inTargets.reduce((s, a) => s + a, 0);
    const met = mode === 'move'
      ? amts[0] === 0 && cups.every(c => !c) && sum === N
      : sum === N && inTargets.every(a => a > 0);
    lumina.goal(met);
    const stuff = clay ? 'clay' : 'juice';
    lumina.scene({
      world: clay ? 'a pot with a lump of clay, a long mold to press a clay snake into, and a tray of spots for clay balls'
        : 'glasses of juice, a row of small cups' + (hasJug ? ', and a jug of juice' : ''),
      containers: glasses.map((g, i) => ({
        name: g.name, looks: g.looks,
        holds: amts[i] === 0 ? 'nothing' : stuff,
        [g.dir === 'right' ? 'snakeLengthPx' : 'levelHeightPx']: Math.round(extent(g, amts[i])),
        ...(i > 0 ? { [clay ? 'ballsPressedInByChild' : 'cupsPouredInByChild']: poured[i] } : {}),
      })),
      [clay ? 'fullBallSpots' : 'fullCups']: cups.filter(Boolean).length,
      [clay ? 'emptyBallSpots' : 'emptyCups']: cups.filter(c => !c).length,
    });
  }, [amts, cups]);

  const TRAY = { x: 20, y: 336, w: 640, h: 84 };
  const slotX = (i) => 40 + i * 60 + (600 - SLOTS * 60) / 2;
  const JUG = { x: 18, y: 70, w: 100, h: 160 };
  const hit = (r, p, pad) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;

  const grab = (kind, i, e) => {
    if (kind === 'glass' && amts[i] === 0) return;
    if (kind === 'cup' && !cups[i]) return;
    svgRef.current.setPointerCapture(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    setDrag({ kind, i, gx: p.x, gy: p.y, x: p.x, y: p.y });
  };
  const move = (e) => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag({ ...drag, x: p.x, y: p.y }); } };
  const drop = (e) => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e), d = drag;
    setDrag(null);
    if (d.kind === 'cup') {
      const gi = glasses.findIndex(g => hit(geo(g), p, 26));
      if (gi >= 0 && amts[gi] < glasses[gi].cap) {
        setAmts(a => a.map((v, k) => (k === gi ? v + 1 : v)));
        setPoured(a => a.map((v, k) => (k === gi ? v + 1 : v)));
        setCups(c => c.map((v, k) => (k === d.i ? false : v)));
      } else if (hasJug && hit(JUG, p, 10)) setCups(c => c.map((v, k) => (k === d.i ? false : v)));
    } else if (d.kind === 'glass') {
      if (!hit(TRAY, p, 16)) return;
      let left = amts[d.i];
      const next = cups.map(v => { if (!v && left > 0) { left--; return true; } return v; });
      setCups(next);
      setAmts(a => a.map((v, k) => (k === d.i ? left : v)));
    } else if (d.kind === 'jug') {
      if (hit(TRAY, p, 16)) setCups(c => c.map(() => true));
    }
  };
  const off = (kind, i) => (drag && drag.kind === kind && drag.i === i ? { dx: drag.x - drag.gx, dy: drag.y - drag.gy } : { dx: 0, dy: 0 });

  const LIQ = clay ? '#c2703d' : '#fb923c', LIQ_EDGE = clay ? '#7c3f1d' : '#c2410c';
  const glass = (g, i) => {
    const r = geo(g), o = off('glass', i), ext = extent(g, amts[i]), can = amts[i] > 0;
    const fill = g.dir === 'right'
      ? <rect x={r.x + 2} y={r.y + 2} width={Math.max(0, ext - 4)} height={r.h - 4} rx={(r.h - 4) / 2} fill={LIQ} stroke={LIQ_EDGE} strokeWidth="2" />
      : <rect x={r.x + 3} y={BASE - ext} width={r.w - 6} height={Math.max(0, ext - 3)} fill={LIQ} opacity={clay ? 1 : 0.9} />;
    const label = g.dir === 'right'
      ? <text x={r.x + r.w / 2} y={r.y + r.h + 26} textAnchor="middle" fontSize="16" fill="#cbd5e1">{g.name}</text>
      : <text x={r.x + r.w / 2} y={BASE + 24} textAnchor="middle" fontSize="16" fill="#cbd5e1">{g.name}</text>;
    return (
      <g key={'g' + i} id={'glass-' + 'abcd'[i]} transform={`translate(${o.dx}, ${o.dy})`} onPointerDown={e => grab('glass', i, e)}
        style={{ cursor: can ? 'grab' : 'default', touchAction: 'none' }}>
        <rect x={r.x - 14} y={r.y - 14} width={r.w + 28} height={r.h + 28} fill="transparent" />
        {fill}
        {g.dir === 'right'
          ? <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.h / 2} fill="none" stroke="#94a3b8" strokeWidth="2.5" />
          : clay
            ? <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="8" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
            : <path d={`M ${r.x} ${r.y} L ${r.x} ${BASE} L ${r.x + r.w} ${BASE} L ${r.x + r.w} ${r.y}`} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round" />}
        {label}
      </g>
    );
  };

  const cup = (full, i) => {
    const o = off('cup', i), x = slotX(i), y = TRAY.y + 14;
    if (clay) return (
      <g key={'c' + i} id={'cup-' + i} transform={`translate(${o.dx}, ${o.dy})`} onPointerDown={e => grab('cup', i, e)} style={{ cursor: full ? 'grab' : 'default', touchAction: 'none' }}>
        <rect x={x - 4} y={y - 6} width="56" height="62" fill="transparent" />
        {full ? <circle cx={x + 24} cy={y + 26} r="20" fill={LIQ} stroke={LIQ_EDGE} strokeWidth="2" />
          : <circle cx={x + 24} cy={y + 26} r="20" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />}
      </g>
    );
    return (
      <g key={'c' + i} id={'cup-' + i} transform={`translate(${o.dx}, ${o.dy})`} onPointerDown={e => grab('cup', i, e)} style={{ cursor: full ? 'grab' : 'default', touchAction: 'none' }}>
        <rect x={x - 4} y={y - 6} width="56" height="62" fill="transparent" />
        {full && <path d={`M ${x + 6} ${y + 16} L ${x + 42} ${y + 16} L ${x + 38} ${y + 48} L ${x + 10} ${y + 48} Z`} fill={LIQ} />}
        <path d={`M ${x + 2} ${y + 4} L ${x + 46} ${y + 4} L ${x + 40} ${y + 50} L ${x + 8} ${y + 50} Z`} fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    );
  };

  const jug = () => {
    const o = off('jug', 0), J = JUG;
    return (
      <g id="jug" transform={`translate(${o.dx}, ${o.dy})`} onPointerDown={e => grab('jug', 0, e)} style={{ cursor: 'grab', touchAction: 'none' }}>
        <rect x={J.x - 6} y={J.y - 10} width={J.w + 30} height={J.h + 20} fill="transparent" />
        <path d={`M ${J.x + 8} ${J.y + 40} L ${J.x + J.w - 8} ${J.y + 40} L ${J.x + J.w - 4} ${J.y + J.h} L ${J.x + 4} ${J.y + J.h} Z`} fill={LIQ} opacity="0.9" />
        <path d={`M ${J.x} ${J.y + 6} L ${J.x - 4} ${J.y} M ${J.x} ${J.y + 6} L ${J.x + J.w} ${J.y + 6} L ${J.x + J.w + 4} ${J.y + J.h} L ${J.x - 4} ${J.y + J.h} Z`} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round" />
        <path d={`M ${J.x + J.w + 2} ${J.y + 30} q 26 10 4 70`} fill="none" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
        <text x={J.x + J.w / 2} y={J.y + J.h + 26} textAnchor="middle" fontSize="16" fill="#cbd5e1">jug</text>
      </g>
    );
  };

  // Draw the thing being dragged last, so it passes over the others.
  const order = glasses.map((g, i) => i).sort((a, b) => (drag && drag.kind === 'glass' ? (a === drag.i) - (b === drag.i) : 0));
  const cupOrder = cups.map((c, i) => i).sort((a, b) => (drag && drag.kind === 'cup' ? (a === drag.i) - (b === drag.i) : 0));
  // The stage starts just above the tallest thing drawn, so a problem of low glasses (the dish, the clay) has no empty band.
  const TOP = Math.max(0, Math.min(...glasses.map(g => geo(g).y), hasJug ? JUG.y - 10 : 1e9) - 34);
  const caption = clay
    ? 'Drag the clay onto the tray to make balls. Drag a ball into a mold to press it in.'
    : 'Drag a glass onto the cups to pour it out. Drag a cup onto a glass to pour it in.' + (hasJug ? ' Drag the jug onto the cups to fill them.' : '');

  return (
    <Panel title={clay ? 'Clay Snake' : 'Pour It'} caption={caption}>
      <svg ref={svgRef} viewBox={`0 ${TOP} 680 ${430 - TOP}`} onPointerMove={move} onPointerUp={drop} onPointerCancel={() => setDrag(null)}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect y={TOP} width="680" height={430 - TOP} fill="#0f172a" />
        <line x1={hasJug ? 130 : 20} y1={BASE + 2} x2="670" y2={BASE + 2} stroke="#475569" strokeWidth="3" />
        <rect id="tray" x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {hasJug && !(drag && drag.kind === 'jug') && jug()}
        {cupOrder.map(i => cup(cups[i], i))}
        {order.map(i => glass(glasses[i], i))}
        {hasJug && drag && drag.kind === 'jug' && jug()}
      </svg>
    </Panel>
  );
}
