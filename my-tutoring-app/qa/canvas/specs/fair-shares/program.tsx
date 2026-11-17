// Fair shares (5.NF.B.3), adapted from pizza-share. The child cuts each pizza with a stepper and deals the pieces to
// the friends' plates until every plate holds the same amount and no pizza is left. A plate puts its pieces back
// together as an amount of one pizza, with no count or fraction label. Say and show: how much pizza one friend gets
// is one sayable fraction, a/b for a pizzas among b friends.
function Display({ params, lumina }) {
  const pizzas = Math.max(1, Math.min(5, Number(params.pizzas) || 3));
  const friends = Math.max(2, Math.min(6, Number(params.friends) || 4));
  const startCut = Math.max(1, Math.min(8, Number(params.startCut) || 1));
  const MAXCUT = 8;
  const UNIT = 840; // every cut 1..8 divides 840, so shares compare as whole numbers

  const [cuts, setCuts] = useState(() => Array.from({ length: pizzas }, () => startCut));
  // where[p][s] = -1 on the counter, or the plate index it was dealt to
  const [where, setWhere] = useState(() => Array.from({ length: pizzas }, () => Array.from({ length: startCut }, () => -1)));
  const [order, setOrder] = useState([]); // [p, s] in the order they were dealt, so a plate fills in that order
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  // The said answer and the wrong rules, from params only.
  useEffect(() => {
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const frac = (n, d) => { const g = gcd(n, d); return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`; };
    const value = n => n.includes('/') ? Number(n.split('/')[0]) / Number(n.split('/')[1]) : Number(n);
    const answer = frac(pizzas, friends);
    const candidates = [
      { says: frac(Math.min(pizzas, friends), Math.max(pizzas, friends)), because: 'put the bigger number on the bottom, whatever was shared' },
      { says: frac(1, friends), because: 'named one cut piece, not all the pieces one friend got' },
      { says: frac(friends, pizzas), because: 'put the friends on top and the pizzas on the bottom' },
      { says: String(pizzas), because: 'counted the pieces on one plate (one from each pizza), not how much pizza they make' },
    ];
    const misrules = [];
    candidates.forEach(m => {
      if (value(m.says) === value(answer)) return;
      if (misrules.some(x => value(x.says) === value(m.says))) return;
      misrules.push(m);
    });
    lumina.answer(answer, misrules.slice(0, 3));
  }, []);

  const W = 680, H = 450;
  const R = 46;
  const pizzaX = p => (W / (pizzas + 1)) * (p + 1);
  const PY = 92;
  const colW = (W - 40) / friends;
  const plateW = Math.min(friends <= 2 ? 260 : 200, colW - 14);
  const plateX = k => 20 + colW * k + (colW - plateW) / 2;
  const PLATE_Y = 268, PLATE_H = 150;
  const FACES = ['🧒', '👧', '👦', '🧑', '👩', '👨'];
  // Places for pizza on a plate: one per pizza on the counter, at most 3 (a fact of the story, not of the share).
  const SLOTS = Math.min(3, pizzas);
  // Lay the places out in the rows that let them be biggest inside the plate.
  const fit = n => Math.min(30, (plateW - 8) / n / 2 - 4, PLATE_H / Math.ceil(SLOTS / n) / 2 - 5);
  const perRow = Array.from({ length: SLOTS }, (_, i) => i + 1).reduce((best, n) => (fit(n) >= fit(best) ? n : best), 1);
  const SR = fit(perRow);
  const rows = Math.ceil(SLOTS / perRow);
  const slotAt = (k, i) => {
    const x = plateX(k), row = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, SLOTS - row * perRow);
    const gap = Math.min(2 * SR + 10, (plateW - 8) / perRow);
    const cx = x + plateW / 2 + (col - (inRow - 1) / 2) * gap;
    const cy = PLATE_Y + ((row + 0.5) * PLATE_H) / rows;
    return { cx, cy };
  };

  const dealtFrom = p => where[p].some(w => w >= 0);
  const plateAmount = k => {
    let t = 0;
    where.forEach((row, p) => row.forEach(w => { if (w === k) t += UNIT / cuts[p]; }));
    return t;
  };
  const onCounter = where.reduce((n, row) => n + row.filter(w => w < 0).length, 0);

  useEffect(() => {
    const amounts = Array.from({ length: friends }, (_, k) => plateAmount(k));
    const fair = onCounter === 0 && amounts.every(a => a === amounts[0]) && amounts[0] > 0;
    lumina.goal(fair);
    lumina.scene({
      pizzasAtStart: pizzas,
      friends,
      piecesEachPizzaIsCutInto: cuts,
      piecesStillOnCounter: onCounter,
      plates: Array.from({ length: friends }, (_, k) => {
        const pieces = [];
        order.forEach(([p, s]) => { if (where[p][s] === k) pieces.push(cuts[p] === 1 ? 'whole pizza' : 'piece of a pizza cut in ' + cuts[p]); });
        return { friend: k + 1, pieces };
      }),
    });
  }, [cuts, where, order]);

  const setCut = (p, d) => {
    if (dealtFrom(p)) return;
    const n = Math.max(1, Math.min(MAXCUT, cuts[p] + d));
    setCuts(c => c.map((v, i) => (i === p ? n : v)));
    setWhere(w => w.map((row, i) => (i === p ? Array.from({ length: n }, () => -1) : row)));
  };

  const sector = (cx, cy, r, a0, a1) => {
    if (a1 - a0 >= Math.PI * 2 - 1e-6) return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const big = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${big} 1 ${x1} ${y1} Z`;
  };
  const sliceAngles = (n, s) => {
    const a0 = -Math.PI / 2 + (2 * Math.PI * s) / n;
    return [a0, a0 + (2 * Math.PI) / n];
  };
  const pizzaFill = (cx, cy, r, a0, a1, key, extra) => { const inset = a1 - a0 >= Math.PI * 2 - 1e-6 ? 0 : 0.02; return (
    <g key={key} {...extra}>
      <path d={sector(cx, cy, r, a0, a1)} fill="#f59e0b" stroke="#7c2d12" strokeWidth="2.5" />
      <path d={sector(cx, cy, r * 0.82, a0 + inset, a1 - inset)} fill="#fcd34d" stroke="none" />
      {[0.35, 0.65].map((t, i) => {
        const a = a0 + (a1 - a0) * t, rr = r * (i ? 0.55 : 0.42);
        return <circle key={i} cx={cx + rr * Math.cos(a)} cy={cy + rr * Math.sin(a)} r={r * 0.09} fill="#dc2626" />;
      })}
    </g>
  ); };

  const grab = (p, s, e) => {
    const pt = svgPoint(svgRef.current, e);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ p, s, dx: pt.x - pizzaX(p), dy: pt.y - PY, x: pt.x, y: pt.y });
  };
  const move = e => { if (drag) { const pt = svgPoint(svgRef.current, e); setDrag({ ...drag, x: pt.x, y: pt.y }); } };
  const drop = e => {
    if (!drag) return;
    const pt = svgPoint(svgRef.current, e);
    const { p, s } = drag;
    setDrag(null);
    let k = -1;
    for (let i = 0; i < friends; i++) {
      const x = plateX(i);
      if (pt.x >= x - 6 && pt.x <= x + plateW + 6 && pt.y >= PLATE_Y - 40 && pt.y <= PLATE_Y + PLATE_H + 6) k = i;
    }
    if (k < 0) return;
    setWhere(w => w.map((row, i) => (i === p ? row.map((v, j) => (j === s ? k : v)) : row)));
    setOrder(o => [...o.filter(([a, b]) => !(a === p && b === s)), [p, s]]);
  };
  const takeBack = (p, s) => {
    setWhere(w => w.map((row, i) => (i === p ? row.map((v, j) => (j === s ? -1 : v)) : row)));
    setOrder(o => o.filter(([a, b]) => !(a === p && b === s)));
  };

  // A plate shows its pieces put back together into pizzas, so the share reads as an amount of pizza.
  const plateDraw = k => {
    const x = plateX(k), mid = x + plateW / 2;
    let filled = 0; // in UNITs, across the plate's circles
    const out = [];
    order.forEach(([p, s], idx) => {
      if (where[p][s] !== k) return;
      const size = UNIT / cuts[p];
      let circle = Math.floor(filled / UNIT);
      if ((filled % UNIT) + size > UNIT) { circle += 1; filled = circle * UNIT; }
      const start = filled % UNIT;
      filled += size;
      const slot = slotAt(k, Math.min(circle, SLOTS - 1));
      const over = Math.max(0, circle - (SLOTS - 1));
      const a0 = -Math.PI / 2 + (2 * Math.PI * start) / UNIT;
      const a1 = a0 + (2 * Math.PI * size) / UNIT;
      out.push(pizzaFill(slot.cx + 6 * over, slot.cy + 6 * over, SR, a0, a1, 'pp' + idx, {
        id: `plate-${k}-piece-${p}-${s}`,
        onClick: () => takeBack(p, s),
        style: { cursor: 'pointer' },
      }));
    });
    return (
      <g key={'plate' + k}>
        <text x={mid} y={PLATE_Y - 12} textAnchor="middle" fontSize="32">{FACES[k % FACES.length]}</text>
        <rect id={`plate-${k}`} x={x} y={PLATE_Y} width={plateW} height={PLATE_H} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {Array.from({ length: SLOTS }, (_, i) => { const c = slotAt(k, i); return <circle key={i} cx={c.cx} cy={c.cy} r={SR} fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 5" />; })}
        {out}
      </g>
    );
  };

  return (
    <Panel title="Fair Shares" caption="Tap − or + under a pizza to cut it. Drag a piece to a plate; tap a piece on a plate to take it back.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="14" y="20" width={W - 28} height="190" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {Array.from({ length: pizzas }, (_, p) => {
          const cx = pizzaX(p), n = cuts[p], locked = dealtFrom(p);
          return (
            <g key={'pz' + p}>
              <circle cx={cx} cy={PY} r={R + 6} fill="#e2e8f0" opacity="0.12" />
              <circle cx={cx} cy={PY} r={R} fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 5" />
              {Array.from({ length: n }, (_, s) => {
                if (where[p][s] >= 0) return null;
                const held = drag && drag.p === p && drag.s === s;
                const [a0, a1] = sliceAngles(n, s);
                return pizzaFill(cx, PY, R, a0, a1, 's' + s, {
                  id: `slice-${p}-${s}`,
                  onPointerDown: e => grab(p, s, e),
                  onPointerUp: drop,
                  opacity: held ? 0 : 1,
                  style: { cursor: 'grab', touchAction: 'none' },
                });
              })}
              {!locked && (
                <g>
                  <g id={`cut-minus-${p}`} onClick={() => setCut(p, -1)} style={{ cursor: 'pointer' }} opacity={n > 1 ? 1 : 0.35}>
                    <rect x={cx - 50} y={150} width="44" height="44" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
                    <text x={cx - 28} y={179} textAnchor="middle" fontSize="24" fill="#e2e8f0">−</text>
                  </g>
                  <g id={`cut-plus-${p}`} onClick={() => setCut(p, 1)} style={{ cursor: 'pointer' }} opacity={n < MAXCUT ? 1 : 0.35}>
                    <rect x={cx + 6} y={150} width="44" height="44" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
                    <text x={cx + 28} y={179} textAnchor="middle" fontSize="24" fill="#e2e8f0">+</text>
                  </g>
                </g>
              )}
            </g>
          );
        })}
        {Array.from({ length: friends }, (_, k) => plateDraw(k))}
        {drag && drag.x !== undefined && (() => {
          const [a0, a1] = sliceAngles(cuts[drag.p], drag.s);
          return <g pointerEvents="none" opacity="0.92">{pizzaFill(drag.x - drag.dx, drag.y - drag.dy, R, a0, a1, 'drag')}</g>;
        })()}
      </svg>
    </Panel>
  );
}
