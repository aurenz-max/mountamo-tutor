function Display({ params, lumina }) {
  // A purse of five coins, a picture of where we are, and a shelf of things. Each thing shows its price as empty coin
  // rings. Drag a coin onto a thing to pay one ring; drag a paid coin off the shelf to take it back to the purse.
  // Nothing on a thing says whether it is a need: the picture of where we are does (snow, an empty or full coat hook,
  // the sun, a boat).
  // params.items: [{ id, pic, name, price (1-3), need, liked }]. need and liked are never drawn or put in the scene.
  // params.where: emoji drawn in the picture of where we are. params.hook: coats already on the hook (absent: no hook).
  // params.place: the picture in words, for the tutor.
  const COINS = 5;
  const items = (Array.isArray(params.items) ? params.items : [
    { id: 'car', pic: '🚗', name: 'toy car', price: 3, need: false, liked: true },
    { id: 'sandwich', pic: '🥪', name: 'sandwich', price: 3, need: true, liked: false },
  ]).slice(0, 6).map(it => ({ ...it, price: Math.max(1, Math.min(3, Number(it.price) || 1)) }));
  const where = Array.isArray(params.where) ? params.where : ['🍽️'];
  const hook = params.hook === undefined || params.hook === null ? null : Math.max(0, Math.min(3, Number(params.hook) || 0));
  const place = params.place || 'lunch time';

  const [placed, setPlaced] = useState([]); // [{ coin, item }] in the order paid
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const onItem = id => placed.filter(p => p.item === id);
  const needs = items.filter(i => i.need);
  const goalMet = items.every(i => (i.need ? onItem(i.id).length === i.price : onItem(i.id).length === 0));

  // The said answer: how many of the things are needs. The misrule counts the things a child likes a lot as needs too.
  const key = needs.length;
  const likedToo = items.filter(i => i.need || i.liked).length;
  // A second misrule where a thing is already owned (the coats on the hook): counts it as a need to buy anyway.
  const ownedToo = key + items.filter(i => i.owned && !i.need).length;
  const misrules = [
    { says: likedToo, because: 'counts the things I like a lot as needs too' },
    { says: ownedToo, because: 'counts a coat as a need to buy even though three coats already hang on the hook' },
  ].filter((m, k, all) => m.says !== key && all.findIndex(x => x.says === m.says) === k);

  useEffect(() => {
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      place,
      coinsInPurse: COINS - placed.length,
      shelf: items.map(i => {
        const n = onItem(i.id).length;
        return i.name + ': costs ' + i.price + (i.price === 1 ? ' coin' : ' coins') + ', ' + n + ' paid';
      }),
    });
  }, [placed, goalMet]);

  const W = 680, TOP = 14, TOP_H = 120, SHELF_Y = 156, CW = 150, CH = 146, GAP = 12, ROW = CH + 16;
  const perRow = items.length > 4 ? 3 : items.length;
  const rows = Math.ceil(items.length / perRow);
  const H = SHELF_Y + rows * ROW;
  const cardAt = i => {
    const r = Math.floor(i / perRow), c = i % perRow, inRow = Math.min(perRow, items.length - r * perRow);
    const x0 = (W - (inRow * CW + (inRow - 1) * GAP)) / 2;
    return { x: x0 + c * (CW + GAP), y: SHELF_Y + r * ROW, w: CW, h: CH };
  };
  const ringAt = (i, k) => {
    const c = cardAt(i), n = items[i].price;
    return { x: c.x + CW / 2 + (k - (n - 1) / 2) * 46, y: c.y + 118 };
  };
  const purseAt = k => ({ x: 404 + k * 54, y: TOP + 66 });

  const coinPos = coin => {
    if (drag && drag.coin === coin && drag.x !== undefined) return { x: drag.x, y: drag.y, r: 22 };
    const p = placed.find(q => q.coin === coin);
    if (p) {
      const i = items.findIndex(it => it.id === p.item);
      const k = onItem(p.item).findIndex(q => q.coin === coin);
      const at = ringAt(i, k);
      return { x: at.x, y: at.y, r: 17 };
    }
    const inPurse = Array.from({ length: COINS }, (_, k) => k).filter(k => !placed.some(q => q.coin === k));
    return { ...purseAt(inPurse.indexOf(coin)), r: 22 };
  };

  const pointOf = e => svgPoint(svgRef.current, e);
  const grab = (coin, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ coin }); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e), coin = drag.coin;
    setDrag(null);
    const hit = items.findIndex((it, i) => { const c = cardAt(i); return p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h; });
    const was = placed.find(q => q.coin === coin);
    if (hit >= 0) {
      const it = items[hit];
      if (was && was.item === it.id) return;
      if (onItem(it.id).length >= it.price) return;
      setPlaced(ps => [...ps.filter(q => q.coin !== coin), { coin, item: it.id }]);
    } else if (was) {
      setPlaced(ps => ps.filter(q => q.coin !== coin));
    }
  };

  const hookPic = () => {
    if (hook === null) return null;
    const hx = 196, hy = TOP + 24;
    return <g>
      <rect x={hx} y={hy} width="120" height="10" rx="4" fill="#92400e" />
      {[0, 1, 2].map(k => <circle key={k} cx={hx + 22 + k * 38} cy={hy + 14} r="4" fill="#78350f" />)}
      {Array.from({ length: hook }, (_, k) => (
        <text key={k} x={hx + 22 + k * 38} y={hy + 50} textAnchor="middle" dominantBaseline="middle" fontSize="40">🧥</text>
      ))}
    </g>;
  };

  const wherePic = () => {
    const room = hook === null ? 300 : 170;
    return where.slice(0, 4).map((w, k) => (
      <text key={k} x={20 + (room / (Math.min(4, where.length) + 1)) * (k + 1)} y={TOP + TOP_H / 2 + 2}
        textAnchor="middle" dominantBaseline="middle" fontSize="48">{w}</text>
    ));
  };

  const card = (it, i) => {
    const c = cardAt(i);
    return <g key={it.id} id={'thing-' + it.id}>
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <text x={c.x + CW / 2} y={c.y + 44} textAnchor="middle" dominantBaseline="middle" fontSize="54">{it.pic}</text>
      <text x={c.x + CW / 2} y={c.y + 88} textAnchor="middle" fontSize="16" fill="#cbd5e1">{it.name}</text>
      {Array.from({ length: it.price }, (_, k) => { const r = ringAt(i, k); return (
        <circle key={k} cx={r.x} cy={r.y} r="17" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="6 5" />); })}
    </g>;
  };

  const coinPic = coin => {
    const p = coinPos(coin);
    return <g key={coin} id={'coin-' + (coin + 1)} transform={`translate(${p.x}, ${p.y})`}
      style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={e => grab(coin, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      <circle r="23" fill="transparent" />
      <circle r={p.r} fill="#facc15" stroke="#a16207" strokeWidth="2.5" />
      <circle r={p.r - 6} fill="none" stroke="#ca8a04" strokeWidth="1.5" />
    </g>;
  };

  const order = Array.from({ length: COINS }, (_, k) => k).sort((a, b) => (drag && drag.coin === a ? 1 : drag && drag.coin === b ? -1 : 0));

  return (
    <Panel title="Five Coins" caption="Drag a coin onto a thing to pay for it. Drag it back up to the purse to take it back.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        {/* where we are */}
        <rect x="20" y={TOP} width="320" height={TOP_H} rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {wherePic()}
        {hookPic()}
        {/* purse */}
        <g id="purse">
          <rect x="360" y={TOP} width="300" height={TOP_H} rx="18" fill="#7c2d12" stroke="#431407" strokeWidth="3" />
          <path d={`M 470 ${TOP} Q 510 ${TOP - 12} 550 ${TOP}`} fill="none" stroke="#9a3412" strokeWidth="5" />
        </g>
        {items.map(card)}
        {order.map(coinPic)}
      </svg>
    </Panel>
  );
}
