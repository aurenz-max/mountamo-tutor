// Drop Tower (3-PS2-1, 5-PS2-1). A thing (the steel ball, a feather, a hammer) already hangs on the release bar at the
// top of a drop tower. The shelf holds other things, each with its mass written under it. The child drags onto the bar
// every thing that will land at the same moment as that thing when the bar lets go, then says how many they hung
// beside it. Nothing is ever dropped on screen: the child commits from the rule, not from watching a fall.
// The child's sort is the variable the rule is about: with the air pumped out (or on the Moon) every thing lands
// together whatever its mass or shape; with air in, the balls of any mass land together and the flat light things
// (a feather, a leaf, a flat sheet) drift behind. The named misrule, heavier lands first, hangs only the things as
// heavy as the dropped one, so it gives a different count on every problem.
function Display({ params, lumina }) {
  const KINDS = {
    steel: { name: 'steel ball', mass: 500, label: '500 g', compact: true },
    wood: { name: 'wood ball', mass: 60, label: '60 g', compact: true },
    plastic: { name: 'plastic ball', mass: 20, label: '20 g', compact: true },
    rubber: { name: 'rubber ball', mass: 150, label: '150 g', compact: true },
    marble: { name: 'marble', mass: 5, label: '5 g', compact: true },
    bowling: { name: 'bowling ball', mass: 6000, label: '6 kg', compact: true },
    crumpled: { name: 'paper crumpled into a ball', mass: 5, label: '5 g', compact: true },
    sheet: { name: 'flat sheet of paper', mass: 5, label: '5 g', compact: false },
    feather: { name: 'feather', mass: 1, label: '1 g', compact: false },
    leaf: { name: 'dry leaf', mass: 2, label: '2 g', compact: false },
    hammer: { name: 'hammer', mass: 1000, label: '1 kg', compact: true },
    rock: { name: 'rock', mass: 2000, label: '2 kg', compact: true },
  };
  const world = ['air', 'vacuum', 'moon'].includes(params.world) ? params.world : 'air';
  const refKind = KINDS[params.ref] ? params.ref : 'steel';
  const shelfKinds = (Array.isArray(params.shelf) ? params.shelf : ['wood', 'feather', 'sheet', 'rubber']).filter(k => KINDS[k]).slice(0, 6);
  // Each shelf thing gets its own id; a second thing of a kind (or a twin of the dropped one) is "<kind>-2".
  const items = [];
  shelfKinds.forEach(k => {
    const n = items.filter(it => it.kind === k).length + (k === refKind ? 1 : 0);
    items.push({ id: n ? k + '-' + (n + 1) : k, kind: k });
  });
  const ref = KINDS[refKind];
  const noAir = world !== 'air';

  // The rule: with no air every thing lands with the dropped one; with air, only things of the same build (balls
  // and crumpled paper together, flat light things apart from them).
  const lands = it => noAir || KINDS[it.kind].compact === ref.compact;
  const key = items.filter(lands).length;

  const [onBar, setOnBar] = useState([]);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const sameMass = items.filter(it => KINDS[it.kind].mass === ref.mass).length;
    const sameBuild = items.filter(it => KINDS[it.kind].compact === ref.compact).length;
    const misrules = [
      { says: sameMass, because: 'thinks heavier things fall faster, so only a thing as heavy as the ' + ref.name + ' lands with it' },
      noAir ? { says: sameBuild, because: 'thinks a feather or a flat sheet still falls slowly when there is no air' } : null,
      noAir ? null : { says: items.length, because: 'thinks everything lands together even with air in the way' },
    ].filter((m, i, all) => m && m.says !== key && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(key, misrules);
  }, []);

  const where = world === 'moon' ? 'on the Moon, with no air' : world === 'vacuum' ? 'in the tower with the air pumped out' : 'in the tower with air in it';
  useEffect(() => {
    const named = it => KINDS[it.kind].name + ' (' + KINDS[it.kind].label + ')';
    const goal = items.every(it => onBar.includes(it.id) === lands(it));
    lumina.goal(goal);
    lumina.scene({
      place: where,
      droppedThing: ref.name + ' (' + ref.label + '), already on the bar',
      hungBesideIt: items.filter(it => onBar.includes(it.id)).map(named),
      onShelf: items.filter(it => !onBar.includes(it.id)).map(named),
    });
  }, [onBar]);

  // Slots along the bar: the dropped thing in slot 0. Every hung thing's bottom is on one line (HANG), drawn a little
  // smaller than on the shelf, so all of them drop from the same height: a thing hung lower would land first.
  const BAR_Y = 54, HANG = 176, HS = 0.72;
  const SLOTS = [60, 106, 152, 198, 244, 290, 336];
  const TOWER = { x: 22, y: 30, w: 340, h: 386 };
  const card = i => ({ x: 386 + (i % 2) * 144, y: 34 + Math.floor(i / 2) * 128, w: 132, h: 116 });

  const grab = (id, e) => { e.currentTarget.setPointerCapture(e.pointerId); const p = svgPoint(svgRef.current, e); setDrag({ id, x: p.x, y: p.y, moved: false }); };
  const move = e => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag({ ...drag, x: p.x, y: p.y, moved: true }); } };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e), id = drag.id;
    const inTower = p.x > TOWER.x && p.x < TOWER.x + TOWER.w && p.y > TOWER.y && p.y < TOWER.y + TOWER.h;
    const moved = drag.moved;
    setDrag(null);
    if (!moved) return;
    setOnBar(b => (inTower ? (b.includes(id) ? b : [...b, id]) : b.filter(x => x !== id)));
  };

  const at = it => {
    if (drag && drag.id === it.id && drag.moved) return { x: drag.x, y: drag.y, hung: false };
    const k = onBar.indexOf(it.id);
    if (k >= 0) return { x: SLOTS[k + 1], y: HANG - half(it.kind) * HS, hung: true, s: HS };
    const c = card(items.indexOf(it));
    return { x: c.x + c.w / 2, y: c.y + 38, hung: false, named: true };
  };

  // A thing drawn centred at (0,0); returns its half height so strings meet its top.
  const half = kind => ({ bowling: 30, marble: 11, sheet: 18, feather: 20, leaf: 20, hammer: 20, rock: 20 }[kind] || 22);
  const art = kind => {
    if (kind === 'feather') return <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="38">🪶</text>;
    if (kind === 'leaf') return <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="36">🍂</text>;
    if (kind === 'hammer') return <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="38">🔨</text>;
    if (kind === 'rock') return <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="38">🪨</text>;
    if (kind === 'sheet') return <rect x="-26" y="-18" width="52" height="36" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />;
    if (kind === 'crumpled') return <path d="M-20,-6 L-12,-19 L0,-15 L11,-21 L20,-8 L17,6 L21,15 L6,21 L-6,17 L-17,20 L-21,6 Z" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />;
    const fill = { steel: '#94a3b8', wood: '#a16207', plastic: '#38bdf8', rubber: '#ef4444', marble: '#60a5fa', bowling: '#1f2937' }[kind];
    const r = half(kind);
    return (
      <g>
        <circle r={r} fill={fill} stroke={kind === 'bowling' ? '#64748b' : '#0f172a'} strokeWidth="2" />
        <circle cx={-r * 0.35} cy={-r * 0.35} r={r * 0.28} fill="#ffffff" opacity="0.35" />
        {kind === 'bowling' ? <g fill="#64748b"><circle cx="6" cy="-10" r="3.5" /><circle cx="14" cy="-4" r="3.5" /><circle cx="8" cy="2" r="3.5" /></g> : null}
      </g>
    );
  };
  const SHORT = { steel: 'steel ball', wood: 'wood ball', plastic: 'plastic ball', rubber: 'rubber ball', marble: 'marble', bowling: 'bowling ball', crumpled: 'crumpled paper', sheet: 'flat paper', feather: 'feather', leaf: 'dry leaf', hammer: 'hammer', rock: 'rock' };
  const thing = (kind, x, y, label, hung, named, s = 1) => (
    <g>
      {hung ? <line x1={x} y1={BAR_Y} x2={x} y2={y - half(kind) * s} stroke="#cbd5e1" strokeWidth="1.5" /> : null}
      <g transform={`translate(${x}, ${y}) scale(${s})`}>{art(kind)}</g>
      {named ? <text x={x} y={y + 46} textAnchor="middle" fontSize="15" fill="#cbd5e1">{SHORT[kind]}</text> : null}
      <text x={x} y={named ? y + 66 : y + half(kind) * s + 20} textAnchor="middle" fontSize="15" fill="#e2e8f0">{label}</text>
    </g>
  );

  const rnd = i => { const v = Math.sin(i * 12.9898) * 43758.5453; return v - Math.floor(v); };
  const specks = Array.from({ length: 34 }, (_, i) => ({ x: 40 + rnd(i) * 300, y: 80 + rnd(i + 99) * 280 }));

  return (
    <Panel title="Drop Tower" caption="Drag a thing onto the bar to hang it. Drag it back to the shelf to take it off.">
      <svg ref={svgRef} viewBox="0 0 680 430" onPointerMove={move} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="430" fill="#0f172a" />

        {world === 'moon' ? (
          <g>
            <rect id="tower" x={TOWER.x} y={TOWER.y} width={TOWER.w} height={TOWER.h} rx="14" fill="#020617" stroke="#475569" strokeWidth="2" />
            {specks.slice(0, 16).map((s, i) => <circle key={i} cx={s.x} cy={s.y * 0.8} r="1.6" fill="#e2e8f0" opacity="0.7" />)}
            <text x="320" y="96" textAnchor="middle" fontSize="30">🌍</text>
            <path d={`M${TOWER.x} 380 Q 110 366 190 378 T ${TOWER.x + TOWER.w} 374 L ${TOWER.x + TOWER.w} 402 Q ${TOWER.x + TOWER.w} 416 ${TOWER.x + TOWER.w - 14} 416 L ${TOWER.x + 14} 416 Q ${TOWER.x} 416 ${TOWER.x} 402 Z`} fill="#6b7280" />
            <circle cx="52" cy="396" r="7" fill="#4b5563" /><circle cx="330" cy="400" r="5" fill="#4b5563" />
          </g>
        ) : (
          <g>
            <rect id="tower" x={TOWER.x} y={TOWER.y} width={TOWER.w} height={TOWER.h} rx="14" fill="#13213a" stroke="#64748b" strokeWidth="2.5" />
            <rect x={TOWER.x + 10} y={TOWER.y + 6} width="10" height={TOWER.h - 12} rx="5" fill="#ffffff" opacity="0.06" />
            {world === 'air' ? specks.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r="2" fill="#94a3b8" opacity="0.45" />) : null}
            <rect x={TOWER.x + 2} y="378" width={TOWER.w - 4} height="36" rx="10" fill="#1e293b" />
            {world === 'vacuum' ? (
              <g>
                <path d="M362 330 C 372 330 372 300 372 290" stroke="#64748b" strokeWidth="5" fill="none" />
                <circle cx="372" cy="276" r="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                <line x1="372" y1="276" x2="363" y2="268" stroke="#e2e8f0" strokeWidth="2" />
              </g>
            ) : null}
          </g>
        )}
        <text x={TOWER.x + TOWER.w / 2} y="402" textAnchor="middle" fontSize="16" fill="#e2e8f0">
          {world === 'moon' ? 'The Moon: no air' : world === 'vacuum' ? 'Air pumped out' : 'Air in the tower'}
        </text>

        <rect x={TOWER.x + 24} y={BAR_Y - 6} width={TOWER.w - 48} height="12" rx="6" fill="#64748b" />
        {SLOTS.slice(1).map((x, i) => <circle key={i} cx={x} cy={BAR_Y} r="4" fill="#334155" />)}
        {thing(refKind, SLOTS[0], HANG - half(refKind) * HS, ref.label, true, false, HS)}

        {items.map((it, i) => {
          const c = card(i);
          return <rect key={'card-' + it.id} x={c.x} y={c.y} width={c.w} height={c.h} rx="14" fill={onBar.includes(it.id) ? 'none' : '#1e293b'} stroke="#475569" strokeWidth="2" strokeDasharray={onBar.includes(it.id) ? '6 5' : undefined} />;
        })}
        <rect id="shelf" x="380" y="28" width="290" height="390" fill="none" pointerEvents="none" />

        {items.map(it => {
          const p = at(it);
          const k = KINDS[it.kind];
          return (
            <g key={it.id} id={'item-' + it.id} onPointerDown={e => grab(it.id, e)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
              <rect x={p.x - 40} y={p.y - 40} width="80" height="96" fill="#0f172a" opacity="0" />
              {thing(it.kind, p.x, p.y, k.label, p.hung, p.named, p.s || 1)}
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}
