// For One (6.RP.A.2). A purse holds the coins a stall's things cost in all (said in the ask, drawn as loose coins, no
// price printed). The child drags coins out of the purse onto the things, one coin a drag, until the purse is empty and
// every thing holds the same; then says the price of one. A second stall (stalls: 2) puts two shares side by side and
// the child says which stall sells one thing cheaper. The transfer swaps coins for road pieces worth 10 km each (a
// scaled move: 150 km cannot be dealt one km at a time) and the things for hours. Say and show: the amount for one.
function Display({ params, lumina }) {
  const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  const stalls = num(params.stalls, 1) >= 2 ? 2 : 1;
  const totals = [num(params.total, 12), num(params.total2, 15)].slice(0, stalls);
  const counts = [num(params.items, 4), num(params.items2, 5)].slice(0, stalls);
  const worth = num(params.worth, 1); // what one piece in the purse is worth (1 coin, or 10 km)
  const road = worth > 1;
  const emoji = String(params.emoji || '🍐');
  const itemName = String(params.itemName || 'pear');
  const purseSide = String(params.purseSide || 'left');

  const [purse, setPurse] = useState(() => totals.slice());
  const [onItem, setOnItem] = useState(() => counts.map(n => Array.from({ length: n }, () => 0)));
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  // The said answer and the wrong rules, from params only.
  useEffect(() => {
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const frac = (n, d) => { const g = gcd(n, d); return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`; };
    const val = v => (typeof v === 'string' && v.includes('/') ? Number(v.split('/')[0]) / Number(v.split('/')[1]) : Number(v));
    if (stalls === 2) {
      const per = totals.map((t, s) => t / counts[s]);
      const pick = (a, b) => (a < b ? 'first' : b < a ? 'second' : 'same');
      const key = pick(per[0], per[1]);
      const misrules = [
        { says: pick(totals[0], totals[1]), because: 'compared the purses, the fewer coins in all, not the price of one ' + itemName },
        { says: pick(totals[0] - counts[0], totals[1] - counts[1]), because: 'took the number of ' + itemName + 's away from the coins at each stall' },
      ].filter((m, i, all) => m.says !== key && all.findIndex(x => x.says === m.says) === i);
      lumina.answer(key, misrules, ['first', 'second', 'same']);
      return;
    }
    const total = totals[0] * worth, n = counts[0];
    const key = total / n;
    const misrules = [
      { says: total - n, because: 'took the number of ' + itemName + 's away from the total instead of sharing it' },
      { says: frac(n, total), because: 'divided the wrong way: the ' + itemName + 's by the total, not the total by the ' + itemName + 's' },
      road ? { says: totals[0] / n, because: 'counted the road pieces on one hour, not the km they hold' } : null,
    ].filter((m, i, all) => m && val(m.says) > 0 && val(m.says) !== key && all.findIndex(x => x && val(x.says) === val(m.says)) === i);
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    const fair = purse.every(p => p === 0) && onItem.every(row => row.every(c => c === row[0]));
    lumina.goal(fair);
    const piece = road ? 'road piece of ' + worth + ' km' : 'coin';
    lumina.scene({
      piece,
      thing: road ? 'hour' : itemName,
      stalls: purse.map((p, s) => ({
        ...(stalls === 2 ? { stall: s === 0 ? 'first' : 'second' } : {}),
        [road ? 'roadPiecesNotYetDealt' : 'coinsInPurse']: p,
        [road ? 'roadPiecesOnEachHour' : 'coinsOnEach' + itemName[0].toUpperCase() + itemName.slice(1)]: onItem[s],
      })),
    });
  }, [purse, onItem]);

  // Layout, sized to this problem.
  const W = 680;
  const stallW = stalls === 2 ? 320 : 640;
  const stallX = s => (stalls === 2 ? 14 + s * 332 : 20);
  const top = stalls === 2 ? 34 : 14;
  const P = road ? { w: 56, h: 28, sx: 62, sy: 34 } : { w: 22, h: 22, sx: 26, sy: 26 };
  const purseCols = s => Math.max(3, Math.floor((Math.min(stallW, 520) - 96) / P.sx));
  const purseRows = s => Math.ceil(totals[s] / purseCols(s));
  const maxPurseRows = Math.max(...totals.map((_, s) => purseRows(s)));
  const purseW = s => Math.min(stallW, 96 + Math.min(totals[s], purseCols(s)) * P.sx + 10);
  const purseH = Math.max(76, 20 + maxPurseRows * P.sy + 12);
  const purseX = s => {
    const x0 = stallX(s);
    if (stalls === 2) return x0 + (stallW - purseW(s)) / 2;
    return purseSide === 'right' ? x0 + stallW - purseW(s) : x0;
  };
  const itemsY = top + purseH + 26;
  const itemW = s => Math.min(150, (stallW - 10 * (counts[s] - 1)) / counts[s]);
  const itemX = (s, i) => {
    const w = itemW(s), all = counts[s] * w + (counts[s] - 1) * 10;
    return stallX(s) + (stallW - all) / 2 + i * (w + 10);
  };
  const trayCols = s => Math.max(2, Math.floor((itemW(s) - 12) / P.sx));
  const perOne = Math.max(...totals.map((t, s) => Math.ceil(t / counts[s])));
  const trayRows = Math.max(...totals.map((t, s) => Math.ceil((Math.ceil(t / counts[s]) + 2) / trayCols(s))));
  const trayH = trayRows * P.sy + 14;
  const EMOJI_H = road ? 70 : 56;
  const itemH = EMOJI_H + trayH + 10;
  const H = itemsY + itemH + 16;

  const pieceAt = (k, cols, x0, y0, rowsFit) => {
    const col = k % cols, row = Math.floor(k / cols);
    return { x: x0 + col * P.sx, y: y0 + row * P.sy };
  };
  const drawPiece = (x, y, key, extra) => road ? (
    <g key={key} transform={`translate(${x}, ${y})`} {...extra}>
      <rect x={-P.w / 2} y={-P.h / 2} width={P.w} height={P.h} rx="5" fill="#15803d" stroke="#e2e8f0" strokeWidth="1.5" />
      <text y="5" textAnchor="middle" fontSize="14" fontWeight="600" fill="#f8fafc">{worth} km</text>
    </g>
  ) : (
    <g key={key} transform={`translate(${x}, ${y})`} {...extra}>
      <circle r="11" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
      <circle r="6" fill="none" stroke="#b45309" strokeWidth="1.2" opacity="0.7" />
    </g>
  );

  // Where a drop lands: a thing or the purse of the same stall, or nothing.
  const hit = (s, pt) => {
    for (let i = 0; i < counts[s]; i++) {
      const x = itemX(s, i);
      if (pt.x >= x - 4 && pt.x <= x + itemW(s) + 4 && pt.y >= itemsY - 10 && pt.y <= itemsY + itemH + 8) return { kind: 'item', i };
    }
    const px = purseX(s);
    if (pt.x >= px - 4 && pt.x <= px + purseW(s) + 4 && pt.y >= top - 6 && pt.y <= top + purseH + 6) return { kind: 'purse' };
    return null;
  };

  const grab = (s, from, e) => {
    if (from === 'purse' ? purse[s] === 0 : onItem[s][from] === 0) return;
    const pt = svgPoint(svgRef.current, e);
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) {}
    setDrag({ s, from, x: pt.x, y: pt.y });
  };
  const move = e => { if (drag) { const pt = svgPoint(svgRef.current, e); setDrag({ ...drag, x: pt.x, y: pt.y }); } };
  const drop = e => {
    if (!drag) return;
    const pt = svgPoint(svgRef.current, e);
    const { s, from } = drag;
    setDrag(null);
    const to = hit(s, pt);
    if (!to) return;
    if (to.kind === 'purse' && from === 'purse') return;
    if (to.kind === 'item' && to.i === from) return;
    if (from === 'purse') setPurse(p => p.map((v, k) => (k === s ? v - 1 : v)));
    else setOnItem(o => o.map((row, k) => (k === s ? row.map((v, j) => (j === from ? v - 1 : v)) : row)));
    if (to.kind === 'purse') setPurse(p => p.map((v, k) => (k === s ? v + 1 : v)));
    else setOnItem(o => o.map((row, k) => (k === s ? row.map((v, j) => (j === to.i ? v + 1 : v)) : row)));
  };

  const held = (s, from) => (drag && drag.s === s && drag.from === from ? 1 : 0);

  const drawStall = s => {
    const px = purseX(s), pw = purseW(s), cols = purseCols(s);
    const inPurse = purse[s] - held(s, 'purse');
    return (
      <g key={'stall' + s}>
        {stalls === 2 && (
          <text x={stallX(s) + stallW / 2} y={22} textAnchor="middle" fontSize="18" fontWeight="600" fill="#e2e8f0">{s === 0 ? 'First stall' : 'Second stall'}</text>
        )}
        <g id={'purse-' + s} onPointerDown={e => grab(s, 'purse', e)} style={{ cursor: purse[s] ? 'grab' : 'default', touchAction: 'none' }}>
          <rect x={px} y={top} width={pw} height={purseH} rx="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <text x={px + 44} y={top + purseH / 2 + 4} textAnchor="middle" dominantBaseline="middle" fontSize="40">{road ? '🚗' : '👛'}</text>
          <text x={px + 44} y={top + purseH - 8} textAnchor="middle" fontSize="14" fill="#cbd5e1">{road ? 'the trip' : 'purse'}</text>
          {Array.from({ length: inPurse }, (_, k) => {
            const p = pieceAt(k, cols, px + 96 + P.sx / 2 - 4, top + 20 + P.sy / 2 - 6);
            return drawPiece(p.x, p.y, 'pp' + k, { pointerEvents: 'none' });
          })}
        </g>
        {Array.from({ length: counts[s] }, (_, i) => {
          const x = itemX(s, i), w = itemW(s), tc = trayCols(s);
          const n = onItem[s][i] - held(s, i);
          const rowsUsed = Math.ceil(n / tc);
          const sy = rowsUsed > trayRows ? (trayH - 14 - P.sy) / Math.max(1, rowsUsed - 1) : P.sy;
          const x0 = x + (w - (tc - 1) * P.sx) / 2;
          return (
            <g key={'it' + i} id={'item-' + s + '-' + i} onPointerDown={e => grab(s, i, e)} style={{ cursor: onItem[s][i] ? 'grab' : 'default', touchAction: 'none' }}>
              <rect x={x} y={itemsY} width={w} height={itemH} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              <text x={x + w / 2} y={itemsY + (road ? 30 : 32)} textAnchor="middle" dominantBaseline="middle" fontSize="34">{emoji}</text>
              {road && <text x={x + w / 2} y={itemsY + 60} textAnchor="middle" fontSize="15" fill="#cbd5e1">{'hour ' + (i + 1)}</text>}
              <rect x={x + 6} y={itemsY + EMOJI_H} width={w - 12} height={trayH} rx="8" fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 5" />
              {Array.from({ length: n }, (_, k) => {
                const col = k % tc, row = Math.floor(k / tc);
                return drawPiece(x0 + col * P.sx, itemsY + EMOJI_H + 7 + P.sy / 2 + row * sy, 'c' + k, { pointerEvents: 'none' });
              })}
            </g>
          );
        })}
      </g>
    );
  };

  const caption = road
    ? 'Drag a 10 km piece of the trip onto an hour. Drag it back to move it.'
    : 'Drag a coin from the purse onto ' + (/^[aeiou]/i.test(itemName) ? 'an ' : 'a ') + itemName + '. Drag a coin back to move it.';

  return (
    <Panel title={road ? 'Road Trip' : 'Market Stall'} caption={caption}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={drop}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        {stalls === 2 && <line x1={W / 2} y1={10} x2={W / 2} y2={H - 10} stroke="#334155" strokeWidth="2" />}
        {Array.from({ length: stalls }, (_, s) => drawStall(s))}
        {drag && <g pointerEvents="none" opacity="0.95">{drawPiece(drag.x, drag.y, 'drag')}</g>}
      </svg>
    </Panel>
  );
}
