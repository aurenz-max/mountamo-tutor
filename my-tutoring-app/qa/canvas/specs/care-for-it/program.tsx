function Display({ params, lumina }) {
  // A place with things in it. Some are cared for, some are not: a cap left off, crayons on the floor, a tap running,
  // a light on in a room nobody is in. Tap a thing to switch it (cap on/off, tap on/off, light on/off, door open/shut).
  // Drag a loose thing to where it goes (box, shelf, a bin). Nothing says which things need care.
  // params.place: 'classroom' | 'park' | 'home'. params.things: [{ id, state }] (state: 'on'|'off' or 'home'|'out').
  // params.people: rooms with someone in them (home only: 'kitchen', 'living').
  const place = ['classroom', 'park', 'home'].includes(params.place) ? params.place : 'classroom';
  const people = Array.isArray(params.people) ? params.people : [];
  const W = 680, H = 520;

  // Every kind of thing: how it is switched or where it goes, and what care means for it.
  // tog: tap switches 'on'/'off'; careOn = the cared-for state is 'on'. put: drag to a home.
  const KINDS = {
    marker: { tog: true, name: 'red marker', on: 'with its cap on', off: 'with its cap off', careOn: () => true },
    glue: { tog: true, name: 'glue stick', on: 'with its lid on', off: 'with its lid off', careOn: () => true },
    paint: { tog: true, name: 'paint pot', on: 'with its lid on', off: 'with its lid off', careOn: () => true },
    sink: { tog: true, name: 'sink tap', on: 'running', off: 'turned off', careOn: () => false },
    crayons: { put: ['crayon-box'], name: 'crayons' },
    book: { put: ['shelf'], name: 'picture book' },
    fountain: { tog: true, name: 'water fountain', on: 'running with nobody drinking', off: 'turned off', careOn: () => false },
    can: { put: ['recycle'], name: 'empty can' },
    bottle: { put: ['recycle'], name: 'plastic bottle' },
    paper: { put: ['recycle'], name: 'newspaper' },
    peel: { put: ['trash'], name: 'banana peel' },
    wrapper: { put: ['trash'], name: 'chip bag' },
    tap: { tog: true, name: 'kitchen tap', on: 'running', off: 'turned off', careOn: () => false },
    fridge: { tog: true, name: 'fridge door', on: 'open', off: 'shut', careOn: () => false },
    'light-kitchen': { tog: true, name: 'kitchen light', on: 'on', off: 'off', careOn: () => people.includes('kitchen') },
    'light-living': { tog: true, name: 'living room light', on: 'on', off: 'off', careOn: () => people.includes('living') },
    tv: { tog: true, name: 'TV', on: 'on', off: 'off', careOn: () => false },
  };
  const things = (Array.isArray(params.things) ? params.things : [{ id: 'marker', state: 'off' }, { id: 'crayons', state: 'out' }])
    .filter(t => KINDS[t.id]);
  const start = {};
  things.forEach(t => { start[t.id] = KINDS[t.id].put ? (t.state === 'home' ? 'home' : 'out') : (t.state === 'on' ? 'on' : 'off'); });
  const [st, setSt] = useState(start);
  const [where, setWhere] = useState({}); // put things: which home they were dropped in
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const has = id => st[id] !== undefined;

  const homeOf = id => (st[id] === 'home' ? (where[id] || KINDS[id].put[0]) : null);
  const cared = id => {
    const k = KINDS[id];
    if (k.put) return homeOf(id) === k.put[0];
    return (st[id] === 'on') === k.careOn();
  };
  const goalMet = things.every(t => cared(t.id));

  // Where loose things lie, and where their homes are, per place.
  const LOOSE = {
    crayons: { x: 230, y: 440 }, book: { x: 440, y: 455 },
    can: { x: 120, y: 440 }, bottle: { x: 230, y: 470 }, paper: { x: 330, y: 430 }, peel: { x: 130, y: 360 }, wrapper: { x: 300, y: 365 },
  };
  const HOMES = place === 'classroom'
    ? { 'crayon-box': { x: 430, y: 228, w: 70, h: 30, name: 'crayon box on the table' }, shelf: { x: 556, y: 150, w: 100, h: 52, name: 'top shelf' } }
    : place === 'park'
      ? { recycle: { x: 470, y: 380, w: 80, h: 100, name: 'blue recycling bin' }, trash: { x: 572, y: 380, w: 80, h: 100, name: 'grey trash bin' } }
      : {};
  const HOME_AT = {
    crayons: { 'crayon-box': { x: 465, y: 236 } }, book: { shelf: { x: 606, y: 170 } },
    can: { recycle: { x: 496, y: 372 }, trash: { x: 598, y: 372 } }, bottle: { recycle: { x: 512, y: 366 }, trash: { x: 614, y: 366 } },
    paper: { recycle: { x: 526, y: 376 }, trash: { x: 626, y: 376 } }, peel: { recycle: { x: 504, y: 380 }, trash: { x: 604, y: 380 } },
    wrapper: { recycle: { x: 520, y: 380 }, trash: { x: 620, y: 380 } },
  };
  const inHome = (p, r) => p.x >= r.x - 16 && p.x <= r.x + r.w + 16 && p.y >= r.y - 30 && p.y <= r.y + r.h + 16;

  useEffect(() => {
    lumina.goal(goalMet);
    const facts = things.map(t => {
      const k = KINDS[t.id];
      if (k.put) return 'the ' + k.name + (st[t.id] === 'home' ? ' is in the ' + HOMES[homeOf(t.id)].name : ' is lying on the ' + (place === 'park' ? 'grass' : 'floor'));
      return 'the ' + k.name + ' is ' + (st[t.id] === 'on' ? k.on : k.off);
    });
    if (place === 'home') {
      facts.push(people.includes('kitchen') ? 'someone is in the kitchen' : 'nobody is in the kitchen');
      facts.push(people.includes('living') ? 'Grandma is reading a book on the sofa in the living room' : 'nobody is in the living room');
    }
    lumina.scene({ place: { classroom: 'a classroom', park: 'a park', home: 'a house with a kitchen and a living room' }[place], things: facts });
  }, [st, where, goalMet]);

  const pointOf = e => svgPoint(svgRef.current, e);
  const toggle = id => setSt(s => ({ ...s, [id]: s[id] === 'on' ? 'off' : 'on' }));
  const grab = (id, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id }); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e), id = drag.id;
    setDrag(null);
    const hit = Object.keys(HOMES).find(h => HOME_AT[id] && HOME_AT[id][h] && inHome(p, HOMES[h]));
    if (hit) { setSt(s => ({ ...s, [id]: 'home' })); setWhere(w => ({ ...w, [id]: hit })); }
    else { setSt(s => ({ ...s, [id]: 'out' })); }
  };
  const tapProps = id => ({ id: 'thing-' + id, style: { cursor: 'pointer' }, onClick: () => toggle(id) });
  const dragProps = id => ({ id: 'thing-' + id, style: { cursor: 'grab', touchAction: 'none' }, onPointerDown: e => grab(id, e), onPointerUp: onUp, onPointerCancel: () => setDrag(null) });
  const at = id => {
    if (drag && drag.id === id && drag.x !== undefined) return { x: drag.x, y: drag.y };
    return st[id] === 'home' ? HOME_AT[id][homeOf(id)] : LOOSE[id];
  };
  const hit = (w, h) => <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="transparent" />;

  // Loose things, drawn centred on 0,0.
  const LOOSE_PICS = {
    crayons: <g>{['#ef4444', '#3b82f6', '#22c55e', '#eab308'].map((c, i) => <g key={c} transform={`rotate(${-30 + i * 22}) translate(${i * 4 - 6}, 0)`}><rect x="-4" y="-18" width="8" height="30" rx="2" fill={c} /><path d="M -4 -18 L 0 -26 L 4 -18 Z" fill={c} /></g>)}</g>,
    book: <g><rect x="-26" y="-18" width="52" height="36" rx="3" fill="#7c3aed" stroke="#4c1d95" strokeWidth="2" /><line x1="0" y1="-18" x2="0" y2="18" stroke="#4c1d95" strokeWidth="2" /><circle cx="-12" cy="-2" r="7" fill="#fde047" /></g>,
    can: <g><rect x="-11" y="-18" width="22" height="36" rx="4" fill="#94a3b8" stroke="#475569" strokeWidth="2" /><rect x="-11" y="-6" width="22" height="12" fill="#ef4444" /></g>,
    bottle: <g transform="rotate(70)"><rect x="-9" y="-12" width="18" height="34" rx="6" fill="rgba(125,211,252,0.6)" stroke="#0284c7" strokeWidth="2" /><rect x="-5" y="-22" width="10" height="11" fill="rgba(125,211,252,0.6)" stroke="#0284c7" strokeWidth="2" /><rect x="-6" y="-26" width="12" height="5" fill="#2563eb" /></g>,
    paper: <g transform="rotate(-8)"><rect x="-24" y="-16" width="48" height="32" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />{[-8, -2, 4, 10].map(y => <line key={y} x1="-18" y1={y} x2="18" y2={y} stroke="#94a3b8" strokeWidth="2" />)}<rect x="-18" y="-12" width="14" height="6" fill="#64748b" /></g>,
    peel: <g><path d="M 0 -4 C -6 -24, -26 -6, -22 10 C -12 0, -6 -2, 0 -4 C 6 -2, 12 0, 22 10 C 26 -6, 6 -24, 0 -4 Z" fill="#facc15" stroke="#a16207" strokeWidth="2" /><path d="M 0 -4 L 2 -16" stroke="#713f12" strokeWidth="3" /></g>,
    wrapper: <g transform="rotate(14)"><path d="M -20 -16 L 20 -16 L 16 16 L -16 16 Z" fill="#f97316" stroke="#9a3412" strokeWidth="2" /><path d="M -20 -16 l 5 -5 l 5 5 l 5 -5 l 5 5 l 5 -5 l 5 5 l 5 -5 l 5 5" fill="none" stroke="#9a3412" strokeWidth="2" /><circle r="7" fill="#fde047" /></g>,
  };
  const loose = id => {
    if (!has(id)) return null;
    const p = at(id), held = drag && drag.id === id;
    return <g key={id} {...dragProps(id)} transform={`translate(${p.x}, ${p.y}) scale(${held ? 1.12 : 1})`}>{hit(64, 60)}{LOOSE_PICS[id]}</g>;
  };

  const lidded = (id, x, y, body, lidColor, h) => {
    if (!has(id)) return null;
    const on = st[id] === 'on';
    return <g {...tapProps(id)} transform={`translate(${x}, ${y})`}>
      <rect x="-26" y={-h - 26} width="52" height={h + 40} fill="transparent" />
      {body}
      {on ? <rect x="-9" y={-h - 12} width="18" height="14" rx="3" fill={lidColor} />
        : <rect x="12" y="-8" width="20" height="16" rx="3" fill={lidColor} transform="rotate(80 22 0)" />}
    </g>;
  };
  const water = (x, y, len) => <g stroke="#38bdf8" strokeWidth="4" strokeLinecap="round">
    <line x1={x} y1={y} x2={x} y2={y + len} /><line x1={x - 5} y1={y + 6} x2={x - 6} y2={y + len - 4} opacity="0.6" />
  </g>;
  const bulb = (id, x, y) => {
    if (!has(id)) return null;
    const on = st[id] === 'on';
    return <g {...tapProps(id)}>
      <rect x={x - 30} y={y - 30} width="60" height="70" fill="transparent" />
      <line x1={x} y1={y - 30} x2={x} y2={y - 8} stroke="#64748b" strokeWidth="3" />
      <path d={`M ${x - 22} ${y + 6} Q ${x} ${y - 22} ${x + 22} ${y + 6} Z`} fill="#475569" />
      <circle cx={x} cy={y + 12} r="10" fill={on ? '#fde047' : '#334155'} stroke="#1e293b" strokeWidth="1.5" />
      {on && <circle cx={x} cy={y + 12} r="24" fill="#fde047" opacity="0.25" />}
    </g>;
  };
  const roomShade = (id, x, w) => (has(id) && st[id] === 'off' ? <rect x={x} y="0" width={w} height={H} fill="#020617" opacity="0.45" pointerEvents="none" /> : null);

  const classroom = () => <g>
    <rect width={W} height="300" fill="#334155" /><rect y="300" width={W} height={H - 300} fill="#78350f" />
    <rect x="150" y="30" width="150" height="100" rx="4" fill="#7dd3fc" stroke="#e2e8f0" strokeWidth="5" /><line x1="225" y1="30" x2="225" y2="130" stroke="#e2e8f0" strokeWidth="4" />
    {/* sink */}
    <rect x="20" y="200" width="110" height="18" rx="4" fill="#cbd5e1" /><rect x="34" y="218" width="82" height="82" fill="#64748b" />
    {has('sink') && <g {...tapProps('sink')}>
      <rect x="40" y="140" width="70" height="80" fill="transparent" />
      <path d="M 62 200 L 62 166 L 92 166 L 92 176" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
      <rect x="52" y="152" width="20" height="8" rx="3" fill={st.sink === 'on' ? '#38bdf8' : '#94a3b8'} />
      {st.sink === 'on' && water(92, 182, 18)}
    </g>}
    {/* table */}
    <rect x="170" y="258" width="350" height="16" rx="3" fill="#a16207" /><rect x="186" y="274" width="12" height="90" fill="#854d0e" /><rect x="492" y="274" width="12" height="90" fill="#854d0e" />
    {lidded('marker', 220, 252, <rect x="-7" y="-36" width="14" height="38" rx="3" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.5" />, '#7f1d1d', 36)}
    {lidded('glue', 290, 252, <rect x="-11" y="-38" width="22" height="40" rx="4" fill="#a855f7" stroke="#581c87" strokeWidth="1.5" />, '#581c87', 38)}
    {lidded('paint', 360, 252, <g><rect x="-20" y="-28" width="40" height="30" rx="5" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" /><rect x="-20" y="-16" width="40" height="10" fill="#22c55e" /></g>, '#475569', 28)}
    <g id="crayon-box"><rect x="430" y="228" width="70" height="30" rx="3" fill="#facc15" stroke="#a16207" strokeWidth="2" /><path d="M 438 236 l 54 0" stroke="#a16207" strokeWidth="2" /></g>
    {/* shelf */}
    <rect x="550" y="120" width="112" height="180" fill="#92400e" stroke="#78350f" strokeWidth="3" />
    <rect id="shelf" x="556" y="150" width="100" height="52" fill="#451a03" /><rect x="556" y="226" width="100" height="62" fill="#451a03" />
    {[0, 1, 2, 3].map(i => <rect key={i} x={566 + i * 22} y="236" width="16" height="50" fill={['#0ea5e9', '#f43f5e', '#22c55e', '#f59e0b'][i]} />)}
  </g>;

  const park = () => <g>
    <rect width={W} height="210" fill="#7dd3fc" /><rect y="210" width={W} height={H - 210} fill="#4d7c0f" />
    <rect y="270" width={W} height="40" fill="#d6d3d1" opacity="0.7" />
    <rect x="70" y="80" width="22" height="140" fill="#78350f" /><circle cx="81" cy="80" r="56" fill="#15803d" />
    <rect x="200" y="226" width="130" height="10" fill="#a16207" /><rect x="210" y="236" width="8" height="26" fill="#78350f" /><rect x="312" y="236" width="8" height="26" fill="#78350f" />
    {has('fountain') && <g {...tapProps('fountain')}>
      <rect x="380" y="150" width="90" height="120" fill="transparent" />
      <rect x="414" y="200" width="22" height="70" fill="#94a3b8" /><rect x="400" y="190" width="50" height="14" rx="5" fill="#cbd5e1" />
      <rect x="440" y="214" width="14" height="10" rx="3" fill={st.fountain === 'on' ? '#38bdf8' : '#64748b'} />
      {st.fountain === 'on' && <path d="M 420 190 Q 432 150 448 186" fill="none" stroke="#38bdf8" strokeWidth="4" />}
    </g>}
    <g id="recycle"><rect x="470" y="380" width="80" height="100" rx="6" fill="#2563eb" stroke="#1e3a8a" strokeWidth="3" /><rect x="464" y="372" width="92" height="12" rx="3" fill="#1d4ed8" />
      <g fill="none" stroke="#e0f2fe" strokeWidth="4" strokeLinecap="round"><path d="M 498 446 L 510 424 L 522 446 Z" /><path d="M 506 452 l 10 0" /></g></g>
    <g id="trash"><rect x="572" y="380" width="80" height="100" rx="6" fill="#475569" stroke="#1e293b" strokeWidth="3" /><rect x="566" y="372" width="92" height="12" rx="3" fill="#334155" />
      <path d="M 596 420 l 32 0 l -4 34 l -24 0 Z" fill="#1e293b" /></g>
  </g>;

  const home = () => <g>
    <rect width="340" height={H} fill="#e7e5e4" /><rect x="340" width="340" height={H} fill="#fde68a" />
    <rect y="420" width={W} height="100" fill="#a8a29e" /><rect x="336" width="8" height={H} fill="#57534e" />
    {/* kitchen */}
    <rect x="20" y="300" width="200" height="120" fill="#94a3b8" /><rect x="20" y="292" width="200" height="12" fill="#cbd5e1" /><rect x="70" y="296" width="70" height="10" rx="3" fill="#64748b" />
    {has('tap') && <g {...tapProps('tap')}>
      <rect x="70" y="220" width="70" height="80" fill="transparent" />
      <path d="M 94 296 L 94 258 L 124 258 L 124 270" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
      <rect x="84" y="244" width="20" height="8" rx="3" fill={st.tap === 'on' ? '#38bdf8' : '#64748b'} />
      {st.tap === 'on' && water(124, 276, 20)}
    </g>}
    {has('fridge') && <g {...tapProps('fridge')}>
      <rect x="238" y="170" width="92" height="250" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="3" />
      {st.fridge === 'on'
        ? <g><rect x="244" y="178" width="80" height="234" fill="#e0f2fe" /><rect x="250" y="250" width="22" height="30" fill="#ef4444" /><rect x="282" y="256" width="30" height="24" fill="#facc15" /><path d="M 238 172 L 200 190 L 200 410 L 238 418 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="3" /></g>
        : <g><line x1="238" y1="260" x2="330" y2="260" stroke="#94a3b8" strokeWidth="3" /><rect x="244" y="200" width="6" height="40" rx="3" fill="#64748b" /></g>}
    </g>}
    {bulb('light-kitchen', 150, 40)}
    {/* living room */}
    <rect x="420" y="330" width="220" height="70" rx="12" fill="#7c3aed" /><rect x="410" y="300" width="240" height="40" rx="12" fill="#6d28d9" />
    {people.includes('living') && <g>
      <circle cx="530" cy="270" r="22" fill="#fcd34d" /><path d="M 508 262 Q 530 236 552 262" fill="#e5e7eb" />
      <rect x="506" y="292" width="48" height="50" rx="10" fill="#0d9488" /><rect x="508" y="300" width="44" height="28" rx="2" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
    </g>}
    {people.includes('kitchen') && <g><circle cx="190" cy="330" r="18" fill="#fcd34d" /><rect x="174" y="348" width="32" height="60" rx="8" fill="#e11d48" /></g>}
    {has('tv') && <g {...tapProps('tv')}>
      <rect x="470" y="110" width="130" height="82" rx="6" fill="#0f172a" stroke="#475569" strokeWidth="4" />
      {st.tv === 'on' && <g><rect x="478" y="118" width="114" height="66" fill="#38bdf8" /><circle cx="510" cy="146" r="12" fill="#fde047" /><path d="M 478 184 L 520 156 L 550 174 L 592 150 L 592 184 Z" fill="#16a34a" /></g>}
      <rect x="526" y="192" width="18" height="16" fill="#475569" />
    </g>}
    {bulb('light-living', 530, 40)}
    {roomShade('light-kitchen', 0, 336)}{roomShade('light-living', 344, 336)}
  </g>;

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        {{ classroom, park, home }[place]()}
        {Object.keys(LOOSE_PICS).map(loose)}
      </svg>
    </Panel>
  );
}
