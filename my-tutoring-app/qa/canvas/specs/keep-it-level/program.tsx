// Keep it level (6.EE.B.7). A pan balance holds paper bags of one unknown weight and unit weights. The starting
// equation is printed over the pans (left side over the left pan, right over the right). The child drags a bag or a
// weight off a pan onto the table below; the beam tilts by the true weights in every state, so taking something off
// one pan only tips it. That is the world reacting, the same in every state; nothing changes colour when it is level.
// "Share" splits both pans into equal-looking groups (a way of looking, nothing leaves a pan); while shared, the child
// drags a whole group off a pan. The goal: one bag alone on a pan, balanced against unit weights only.
// No bag weight is printed or put in the scene. Say and show: what one bag weighs in unit weights is said; Check
// judges that one bag stands alone against the right number of unit weights.
function Display({ params, lumina }) {
  const num = (v, d) => (v === undefined || v === null || v === '' ? d : Math.max(0, Math.round(Number(v)) || 0));
  const start = {
    L: { bags: num(params.leftBags, 1), units: num(params.leftUnits, 3) },
    R: { bags: num(params.rightBags, 0), units: num(params.rightUnits, 7) },
  };
  const dBags = start.L.bags - start.R.bags, dUnits = start.R.units - start.L.units;
  const bag = dBags !== 0 ? dUnits / dBags : 0; // what one bag weighs, in unit weights (never shown)
  const heavy = dBags > 0 ? 'L' : 'R', light = heavy === 'L' ? 'R' : 'L';
  const idsFor = s => Array.from({ length: start[s].bags }, (_, i) => s + '-bag-' + i)
    .concat(Array.from({ length: start[s].units }, (_, i) => s + '-unit-' + i));
  const isBag = id => id.indexOf('-bag-') > 0;

  const [on, setOn] = useState(() => ({ L: idsFor('L'), R: idsFor('R') }));
  const [off, setOff] = useState({ L: [], R: [] });
  const [k, setK] = useState(1);
  const [assign, setAssign] = useState({});
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const counts = s => ({ bags: on[s].filter(isBag).length, units: on[s].filter(i => !isBag(i)).length });
  const weight = s => { const c = counts(s); return c.bags * bag + c.units; };
  const angle = Math.max(-12, Math.min(12, (weight('R') - weight('L')) * 3));

  useEffect(() => {
    const A = Math.abs(dBags), C = Math.abs(dUnits);
    const misrules = [
      A > 1 ? { says: C, because: 'took the extra bags off one pan only, so one bag was left against everything all the bags balanced' } : null,
      start[heavy].units > 0 ? { says: start[light].units / A, because: 'took the unit weights off the bag side only and left the other pan as it was' } : null,
      start[light].bags > 0 ? { says: (start[light].units - start[heavy].units) / start[heavy].bags, because: 'took the bags off the other pan only, as if those bags weighed nothing' } : null,
    ].filter((m, i, all) => m && Number.isInteger(m.says) && m.says > 0 && m.says !== bag && all.findIndex(o => o && o.says === m.says) === i);
    lumina.answer(bag, misrules);
  }, []);

  useEffect(() => {
    const L = counts('L'), R = counts('R');
    const alone = (a, b) => a.bags === 1 && a.units === 0 && b.bags === 0 && b.units === bag;
    lumina.goal(Number.isInteger(bag) && bag > 0 && (alone(L, R) || alone(R, L)));
    const says = c => (c.bags + c.units === 0 ? 'nothing'
      : [c.bags ? c.bags + (c.bags === 1 ? ' bag' : ' bags') : '', c.units ? c.units + (c.units === 1 ? ' unit weight' : ' unit weights') : ''].filter(Boolean).join(' and '));
    const offSays = s => says({ bags: off[s].filter(isBag).length, units: off[s].filter(i => !isBag(i)).length });
    lumina.scene({
      startingEquation: eqText('L') + ' = ' + eqText('R'),
      leftPanHolds: says(L),
      rightPanHolds: says(R),
      takenOffLeftPan: offSays('L'),
      takenOffRightPan: offSays('R'),
      balance: angle === 0 ? 'level' : angle > 0 ? 'right pan lower' : 'left pan lower',
      sharedInto: k === 1 ? 'not shared' : k + ' groups on each pan',
    });
  }, [on, k]);

  function eqText(s) {
    const t = [];
    const b = start[s].bags, u = start[s].units;
    if (b) t.push(b === 1 ? 'x' : b + 'x');
    if (u || !b) t.push(String(u));
    return t.join(' + ');
  }

  // Share: each pan's bags and weights are dealt into k groups in turn, so equal amounts make equal groups.
  const share = next => {
    const a = {};
    ['L', 'R'].forEach(s => {
      on[s].filter(isBag).forEach((id, i) => { a[id] = i % next; });
      on[s].filter(i => !isBag(i)).forEach((id, i) => { a[id] = i % next; });
    });
    setAssign(a);
    setK(next);
  };
  const removeIds = (s, list) => {
    setOn(o => ({ ...o, [s]: o[s].filter(i => !list.includes(i)) }));
    setOff(o => ({ ...o, [s]: o[s].concat(list.filter(i => !o[s].includes(i))) }));
  };

  // Layout.
  const CX = 340, ARM = 170, PAN_W = 284, UNIT = 48, BAG = 62;
  const panX = s => (s === 'L' ? CX - ARM : CX + ARM);
  const rowsOf = c => Math.ceil(c.bags / 4) * BAG + Math.ceil(c.units / 5) * UNIT;
  const contentH = Math.max(110, rowsOf(start.L), rowsOf(start.R));
  const CT = 66, TOP = CT + contentH + 6, PIVOT = TOP + 50, BASE_Y = PIVOT + 44, FLOOR_Y = BASE_Y + 16, FLOOR_H = 52;
  const STEP_Y = FLOOR_Y + FLOOR_H + 34, H = STEP_Y + 30;
  const rad = (angle * Math.PI) / 180;
  const dropY = s => (s === 'L' ? -1 : 1) * ARM * Math.sin(rad);

  const svgAt = e => svgPoint(svgRef.current, e);
  const grab = (e, payload) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = svgAt(e);
    setDrag({ ...payload, x0: p.x, y0: p.y, x: p.x, y: p.y });
  };
  const move = e => { if (drag) { const p = svgAt(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : d)); } };
  const inPan = (p, s) => Math.abs(p.x - panX(s)) < PAN_W / 2 + 12 && p.y > CT - 30 && p.y < TOP + 30;
  const release = e => {
    if (!drag) return;
    const p = svgAt(e), d = drag;
    setDrag(null);
    if (Math.hypot(p.x - d.x0, p.y - d.y0) < 24 || inPan(p, 'L') || inPan(p, 'R')) return;
    if (d.kind === 'item') removeIds(d.side, [d.id]);
    else removeIds(d.side, on[d.side].filter(i => assign[i] === d.g));
  };
  const shift = (match) => (drag && match ? `translate(${drag.x - drag.x0}px, ${drag.y - drag.y0}px)` : '');

  const sack = (cx, by, w, h) => (
    <g pointerEvents="none">
      <path d={`M ${cx - w * 0.42} ${by} L ${cx - w * 0.5} ${by - h * 0.62} Q ${cx - w * 0.36} ${by - h * 0.78} ${cx - w * 0.18} ${by - h * 0.8} L ${cx + w * 0.18} ${by - h * 0.8} Q ${cx + w * 0.36} ${by - h * 0.78} ${cx + w * 0.5} ${by - h * 0.62} L ${cx + w * 0.42} ${by} Z`}
        fill="#b08955" stroke="#7c5a2e" strokeWidth="2" strokeLinejoin="round" />
      <path d={`M ${cx - w * 0.18} ${by - h * 0.8} L ${cx - w * 0.26} ${by - h} L ${cx + w * 0.26} ${by - h} L ${cx + w * 0.18} ${by - h * 0.8} Z`} fill="#c49a64" stroke="#7c5a2e" strokeWidth="2" strokeLinejoin="round" />
      <line x1={cx - w * 0.22} y1={by - h * 0.82} x2={cx + w * 0.22} y2={by - h * 0.82} stroke="#5c3d24" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
  const block = (cx, by, s, mark) => (
    <g pointerEvents="none">
      <path d={`M ${cx - s * 0.5} ${by} L ${cx - s * 0.38} ${by - s * 0.78} L ${cx + s * 0.38} ${by - s * 0.78} L ${cx + s * 0.5} ${by} Z`} fill="#9ca3af" stroke="#4b5563" strokeWidth="2" strokeLinejoin="round" />
      <rect x={cx - s * 0.14} y={by - s} width={s * 0.28} height={s * 0.24} rx="3" fill="#9ca3af" stroke="#4b5563" strokeWidth="2" />
      {mark && <text x={cx} y={by - s * 0.22} textAnchor="middle" fontSize="16" fontWeight="600" fill="#0f172a">1</text>}
    </g>
  );

  // One pan's things laid out loose: bags in rows of four on the pan, unit weights in rows of five above them.
  const loose = s => {
    const bags = on[s].filter(isBag), units = on[s].filter(i => !isBag(i));
    const out = [];
    const rowX = (i, n, per, pitch) => { const row = Math.floor(i / per), inRow = Math.min(per, n - row * per); return panX(s) - ((inRow - 1) * pitch) / 2 + (i % per) * pitch; };
    bags.forEach((id, i) => {
      const cx = rowX(i, bags.length, 4, BAG), by = TOP - Math.floor(i / 4) * BAG;
      out.push({ id, cx, by, w: 54, h: 58 });
    });
    const bagRows = Math.ceil(bags.length / 4) * BAG;
    units.forEach((id, i) => {
      const cx = rowX(i, units.length, 5, UNIT), by = TOP - bagRows - Math.floor(i / 5) * UNIT;
      out.push({ id, cx, by, w: 46, h: 46 });
    });
    return out.map(t => {
      const dragging = drag && drag.kind === 'item' && drag.id === t.id;
      return (
        <g key={t.id} id={t.id} onPointerDown={e => grab(e, { kind: 'item', side: s, id: t.id })}
          style={{ cursor: 'grab', touchAction: 'none', transform: `translateY(${dropY(s)}px) ${shift(dragging)}`, transition: dragging ? 'none' : 'transform 0.35s ease' }}>
          <rect x={t.cx - t.w / 2} y={t.by - t.h} width={t.w} height={t.h} fill="transparent" />
          {isBag(t.id) ? sack(t.cx, t.by - 1, 50, 56) : block(t.cx, t.by - 2, 40, true)}
        </g>
      );
    });
  };

  // One pan shared into k groups: each group is a tray the child drags off whole.
  const grouped = s => {
    const gap = 8, gw = (PAN_W - gap * (k - 1)) / k, gh = contentH - 4;
    return Array.from({ length: k }, (_, g) => {
      const mine = on[s].filter(i => assign[i] === g);
      const gx = panX(s) - PAN_W / 2 + g * (gw + gap);
      const per = Math.max(1, Math.floor((gw - 8) / 30));
      const bags = mine.filter(isBag), units = mine.filter(i => !isBag(i));
      const dragging = drag && drag.kind === 'group' && drag.side === s && drag.g === g;
      const bagRows = Math.ceil(bags.length / per) * 42;
      const inner = [
        ...bags.map((id, i) => <g key={id}>{sack(gx + 19 + (i % per) * 30, TOP - 6 - Math.floor(i / per) * 42, 28, 38)}</g>),
        ...units.map((id, i) => <g key={id}>{block(gx + 19 + (i % per) * 30, TOP - 6 - bagRows - Math.floor(i / per) * 30, 26, false)}</g>),
      ];
      if (!mine.length) return (
        <g key={s + 'g' + g} style={{ transform: `translateY(${dropY(s)}px)`, transition: 'transform 0.35s ease' }}>
          <rect x={gx} y={TOP - gh - 2} width={gw} height={gh} rx="10" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
        </g>
      );
      return (
        <g key={s + 'g' + g} id={s + '-group-' + g} onPointerDown={e => grab(e, { kind: 'group', side: s, g })}
          style={{ cursor: 'grab', touchAction: 'none', transform: `translateY(${dropY(s)}px) ${shift(dragging)}`, transition: dragging ? 'none' : 'transform 0.35s ease' }}>
          <rect x={gx} y={TOP - gh - 2} width={gw} height={gh} rx="10" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          {inner}
        </g>
      );
    });
  };

  // What was taken off each pan lies on the table under that pan, small.
  const pile = s => {
    const list = off[s], x0 = panX(s) - 130;
    const bags = list.filter(isBag), units = list.filter(i => !isBag(i));
    return (
      <g pointerEvents="none" opacity="0.55">
        {bags.map((id, i) => <g key={id}>{sack(x0 + 12 + i * 26, FLOOR_Y + 44, 22, 30)}</g>)}
        {units.map((id, i) => <g key={id}>{block(x0 + 12 + bags.length * 26 + i * 20, FLOOR_Y + 44, 17, false)}</g>)}
      </g>
    );
  };

  const eqSide = s => <text x={panX(s)} y="48" textAnchor="middle" fontSize="34" fill="#e2e8f0">{eqText(s)}</text>;
  const step = (id, x, sign, can, act) => (
    <g id={id} onPointerDown={() => can && act()} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={STEP_Y} r="24" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={STEP_Y + 10} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );

  return (
    <Panel title="Keep It Level" caption="Drag a bag or a weight off the balance onto the table. Tap plus or minus to share each pan into groups.">
      <svg ref={svgRef} viewBox={`0 0 680 ${H}`} onPointerMove={move} onPointerUp={release}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />
        <text x="22" y="46" fontSize="15" fill="#cbd5e1">start</text>
        {eqSide('L')}
        <text x={CX} y="48" textAnchor="middle" fontSize="34" fill="#e2e8f0">=</text>
        {eqSide('R')}

        <rect id="table" x="16" y={FLOOR_Y} width="648" height={FLOOR_H} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {pile('L')}
        {pile('R')}

        {['L', 'R'].map(s => (
          <g key={'pan' + s} pointerEvents="none" style={{ transform: `translateY(${dropY(s)}px)`, transition: 'transform 0.35s ease' }}>
            <line x1={panX(s)} y1={TOP + 10} x2={panX(s)} y2={PIVOT} stroke="#64748b" strokeWidth="4" />
            <rect x={panX(s) - PAN_W / 2} y={TOP} width={PAN_W} height="12" rx="6" fill="#334155" stroke="#64748b" strokeWidth="2" />
          </g>
        ))}
        <g pointerEvents="none" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${PIVOT}px`, transition: 'transform 0.35s ease' }}>
          <rect x={CX - ARM - 12} y={PIVOT - 6} width={2 * ARM + 24} height="12" rx="6" fill="#94a3b8" />
        </g>
        <polygon points={`${CX},${PIVOT} ${CX - 30},${BASE_Y} ${CX + 30},${BASE_Y}`} fill="#64748b" pointerEvents="none" />
        <rect x={CX - 80} y={BASE_Y} width="160" height="10" rx="5" fill="#475569" pointerEvents="none" />
        <circle cx={CX} cy={PIVOT} r="7" fill="#e2e8f0" pointerEvents="none" />

        {k === 1 ? loose('L') : grouped('L')}
        {k === 1 ? loose('R') : grouped('R')}

        {step('share-minus', CX - 110, '−', k > 1, () => share(k - 1))}
        <text x={CX} y={STEP_Y + 6} textAnchor="middle" fontSize="17" fill="#cbd5e1">{k === 1 ? 'not shared' : 'share into ' + k}</text>
        {step('share-plus', CX + 110, '+', k < 4, () => share(k + 1))}
      </svg>
    </Panel>
  );
}
