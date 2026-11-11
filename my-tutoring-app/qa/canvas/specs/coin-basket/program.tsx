function Display({ params, lumina }) {
  // A shop shelf, a purse of coins and a basket. Drag a thing into the basket to buy it: its coins leave the purse.
  // A thing that costs more coins than are left will not go in. Drag it out of the basket to put it back and get the
  // coins back. Nothing says which things are needed: the situation in the ask does.
  // params.coins: coins in the purse. params.items: [{ id, pic, name, price, need }]. params.story: the situation, for the tutor.
  const coins = Math.max(1, Math.min(10, Number(params.coins) || 5));
  const items = (Array.isArray(params.items) ? params.items : [
    { id: 'bread', pic: '🍞', name: 'bread', price: 2, need: true },
    { id: 'toy', pic: '🚗', name: 'toy car', price: 3, need: false },
  ]).slice(0, 6).map(it => ({ ...it, price: Math.max(1, Math.min(5, Number(it.price) || 1)) }));
  const story = params.story || 'shopping';
  const W = 680, H = 500, SHELF_Y = 120, BASKET = { x: 150, y: 340, w: 380, h: 140 };

  const [inBasket, setInBasket] = useState([]);
  const [bounce, setBounce] = useState(null);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const spent = inBasket.reduce((s, id) => s + items.find(i => i.id === id).price, 0);
  const left = coins - spent;
  const goalMet = items.filter(i => i.need).every(i => inBasket.includes(i.id));

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      situation: story,
      purse: left + ' of ' + coins + ' coins left',
      shelf: items.filter(i => !inBasket.includes(i.id)).map(i => i.name + ' (' + i.price + (i.price === 1 ? ' coin)' : ' coins)')),
      basket: inBasket.map(id => items.find(i => i.id === id).name),
      lastTry: bounce ? 'the ' + items.find(i => i.id === bounce).name + ' costs more coins than are left in the purse, so it stayed on the shelf' : null,
    });
  }, [inBasket, bounce, goalMet]);

  const pointOf = e => svgPoint(svgRef.current, e);
  const grab = (id, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id }); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 20 && p.y <= r.y + r.h;
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e), id = drag.id, it = items.find(i => i.id === id);
    setDrag(null);
    const wasIn = inBasket.includes(id), dropIn = inRect(p, BASKET);
    if (dropIn && !wasIn) {
      if (it.price <= left) { setInBasket(b => [...b, id]); setBounce(null); } else setBounce(id);
    } else if (!dropIn && wasIn) { setInBasket(b => b.filter(x => x !== id)); setBounce(null); }
  };

  const CARD = 96, gap = 14, x0 = (W - (items.length * CARD + (items.length - 1) * gap)) / 2;
  const shelfAt = i => ({ x: x0 + i * (CARD + gap) + CARD / 2, y: SHELF_Y + 70 });
  const basketAt = k => ({ x: BASKET.x + 60 + (k % 4) * 88, y: BASKET.y + 52 + Math.floor(k / 4) * 60 });
  const coinRow = (n, cx, y, r) => Array.from({ length: n }, (_, k) => (
    <circle key={k} cx={cx + (k - (n - 1) / 2) * (r * 2 + 4)} cy={y} r={r} fill="#facc15" stroke="#a16207" strokeWidth="2" />));

  const itemPic = (it, i) => {
    const held = drag && drag.id === it.id && drag.x !== undefined;
    const k = inBasket.indexOf(it.id);
    const p = held ? { x: drag.x, y: drag.y } : k >= 0 ? basketAt(k) : shelfAt(i);
    const small = k >= 0 && !held;
    return <g key={it.id} id={'item-' + it.id} transform={`translate(${p.x}, ${p.y}) scale(${held ? 1.1 : small ? 0.8 : 1})`}
      style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={e => grab(it.id, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      <rect x="-44" y="-50" width="88" height="100" rx="12" fill="#1e293b" stroke={bounce === it.id ? '#94a3b8' : '#475569'} strokeWidth="2" />
      <text y="2" textAnchor="middle" fontSize="44" dominantBaseline="middle">{it.pic}</text>
      {k < 0 && <g>{coinRow(it.price, 0, 38, 6)}</g>}
    </g>;
  };

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        {/* purse */}
        <g id="purse">
          <rect x="20" y="14" width={Math.max(150, coins * 30 + 60)} height="70" rx="16" fill="#7c2d12" stroke="#431407" strokeWidth="3" />
          <path d="M 40 14 Q 60 -4 80 14" fill="none" stroke="#431407" strokeWidth="4" />
          {Array.from({ length: left }, (_, k) => <circle key={k} cx={52 + k * 30} cy="49" r="12" fill="#facc15" stroke="#a16207" strokeWidth="2.5" />)}
        </g>
        {/* shelf */}
        <rect x="20" y={SHELF_Y + 128} width={W - 40} height="14" rx="4" fill="#92400e" />
        {/* basket */}
        <g id="basket">
          <path d={`M ${BASKET.x} ${BASKET.y} L ${BASKET.x + BASKET.w} ${BASKET.y} L ${BASKET.x + BASKET.w - 30} ${BASKET.y + BASKET.h} L ${BASKET.x + 30} ${BASKET.y + BASKET.h} Z`}
            fill="#a16207" stroke="#713f12" strokeWidth="3" opacity="0.9" />
          {[1, 2, 3].map(r => <line key={r} x1={BASKET.x + 10 * r} y1={BASKET.y + 35 * r} x2={BASKET.x + BASKET.w - 10 * r} y2={BASKET.y + 35 * r} stroke="#713f12" strokeWidth="2" />)}
          <path d={`M ${BASKET.x + 60} ${BASKET.y} Q ${BASKET.x + BASKET.w / 2} ${BASKET.y - 70} ${BASKET.x + BASKET.w - 60} ${BASKET.y}`} fill="none" stroke="#713f12" strokeWidth="6" />
        </g>
        {items.map((it, i) => (inBasket.includes(it.id) ? null : itemPic(it, i)))}
        {items.map((it, i) => (inBasket.includes(it.id) ? itemPic(it, i) : null))}
      </svg>
    </Panel>
  );
}
