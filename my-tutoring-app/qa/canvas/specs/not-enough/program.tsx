// Not enough (social studies K-2: scarcity). Two tasks on one page.
// mode 'deal': a box of toys and a group of friends, each with an empty dashed place in front of them. The child drags
//   toys from the box to the friends. A toy can go to a friend who already holds one (doubling up is drawn, and Check
//   refuses it); a toy dropped on the box goes back. The goal: every toy that can go out is out, and no friend holds two.
//   The said answer: how many friends get no toy (friends minus toys, never below zero).
// mode 'turns': a few bikes and more friends than bikes. Each row below is one turn, with one dashed seat per bike. The
//   child drags each friend onto a seat. The goal: every friend rides once, turns are used from the top with no gap, and
//   no bike stands empty while a friend still waits. The said answer: how many turns it takes.
// Nothing is numbered on the stage; the tutor reads the ask.
function Display({ params, lumina }) {
  const mode = params.mode === 'turns' ? 'turns' : 'deal';
  const W = 680;
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const pt = e => svgPoint(svgRef.current, e);
  const FACES = ['👧', '👦🏿', '🧒🏽', '👧🏼', '👦', '🧑🏾', '👧🏻', '👦🏽'];
  const TOYS = ['🧸', '🚗', '⚽', '🪀', '🎈', '🧩', '🦆', '🪁'];

  // ---------- deal ----------
  const nFriends = Math.max(2, Math.min(8, Number(params.friends) || 5));
  const nToys = Math.max(1, Math.min(8, Number(params.toys) || 3));
  const rows = Number(params.rows) === 2 ? 2 : 1;
  const boxSide = ['left', 'right', 'middle'].includes(params.boxSide) ? params.boxSide : 'left';
  const toyKinds = Array.isArray(params.toyKinds) && params.toyKinds.length ? params.toyKinds : TOYS;
  const [holder, setHolder] = useState(() => Array(nToys).fill(-1));

  // ---------- turns ----------
  const seats = Math.max(1, Math.min(3, Number(params.seats) || 2));
  const turnRows = Math.max(2, Math.min(6, Number(params.turnRows) || 5));
  const ride = String(params.ride || '🚲');
  const [seatOf, setSeatOf] = useState(() => Array(nFriends).fill(null)); // [row, seat] or null

  useEffect(() => {
    if (mode === 'deal') {
      const key = Math.max(0, nFriends - nToys);
      const misrules = [
        { says: 0, because: 'thought everyone can have one, so nobody goes without' },
        { says: nToys, because: 'counted the toys given out, not the friends without one' },
        { says: nFriends, because: 'counted all the friends' },
      ].filter((m, k, all) => m.says !== key && all.findIndex(x => x.says === m.says) === k);
      lumina.answer(key, misrules);
    } else {
      const key = Math.ceil(nFriends / seats);
      const misrules = [
        { says: 1, because: 'thought everyone can ride at once' },
        { says: nFriends, because: 'gave each friend a turn alone, one bike used' },
        { says: nFriends - seats, because: 'counted the friends who wait on the first turn' },
      ].filter((m, k, all) => m.says !== key && m.says > 0 && all.findIndex(x => x.says === m.says) === k);
      lumina.answer(key, misrules);
    }
  }, []);

  // goal + scene
  useEffect(() => {
    if (mode === 'deal') {
      const per = Array.from({ length: nFriends }, (_, j) => holder.filter(h => h === j).length);
      const out = holder.filter(h => h >= 0).length;
      const met = out === Math.min(nToys, nFriends) && per.every(c => c <= 1);
      lumina.goal(met);
      lumina.scene({
        story: 'a box of toys and a group of friends who each want one',
        friendsSit: rows === 2 ? 'in two rows' : 'in one row',
        toyBoxIs: 'on the ' + boxSide,
        toysStillInBox: holder.some(h => h < 0) ? 'some' : 'none',
        toysHandedOut: out,
        friendsHoldingTwoOrMore: per.filter(c => c >= 2).length,
      });
    } else {
      const placed = seatOf.filter(Boolean);
      const used = Array.from({ length: turnRows }, (_, r) => placed.filter(s => s[0] === r).length);
      const last = used.reduce((m, c, r) => (c > 0 ? r : m), -1);
      const met = placed.length === nFriends && used.slice(0, last + 1).every((c, r) => (r < last ? c === seats : c > 0));
      lumina.goal(met);
      lumina.scene({
        story: 'friends take turns on the bikes; each row is one turn, top row first',
        bikesEachTurn: seats,
        friendsStillWaiting: nFriends - placed.length,
        ridersInEachTurn: used.map((c, r) => 'turn ' + (r + 1) + ': ' + (c === 0 ? 'empty' : c === 1 ? 'one rider' : c + ' riders')),
      });
    }
  }, [holder, seatOf]);

  const onMove = e => { if (drag) { const p = pt(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y, moved: true } : null)); } };
  const grab = (key, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); const p = pt(e); setDrag({ key, x: p.x, y: p.y, moved: false }); };

  if (mode === 'deal') {
    // Toy box band, then friends.
    const BOX_Y = 16, BOX_H = 104, STEP = 72;
    const bw = nToys * STEP + 28;
    const bx = boxSide === 'left' ? 24 : boxSide === 'right' ? W - 24 - bw : (W - bw) / 2;
    const perRow = Math.ceil(nFriends / rows);
    const gap = Math.min(128, 640 / perRow);
    const FR_Y = BOX_Y + BOX_H + 30, ROW_H = 176;
    const H = FR_Y + rows * ROW_H + 6;
    const friendAt = j => {
      const r = Math.floor(j / perRow), k = j % perRow, inRow = r === rows - 1 ? nFriends - r * perRow : perRow;
      return { x: W / 2 + (k - (inRow - 1) / 2) * gap, y: FR_Y + r * ROW_H + 40 };
    };
    const homeOf = i => ({ x: bx + 14 + STEP / 2 + i * STEP, y: BOX_Y + BOX_H / 2 + 6 });
    const toyAt = i => {
      if (drag && drag.key === i && drag.moved) return { x: drag.x, y: drag.y, s: 1 };
      const j = holder[i];
      if (j < 0) return { ...homeOf(i), s: 1 };
      const f = friendAt(j);
      const mates = holder.map((h, k) => (h === j ? k : -1)).filter(k => k >= 0);
      const n = mates.length, k = mates.indexOf(i);
      return n === 1 ? { x: f.x, y: f.y + 86, s: 1 } : { x: f.x + (k - (n - 1) / 2) * 30, y: f.y + 86, s: 0.75 };
    };
    const drop = e => {
      if (!drag) return;
      const p = pt(e), i = drag.key, moved = drag.moved;
      setDrag(null);
      if (!moved) return; // a tap moves nothing
      if (p.y < BOX_Y + BOX_H + 14) { setHolder(h => h.map((v, k) => (k === i ? -1 : v))); return; }
      let best = -1, bd = 1e9;
      for (let j = 0; j < nFriends; j++) {
        const f = friendAt(j), dx = Math.abs(p.x - f.x), dy = p.y - f.y;
        if (dx < gap / 2 && dy > -46 && dy < 136 && dx + Math.abs(dy - 50) < bd) { bd = dx + Math.abs(dy - 50); best = j; }
      }
      if (best >= 0) setHolder(h => h.map((v, k) => (k === i ? best : v)));
    };
    const friend = j => {
      const f = friendAt(j);
      return (
        <g key={'f' + j} id={'friend-' + j}>
          <circle cx={f.x} cy={f.y} r="34" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          <text x={f.x} y={f.y + 3} textAnchor="middle" dominantBaseline="middle" fontSize="40">{FACES[j % FACES.length]}</text>
          <rect x={f.x - 38} y={f.y + 48} width="76" height="76" rx="12" fill="#0f172a" stroke="#475569" strokeWidth="2.5" strokeDasharray="6 5" />
        </g>
      );
    };
    const toy = i => {
      const p = toyAt(i), held = drag && drag.key === i && drag.moved;
      return (
        <g key={'t' + i} id={'toy-' + i} transform={`translate(${p.x}, ${p.y}) scale(${p.s})`} onPointerDown={e => grab(i, e)} onPointerUp={drop}
          onPointerCancel={() => setDrag(null)} style={{ cursor: 'grab', touchAction: 'none' }}>
          <circle r="30" fill={held ? '#334155' : '#1e293b'} stroke="#64748b" strokeWidth="2" />
          <text y="3" textAnchor="middle" dominantBaseline="middle" fontSize="36">{toyKinds[i % toyKinds.length]}</text>
        </g>
      );
    };
    const order = [...holder.map((_, i) => i).filter(i => !(drag && drag.key === i)), ...(drag ? [drag.key] : [])];
    return (
      <Panel title="Not Enough Toys" caption="Drag a toy to a friend. Drag it back to the box to take it away.">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
          <rect width={W} height={H} fill="#0f172a" />
          <rect x={bx} y={BOX_Y} width={bw} height={BOX_H} rx="14" fill="#78350f" stroke="#b45309" strokeWidth="3" />
          <rect x={bx} y={BOX_Y} width={bw} height="18" rx="8" fill="#92400e" />
          {Array.from({ length: nFriends }, (_, j) => friend(j))}
          {order.map(toy)}
        </svg>
      </Panel>
    );
  }

  // ---------- turns view ----------
  const LINE_Y = 56, ROW0 = 120, ROW_H = 74;
  const H = ROW0 + turnRows * ROW_H + 8;
  const kgap = Math.min(100, 620 / nFriends);
  const lineAt = j => ({ x: W / 2 + (j - (nFriends - 1) / 2) * kgap, y: LINE_Y });
  const SEAT_W = 150;
  const seatAt = (r, s) => ({ x: W / 2 + 20 + (s - (seats - 1) / 2) * SEAT_W + 30, y: ROW0 + r * ROW_H + ROW_H / 2 + 1 });
  const kidAt = j => {
    if (drag && drag.key === j && drag.moved) return { x: drag.x, y: drag.y };
    const s = seatOf[j];
    return s ? seatAt(s[0], s[1]) : lineAt(j);
  };
  const dropKid = e => {
    if (!drag) return;
    const p = pt(e), j = drag.key, moved = drag.moved;
    setDrag(null);
    if (!moved) return;
    let best = null, bd = 50;
    for (let r = 0; r < turnRows; r++) for (let s = 0; s < seats; s++) {
      const q = seatAt(r, s), d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < bd) { bd = d; best = [r, s]; }
    }
    if (best) setSeatOf(v => v.map((x, k) => (k === j ? best : x && x[0] === best[0] && x[1] === best[1] ? null : x)));
    else if (p.y < ROW0 - 10) setSeatOf(v => v.map((x, k) => (k === j ? null : x)));
  };
  const kid = j => {
    const p = kidAt(j), held = drag && drag.key === j && drag.moved;
    return (
      <g key={'k' + j} id={'kid-' + j} transform={`translate(${p.x}, ${p.y})`} onPointerDown={e => grab(j, e)} onPointerUp={dropKid}
        onPointerCancel={() => setDrag(null)} style={{ cursor: 'grab', touchAction: 'none' }}>
        <circle r="30" fill={held ? '#334155' : '#1e293b'} stroke="#64748b" strokeWidth="2" />
        <text y="3" textAnchor="middle" dominantBaseline="middle" fontSize="36">{FACES[j % FACES.length]}</text>
      </g>
    );
  };
  const rowX0 = seatAt(0, 0).x - 100, rowX1 = seatAt(0, seats - 1).x + 44;
  const order = [...seatOf.map((_, j) => j).filter(j => !(drag && drag.key === j)), ...(drag ? [drag.key] : [])];
  return (
    <Panel title="Bike Turns" caption="Drag a friend onto a bike. Each row is one turn.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="20" y={LINE_Y - 44} width={W - 40} height="88" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <line x1={rowX0 - 34} y1={ROW0 + 14} x2={rowX0 - 34} y2={H - 20} stroke="#64748b" strokeWidth="3" markerEnd="url(#down)" />
        <defs><marker id="down" markerWidth="10" markerHeight="10" refX="5" refY="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#64748b" /></marker></defs>
        {Array.from({ length: turnRows }, (_, r) => (
          <g key={'r' + r}>
            <rect x={rowX0} y={ROW0 + r * ROW_H + 2} width={rowX1 - rowX0} height={ROW_H - 6} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            {Array.from({ length: seats }, (_, s) => {
              const q = seatAt(r, s);
              return (
                <g key={s} id={'seat-' + r + '-' + s}>
                  <text x={q.x - 62} y={q.y + 3} textAnchor="middle" dominantBaseline="middle" fontSize="38">{ride}</text>
                  <circle cx={q.x} cy={q.y} r="32" fill="#0f172a" stroke="#475569" strokeWidth="2.5" strokeDasharray="6 5" />
                </g>
              );
            })}
          </g>
        ))}
        {order.map(kid)}
      </svg>
    </Panel>
  );
}
