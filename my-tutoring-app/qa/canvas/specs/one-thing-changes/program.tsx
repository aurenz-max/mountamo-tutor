// One thing changes (3-5-ETS1-3, planning a fair test). Two set-ups side by side: ramp A and ramp B (or pot A and pot
// B on the transfer item). Each has four parts: a surface (or soil), a height in blocks (or cups of water a day), a car
// (or a plant) and a start mark (or a place in the light). The child leaves A alone and sets up B by hand: drags a mat
// or a car from the shelf onto ramp B, drags B's top block up or down, drags B's car to a start mark.
// The rule: a fair test changes one thing and keeps the rest the same.
// Say and show: Check judges the set-up (the named thing differs between A and B, every other part is the same). The
// said answer is how many things the child has to change on B to make the test fair, computed from the given set-up:
// every other part that differs, plus the named thing when it does not differ yet.
// Misrules, each computed from the given set-up: change everything so B wins (the count of B's parts that are not
// already the "winning" choice: the miss builds that set-up), change only the thing being tested, and fix the other
// parts but leave the thing tested the same (or, when it already differs, change it back too).
function Display({ params, lumina }) {
  const WORLDS = {
    ramp: {
      title: 'Ramp Test',
      caption: 'Drag a mat or a car onto ramp B. Drag its top block up or down, or its car to a start mark.',
      side: ['Ramp A', 'Ramp B'], sceneSide: ['rampA', 'rampB'],
      shelf: ['Mats', 'Cars'],
      name: { mat: 'surface', level: 'height', item: 'car', spot: 'start' },
      sceneName: { mat: 'surface', level: 'blocksUnderRamp', item: 'car', spot: 'startMark' },
      mats: [
        { id: 'wood', label: 'wood', fill: '#b7791f', mark: '#7c4a12', w: 3, dash: '16 9' },
        { id: 'carpet', label: 'carpet', fill: '#9d174d', mark: '#f9a8d4', w: 3, dash: '2 3' },
        { id: 'sandpaper', label: 'sandpaper', fill: '#d6b370', mark: '#6b4f12', w: 4, dash: '1 6' },
        { id: 'ice', label: 'ice', fill: '#bae6fd', mark: '#ffffff', w: 2, dash: '' },
      ],
      items: [
        { id: 'redcar', label: 'red car', emoji: '🚗' },
        { id: 'jeep', label: 'jeep', emoji: '🚙' },
        { id: 'truck', label: 'truck', emoji: '🚚' },
        { id: 'racecar', label: 'race car', emoji: '🏎️' },
      ],
      spots: ['top', 'middle', 'low'],
      best: { mat: 'ice', level: 6, item: 'racecar', spot: 'top' },
      win: 'changed everything on ramp B to make its car win',
      handle: 'car', place: 'start',
    },
    plant: {
      title: 'Plant Test',
      caption: 'Drag a soil bag or a seed onto pot B. Drag its water up or down, or the pot to a place.',
      side: ['Pot A', 'Pot B'], sceneSide: ['potA', 'potB'],
      shelf: ['Soil', 'Seeds'],
      name: { mat: 'soil', level: 'water', item: 'plant', spot: 'light' },
      sceneName: { mat: 'soil', level: 'cupsOfWaterADay', item: 'plant', spot: 'place' },
      mats: [
        { id: 'potting', label: 'potting', fill: '#4a2f1d', mark: '#7c5a3f', w: 4, dash: '2 5' },
        { id: 'sand', label: 'sand', fill: '#e6c88f', mark: '#b08d4f', w: 3, dash: '1 4' },
        { id: 'clay', label: 'clay', fill: '#b45309', mark: '#7c2d12', w: 3, dash: '10 6' },
        { id: 'pebbles', label: 'pebbles', fill: '#9ca3af', mark: '#e5e7eb', w: 6, dash: '3 6' },
      ],
      items: [
        { id: 'sunflower', label: 'sunflower', emoji: '🌻' },
        { id: 'corn', label: 'corn', emoji: '🌽' },
        { id: 'tomato', label: 'tomato', emoji: '🍅' },
        { id: 'pumpkin', label: 'pumpkin', emoji: '🎃' },
      ],
      spots: ['sun', 'shade', 'dark'],
      best: { mat: 'potting', level: 6, item: 'sunflower', spot: 'sun' },
      win: 'changed everything for pot B to make its plant grow best',
      handle: 'pot', place: 'place',
    },
  };
  const world = params.world === 'plant' ? 'plant' : 'ramp';
  const W = WORLDS[world];
  const KEYS = ['mat', 'level', 'item', 'spot'];
  const pick = (list, v, d) => (list.some(o => (o.id || o) === v) ? v : d);
  const lvl = (v, d) => Math.max(1, Math.min(6, Math.round(Number(v)) || d));
  const read = (mat, level, item, spot) => ({
    mat: pick(W.mats, mat, W.mats[0].id),
    level: lvl(level, 2),
    item: pick(W.items, item, W.items[0].id),
    spot: pick(W.spots, spot, W.spots[0]),
  });
  const A = read(params.aMat, params.aLevel, params.aItem, params.aSpot);
  const B0 = read(params.bMat, params.bLevel, params.bItem, params.bSpot);
  const tested = KEYS.find(k => W.name[k] === params.test) || 'mat';

  const [B, setB] = useState(B0);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const diff = k => B0[k] !== A[k];
    const others = KEYS.filter(k => k !== tested);
    const key = others.filter(diff).length + (diff(tested) ? 0 : 1);
    const misrules = [
      { says: KEYS.filter(k => B0[k] !== W.best[k]).length, because: W.win },
      { says: diff(tested) ? 0 : 1, because: 'changed only the thing being tested and left the other differences in' },
      diff(tested)
        ? { says: KEYS.filter(diff).length, because: 'made every part match, the thing being tested too, so nothing is tested' }
        : { says: others.filter(diff).length, because: 'made the other parts match but did not change the thing being tested' },
    ].filter((m, i, all) => Number.isInteger(m.says) && m.says >= 0 && m.says !== key && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    const fair = KEYS.every(k => (k === tested ? B[k] !== A[k] : B[k] === A[k]));
    lumina.goal(fair);
    const describe = (s) => {
      const o = {};
      o[W.sceneName.mat] = W.mats.find(m => m.id === s.mat).label;
      o[W.sceneName.level] = s.level;
      o[W.sceneName.item] = W.items.find(m => m.id === s.item).label;
      o[W.sceneName.spot] = s.spot;
      return o;
    };
    const sc = { testing: W.name[tested] };
    sc[W.sceneSide[0]] = describe(A);
    sc[W.sceneSide[1]] = describe(B);
    lumina.scene(sc);
  }, [B]);

  // Geometry. Two side cards (A at x 10, B at x 350), the shelf below.
  const XA = 10, XB = 350, CW = 320, CT = 40, CH = 330;
  const G = 340, BH = 30; // ramp: ground line and block height
  const JB = 214, JU = 22; // plant: jug bottom and one cup
  const SPOT_T = [0.15, 0.42, 0.7];
  const PLACE_X = [64, 162, 262];
  const ramp = (x0, h) => {
    const T = { x: x0 + 76, y: G - BH * h }, E = { x: x0 + 306, y: G };
    const dx = E.x - T.x, dy = E.y - T.y, L = Math.hypot(dx, dy);
    return { T, E, dx, dy, nx: dy / L, ny: -dx / L, ang: Math.atan2(dy, dx) * 180 / Math.PI };
  };
  const spotXY = (x0, s, i) => {
    if (world === 'plant') return { x: x0 + PLACE_X[i], y: 330 };
    const g = ramp(x0, s.level), t = SPOT_T[i];
    return { x: g.T.x + g.dx * t + g.nx * 20, y: g.T.y + g.dy * t + g.ny * 20 };
  };
  const inB = p => p.x > XB && p.x < XB + CW && p.y > CT && p.y < CT + CH;

  const grab = (d, e) => {
    e.stopPropagation();
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
    const p = svgPoint(svgRef.current, e);
    setDrag({ ...d, x: p.x, y: p.y });
  };
  const levelAt = y => world === 'plant'
    ? Math.max(1, Math.min(6, Math.ceil((JB - y) / JU)))
    : Math.max(1, Math.min(6, Math.ceil((G - y) / BH)));
  const move = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e);
    setDrag({ ...drag, x: p.x, y: p.y });
    if (drag.kind === 'level') {
      const k = levelAt(p.y);
      setB(b => (b.level === k ? b : { ...b, level: k }));
    }
  };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e);
    const d = drag;
    setDrag(null);
    if (d.kind === 'mat' && inB(p)) setB(b => ({ ...b, mat: d.value }));
    if (d.kind === 'item' && inB(p)) setB(b => ({ ...b, item: d.value }));
    if (d.kind === 'level') setB(b => ({ ...b, level: levelAt(p.y) }));
    if (d.kind === 'spot' && inB(p)) {
      setB(b => {
        let best = 0, bd = Infinity;
        W.spots.forEach((s, i) => { const q = spotXY(XB, b, i); const dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < bd) { bd = dd; best = i; } });
        return { ...b, spot: W.spots[best] };
      });
    }
  };

  const matOf = id => W.mats.find(m => m.id === id);
  const itemOf = id => W.items.find(m => m.id === id);
  const emoji = (ch, x, y, size, flip) => (
    <text x={0} y={0} fontSize={size} textAnchor="middle" dominantBaseline="central" transform={`translate(${x}, ${y})${flip ? ' scale(-1, 1)' : ''}`} pointerEvents="none">{ch}</text>
  );
  const swatch = (m, x, y, w, h) => (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} rx="6" fill={m.fill} stroke="#0f172a" strokeWidth="1.5" />
      {[0.3, 0.7].map((f, i) => (
        <line key={i} x1={x + 5} y1={y + h * f} x2={x + w - 5} y2={y + h * f} stroke={m.mark} strokeWidth={m.w} strokeDasharray={m.dash} strokeLinecap="round" />
      ))}
    </g>
  );

  // --- The ramp world ------------------------------------------------------------------------------------------------
  const rampSide = (x0, s, mine) => {
    const g = ramp(x0, s.level), m = matOf(s.mat), it = itemOf(s.item);
    const draggingSpot = mine && drag && drag.kind === 'spot';
    const car = draggingSpot ? { x: drag.x, y: drag.y } : spotXY(x0, s, W.spots.indexOf(s.spot));
    const blocks = [];
    for (let k = 1; k <= 6; k++) {
      const y = G - BH * k, filled = k <= s.level;
      if (!filled && !mine) continue;
      blocks.push(
        <rect key={k} id={mine ? 'b-slot-' + k : undefined} x={x0 + 24} y={y} width="52" height={BH} rx="3"
          fill={filled ? '#c2410c' : 'none'} stroke={filled ? '#7c2d12' : '#475569'} strokeWidth="2" strokeDasharray={filled ? '' : '6 5'} pointerEvents="none" />,
      );
    }
    return (
      <g>
        <line x1={x0 + 12} y1={G} x2={x0 + CW - 12} y2={G} stroke="#64748b" strokeWidth="3" />
        {blocks}
        <line x1={g.T.x} y1={g.T.y} x2={g.E.x} y2={g.E.y} stroke="#5b3410" strokeWidth="22" strokeLinecap="round" />
        <line x1={g.T.x} y1={g.T.y} x2={g.E.x} y2={g.E.y} stroke={m.fill} strokeWidth="14" strokeLinecap="round" />
        <line x1={g.T.x + 4} y1={g.T.y} x2={g.E.x - 4} y2={g.E.y} stroke={m.mark} strokeWidth={m.w} strokeDasharray={m.dash} strokeLinecap="round" />
        {W.spots.map((sp, i) => {
          const t = SPOT_T[i], px = g.T.x + g.dx * t, py = g.T.y + g.dy * t;
          const q = spotXY(x0, s, i);
          return (
            <g key={sp}>
              <line x1={px - g.nx * 12} y1={py - g.ny * 12} x2={px + g.nx * 12} y2={py + g.ny * 12} stroke="#e2e8f0" strokeWidth="3" />
              {mine ? <circle id={'b-start-' + sp} cx={q.x} cy={q.y} r="18" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" /> : null}
            </g>
          );
        })}
        {mine ? (
          <g id="b-level" onPointerDown={e => grab({ kind: 'level' }, e)} style={{ cursor: 'grab', touchAction: 'none' }}>
            <rect x={x0 + 14} y={G - BH * s.level - 12} width="72" height="54" fill="#000" fillOpacity="0" />
            {[0, 1, 2].map(i => <line key={i} x1={x0 + 38} y1={G - BH * s.level + 9 + i * 6} x2={x0 + 62} y2={G - BH * s.level + 9 + i * 6} stroke="#fde68a" strokeWidth="2" pointerEvents="none" />)}
          </g>
        ) : null}
        <g id={mine ? 'b-car' : undefined} onPointerDown={mine ? e => grab({ kind: 'spot' }, e) : undefined}
          style={mine ? { cursor: 'grab', touchAction: 'none' } : undefined}
          transform={`translate(${car.x}, ${car.y}) rotate(${draggingSpot ? 0 : g.ang})`}>
          {mine ? <circle r="28" fill="#000" fillOpacity="0" /> : null}
          <line x1="-24" y1="12" x2="-24" y2="-30" stroke="#e2e8f0" strokeWidth="2.5" pointerEvents="none" />
          <path d="M -24 -30 L -4 -24 L -24 -18 Z" fill="#22d3ee" pointerEvents="none" />
          {emoji(it.emoji, 4, 0, 34, true)}
        </g>
      </g>
    );
  };

  // --- The plant world -----------------------------------------------------------------------------------------------
  const plantSide = (x0, s, mine) => {
    const m = matOf(s.mat), it = itemOf(s.item);
    const draggingSpot = mine && drag && drag.kind === 'spot';
    const pot = draggingSpot ? { x: drag.x, y: drag.y } : spotXY(x0, s, W.spots.indexOf(s.spot));
    const marks = [];
    for (let k = 1; k <= 6; k++) {
      marks.push(<line key={'m' + k} x1={x0 + 136} y1={JB - JU * k} x2={x0 + 150} y2={JB - JU * k} stroke="#94a3b8" strokeWidth="2" pointerEvents="none" />);
      if (mine) marks.push(<rect key={'s' + k} id={'b-slot-' + k} x={x0 + 134} y={JB - JU * k} width="52" height={JU} fill="none" pointerEvents="none" />);
    }
    return (
      <g>
        <rect x={x0 + 18} y="80" width="94" height="82" rx="4" fill="#7dd3fc" stroke="#e2e8f0" strokeWidth="3" />
        <line x1={x0 + 65} y1="80" x2={x0 + 65} y2="162" stroke="#e2e8f0" strokeWidth="3" />
        {emoji('☀️', x0 + 44, 104, 30)}
        <polygon points={`${x0 + 18},162 ${x0 + 112},162 ${x0 + 114},350 ${x0 + 18},350`} fill="#fde047" fillOpacity="0.3" pointerEvents="none" />
        <rect x={x0 + 216} y="168" width="98" height="182" rx="4" fill="#020617" stroke="#475569" strokeWidth="2" />
        <text x={x0 + 265} y="192" textAnchor="middle" fontSize="14" fill="#94a3b8">cupboard</text>
        <rect x={x0 + 134} y={JB - JU * 6 - 8} width="52" height={JU * 6 + 8} rx="6" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
        <rect x={x0 + 136} y={JB - JU * s.level} width="48" height={JU * s.level - 2} rx="3" fill="#38bdf8" fillOpacity="0.85" pointerEvents="none" />
        {marks}
        <text x={x0 + 160} y={JB + 22} textAnchor="middle" fontSize="14" fill="#cbd5e1">water a day</text>
        {mine ? W.spots.map((sp, i) => (
          <rect key={sp} id={'b-place-' + sp} x={x0 + PLACE_X[i] - 38} y="282" width="76" height="70" rx="8" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
        )) : null}
        {mine ? (
          <g id="b-level" onPointerDown={e => grab({ kind: 'level' }, e)} style={{ cursor: 'grab', touchAction: 'none' }}>
            <rect x={x0 + 124} y={JB - JU * s.level - 24} width="72" height="48" fill="#000" fillOpacity="0" />
            <rect x={x0 + 140} y={JB - JU * s.level - 3} width="40" height="6" rx="3" fill="#e0f2fe" pointerEvents="none" />
          </g>
        ) : null}
        <g id={mine ? 'b-pot' : undefined} onPointerDown={mine ? e => grab({ kind: 'spot' }, e) : undefined}
          style={mine ? { cursor: 'grab', touchAction: 'none' } : undefined} transform={`translate(${pot.x}, ${pot.y})`}>
          {mine ? <rect x="-38" y="-62" width="76" height="84" fill="#000" fillOpacity="0" /> : null}
          <polygon points="-26,-14 26,-14 20,20 -20,20" fill="#c2410c" stroke="#7c2d12" strokeWidth="2" pointerEvents="none" />
          <ellipse cx="0" cy="-13" rx="27" ry="9" fill={m.fill} stroke={m.mark} strokeWidth="2" pointerEvents="none" />
          {emoji(it.emoji, 0, -38, 32)}
        </g>
        {s.spot === 'dark' && !draggingSpot ? <rect x={x0 + 218} y="200" width="94" height="148" fill="#020617" fillOpacity="0.45" pointerEvents="none" /> : null}
      </g>
    );
  };

  const side = (x0, s, i) => (
    <g key={i}>
      <rect id={i ? 'b-panel' : 'a-panel'} x={x0} y={CT} width={CW} height={CH} rx="14" fill="#1e293b" stroke={i ? '#64748b' : '#475569'} strokeWidth="2" />
      <text x={x0 + 16} y={CT + 26} fontSize="18" fill="#e2e8f0">{W.side[i]}</text>
      {world === 'plant' ? plantSide(x0, s, !!i) : rampSide(x0, s, !!i)}
    </g>
  );

  const shelfCard = (kind, o, x) => (
    <g key={o.id} id={(kind === 'mat' ? 'mat-' : 'item-') + o.id} onPointerDown={e => grab({ kind, value: o.id }, e)} style={{ cursor: 'grab', touchAction: 'none' }}>
      <rect x={x} y="424" width="74" height="104" rx="12" fill="#334155" stroke="#64748b" strokeWidth="2" />
      {kind === 'mat' ? swatch(o, x + 9, 438, 56, 44) : emoji(o.emoji, x + 37, 462, 36, world === 'ramp')}
      <text x={x + 37} y="512" textAnchor="middle" fontSize="14" fill="#e2e8f0" pointerEvents="none">{o.label}</text>
    </g>
  );

  const ghost = () => {
    if (!drag || (drag.kind !== 'mat' && drag.kind !== 'item')) return null;
    if (drag.kind === 'mat') return swatch(matOf(drag.value), drag.x - 28, drag.y - 22, 56, 44);
    return <g pointerEvents="none">{emoji(itemOf(drag.value).emoji, drag.x, drag.y, 36, world === 'ramp')}</g>;
  };

  return (
    <Panel title={W.title} caption={W.caption}>
      <svg ref={svgRef} viewBox="0 28 680 518" onPointerMove={move} onPointerUp={drop} onPointerCancel={drop}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect y="28" width="680" height="518" fill="#0f172a" />
        {side(XA, A, 0)}
        {side(XB, B, 1)}
        <rect x="10" y="388" width="660" height="152" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x="26" y="412" fontSize="16" fill="#cbd5e1">{W.shelf[0]}</text>
        <text x="366" y="412" fontSize="16" fill="#cbd5e1">{W.shelf[1]}</text>
        {W.mats.map((o, i) => shelfCard('mat', o, 24 + i * 80))}
        {W.items.map((o, i) => shelfCard('item', o, 364 + i * 76))}
        {ghost()}
      </svg>
    </Panel>
  );
}
