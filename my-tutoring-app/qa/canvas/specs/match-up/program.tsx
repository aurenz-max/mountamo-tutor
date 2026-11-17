// Match Up (K.CC.C.6). Two rows of things. The child drags a string from a thing in one row to a thing in the other;
// each thing holds at most one string. When every thing that can have a partner has one, the group with some left
// over has more. The rows are drawn so the eye is misled: the group with fewer things has the bigger things or the
// longer row. The said answer is the group with more (or "same"), or on the last problem how many more.
// params.top / params.bottom: { pic, name, one, n, size: 'big' | 'small', gap } (gap: centre to centre, in px).
// params.ask: 'which' (say the group with more, or same) or 'howMany' (say how many more the bigger group has).
function Display({ params, lumina }) {
  const row = (r, d) => ({
    pic: (r && r.pic) || d.pic, name: (r && r.name) || d.name, one: (r && r.one) || d.one,
    n: Math.max(1, Math.min(9, Number(r && r.n) || d.n)),
    size: (r && r.size) === 'big' ? 'big' : 'small',
    gap: Number(r && r.gap) || d.gap,
  });
  const top = row(params.top, { pic: '🐕', name: 'dogs', one: 'dog', n: 4, gap: 140 });
  const bot = row(params.bottom, { pic: '🦴', name: 'bones', one: 'bone', n: 6, gap: 60 });
  const mode = params.ask === 'howMany' ? 'howMany' : 'which';

  const W = 680, CX = 340;
  const R = s => (s === 'big' ? 44 : 27);          // touch radius: 88px and 54px targets
  const FS = s => (s === 'big' ? 62 : 36);          // emoji size
  const TOP_Y = R(top.size) + 30;
  const BOT_Y = TOP_Y + 92 + R(top.size) + R(bot.size);
  const H = BOT_Y + R(bot.size) + 44;
  const xs = g => Array.from({ length: g.n }, (_, i) => CX + (i - (g.n - 1) / 2) * g.gap);
  const pos = { top: xs(top).map(x => ({ x, y: TOP_Y })), bot: xs(bot).map(x => ({ x, y: BOT_Y })) };

  const [links, setLinks] = useState([]);           // [{ t, b }]: top index, bottom index
  const [drag, setDrag] = useState(null);           // { side, i, x, y }
  const svgRef = useRef(null);

  useEffect(() => {
    const extra = Math.abs(top.n - bot.n);
    if (mode === 'howMany') {
      const more = top.n > bot.n ? top : bot, fewer = top.n > bot.n ? bot : top;
      const misrules = [
        { says: more.n, because: 'counted every ' + more.one + ', not only the ones with no partner' },
        { says: fewer.n, because: 'counted the ' + fewer.name + ', the ones that look like more' },
      ].filter((m, i, all) => m.says !== extra && all.findIndex(x => x.says === m.says) === i);
      lumina.answer(extra, misrules);
      return;
    }
    const key = top.n > bot.n ? top.name : bot.n > top.n ? bot.name : 'same';
    // The misrule: the bigger things are more; with things the same size, the longer row is more.
    const len = g => (g.n - 1) * g.gap + 2 * R(g.size);
    const looks = top.size !== bot.size ? (top.size === 'big' ? top : bot) : len(top) !== len(bot) ? (len(top) > len(bot) ? top : bot) : null;
    const because = top.size !== bot.size ? 'the bigger things look like more' : 'the longer row looks like more';
    const misrules = looks && looks.name !== key ? [{ says: looks.name, because }] : [];
    lumina.answer(key, misrules, [top.name, bot.name, 'same']);
  }, []);

  useEffect(() => {
    lumina.goal(links.length === Math.min(top.n, bot.n));
    lumina.scene({
      topRow: top.name + ', ' + top.size + ' ones, ' + (top.gap >= 100 ? 'spread far apart' : 'close together'),
      bottomRow: bot.name + ', ' + bot.size + ' ones, ' + (bot.gap >= 100 ? 'spread far apart' : 'close together'),
      stringsTied: links.length,
      stringsGoFrom: links.map(l => top.one + ' ' + (l.t + 1) + ' to ' + bot.one + ' ' + (l.b + 1)),
    });
  }, [links]);

  const other = s => (s === 'top' ? 'bot' : 'top');
  const grab = (side, i, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ side, i }); };
  const onMove = e => { if (drag && svgRef.current) { const p = svgPoint(svgRef.current, e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e), { side, i } = drag;
    setDrag(null);
    if (drag.x === undefined) return;                  // a tap, not a drag: nothing changes
    const os = other(side), g = os === 'top' ? top : bot;
    const j = pos[os].findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) < R(g.size) + 8);
    const mine = l => (side === 'top' ? l.t === i : l.b === i);
    if (j < 0) {                                       // dropped on nothing: the string comes off
      const near = pos[side].findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) < 30);
      if (near !== i) setLinks(ls => ls.filter(l => !mine(l)));
      return;
    }
    const t = side === 'top' ? i : j, b = side === 'top' ? j : i;
    setLinks(ls => [...ls.filter(l => l.t !== t && l.b !== b), { t, b }]);
  };

  const thing = (side, i) => {
    const g = side === 'top' ? top : bot, q = pos[side][i], r = R(g.size);
    const tied = links.some(l => (side === 'top' ? l.t : l.b) === i);
    return (
      <g key={side + i} id={(side === 'top' ? 'top-' : 'bottom-') + i} transform={`translate(${q.x}, ${q.y})`}
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => grab(side, i, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        <circle r={r} fill={tied ? '#334155' : '#1e293b'} stroke="#64748b" strokeWidth="2" />
        <text y="3" textAnchor="middle" dominantBaseline="middle" fontSize={FS(g.size)}>{g.pic}</text>
      </g>
    );
  };

  const held = drag && drag.x !== undefined ? pos[drag.side][drag.i] : null;

  return (
    <Panel title="Match Up" caption="Drag from one thing to another to tie a string. Drag a tied thing away to untie it.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="14" y={TOP_Y - R(top.size) - 16} width={W - 28} height={2 * R(top.size) + 32} rx="16" fill="#1e293b" fillOpacity="0.45" stroke="#475569" strokeWidth="2" />
        <rect x="14" y={BOT_Y - R(bot.size) - 16} width={W - 28} height={2 * R(bot.size) + 32} rx="16" fill="#1e293b" fillOpacity="0.45" stroke="#475569" strokeWidth="2" />
        {links.map(l => {
          const a = pos.top[l.t], b = pos.bot[l.b];
          return <line key={l.t + '-' + l.b} x1={a.x} y1={a.y + R(top.size)} x2={b.x} y2={b.y - R(bot.size)}
            stroke="#22d3ee" strokeWidth="5" strokeLinecap="round" />;
        })}
        {held ? <line x1={held.x} y1={held.y} x2={drag.x} y2={drag.y} stroke="#22d3ee" strokeWidth="4" strokeDasharray="8 6" strokeLinecap="round" /> : null}
        {pos.top.map((_, i) => thing('top', i))}
        {pos.bot.map((_, i) => thing('bot', i))}
      </svg>
    </Panel>
  );
}
