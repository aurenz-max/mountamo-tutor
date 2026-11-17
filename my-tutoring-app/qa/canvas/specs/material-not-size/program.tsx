// Material, not size (2-PS1-1, 5-PS1-3). Things sit on a dock beside a tank of water. Each thing has a guess tag.
// The child first drags the tag to the post at the side of the tank: the place at the waterline (it will float) or the
// place on the bottom (it will sink). The tag then stays put, and only then can the thing be picked up and dropped in
// the water. The world shows where it ends up; nothing changes colour and no word says whether the guess was right.
// Check judges the guesses: every tag where its thing ended up, every thing in the water.
// Params: objects (1-2 of { material: steel | wood | wax | stone | log, size: small | big | half }),
// about (which object the said answer is about, default 0).
function Display({ params, lumina }) {
  const DENSITY = { steel: 7.8, wood: 0.6, wax: 0.9, stone: 2.6, log: 0.6 };
  const objects = (Array.isArray(params.objects) && params.objects.length ? params.objects : [{ material: 'steel', size: 'small' }])
    .slice(0, 2)
    .map(o => ({
      material: o && DENSITY[o.material] ? o.material : 'steel',
      size: o && (o.size === 'big' || o.size === 'half') ? o.size : 'small',
    }));
  const n = objects.length;
  const about = Math.max(0, Math.min(n - 1, Number(params.about) || 0));
  const sinks = o => DENSITY[o.material] > 1;
  const looksBig = o => o.material === 'log' || o.size === 'big';
  const nameOf = o => {
    if (o.material === 'stone') return 'a pebble';
    if (o.material === 'log') return 'a log';
    if (o.material === 'wax') return o.size === 'small' ? 'a small block of candle wax' : 'a big block of candle wax';
    if (o.size === 'half') return o.material === 'wood' ? 'half of the big wooden block' : 'half of the big steel block';
    const m = o.material === 'wood' ? 'wooden' : 'steel';
    return o.size === 'small' ? `a small ${m} cube` : `a big ${m} block`;
  };
  const dims = o => {
    if (o.material === 'stone') return { w: 44, h: 30 };
    if (o.material === 'log') return { w: 124, h: 50 };
    if (o.size === 'small') return { w: 38, h: 38 };
    if (o.size === 'half') return { w: 60, h: 90 };
    return { w: 120, h: 90 };
  };

  // The said answer: about one thing, the same whatever the child does.
  useEffect(() => {
    const o = objects[about];
    const key = sinks(o) ? 'sink' : 'float';
    const says = looksBig(o) ? 'sink' : 'float';
    const misrules = [{
      says,
      because: says === 'sink'
        ? 'thinks big or heavy things sink, whatever they are made of'
        : 'thinks small or light things float, whatever they are made of',
    }].filter(m => m.says !== key);
    lumina.answer(key, misrules, ['sink', 'float']);
  }, []);

  const [tags, setTags] = useState(() => objects.map(() => null)); // null | 'top' | 'bottom'
  const [dropped, setDropped] = useState(() => objects.map(() => false));
  const [drag, setDrag] = useState(null); // { kind: 'tag' | 'thing', i, x?, y? }
  const svgRef = useRef(null);

  const met = objects.every((o, i) => tags[i] === (sinks(o) ? 'bottom' : 'top') && dropped[i]);
  const TAG_WORDS = { top: 'tag in the place at the waterline', bottom: 'tag in the place on the bottom' };

  useEffect(() => {
    lumina.goal(met);
    lumina.scene({
      things: objects.map((o, i) => ({
        thing: nameOf(o),
        guessTag: tags[i] ? TAG_WORDS[tags[i]] : 'tag still on the dock',
        where: !dropped[i] ? 'on the dock' : sinks(o) ? 'resting on the bottom of the tank' : 'floating at the top of the water',
      })),
      tank: 'a tank of water; the post at its side has one tag place at the waterline and one on the bottom',
    });
  }, [tags, dropped]);

  // ---------- layout ----------
  const W = 680, H = 430;
  const SY = 120; // waterline
  const FY = 396; // tank floor
  const WX0 = 384, WX1 = 660; // water, right of the post
  const SLOT = { top: { x: 290, y: 68, w: 86, h: 112 }, bottom: { x: 290, y: 284, w: 86, h: 108 } };
  const slotCentre = k => ({ x: SLOT[k].x + SLOT[k].w / 2, y: SLOT[k].y + SLOT[k].h / 2 });
  const ACCENT = ['#22d3ee', '#fbbf24'];

  const dockThing = i => (n === 1 ? { x: 142, y: 170 } : { x: i === 0 ? 84 : 204, y: 170 });
  const dockTag = i => (n === 1 ? { x: 142, y: 340 } : { x: i === 0 ? 84 : 204, y: 340 });
  const slotTag = i => {
    const c = slotCentre(tags[i]);
    return { x: c.x, y: c.y + (n === 2 ? (i === 0 ? -26 : 26) : 0) };
  };
  const rest = i => {
    const o = objects[i], d = dims(o);
    const cx = n === 1 ? (WX0 + WX1) / 2 : WX0 + ((WX1 - WX0) / 2) * (i + 0.5);
    if (sinks(o)) return { x: cx, y: FY - d.h / 2 };
    return { x: cx, y: SY - (1 - DENSITY[o.material]) * d.h + d.h / 2 };
  };
  const dragging = (kind, i) => drag && drag.kind === kind && drag.i === i;
  const tagAt = i => (dragging('tag', i) && drag.x !== undefined ? { x: drag.x, y: drag.y } : tags[i] ? slotTag(i) : dockTag(i));
  const thingAt = i => (dragging('thing', i) && drag.x !== undefined ? { x: drag.x, y: drag.y } : dropped[i] ? rest(i) : dockThing(i));

  const onDown = (kind, i, e) => {
    if (kind === 'tag' && tags[i]) return;
    if (kind === 'thing' && (!tags[i] || dropped[i])) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ kind, i });
  };
  const onMove = e => {
    if (!drag || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    setDrag(d => (d ? { ...d, x: pt.x, y: pt.y } : null));
  };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    const { kind, i } = drag;
    setDrag(null);
    if (kind === 'tag') {
      if (pt.x < 276 || pt.x > 392) return;
      const k = pt.y >= 52 && pt.y <= 200 ? 'top' : pt.y >= 268 && pt.y <= 412 ? 'bottom' : null;
      if (k) setTags(t => t.map((v, j) => (j === i ? k : v)));
    } else if (pt.x >= WX0 && pt.x <= WX1 + 10 && pt.y >= 24 && pt.y <= 412) {
      setDropped(ds => ds.map((v, j) => (j === i ? true : v)));
    }
  };

  // ---------- pictures ----------
  const drawThing = (o, i, mini) => {
    const { w, h } = dims(o);
    const x = -w / 2, y = -h / 2;
    let body;
    if (o.material === 'steel') {
      body = (
        <g>
          <rect x={x} y={y} width={w} height={h} rx="3" fill="url(#steel)" stroke="#475569" strokeWidth="2" />
          <line x1={x + w * 0.2} y1={y + h * 0.25} x2={x + w * 0.45} y2={y + h * 0.12} stroke="#f8fafc" strokeWidth="2.5" opacity="0.8" />
        </g>
      );
    } else if (o.material === 'wood') {
      const lines = [0.25, 0.5, 0.75].map(f => y + h * f);
      body = (
        <g>
          <rect x={x} y={y} width={w} height={h} rx="3" fill="#c08a4e" stroke="#7c4a1e" strokeWidth="2" />
          {lines.map((ly, k) => (
            <path key={k} d={`M ${x + 4} ${ly} q ${w / 4} ${k % 2 ? 5 : -5} ${w / 2} 0 t ${w / 2 - 8} 0`} fill="none" stroke="#8b5a2b" strokeWidth="1.5" />
          ))}
          {o.size === 'half' && <rect x={x + w - 8} y={y + 1} width="7" height={h - 2} fill="#e8c08a" />}
        </g>
      );
    } else if (o.material === 'wax') {
      body = (
        <g>
          <rect x={x} y={y} width={w} height={h} rx="5" fill="#fef3c7" stroke="#d4b86a" strokeWidth="2" />
          <path d={`M ${x + w * 0.2} ${y} q 4 14 0 22`} fill="none" stroke="#fde68a" strokeWidth="5" strokeLinecap="round" />
          <line x1="0" y1={y} x2="0" y2={y - 12} stroke="#334155" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    } else if (o.material === 'stone') {
      body = (
        <g>
          <ellipse cx="0" cy="0" rx={w / 2} ry={h / 2} fill="#78716c" stroke="#44403c" strokeWidth="2" />
          <circle cx="-8" cy="-4" r="2.5" fill="#a8a29e" />
          <circle cx="7" cy="4" r="2" fill="#57534e" />
          <circle cx="4" cy="-7" r="1.8" fill="#d6d3d1" />
        </g>
      );
    } else {
      body = (
        <g>
          <rect x={x} y={y} width={w - 14} height={h} rx="10" fill="#92582c" stroke="#5c3317" strokeWidth="2" />
          <line x1={x + 10} y1={y + h * 0.35} x2={x + w - 30} y2={y + h * 0.35} stroke="#6b3e1d" strokeWidth="2" />
          <line x1={x + 20} y1={y + h * 0.7} x2={x + w - 40} y2={y + h * 0.7} stroke="#6b3e1d" strokeWidth="2" />
          <ellipse cx={x + w - 16} cy="0" rx="16" ry={h / 2} fill="#d6a66b" stroke="#5c3317" strokeWidth="2" />
          <ellipse cx={x + w - 16} cy="0" rx="9" ry={h / 3.4} fill="none" stroke="#a87440" strokeWidth="1.5" />
          <ellipse cx={x + w - 16} cy="0" rx="3.5" ry={h / 9} fill="#a87440" />
        </g>
      );
    }
    return (
      <g>
        {body}
        {n === 2 && !mini && <circle cx={x + 2} cy={y + 2} r="7" fill={ACCENT[i]} stroke="#0f172a" strokeWidth="2" />}
      </g>
    );
  };

  const tagView = i => {
    const p = tagAt(i);
    const o = objects[i], d = dims(o);
    const s = Math.min(38 / d.w, 28 / d.h, 1);
    const live = !tags[i];
    const moving = dragging('tag', i) && drag.x !== undefined;
    return (
      <g key={'tag' + i} id={`tag-${i + 1}`} onPointerDown={e => onDown('tag', i, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}
        style={{ cursor: live ? 'grab' : 'default', touchAction: 'none', transform: `translate(${p.x}px, ${p.y}px)`, transition: moving ? 'none' : 'transform 0.3s ease-out' }}>
        <path d="M -44 0 L -34 -22 L 36 -22 L 36 22 L -34 22 Z" fill={moving ? '#334155' : '#1e293b'} stroke={ACCENT[i]} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="-30" cy="0" r="4" fill="#0f172a" stroke={ACCENT[i]} strokeWidth="2" />
        <g transform={`translate(6, 2) scale(${s})`}>{drawThing(o, i, true)}</g>
      </g>
    );
  };

  const thingView = i => {
    const p = thingAt(i);
    const o = objects[i], d = dims(o);
    const live = !!tags[i] && !dropped[i];
    const moving = dragging('thing', i) && drag.x !== undefined;
    const transition = moving ? 'none' : dropped[i] ? (sinks(o) ? 'transform 0.5s ease-in' : 'transform 0.4s ease-out') : 'transform 0.3s ease-out';
    return (
      <g key={'thing' + i} id={`thing-${i + 1}`} onPointerDown={e => onDown('thing', i, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}
        opacity={tags[i] || dropped[i] ? 1 : 0.6}
        style={{ cursor: live ? 'grab' : 'default', touchAction: 'none', transform: `translate(${p.x}px, ${p.y}px)`, transition }}>
        <rect x={-Math.max(56, d.w + 8) / 2} y={-Math.max(56, d.h + 8) / 2} width={Math.max(56, d.w + 8)} height={Math.max(56, d.h + 8)} fill="transparent" />
        {drawThing(o, i, false)}
      </g>
    );
  };

  const slotView = k => {
    const s = SLOT[k];
    return (
      <rect key={k} id={`slot-${k}`} x={s.x} y={s.y} width={s.w} height={s.h} rx="10" fill="rgba(15,23,42,0.5)"
        stroke="#64748b" strokeWidth="2" strokeDasharray="6 5" />
    );
  };

  const wave = (x0, x1, y) => {
    let d = `M ${x0} ${y}`;
    for (let x = x0; x < x1; x += 24) d += ` q 6 -5 12 0 t 12 0`;
    return d;
  };

  return (
    <Panel title="Water Tank" caption="Drag a tag to the post first. Then drag the thing into the water.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <defs>
          <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e2e8f0" />
            <stop offset="0.5" stopColor="#94a3b8" />
            <stop offset="1" stopColor="#64748b" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#0f172a" />
        {/* the dock */}
        <rect x="16" y="36" width="252" height="372" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <rect x="28" y={170 + 50} width="228" height="10" rx="4" fill="#7c4a1e" opacity="0.7" />
        {/* the tank: the post on the left, water on the right */}
        <rect x="280" y="36" width="100" height="372" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <rect x={WX0 - 4} y="36" width={WX1 - WX0 + 12} height={FY - 36 + 12} rx="10" fill="#0b1224" />
        <rect x={WX0} y={SY} width={WX1 - WX0 + 4} height={FY - SY} fill="#0c4a6e" opacity="0.55" />
        <rect x={WX0} y={FY} width={WX1 - WX0 + 4} height="10" fill="#a8a29e" />
        <line x1="280" y1={SY} x2="380" y2={SY} stroke="#7dd3fc" strokeWidth="2" strokeDasharray="4 4" />
        <line x1="280" y1={FY} x2="380" y2={FY} stroke="#a8a29e" strokeWidth="2" strokeDasharray="4 4" />
        {slotView('top')}
        {slotView('bottom')}
        {objects.map((_, i) => thingView(i))}
        {/* water over the things, so what is under the waterline looks under water */}
        <rect id="tank" x={WX0} y={SY} width={WX1 - WX0 + 4} height={FY - SY} fill="#38bdf8" opacity="0.2" style={{ pointerEvents: 'none' }} />
        <path d={wave(WX0, WX1, SY)} fill="none" stroke="#7dd3fc" strokeWidth="2.5" style={{ pointerEvents: 'none' }} />
        <rect x={WX0 - 4} y="36" width={WX1 - WX0 + 12} height={FY - 36 + 12} rx="10" fill="none" stroke="#64748b" strokeWidth="3" style={{ pointerEvents: 'none' }} />
        {objects.map((_, i) => tagView(i))}
      </svg>
    </Panel>
  );
}
