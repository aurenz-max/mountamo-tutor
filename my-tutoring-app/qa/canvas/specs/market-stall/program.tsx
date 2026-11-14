function Display({ params, lumina }) {
  // A market stall under the day's sky. Three tasks on one world:
  //  stock:   drag things from the crate onto the stall's shelf (params.start may pre-fill it with yesterday's stock).
  //  restock: yesterday's shelf shows what sold (faded places) and what was left; fill the wagon for tomorrow.
  //  price:   each row shows what is left, its price in coins and the buyers waiting; tap - or + to change a price.
  //  compare: two shops sell the same thing at different prices; drag one into the basket and its coins leave the purse.
  // Nothing on screen says which things fit the day or which price is right. The sky, the sales and the queue do.
  // params.task, params.weather (rain | sun | hot | snow), params.slots, params.kinds [{ id, pic, name, count, fits }],
  // params.start [kind ids], params.yesterday [{ id, morning, left }], params.rows [{ id, pic, name, left, buyers, price, move }],
  // params.item { pic, name }, params.shops [{ id, sign, name, price }], params.coins, params.story (for the tutor).
  const task = ['stock', 'restock', 'price', 'compare'].includes(params.task) ? params.task : 'stock';
  const weather = ['rain', 'sun', 'hot', 'snow'].includes(params.weather) ? params.weather : 'sun';
  const story = params.story || 'a day at the market stall';
  const slots = Math.max(1, Math.min(4, Number(params.slots) || 3));
  const kinds = (Array.isArray(params.kinds) ? params.kinds : [
    { id: 'umbrella', pic: '☂️', name: 'umbrella', fits: true },
    { id: 'shades', pic: '🕶️', name: 'sunglasses', fits: false },
  ]).slice(0, 6).map(k => ({ ...k, count: k.count == null ? 99 : Math.max(0, Number(k.count) || 0) }));
  const kindOf = id => kinds.find(k => k.id === id);
  const startSlots = Array.from({ length: slots }, (_, i) => (Array.isArray(params.start) && kindOf(params.start[i]) ? params.start[i] : null));
  const yesterday = (Array.isArray(params.yesterday) ? params.yesterday : []).slice(0, 3).map(r => ({
    ...r, morning: Math.max(1, Math.min(5, Number(r.morning) || 4)), left: Math.max(0, Math.min(5, Number(r.left) || 0)),
  }));
  const rows = (Array.isArray(params.rows) ? params.rows : [
    { id: 'umbrella', pic: '☂️', name: 'umbrella', left: 4, buyers: 0, price: 3, move: 'down' },
  ]).slice(0, 2).map(r => ({
    ...r, left: Math.max(0, Math.min(6, Number(r.left) || 0)), buyers: Math.max(0, Math.min(6, Number(r.buyers) || 0)),
    price: Math.max(1, Math.min(5, Number(r.price) || 2)),
  }));
  const item = params.item && params.item.pic ? params.item : { pic: '🖍️', name: 'crayons' };
  const shops = (Array.isArray(params.shops) ? params.shops : [
    { id: 'toys', sign: '🧸', name: 'toy shop', price: 4 },
    { id: 'food', sign: '🥕', name: 'grocery shop', price: 2 },
  ]).slice(0, 2).map(s => ({ ...s, price: Math.max(1, Math.min(5, Number(s.price) || 2)) }));
  const coins = Math.max(1, Math.min(8, Number(params.coins) || 5));

  const W = 680;
  const H = task === 'compare' ? 470 : task === 'price' ? 440 : task === 'restock' ? 592 : 490;
  const SLOT = 96, SGAP = 18;
  const SLOTS_Y = task === 'restock' ? 336 : 162;
  const slotsW = slots * SLOT + (slots - 1) * SGAP;
  const SLOTS_RECT = { x: (W - slotsW) / 2 - 30, y: SLOTS_Y - 14, w: slotsW + 60, h: SLOT + 28 };
  const CRATE_Y = task === 'restock' ? 468 : 312;

  const [shelf, setShelf] = useState(startSlots);
  const [prices, setPrices] = useState(rows.map(r => r.price));
  const [bought, setBought] = useState(null);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const placed = id => shelf.filter(s => s === id).length;
  const avail = k => k.count - placed(k.id);
  const cheapest = Math.min(...shops.map(s => s.price));
  const shopOf = id => shops.find(s => s.id === id);
  const purse = coins - (bought ? shopOf(bought).price : 0);
  const goalMet = task === 'compare' ? !!bought && shopOf(bought).price === cheapest
    : task === 'price'
    ? rows.every((r, i) => (r.move === 'up' ? prices[i] > r.price : r.move === 'down' ? prices[i] < r.price : prices[i] === r.price))
    : shelf.every(s => s && kindOf(s) && kindOf(s).fits);

  const weatherWords = { rain: 'rainy and wet', sun: 'sunny', hot: 'very hot and sunny', snow: 'snowy and cold' }[weather];
  useEffect(() => {
    lumina.goal(goalMet);
    const scene = { situation: story, sky: weatherWords + (task === 'restock' ? ' (tomorrow)' : '') };
    if (task === 'compare') {
      scene.shops = shops.map(s => s.name + ' sells ' + item.name + ' for ' + s.price + (s.price === 1 ? ' coin' : ' coins'));
      scene.purse = purse + ' of ' + coins + ' coins left';
      scene.basket = bought ? item.name + ' from the ' + shopOf(bought).name : 'empty';
    } else if (task === 'price') {
      scene.stall = rows.map((r, i) => r.name + ': ' + r.left + ' left, price ' + prices[i] + (prices[i] === 1 ? ' coin' : ' coins') +
        (prices[i] !== r.price ? ' (was ' + r.price + ')' : '') + ', ' + r.buyers + (r.buyers === 1 ? ' buyer waiting' : ' buyers waiting'));
    } else {
      if (task === 'restock') scene.yesterday = yesterday.map(r => { const k = kindOf(r.id); return (k ? k.name : r.id) + ': ' + r.morning + ' in the morning, ' + r.left + ' left at the end of the day'; });
      scene[task === 'restock' ? 'wagon' : 'shelf'] = shelf.map(s => (s ? kindOf(s).name : 'empty'));
      scene.crate = kinds.filter(k => avail(k) > 0).map(k => k.name);
    }
    lumina.scene(scene);
  }, [shelf, prices, bought, goalMet]);

  const pointOf = e => svgPoint(svgRef.current, e);
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  const grab = (d, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(d); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e), d = drag;
    setDrag(null);
    if (d.from === 'shop') {
      const inBasket = inRect(p, BASKET_RECT);
      if (inBasket && d.shop !== bought) setBought(d.shop);
      else if (!inBasket && d.shop === bought) setBought(null);
      return;
    }
    const into = inRect(p, SLOTS_RECT);
    if (d.from === 'crate' && into) {
      const k = kindOf(d.kind), free = shelf.indexOf(null);
      if (k && avail(k) > 0 && free >= 0) setShelf(s => s.map((v, i) => (i === free ? d.kind : v)));
    } else if (d.from === 'slot' && !into) {
      setShelf(s => s.map((v, i) => (i === d.slot ? null : v)));
    }
  };
  const nudge = (i, by) => setPrices(ps => ps.map((v, j) => (j === i ? Math.max(1, Math.min(5, v + by)) : v)));

  // ---- the sky ----
  const sky = () => {
    const bg = { rain: '#334155', sun: '#0c4a6e', hot: '#9a3412', snow: '#475569' }[weather];
    const cloud = (cx, cy, fill) => <g fill={fill}><circle cx={cx - 34} cy={cy + 6} r="22" /><circle cx={cx} cy={cy - 6} r="30" /><circle cx={cx + 36} cy={cy + 6} r="22" /><rect x={cx - 56} y={cy + 6} width="114" height="22" rx="11" /></g>;
    return <g>
      <rect x="0" y="0" width={W} height="100" fill={bg} />
      {(weather === 'sun' || weather === 'hot') && <g>
        <circle cx="590" cy="50" r={weather === 'hot' ? 34 : 26} fill="#facc15" />
        {Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2, r0 = weather === 'hot' ? 42 : 34; return <line key={k} x1={590 + Math.cos(a) * r0} y1={50 + Math.sin(a) * r0} x2={590 + Math.cos(a) * (r0 + 12)} y2={50 + Math.sin(a) * (r0 + 12)} stroke="#facc15" strokeWidth="4" strokeLinecap="round" />; })}
        {weather === 'hot' && [0, 1, 2].map(k => <path key={k} d={`M ${90 + k * 140} 80 q 10 -12 20 0 t 20 0 t 20 0 t 20 0`} fill="none" stroke="#fdba74" strokeWidth="3" />)}
      </g>}
      {weather === 'rain' && <g>{cloud(160, 36, '#94a3b8')}{cloud(470, 30, '#94a3b8')}
        {Array.from({ length: 16 }, (_, k) => <line key={k} x1={90 + k * 34} y1={66 + (k % 3) * 8} x2={84 + k * 34} y2={82 + (k % 3) * 8} stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" />)}</g>}
      {weather === 'snow' && <g>{cloud(160, 36, '#e2e8f0')}{cloud(470, 30, '#e2e8f0')}
        {Array.from({ length: 16 }, (_, k) => <circle key={k} cx={90 + k * 34} cy={74 + (k % 3) * 8} r="4" fill="#f8fafc" />)}</g>}
    </g>;
  };

  // ---- the stall ----
  const awning = () => <g>
    {Array.from({ length: 10 }, (_, k) => <path key={k} d={`M ${90 + k * 50} 108 l 50 0 l 0 30 q -25 16 -50 0 z`} fill={k % 2 ? '#f8fafc' : '#dc2626'} />)}
    <rect x="96" y="138" width="8" height={(task === 'price' ? H : CRATE_Y) - 150} fill="#78350f" /><rect x="576" y="138" width="8" height={(task === 'price' ? H : CRATE_Y) - 150} fill="#78350f" />
  </g>;

  const slotAt = i => ({ x: (W - slotsW) / 2 + i * (SLOT + SGAP) + SLOT / 2, y: SLOTS_Y + SLOT / 2 });
  const card = (k, held) => <g>
    <rect x="-44" y="-44" width="88" height="88" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
    <text y="4" textAnchor="middle" fontSize="46" dominantBaseline="middle">{k.pic}</text>
  </g>;

  const shelfArea = () => <g id="slots">
    {task === 'restock'
      ? <g><rect x={SLOTS_RECT.x} y={SLOTS_RECT.y} width={SLOTS_RECT.w} height={SLOTS_RECT.h} rx="14" fill="#713f12" stroke="#422006" strokeWidth="3" />
        <circle cx={SLOTS_RECT.x + 40} cy={SLOTS_RECT.y + SLOTS_RECT.h + 4} r="14" fill="#1e293b" stroke="#94a3b8" strokeWidth="3" />
        <circle cx={SLOTS_RECT.x + SLOTS_RECT.w - 40} cy={SLOTS_RECT.y + SLOTS_RECT.h + 4} r="14" fill="#1e293b" stroke="#94a3b8" strokeWidth="3" />
        <line x1={SLOTS_RECT.x + SLOTS_RECT.w} y1={SLOTS_RECT.y + 20} x2={SLOTS_RECT.x + SLOTS_RECT.w + 40} y2={SLOTS_RECT.y - 10} stroke="#422006" strokeWidth="6" strokeLinecap="round" /></g>
      : <g><rect x={SLOTS_RECT.x} y={SLOTS_RECT.y} width={SLOTS_RECT.w} height={SLOTS_RECT.h} rx="8" fill="#451a03" opacity="0.6" />
        <rect x={SLOTS_RECT.x - 10} y={SLOTS_RECT.y + SLOTS_RECT.h} width={SLOTS_RECT.w + 20} height="14" rx="4" fill="#92400e" /></g>}
    {shelf.map((s, i) => { const p = slotAt(i); return s ? null : <rect key={i} x={p.x - 44} y={p.y - 44} width="88" height="88" rx="12" fill="none" stroke="#a8a29e" strokeWidth="2" strokeDasharray="6 6" />; })}
  </g>;

  const slotItem = i => {
    const s = shelf[i]; if (!s) return null;
    const held = drag && drag.from === 'slot' && drag.slot === i && drag.x !== undefined;
    const p = held ? { x: drag.x, y: drag.y } : slotAt(i);
    return <g key={'slot' + i} id={'slot-' + i} transform={`translate(${p.x}, ${p.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
      onPointerDown={e => grab({ from: 'slot', slot: i, kind: s }, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>{card(kindOf(s))}</g>;
  };

  const CW = 92, CGAP = 12, cx0 = (W - (kinds.length * CW + (kinds.length - 1) * CGAP)) / 2;
  const crateAt = i => ({ x: cx0 + i * (CW + CGAP) + CW / 2, y: CRATE_Y + 64 });
  const crate = () => <g id="crate">
    <rect x="30" y={CRATE_Y} width={W - 60} height="128" rx="10" fill="#57534e" stroke="#292524" strokeWidth="3" />
    {[1, 2].map(r => <line key={r} x1="30" y1={CRATE_Y + r * 43} x2={W - 30} y2={CRATE_Y + r * 43} stroke="#44403c" strokeWidth="2" />)}
  </g>;
  const crateItem = (k, i) => {
    if (avail(k) <= 0) return null;
    const held = drag && drag.from === 'crate' && drag.kind === k.id && drag.x !== undefined;
    const home = crateAt(i), many = k.count > 1;
    return <g key={k.id}>
      {held && many && <g transform={`translate(${home.x}, ${home.y})`}>{card(k)}</g>}
      <g id={'stack-' + k.id} transform={`translate(${held ? drag.x : home.x}, ${held ? drag.y : home.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => grab({ from: 'crate', kind: k.id }, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        {many && !held && <rect x="-38" y="-50" width="88" height="88" rx="12" fill="#334155" stroke="#475569" strokeWidth="2" />}
        {card(k)}
      </g>
    </g>;
  };

  // ---- yesterday's shelf: one row per thing; a faded place is one that sold ----
  const yesterdayRows = () => <g id="yesterday">
    <rect x="120" y="150" width="440" height={yesterday.length * 56 + 12} rx="10" fill="#1c1917" stroke="#57534e" strokeWidth="2" />
    {yesterday.map((r, ri) => { const k = kindOf(r.id) || { pic: '?' }; const y = 186 + ri * 56; return <g key={r.id} id={'row-' + r.id}>
      {Array.from({ length: r.morning }, (_, j) => { const x = 170 + j * 76, sold = j >= r.left; return <g key={j} transform={`translate(${x}, ${y})`}>
        <rect x="-26" y="-24" width="52" height="48" rx="8" fill={sold ? 'none' : '#292524'} stroke="#78716c" strokeWidth="2" strokeDasharray={sold ? '5 5' : 'none'} />
        <text y="3" textAnchor="middle" dominantBaseline="middle" fontSize="30" opacity={sold ? 0.18 : 1}>{k.pic}</text></g>; })}
    </g>; })}
  </g>;

  // ---- prices ----
  const btn = (id, x, y, label, on, act) => <g id={id} transform={`translate(${x}, ${y})`} style={{ cursor: on ? 'pointer' : 'default' }} opacity={on ? 1 : 0.3} onClick={on ? act : undefined}>
    <rect x="-24" y="-24" width="48" height="48" rx="12" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
    <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="32" fill="#f8fafc" fontWeight="700">{label}</text></g>;
  const priceRow = (r, i) => { const y = 214 + i * 124, n = prices[i]; return <g key={r.id} id={'row-' + r.id}>
    <rect x="30" y={y - 54} width={W - 60} height="108" rx="12" fill="#1c1917" stroke="#57534e" strokeWidth="2" />
    {Array.from({ length: r.left }, (_, j) => <text key={j} x={72 + (j % 3) * 46} y={y - 22 + Math.floor(j / 3) * 46} textAnchor="middle" dominantBaseline="middle" fontSize="34">{r.pic}</text>)}
    {r.left === 0 && <rect x="50" y={y - 40} width="130" height="80" rx="10" fill="none" stroke="#78716c" strokeWidth="2" strokeDasharray="6 6" />}
    {btn('down-' + r.id, 236, y, '−', n > 1, () => nudge(i, -1))}
    <g id={'price-' + r.id}><path d={`M 272 ${y - 30} L 420 ${y - 30} L 420 ${y + 30} L 272 ${y + 30} L 262 ${y} Z`} fill="#fef3c7" stroke="#a16207" strokeWidth="2" />
      {Array.from({ length: n }, (_, k) => <circle key={k} cx={346 + (k - (n - 1) / 2) * 27} cy={y} r="11" fill="#facc15" stroke="#a16207" strokeWidth="2.5" />)}</g>
    {btn('up-' + r.id, 452, y, '+', n < 5, () => nudge(i, 1))}
    <g id={'buyers-' + r.id}>{Array.from({ length: r.buyers }, (_, j) => <text key={j} x={516 + (j % 3) * 40} y={y - 22 + Math.floor(j / 3) * 46} textAnchor="middle" dominantBaseline="middle" fontSize="32">🧒</text>)}</g>
  </g>; };

  // ---- two shops, one basket ----
  const BASKET_RECT = { x: 250, y: 330, w: 380, h: 120 };
  const shopX = i => (i === 0 ? 70 : 380);
  const shopHome = i => ({ x: shopX(i) + 115, y: 214 });
  const compareScene = () => <g>
    <g id="purse">
      <rect x="30" y="342" width="190" height="96" rx="16" fill="#7c2d12" stroke="#431407" strokeWidth="3" />
      <path d="M 70 342 Q 95 318 120 342" fill="none" stroke="#431407" strokeWidth="4" />
      {Array.from({ length: purse }, (_, k) => <circle key={k} cx={58 + (k % 4) * 44} cy={372 + Math.floor(k / 4) * 40} r="15" fill="#facc15" stroke="#a16207" strokeWidth="2.5" />)}
    </g>
    <g id="basket">
      <path d={`M ${BASKET_RECT.x} ${BASKET_RECT.y + 20} L ${BASKET_RECT.x + BASKET_RECT.w} ${BASKET_RECT.y + 20} L ${BASKET_RECT.x + BASKET_RECT.w - 30} ${BASKET_RECT.y + BASKET_RECT.h} L ${BASKET_RECT.x + 30} ${BASKET_RECT.y + BASKET_RECT.h} Z`} fill="#a16207" stroke="#713f12" strokeWidth="3" />
      <path d={`M ${BASKET_RECT.x + 70} ${BASKET_RECT.y + 20} Q ${BASKET_RECT.x + BASKET_RECT.w / 2} ${BASKET_RECT.y - 40} ${BASKET_RECT.x + BASKET_RECT.w - 70} ${BASKET_RECT.y + 20}`} fill="none" stroke="#713f12" strokeWidth="6" />
    </g>
    {shops.map((s, i) => { const x = shopX(i), n = s.price; return <g key={s.id} id={'shop-' + s.id}>
      {Array.from({ length: 5 }, (_, k) => <path key={k} d={`M ${x + k * 46} 108 l 46 0 l 0 26 q -23 14 -46 0 z`} fill={k % 2 ? '#f8fafc' : (i === 0 ? '#7c3aed' : '#16a34a')} />)}
      <circle cx={x + 115} cy="104" r="24" fill="#f8fafc" /><text x={x + 115} y="106" textAnchor="middle" dominantBaseline="middle" fontSize="30">{s.sign}</text>
      <rect x={x} y="142" width="230" height="160" rx="10" fill="#1c1917" stroke="#57534e" strokeWidth="2" />
      {bought === s.id && <rect x={x + 71} y="170" width="88" height="88" rx="12" fill="none" stroke="#78716c" strokeWidth="2" strokeDasharray="6 6" />}
      <g transform={`translate(${x + 115}, 282)`}><path d="M -66 -16 L 66 -16 L 66 16 L -66 16 L -76 0 Z" fill="#fef3c7" stroke="#a16207" strokeWidth="2" />
        {Array.from({ length: n }, (_, k) => <circle key={k} cx={(k - (n - 1) / 2) * 24} cy="0" r="10" fill="#facc15" stroke="#a16207" strokeWidth="2.5" />)}</g>
    </g>; })}
    {shops.map((s, i) => {
      const held = drag && drag.from === 'shop' && drag.shop === s.id && drag.x !== undefined;
      const p = held ? { x: drag.x, y: drag.y } : bought === s.id ? { x: BASKET_RECT.x + BASKET_RECT.w / 2, y: BASKET_RECT.y + 64 } : shopHome(i);
      return <g key={'it' + s.id} id={'item-' + s.id} transform={`translate(${p.x}, ${p.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => grab({ from: 'shop', shop: s.id }, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>{card(item)}</g>;
    })}
  </g>;

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        {sky()}
        {task !== 'compare' && awning()}
        {task === 'compare' ? compareScene() : task === 'price' ? rows.map(priceRow) : <g>
          {task === 'restock' && yesterdayRows()}
          {shelfArea()}
          {crate()}
          {shelf.map((_, i) => (drag && drag.from === 'slot' && drag.slot === i ? null : slotItem(i)))}
          {kinds.map((k, i) => (drag && drag.from === 'crate' && drag.kind === k.id ? null : crateItem(k, i)))}
          {drag && drag.from === 'slot' && slotItem(drag.slot)}
          {drag && drag.from === 'crate' && crateItem(kindOf(drag.kind), kinds.findIndex(k => k.id === drag.kind))}
        </g>}
      </svg>
    </Panel>
  );
}
