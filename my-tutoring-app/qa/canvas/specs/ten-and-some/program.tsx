// Ten and Some (K.NBT.A.1). A heap of counters lies in a basket (seeded cells, jittered, never in rows, so the count
// is not read at a glance). The child drags counters into a ten frame (each drop fills the next empty cell) and puts
// the rest loose on the mat beside it. On a card problem a numeral card says the number to build and the basket holds
// more than enough; on a count problem there is no card and every counter must leave the basket.
// Say and show: the child says the number; Check judges the build (every frame full, the right number loose).
// Misrules are computed: a full frame read as one ("1 and 4" makes five), and only the loose counters counted.
function Display({ params, lumina }) {
  const n = Number(params?.n ?? 14); // counters in the basket at the start
  const card = Number(params?.card ?? 0); // the number on the card, 0 for no card
  const frames = Number(params?.frames ?? 1);
  const color = String(params?.color ?? 'red');

  const key = card > 0 ? card : n;
  const COLORS = { red: ['#f87171', '#fecaca'], blue: ['#60a5fa', '#bfdbfe'], amber: ['#fbbf24', '#fde68a'], green: ['#34d399', '#a7f3d0'], pink: ['#f472b6', '#fbcfe8'] };
  const [fill, rim] = COLORS[color] || COLORS.red;

  // Layout. Left column: the basket. Right column: the frames, then the loose mat. The card sits in the shorter column.
  const M = 12, GAP = 14;
  const PCELL = 52, PCOLS = 5;
  const prows = Math.max(3, Math.min(6, Math.ceil((n * 1.5) / PCOLS)));
  const PILE_W = PCOLS * PCELL + 20, PILE_H = prows * PCELL + 20;
  const RX = M + PILE_W + 20, RW = 680 - RX - M;
  const FCELL = 62, FW = 5 * FCELL + 16, FH = 2 * FCELL + 16;
  const TW = FW, TH = 132;
  const CARD_W = 150, CARD_H = 96;
  const rightBody = frames * (FH + GAP) + TH;
  const cardRight = card > 0 && frames === 1;
  const cardLeft = card > 0 && !cardRight;
  const leftH = (cardLeft ? CARD_H + GAP : 0) + PILE_H;
  const rightH = (cardRight ? CARD_H + GAP : 0) + rightBody;
  const VH = M * 2 + Math.max(leftH, rightH);

  const pileY = M + (cardLeft ? CARD_H + GAP : 0) + Math.max(0, (VH - 2 * M - leftH) / 2);
  const PILE = { x: M, y: pileY, w: PILE_W, h: PILE_H };
  const rightTop = M + (cardRight ? CARD_H + GAP : 0) + Math.max(0, (VH - 2 * M - rightH) / 2);
  const FX = RX + (RW - FW) / 2;
  const FRAME = Array.from({ length: frames }, (_, k) => ({ x: FX, y: rightTop + k * (FH + GAP), w: FW, h: FH }));
  const TRAY = { x: FX, y: rightTop + frames * (FH + GAP), w: TW, h: TH };
  const CARD = cardRight
    ? { x: RX + (RW - CARD_W) / 2, y: M }
    : { x: M + (PILE_W - CARD_W) / 2, y: M };

  // Each counter's home cell in the basket: a seeded shuffle of the cells plus a small jitter.
  const homes = useMemo(() => {
    let s = (n * 7919 + card * 104729 + color.length * 31) >>> 0 || 1;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const cells = Array.from({ length: PCOLS * prows }, (_, k) => k);
    for (let i = cells.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const t = cells[i]; cells[i] = cells[j]; cells[j] = t;
    }
    return cells.slice(0, n).map((k) => ({
      dx: 10 + (k % PCOLS) * PCELL + PCELL / 2 + Math.round((rand() - 0.5) * 8),
      dy: 10 + Math.floor(k / PCOLS) * PCELL + PCELL / 2 + Math.round((rand() - 0.5) * 8),
    }));
  }, [n, card, color, prows]);

  // Loose spots on the mat: two staggered, uneven rows, so the loose counters do not look like a second frame.
  const TRAY_SPOTS = [[42, 38], [104, 46], [166, 36], [228, 48], [290, 38], [70, 96], [134, 92], [196, 100], [258, 90], [314, 98]];

  const [inFrame, setInFrame] = useState(() => Array.from({ length: frames }, () => []));
  const [loose, setLoose] = useState([]);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const tens = Math.floor(key / 10), ones = key % 10;
    const misrules = [
      { says: tens + ones, because: card > 0 ? 'read the 1 and the ' + ones + ' as two small numbers and put them together' : 'counted the full frame as one, not as ten' },
      ones > 0 ? { says: ones, because: 'counted only the loose counters and left out the ten' } : null,
    ].filter((m, i, all) => m && m.says !== key && all.findIndex((x) => x && x.says === m.says) === i);
    lumina.answer(key, misrules);
  }, []);

  const placed = new Set();
  inFrame.forEach((f) => f.forEach((c) => placed.add(c)));
  loose.forEach((c) => placed.add(c));
  const inPile = homes.map((_, i) => i).filter((i) => !placed.has(i));

  useEffect(() => {
    const allFull = inFrame.every((f) => f.length === 10);
    const looseRight = loose.length === key - 10 * frames;
    const basketDone = card > 0 ? true : inPile.length === 0;
    lumina.goal(allFull && looseRight && basketDone);
    lumina.scene({
      numberCard: card > 0 ? String(card) : 'no card',
      framesDrawn: frames,
      countersInEachFrame: inFrame.map((f) => f.length),
      countersLooseBesideTheFrame: loose.length,
      basket: inPile.length === 0 ? 'empty' : 'still has counters',
      counterColour: color,
    });
  }, [inFrame, loose]);

  const inside = (r, p) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;

  const grab = (id, e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id }); };
  const move = (e) => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag({ ...drag, x: p.x, y: p.y }); } };
  const drop = (e) => {
    if (!drag) return;
    const id = drag.id;
    const p = svgPoint(svgRef.current, e);
    setDrag(null);
    const fromFrame = inFrame.findIndex((f) => f.includes(id));
    const fromLoose = loose.includes(id);
    const toFrame = FRAME.findIndex((r) => inside(r, p));
    if (toFrame >= 0) {
      if (fromFrame === toFrame || inFrame[toFrame].length >= 10) return;
      setInFrame((all) => all.map((f, k) => (k === toFrame ? f.concat(id) : f.filter((x) => x !== id))));
      if (fromLoose) setLoose((l) => l.filter((x) => x !== id));
      return;
    }
    if (inside(TRAY, p)) {
      if (fromLoose || loose.length >= TRAY_SPOTS.length) return;
      setLoose((l) => l.concat(id));
      if (fromFrame >= 0) setInFrame((all) => all.map((f) => f.filter((x) => x !== id)));
      return;
    }
    if (inside(PILE, p)) {
      if (fromFrame >= 0) setInFrame((all) => all.map((f) => f.filter((x) => x !== id)));
      if (fromLoose) setLoose((l) => l.filter((x) => x !== id));
    }
  };

  const at = (id) => {
    if (drag && drag.id === id && drag.x !== undefined) return { x: drag.x, y: drag.y };
    for (let k = 0; k < frames; k += 1) {
      const c = inFrame[k].indexOf(id);
      if (c >= 0) return { x: FRAME[k].x + 8 + (c % 5) * FCELL + FCELL / 2, y: FRAME[k].y + 8 + Math.floor(c / 5) * FCELL + FCELL / 2 };
    }
    const t = loose.indexOf(id);
    if (t >= 0) return { x: TRAY.x + TRAY_SPOTS[t][0], y: TRAY.y + TRAY_SPOTS[t][1] };
    return { x: PILE.x + homes[id].dx, y: PILE.y + homes[id].dy };
  };

  const counter = (id) => {
    const p = at(id);
    return (
      <g key={id} id={'c-' + id} transform={'translate(' + p.x + ',' + p.y + ')'} onPointerDown={(e) => grab(id, e)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
        <circle r={23} fill={fill} stroke={rim} strokeWidth={3} />
        <circle r={12} fill="none" stroke={rim} strokeWidth={1.5} opacity={0.6} />
      </g>
    );
  };

  const frame = (r, k) => (
    <g key={'frame-' + k}>
      <rect id={'frame-' + k} x={r.x} y={r.y} width={r.w} height={r.h} rx={12} fill="#1e293b" stroke="#64748b" strokeWidth={3} />
      {Array.from({ length: 10 }, (_, c) => (
        <rect key={c} x={r.x + 8 + (c % 5) * FCELL + 3} y={r.y + 8 + Math.floor(c / 5) * FCELL + 3} width={FCELL - 6} height={FCELL - 6} rx={6} fill="#0f172a" stroke="#475569" strokeWidth={2} pointerEvents="none" />
      ))}
    </g>
  );

  const order = homes.map((_, i) => i).filter((i) => !drag || drag.id !== i);
  if (drag) order.push(drag.id);

  return (
    <Panel title="Ten and Some" caption="Drag a counter into the frame, or out beside it.">
      <svg ref={svgRef} viewBox={'0 0 680 ' + VH} onPointerMove={move} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={VH} fill="#0f172a" />
        <rect id="basket" x={PILE.x} y={PILE.y} width={PILE.w} height={PILE.h} rx={16} fill="#3f2a1a" stroke="#7c5a3a" strokeWidth={3} />
        {card > 0 ? (
          <g pointerEvents="none">
            <rect x={CARD.x} y={CARD.y} width={CARD_W} height={CARD_H} rx={12} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={2} />
            <text x={CARD.x + CARD_W / 2} y={CARD.y + CARD_H / 2 + 4} textAnchor="middle" dominantBaseline="middle" fontSize={64} fontWeight={800} fill="#0f172a">{card}</text>
          </g>
        ) : null}
        {FRAME.map((r, k) => frame(r, k))}
        <rect id="mat" x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx={16} fill="none" stroke="#475569" strokeWidth={2.5} strokeDasharray="6 5" />
        {order.map((i) => counter(i))}
      </svg>
    </Panel>
  );
}
