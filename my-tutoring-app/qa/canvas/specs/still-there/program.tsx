// Still there (5-PS1-2): matter that dissolves is still there, and the weight is unchanged. A kitchen scale, a cup of
// water and a dish of something to mix in. The scale reads one thing at a time: the water alone, the dish alone. It
// never reads two things or a mix, so the weight after mixing is never printed: the child works it out and says it.
// The child weighs each part, puts the cup on the scale, tips the dish into the cup and stirs with the spoon until the
// grains are gone from sight (sand stays; ice melts). Check judges the build: both parts weighed, the mix on the scale
// alone, stirred. The misrule: the sugar disappeared, so the weight is the water alone (and so the sugar need not be
// weighed). With params.target the child must make a mix of a given weight by choosing which dish to stir in.
function Display({ params, lumina }) {
  const num = (v, d) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? d : Number(v));
  const water = num(params.water, 100);
  const material = String(params.material || 'sugar');
  const scoops = (Array.isArray(params.scoops) ? params.scoops : [params.scoops === undefined ? 10 : params.scoops]).map(g => num(g, 10));
  const target = num(params.target, 0);
  const dissolves = material === 'sugar' || material === 'salt';
  const melts = material === 'ice';
  const STIR = 4;
  const many = scoops.length > 1;
  const names = scoops.map((_, i) => (many ? material + ' ' + 'ABC'[i] : material));
  const want = target > 0 ? Math.max(0, scoops.findIndex(g => g + water === target)) : 0;

  const [beakerOn, setBeakerOn] = useState(false);
  const [scoopAt, setScoopAt] = useState(scoops.map(() => 'tray'));
  const [inCup, setInCup] = useState(-1);
  const [strokes, setStrokes] = useState(0);
  const [spoonIn, setSpoonIn] = useState(false);
  const [side, setSide] = useState(-1);
  const [weighed, setWeighed] = useState([]);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  // What the scale can read: nothing (0 g), or exactly one unmixed thing. Two things or a mix: no number.
  const onPan = (beakerOn ? ['water'] : []).concat(scoops.map((_, i) => 's' + i).filter((_, i) => scoopAt[i] === 'pan'));
  const gramsOf = id => (id === 'water' ? water : scoops[Number(id.slice(1))]);
  const nameOf = id => (id === 'water' ? 'water' : names[Number(id.slice(1))]);
  const readable = onPan.length === 1 && !(onPan[0] === 'water' && inCup >= 0);
  const display = onPan.length === 0 ? '0 g' : readable ? gramsOf(onPan[0]) + ' g' : '? g';

  useEffect(() => {
    if (target > 0) { lumina.answer(scoops[want], []); return; }
    const key = water + scoops[0];
    const misrules = [
      { says: water, because: 'thought the ' + material + (melts ? ' melted away' : ' disappeared') + ', so the weight is the water alone' },
    ].filter(m => (dissolves || melts) && m.says !== key);
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    if (readable && !weighed.includes(onPan[0])) setWeighed(w => (w.includes(onPan[0]) ? w : [...w, onPan[0]]));
  }, [beakerOn, scoopAt, inCup]);

  useEffect(() => {
    const met = beakerOn && onPan.length === 1 && inCup === want && strokes >= STIR && weighed.includes('water') && weighed.includes('s' + want);
    lumina.goal(met);
    const f = Math.min(strokes, STIR) / STIR;
    const looks = inCup < 0 ? 'clear water'
      : dissolves ? (f === 0 ? names[inCup] + ' grains at the bottom' : f < 1 ? 'fewer grains, some still at the bottom' : 'no grains to see, the water looks clear')
      : melts ? (f === 0 ? 'an ice cube floating' : f < 1 ? 'a smaller ice cube' : 'no ice left, only water, a little higher in the cup')
      : (f === 0 ? 'sand grains at the bottom' : 'sand stirred up, then settled at the bottom again');
    lumina.scene({
      mixingIn: material,
      cupOfWater: water >= 180 ? 'water most of the way up the cup' : water >= 140 ? 'water a little over halfway up the cup' : 'water about halfway up the cup',
      dishes: scoops.map((g, i) => names[i] + ': ' + (melts ? 'one ice cube' : g >= 35 ? 'a big heap' : g >= 20 ? 'a heap' : 'a small heap')),
      onTheScale: onPan.length ? onPan.map(id => (id === 'water' && inCup >= 0 ? 'the cup of water with ' + names[inCup] + ' in it' : nameOf(id))) : 'nothing',
      scaleShows: readable || onPan.length === 0 ? display : 'a question mark: the scale reads only one thing at a time, and never a mix',
      weighedSoFar: weighed.length ? weighed.map(id => nameOf(id) + ' ' + gramsOf(id) + ' g') : 'nothing yet',
      dishesOnTray: names.filter((_, i) => scoopAt[i] === 'tray'),
      inTheCup: inCup < 0 ? 'water only' : 'water and ' + names[inCup],
      howTheCupLooks: looks,
      spoon: spoonIn ? 'in the cup' : 'on the tray',
      stirStrokes: strokes,
      ...(target > 0 ? { makeAMixThatWeighs: target + ' g' } : {}),
    });
  }, [beakerOn, scoopAt, inCup, strokes, spoonIn, weighed]);

  // Places, in viewBox units. Items are drawn around their centre.
  const BEAKER_HOME = { x: 110, y: 300 }, BEAKER_PAN = { x: 470, y: 226 };
  const SCOOP_PAN = { x: 590, y: 270 };
  const scoopHome = i => (many ? { x: 262, y: 92 + i * 108 } : { x: 262, y: 200 });
  const SPOON_HOME = { x: 110, y: 110 };
  const B = beakerOn ? BEAKER_PAN : BEAKER_HOME;
  const inBeaker = p => Math.abs(p.x - B.x) <= 62 && p.y >= B.y - 100 && p.y <= B.y + 74;
  const onPanZone = p => p.x >= 362 && p.x <= 664 && p.y >= 128 && p.y <= 312;

  const grab = (id, e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    setDrag({ id, x: p.x, y: p.y, sx: p.x });
  };
  const move = e => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : d)); } };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e), d = drag;
    setDrag(null);
    if (d.id === 'beaker') { setBeakerOn(onPanZone(p)); return; }
    if (d.id === 'spoon') {
      // A stir stroke may swing a little past the glass: keep the spoon in the cup within 90 of its middle.
      if (Math.abs(p.x - B.x) <= 90 && p.y >= B.y - 110 && p.y <= B.y + 74) {
        if (spoonIn && inCup >= 0 && Math.abs(p.x - d.sx) >= 30) setStrokes(s => s + 1);
        setSpoonIn(true);
        setSide(p.x > B.x ? 1 : -1);
      } else setSpoonIn(false);
      return;
    }
    const i = Number(d.id.slice(6));
    if (inBeaker(p) && inCup < 0) {
      setScoopAt(a => a.map((v, k) => (k === i ? 'poured' : v)));
      setInCup(i);
      setStrokes(0);
    } else if (onPanZone(p)) {
      setScoopAt(a => a.map((v, k) => (k === i ? 'pan' : v === 'pan' ? 'tray' : v)));
    } else {
      setScoopAt(a => a.map((v, k) => (k === i ? 'tray' : v)));
    }
  };

  const at = (id, rest) => (drag && drag.id === id ? { x: drag.x, y: drag.y } : rest);
  const bp = at('beaker', B);
  const f = inCup >= 0 ? Math.min(strokes, STIR) / STIR : 0;
  const grainColor = material === 'sand' ? '#d6a85c' : material === 'salt' ? '#e5e7eb' : '#f8fafc';

  const pile = (g, cx, cy) => {
    if (melts) { const s = 24 + g * 0.35; return <rect x={cx - s / 2} y={cy - s + 6} width={s} height={s} rx="5" fill="#bae6fd" fillOpacity="0.85" stroke="#f0f9ff" strokeWidth="2" />; }
    const w = Math.min(70, 26 + g * 1.1), h = Math.min(30, 8 + g * 0.45);
    return <path d={'M' + (cx - w / 2) + ' ' + (cy + 6) + ' Q' + cx + ' ' + (cy + 6 - h * 2) + ' ' + (cx + w / 2) + ' ' + (cy + 6) + ' Z'} fill={grainColor} stroke={material === 'sand' ? '#a16207' : '#cbd5e1'} strokeWidth="1.5" />;
  };

  const beaker = () => {
    const { x, y } = bp;
    const melt = melts && inCup >= 0 ? scoops[inCup] * 0.35 * f : 0;
    const level = Math.min(118, 30 + water * 0.35 + melt);
    const grains = [];
    if (inCup >= 0 && !melts) {
      const n = 16, show = dissolves ? Math.round(n * (1 - f)) : n;
      for (let k = 0; k < show; k++) {
        const gx = x - 42 + (k % 8) * 12 + (Math.floor(k / 8) % 2) * 6, gy = y + 60 - Math.floor(k / 8) * 7;
        grains.push(material === 'salt' || material === 'sand'
          ? <rect key={k} x={gx - 3} y={gy - 3} width="6" height="6" fill={grainColor} />
          : <circle key={k} cx={gx} cy={gy} r="3.5" fill={grainColor} />);
      }
    }
    const ice = melts && inCup >= 0 && f < 1 ? (() => { const s = (24 + scoops[inCup] * 0.35) * (1 - f * 0.8); return <rect x={x - s / 2} y={y + 68 - level - s * 0.4} width={s} height={s} rx="5" fill="#bae6fd" fillOpacity="0.85" stroke="#f0f9ff" strokeWidth="2" />; })() : null;
    return (
      <g id="beaker" onPointerDown={e => grab('beaker', e)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
        <rect x={x - 60} y={y - 74} width="120" height="148" fill="transparent" />
        <rect x={x - 52} y={y + 68 - level} width="104" height={level} fill="#38bdf8" fillOpacity="0.45" />
        {grains}
        {ice}
        <path d={'M' + (x - 55) + ' ' + (y - 70) + ' L' + (x - 55) + ' ' + (y + 60) + ' Q' + (x - 55) + ' ' + (y + 70) + ' ' + (x - 45) + ' ' + (y + 70) + ' L' + (x + 45) + ' ' + (y + 70) + ' Q' + (x + 55) + ' ' + (y + 70) + ' ' + (x + 55) + ' ' + (y + 60) + ' L' + (x + 55) + ' ' + (y - 70)}
          fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round" />
        {!beakerOn && !(drag && drag.id === 'beaker') && <text x={x} y={y + 94} textAnchor="middle" fontSize="16" fill="#cbd5e1">water</text>}
      </g>
    );
  };

  const scoop = i => {
    if (scoopAt[i] === 'poured') return null;
    const id = 'scoop-' + i, rest = scoopAt[i] === 'pan' ? SCOOP_PAN : scoopHome(i);
    const { x, y } = at(id, rest);
    const held = drag && drag.id === id;
    return (
      <g key={id} id={id} onPointerDown={e => grab(id, e)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
        <rect x={x - 46} y={y - 40} width="92" height="70" fill="transparent" />
        <ellipse cx={x} cy={y + 14} rx="42" ry="13" fill={held ? '#475569' : '#334155'} stroke="#64748b" strokeWidth="2" />
        {pile(scoops[i], x, y + 6)}
        {scoopAt[i] !== 'pan' && !held && <text x={x} y={y + 50} textAnchor="middle" fontSize="16" fill="#cbd5e1">{names[i]}</text>}
      </g>
    );
  };

  const spoon = () => {
    const rest = spoonIn ? { x: B.x + side * 24, y: B.y - 20 } : SPOON_HOME;
    const held = drag && drag.id === 'spoon';
    let p = at('spoon', rest);
    if (!held && spoonIn && drag && drag.id === 'beaker') p = { x: drag.x + side * 24, y: drag.y - 20 };
    const flat = !spoonIn && !held;
    return (
      <g id="spoon" onPointerDown={e => grab('spoon', e)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}
        transform={'translate(' + p.x + ' ' + p.y + ')' + (flat ? ' rotate(90)' : '')}>
        <rect x="-24" y="-66" width="48" height="128" fill="transparent" />
        <rect x="-5" y="-62" width="10" height="92" rx="5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.5" />
        <ellipse cx="0" cy="42" rx="11" ry="16" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.5" />
      </g>
    );
  };

  const order = ['beaker', 'scoops', 'spoon'];
  const held = drag ? (drag.id.startsWith('scoop') ? 'scoops' : drag.id) : null;
  const layers = order.filter(k => k !== held).concat(held ? [held] : []);
  const draw = k => (k === 'beaker' ? <g key="b">{beaker()}</g> : k === 'spoon' ? <g key="sp">{spoon()}</g> : <g key="sc">{scoops.map((_, i) => scoop(i))}</g>);

  return (
    <Panel title="Kitchen Scale" caption="Drag a thing onto the scale or into the cup. Drag the spoon side to side in the cup to stir.">
      <svg ref={svgRef} viewBox="0 0 680 420" onPointerMove={move} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="420" fill="#0f172a" />
        <rect id="tray" x="24" y="16" width="316" height="388" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />

        <rect x="370" y="16" width="286" height="104" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x="390" y="44" fontSize="16" fill="#cbd5e1">Weighed</text>
        {target > 0 && <text x="636" y="44" textAnchor="end" fontSize="18" fill="#fbbf24">Make {target} g</text>}
        {weighed.map((id, k) => (
          <text key={id} x={390 + (k % 2) * 136} y={76 + Math.floor(k / 2) * 30} fontSize="18" fill="#e2e8f0">{nameOf(id)} {gramsOf(id)} g</text>
        ))}

        <rect id="pan" x="372" y="134" width="280" height="156" rx="14" fill="transparent"
          stroke={onPan.length ? 'none' : '#475569'} strokeWidth="2" strokeDasharray="6 5" pointerEvents="none" />
        <rect x="380" y="296" width="260" height="12" rx="6" fill="#94a3b8" />
        <rect x="500" y="308" width="20" height="14" fill="#64748b" />
        <rect x="400" y="322" width="220" height="84" rx="12" fill="#334155" stroke="#64748b" strokeWidth="2" />
        <rect x="446" y="338" width="128" height="52" rx="8" fill="#0b1220" stroke="#475569" strokeWidth="2" />
        <text x="510" y="374" textAnchor="middle" fontSize="28" fill="#fbbf24" fontFamily="monospace">{display}</text>

        {layers.map(draw)}
      </svg>
    </Panel>
  );
}
