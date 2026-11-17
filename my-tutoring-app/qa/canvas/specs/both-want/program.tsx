// Both want (social studies K-2). Two or three children stand in a row. Each has a basket of things and a thought
// bubble showing (in pictures) what they want. The child builds the offer the ask names by dragging things from the
// baskets onto the trade mat, then drags the handshake token to YES (they will trade) or NO (they will not). The
// children never react: nothing swaps and nothing says who is right. Check judges the mat (exactly the named offer)
// and the token (whether everyone on the mat wants a thing someone else put there, each thing going to one person).
// Params: kids [{ id, pic, name, wants: [kind], has: [kind] }] (2-3), offer ['kid:kind'] (the offer the ask names),
// onMat ['kid:kind'] (things already on the mat at the start), goods { kind: emoji } (optional extra pictures).
function Display({ params, lumina }) {
  const GOODS = {
    apple: '🍎', banana: '🍌', lollipop: '🍭', ball: '⚽', car: '🚗', balloon: '🎈', strawberry: '🍓', carrot: '🥕',
    fish: '🐟', bear: '🧸', hat: '🎩', cookie: '🍪', book: '📕', ...(params.goods || {}),
  };
  const kids = (Array.isArray(params.kids) && params.kids.length >= 2 ? params.kids : [
    { id: 'mia', pic: '👧', name: 'Mia', wants: ['ball'], has: ['apple', 'banana'] },
    { id: 'sam', pic: '👦', name: 'Sam', wants: ['apple'], has: ['ball', 'car'] },
  ]).slice(0, 3);
  const itemId = (kid, kind) => kid + '-' + kind;
  const parseRef = s => { const [kid, kind] = String(s).split(':'); return itemId(kid, kind); };
  const offer = (Array.isArray(params.offer) ? params.offer : ['mia:apple', 'sam:ball']).map(parseRef);
  // params.build: the child whose offer the child must choose (a build problem: no yes/no, no handshake; Check needs
  // the named things plus one thing of this child's that makes the trade happen).
  const build = kids.some(k => k.id === params.build) ? params.build : null;
  const onMat0 = (Array.isArray(params.onMat) ? params.onMat : []).map(parseRef);

  const allItems = [];
  kids.forEach((k, ki) => (k.has || []).forEach((kind, i) => allItems.push({ id: itemId(k.id, kind), kid: k.id, ki, kind, i, n: k.has.length })));
  const byId = {};
  allItems.forEach(it => { byId[it.id] = it; });
  const kidOf = id => kids.find(k => k.id === id);

  // ---------- the said answer: computed from the named offer and the pictured wants ----------
  // A trade happens when every thing on the mat can go to someone else on the mat who wants it, and every one of them
  // gets one thing (two children: each wants the other's thing; three: the wants go around).
  const willTrade = ids => {
    const items = ids.map(id => byId[id]).filter(Boolean);
    const people = items.map(it => it.kid);
    const perms = arr => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [x, ...p])));
    return items.length >= 2 && perms(items).some(p => p.every((it, j) => it.kid !== people[j] && (kidOf(people[j]).wants || []).includes(it.kind)));
  };
  const key = willTrade(offer) ? 'yes' : 'no';

  useEffect(() => {
    if (build) return; // a build problem is shown only: Check carries it
    const items = offer.map(id => byId[id]).filter(Boolean);
    const wantsFromOther = (a, b) => (kidOf(a.kid).wants || []).includes(b.kind) && a.kid !== b.kid;
    const misrules = [];
    // Wanting is enough: one child wanting a thing on the mat makes it a trade.
    const someoneWants = items.some(a => items.some(b => wantsFromOther(a, b)));
    misrules.push({ says: someoneWants ? 'yes' : 'no', because: 'thinks one child wanting the other thing is enough for a trade' });
    // A trade must be a straight swap: two children who each want the other's thing (misses a trade that goes around).
    const pairSwap = items.some(a => items.some(b => wantsFromOther(a, b) && wantsFromOther(b, a)));
    misrules.push({ says: pairSwap ? 'yes' : 'no', because: 'thinks a trade must be two children who each want the other one\'s thing, so a trade around three cannot happen' });
    const seen = new Set();
    lumina.answer(key, misrules.filter(m => m.says !== key && !seen.has(m.says) && seen.add(m.says)), ['yes', 'no']);
  }, []);

  // ---------- state ----------
  const [onMat, setOnMat] = useState(() => allItems.filter(it => onMat0.includes(it.id)).map(it => it.id));
  const [tag, setTag] = useState(null); // null | 'yes' | 'no'
  const [drag, setDrag] = useState(null); // { kind: 'item', id, x?, y? } | { kind: 'tag', x?, y? }
  const svgRef = useRef(null);

  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  const extra = onMat.filter(id => !offer.includes(id));
  const met = build
    ? offer.every(id => onMat.includes(id)) && extra.length === 1 && byId[extra[0]].kid === build && willTrade(onMat)
    : sameSet(onMat, offer) && tag === key;
  const said = id => { const it = byId[id]; return kidOf(it.kid).name + "'s " + it.kind; };

  useEffect(() => {
    lumina.goal(met);
    lumina.scene({
      children: kids.map(k => ({
        name: k.name,
        thoughtBubbleWants: k.wants || [],
        basket: allItems.filter(it => it.kid === k.id && !onMat.includes(it.id)).map(it => it.kind),
      })),
      tradeMat: onMat.length ? onMat.map(said) : 'empty',
      handshakeToken: build ? 'not used on this problem' : tag ? 'placed on ' + tag.toUpperCase() : 'not placed yet',
    });
  }, [onMat, tag, met]);

  // ---------- layout ----------
  const W = 680, H = build ? 392 : 486;
  const COLS = kids.length === 3 ? [113, 340, 567] : [160, 520];
  const BUB_Y = 54, FACE_Y = 132, NAME_Y = 176, BASKET_Y = 226;
  const MAT = { x: 120, y: 280, w: 440, h: 92 };
  const ROW_Y = 432;
  const SLOTS = { yes: 390, no: 586 };
  const TAG_HOME = { x: 120, y: ROW_Y };

  const basketPos = it => ({ x: COLS[it.ki] + (it.i - (it.n - 1) / 2) * 62, y: BASKET_Y });
  const matOrder = allItems.filter(it => onMat.includes(it.id));
  const matPos = id => {
    const k = matOrder.findIndex(it => it.id === id), m = matOrder.length;
    return { x: MAT.x + MAT.w / 2 + (k - (m - 1) / 2) * 74, y: MAT.y + MAT.h / 2 };
  };
  const itemAt = id => {
    if (drag && drag.kind === 'item' && drag.id === id && drag.x !== undefined) return { x: drag.x, y: drag.y };
    return onMat.includes(id) ? matPos(id) : basketPos(byId[id]);
  };
  const tagAt = () => {
    if (drag && drag.kind === 'tag' && drag.x !== undefined) return { x: drag.x, y: drag.y };
    if (tag) return { x: SLOTS[tag] - 52, y: ROW_Y };
    return TAG_HOME;
  };

  // ---------- drag ----------
  const onDown = (d, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(d); };
  const onMove = e => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e);
    setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null));
  };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e), d = drag;
    setDrag(null);
    if (d.kind === 'tag') {
      const k = Object.keys(SLOTS).find(s => Math.abs(p.x - SLOTS[s]) <= 90 && Math.abs(p.y - ROW_Y) <= 42);
      setTag(k || null);
      return;
    }
    const inMat = p.x >= MAT.x - 10 && p.x <= MAT.x + MAT.w + 10 && p.y >= MAT.y - 10 && p.y <= MAT.y + MAT.h + 10;
    setOnMat(m => (inMat ? (m.includes(d.id) ? m : [...m, d.id]) : m.filter(x => x !== d.id)));
  };

  // ---------- pictures ----------
  const kidPic = (k, ki) => {
    const x = COLS[ki], wants = k.wants || [], bw = Math.max(1, (k.has || []).length) * 62 + 18;
    return <g key={k.id}>
      {/* thought bubble: what this child wants */}
      <ellipse cx={x} cy={BUB_Y} rx={wants.length > 1 ? 74 : 50} ry="36" fill="#e2e8f0" />
      <circle cx={x - 14} cy={BUB_Y + 44} r="7" fill="#e2e8f0" />
      <circle cx={x - 22} cy={BUB_Y + 58} r="4" fill="#e2e8f0" />
      {wants.map((w, j) => (
        <text key={w} x={x + (j - (wants.length - 1) / 2) * 50} y={BUB_Y + 3} textAnchor="middle" dominantBaseline="middle" fontSize="36">{GOODS[w] || '?'}</text>
      ))}
      <text x={x} y={FACE_Y} textAnchor="middle" dominantBaseline="middle" fontSize="48">{k.pic}</text>
      <text x={x} y={NAME_Y - 8} textAnchor="middle" fontSize="20" fontWeight="600" fill="#e2e8f0">{k.name}</text>
      <rect id={'basket-' + k.id} x={x - bw / 2} y={BASKET_Y - 34} width={bw} height="68" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      {allItems.filter(it => it.kid === k.id && onMat.includes(it.id)).map(it => {
        const p = basketPos(it);
        return <circle key={it.id} cx={p.x} cy={p.y} r="25" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />;
      })}
    </g>;
  };

  const itemPic = id => {
    const it = byId[id], p = itemAt(id), held = drag && drag.kind === 'item' && drag.id === id;
    return <g key={id} id={'item-' + id} transform={`translate(${p.x}, ${p.y}) scale(${held ? 1.12 : 1})`}
      onPointerDown={e => onDown({ kind: 'item', id }, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}
      style={{ cursor: 'grab', touchAction: 'none' }}>
      <circle r="27" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="32">{GOODS[it.kind] || '?'}</text>
    </g>;
  };

  const slot = (k, face, word) => (
    <g key={k}>
      <rect id={'slot-' + k} x={SLOTS[k] - 90} y={ROW_Y - 38} width="180" height="76" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
      <text x={SLOTS[k] + 28} y={ROW_Y + 2} textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="700" fill="#e2e8f0">{face} {word}</text>
    </g>
  );
  const tp = tagAt(), tagHeld = drag && drag.kind === 'tag';

  const ids = allItems.map(it => it.id);
  const heldId = drag && drag.kind === 'item' ? drag.id : null;
  return (
    <Panel title="Trade Mat" caption={build ? 'Drag things onto the mat or back.' : 'Drag things onto the mat or back. Drag the 🤝 to yes or no.'}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        {kids.map(kidPic)}
        <rect id="trade-mat" x={MAT.x} y={MAT.y} width={MAT.w} height={MAT.h} rx="16" fill="#3f2a1d" stroke="#a16207" strokeWidth="3" strokeDasharray="6 5" />
        {!onMat.length && <text x={MAT.x + MAT.w / 2} y={MAT.y + MAT.h / 2 + 2} textAnchor="middle" dominantBaseline="middle" fontSize="18" fill="#cbd5e1">trade mat</text>}
        {!build && <g><circle cx={TAG_HOME.x} cy={ROW_Y} r="32" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
        {slot('yes', '👍', 'YES')}
        {slot('no', '👎', 'NO')}</g>}
        {ids.filter(id => id !== heldId).map(itemPic)}
        {!build && <g id="answer-tag" transform={`translate(${tp.x}, ${tp.y}) scale(${tagHeld ? 1.12 : 1})`}
          onPointerDown={e => onDown({ kind: 'tag' }, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}
          style={{ cursor: 'grab', touchAction: 'none' }}>
          <circle r="30" fill="#334155" stroke="#64748b" strokeWidth="2" />
          <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="32">🤝</text>
        </g>}
        {heldId && itemPic(heldId)}
      </svg>
    </Panel>
  );
}
