// Partners (2.OA.C.3): a number is even when every one has a partner. A tray of counters scattered loose (not in
// rows, so the tray does not pair them) and a partner frame: columns of two seats, more columns than any build needs,
// and one round spot on its own. The child drags each counter into a seat or onto the spot. Check judges the pairing:
// nothing left on the tray, every column of the frame full or empty, and so at most one counter alone on the spot.
// The child says "even" or "odd". The misrules are computed per number: judging by the tens digit (12 is odd because
// of the 1, 21 is even because of the 2) or "big numbers are odd". The transfer (params.tens): the number comes as
// ten-sticks and single cubes; a ten-stick dropped in the frame lays itself out as five full columns, so the child
// sees every ten pair up and only the single cubes decide.
function Display({ params, lumina }) {
  const tens = Math.max(0, Number(params.tens) || 0);
  const sticks = tens > 0;
  const ones = sticks ? Math.max(0, Number(params.ones) || 0) : 0;
  const n = sticks ? tens * 10 + ones : Math.max(1, Number(params.n) || 6);
  const loose = sticks ? ones : n;
  const cols = Math.max(Math.ceil(n / 2) + 1, Number(params.cols) || Math.ceil(n / 2) + 2);
  const seed = Number(params.seed) || 1;

  const [pos, setPos] = useState(() => Array.from({ length: loose }, () => ({ w: 'tray' })));
  const [stickCol, setStickCol] = useState(() => Array.from({ length: tens }, () => -1));
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  // Seats taken: 'c<i>' for a counter or cube, 's<i>' for a cube of a placed ten-stick.
  const occ = {};
  stickCol.forEach((c0, i) => { if (c0 >= 0) for (let k = 0; k < 5; k++) { occ[(c0 + k) + '-0'] = 's' + i; occ[(c0 + k) + '-1'] = 's' + i; } });
  pos.forEach((p, i) => { if (p.w === 'slot') occ[p.c + '-' + p.r] = 'c' + i; });
  const colCount = c => (occ[c + '-0'] ? 1 : 0) + (occ[c + '-1'] ? 1 : 0);
  let full = 0, half = 0;
  for (let c = 0; c < cols; c++) { const k = colCount(c); if (k === 2) full++; else if (k === 1) half++; }
  const onTray = pos.filter(p => p.w === 'tray').length;
  const sticksOnTray = stickCol.filter(c => c < 0).length;
  const spotTaken = pos.findIndex(p => p.w === 'spot');

  useEffect(() => {
    const key = n % 2 ? 'odd' : 'even';
    const cands = [];
    if (n >= 10) {
      const t = Math.floor(n / 10) % 10;
      cands.push({ says: t % 2 ? 'odd' : 'even', because: 'judged by the tens digit, ' + t + ', not by whether every one has a partner' });
      cands.push({ says: 'odd', because: 'thought a big number must be odd' });
    }
    const misrules = [];
    cands.forEach(m => { if (m.says !== key && !misrules.some(x => x.says === m.says)) misrules.push(m); });
    lumina.answer(key, misrules, ['even', 'odd']);
  }, []);

  useEffect(() => {
    lumina.goal(onTray === 0 && sticksOnTray === 0 && half === 0);
    lumina.scene({
      number: n,
      madeOf: sticks ? tens + ' ten-sticks and ' + (ones ? ones + ' single cube' + (ones > 1 ? 's' : '') : 'no single cubes') : n + ' counters',
      partnerFrame: cols + ' columns of two seats, more than needed, and one round spot on its own',
      stillOnTray: sticks ? sticksOnTray + ' ten-sticks, ' + onTray + ' single cubes' : onTray + ' counters',
      fullColumnsInFrame: full,
      columnsWithOneSeatEmpty: half,
      onTheSpotAlone: spotTaken >= 0 ? (sticks ? 'one cube' : 'one counter') : 'nothing',
    });
  }, [pos, stickCol]);

  // Geometry, in viewBox units.
  const R = 22, COLW = sticks ? 34 : 56, CUBE = 26;
  const trayTop = 14;
  const rows = sticks ? 0 : Math.ceil((n + 3) / 7);
  const trayH = sticks ? Math.max(tens * 54, 64) + 34 : rows * 64 + 22;
  const frameTop = trayTop + trayH + 22;
  const rowY = sticks ? [30, 64] : [36, 96];
  const frameH = sticks ? 94 : 132;
  const frameW = cols * COLW + 20;
  const SPOT_R = 28, GAP = sticks ? 26 : 36;
  const frameX = Math.round((680 - (frameW + GAP + SPOT_R * 2)) / 2);
  const spot = { x: frameX + frameW + GAP + SPOT_R, y: frameTop + frameH / 2 };
  const H = frameTop + frameH + 16;
  const seat = (c, r) => ({ x: frameX + 10 + c * COLW + COLW / 2, y: frameTop + rowY[r] });

  // A loose scatter on the tray: n of the tray's cells, shuffled by the number and a seed, each nudged off its cell.
  const trayAt = (() => {
    let s = (n * 7919 + seed * 104729) % 2147483647 || 1;
    const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
    if (sticks) return Array.from({ length: loose }, (_, k) => ({ x: 470 + k * 64, y: trayTop + 46 + (k % 2) * 40 }));
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < 7; c++) cells.push({ x: 140 + c * 76, y: trayTop + 42 + r * 64 });
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    return cells.slice(0, loose).map(p => ({ x: p.x + Math.round((rnd() - 0.5) * 18), y: p.y + Math.round((rnd() - 0.5) * 12) }));
  })();
  const stickHome = i => ({ x: 110, y: trayTop + 20 + i * 54 });

  const inFrame = p => p.x >= frameX - 10 && p.x <= frameX + frameW + 10 && p.y >= frameTop - 10 && p.y <= frameTop + frameH + 10;
  const onSpot = p => Math.hypot(p.x - spot.x, p.y - spot.y) <= SPOT_R + 22;

  const grab = (id, e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    setDrag({ id, x: p.x, y: p.y });
  };
  const move = e => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : d)); } };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e), id = drag.id;
    setDrag(null);
    if (id.startsWith('stick-')) {
      const i = Number(id.slice(6));
      if (!inFrame(p)) { setStickCol(a => a.map((v, k) => (k === i ? -1 : v))); return; }
      const free = c => !occ[c + '-0'] && !occ[c + '-1'];
      // The stick lays itself out where it is dropped: five columns centred on the drop. If they are not all free,
      // it goes back to the tray.
      const s0 = Math.min(cols - 5, Math.max(0, Math.floor((p.x - frameX - 10) / COLW) - 2));
      let ok = true;
      for (let k = 0; k < 5; k++) { const c = s0 + k; if ((occ[c + '-0'] && occ[c + '-0'] !== 's' + i) || (occ[c + '-1'] && occ[c + '-1'] !== 's' + i)) ok = false; }
      setStickCol(a => a.map((v, k) => (k === i ? (ok ? s0 : -1) : v)));
      return;
    }
    const i = Number(id.slice(8));
    const mine = 'c' + i;
    if (inFrame(p)) {
      let best = null, bd = 1e9;
      for (let c = 0; c < cols; c++) for (let r = 0; r < 2; r++) {
        const o = occ[c + '-' + r];
        if (o && o !== mine) continue;
        const s = seat(c, r), d = Math.hypot(s.x - p.x, s.y - p.y);
        if (d < bd) { bd = d; best = { w: 'slot', c, r }; }
      }
      setPos(a => a.map((v, k) => (k === i ? best || { w: 'tray' } : v)));
    } else if (onSpot(p) && (spotTaken < 0 || spotTaken === i)) {
      setPos(a => a.map((v, k) => (k === i ? { w: 'spot' } : v)));
    } else {
      setPos(a => a.map((v, k) => (k === i ? { w: 'tray' } : v)));
    }
  };

  const counterAt = i => {
    const id = 'counter-' + i;
    if (drag && drag.id === id) return { x: drag.x, y: drag.y };
    const p = pos[i];
    return p.w === 'slot' ? seat(p.c, p.r) : p.w === 'spot' ? spot : trayAt[i];
  };
  const counter = i => {
    const id = 'counter-' + i, { x, y } = counterAt(i);
    return (
      <g key={id} id={id} transform={'translate(' + x + ' ' + y + ')'} onPointerDown={e => grab(id, e)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
        {sticks ? (
          <g>
            <rect x="-22" y="-22" width="44" height="44" fill="transparent" />
            <rect x={-CUBE / 2} y={-CUBE / 2} width={CUBE} height={CUBE} rx="4" fill="#fbbf24" stroke="#92400e" strokeWidth="2" />
          </g>
        ) : (
          <g>
            <circle r={R} fill="#f472b6" stroke="#64748b" strokeWidth="2" />
            <circle r={R - 9} fill="none" stroke="#fbcfe8" strokeWidth="2" opacity="0.6" />
          </g>
        )}
      </g>
    );
  };
  const stickCubes = (x, y) => Array.from({ length: 10 }, (_, k) => (
    <rect key={k} x={x + k * (CUBE + 1)} y={y} width={CUBE} height={CUBE} rx="3" fill="#fbbf24" stroke="#92400e" strokeWidth="2" />
  ));
  const stick = i => {
    if (stickCol[i] >= 0) return null;
    const id = 'stick-' + i, held = drag && drag.id === id;
    const home = stickHome(i), x = held ? drag.x - 135 : home.x, y = held ? drag.y - 22 : home.y;
    return (
      <g key={id} id={id} onPointerDown={e => grab(id, e)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
        <rect x={x} y={y} width="270" height="44" fill="transparent" />
        {stickCubes(x, y + 9)}
      </g>
    );
  };
  const placedStick = i => {
    const c0 = stickCol[i];
    if (c0 < 0) return null;
    const out = [];
    for (let k = 0; k < 5; k++) for (let r = 0; r < 2; r++) {
      const s = seat(c0 + k, r);
      out.push(<rect key={k + '-' + r} x={s.x - CUBE / 2} y={s.y - CUBE / 2} width={CUBE} height={CUBE} rx="3" fill="#fbbf24" stroke="#92400e" strokeWidth="2" />);
    }
    return <g key={'placed-' + i} pointerEvents="none">{out}</g>;
  };

  const heldId = drag ? drag.id : null;
  const counterIdx = Array.from({ length: loose }, (_, i) => i).filter(i => 'counter-' + i !== heldId);
  const heldCounter = heldId && heldId.startsWith('counter-') ? Number(heldId.slice(8)) : -1;

  return (
    <Panel title="Partner Frame" caption={sticks ? 'Drag a ten-stick or a cube into the frame, or a cube onto the round spot.' : 'Drag a counter into a seat in the frame or onto the round spot.'}>
      <svg ref={svgRef} viewBox={'0 0 680 ' + H} onPointerMove={move} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />
        <rect x="16" y={trayTop} width="648" height={trayH} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x="62" y={trayTop + trayH / 2 + 14} textAnchor="middle" fontSize="40" fontWeight="700" fill="#e2e8f0">{n}</text>

        <rect id="frame" x={frameX} y={frameTop} width={frameW} height={frameH} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" pointerEvents="none" />
        {Array.from({ length: cols - 1 }, (_, c) => (
          <line key={'d' + c} x1={frameX + 10 + (c + 1) * COLW} y1={frameTop + 10} x2={frameX + 10 + (c + 1) * COLW} y2={frameTop + frameH - 10} stroke="#334155" strokeWidth="2" />
        ))}
        {Array.from({ length: cols * 2 }, (_, k) => {
          const c = Math.floor(k / 2), r = k % 2, s = seat(c, r);
          return sticks
            ? <rect key={'s' + k} id={'slot-' + c + '-' + r} x={s.x - 14} y={s.y - 14} width="28" height="28" rx="4" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="5 4" pointerEvents="none" />
            : <circle key={'s' + k} id={'slot-' + c + '-' + r} cx={s.x} cy={s.y} r={R} fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" pointerEvents="none" />;
        })}
        <circle id="spot" cx={spot.x} cy={spot.y} r={SPOT_R} fill="#1e293b" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" pointerEvents="none" />

        {stickCol.map((_, i) => placedStick(i))}
        {stickCol.map((_, i) => stick(i))}
        {counterIdx.map(counter)}
        {heldCounter >= 0 && counter(heldCounter)}
      </svg>
    </Panel>
  );
}
