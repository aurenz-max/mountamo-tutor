// Picture Key (3.MD.B.3). A picture graph was drawn this morning: each row shows one choice's votes, and the key says
// how many votes one picture stands for. More votes for one choice came in later; their vote cards (one card, one
// vote) lie on the tray. The child drags whole or half pictures into that row so the graph shows the new total, then
// says how many votes the row stands for now (or, on the last problem, how many more than another row). The rule is
// used twice: reading the pictures already drawn (each is worth the key) and turning the new cards into pictures.
// The named misrule counts each picture as one vote: it reads the row as its picture count and adds one picture per
// card. No total and no vote count of a row is printed; the only numbers on screen are the key's.
// params: pic (the graph's picture), key (votes per picture), rows [{ id, icon, name, has }] (has = pictures drawn
// this morning, may end in .5), target (the row the new votes are for), cards (new vote cards), than (optional row
// id: the answer is how many more votes the target has than that row).
function Display({ params, lumina }) {
  const pic = params.pic || '⭐';
  const key = Math.max(1, Number(params.key) || 2);
  const rows = (Array.isArray(params.rows) ? params.rows : [
    { id: 'apple', icon: '🍎', name: 'apples', has: 3 }, { id: 'grape', icon: '🍇', name: 'grapes', has: 2 },
  ]).slice(0, 3);
  const target = params.target || rows[rows.length - 1].id;
  const cards = Math.max(1, Math.min(10, Number(params.cards) || 4));
  const than = params.than || null;
  const tRow = rows.find(r => r.id === target) || rows[0];
  const oRow = than ? rows.find(r => r.id === than) : null;

  const MAX = 11, SLOT = 44, TRACK_X = 166, ROW_Y = 140, ROW_H = 56, ROW_GAP = 64, W = 680;
  const startUnits = has => { const n = Number(has) || 0; const u = Array(Math.floor(n)).fill(1); if (n % 1) u.push(0.5); return u; };
  const [units, setUnits] = useState(() => Object.fromEntries(rows.map(r => [r.id, startUnits(r.has)])));
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const total = id => (units[id] || []).reduce((a, b) => a + b, 0);

  // What the finished target row must hold, in pictures, and the said answer.
  const want = Number(tRow.has) + cards / key;
  const votesNow = Number(tRow.has) * key + cards;
  const answer = oRow ? votesNow - Number(oRow.has) * key : votesNow;
  const goalMet = Math.abs(total(tRow.id) - want) < 1e-9 && rows.every(r => r.id === tRow.id || Math.abs(total(r.id) - Number(r.has)) < 1e-9);

  useEffect(() => {
    const asOnes = Number(tRow.has) + cards; // every picture read as one vote, one picture added per card
    const raw = oRow ? [
      { says: asOnes - Number(oRow.has), because: 'counted each picture as one vote instead of the number in the key, and added one picture for each new card' },
      { says: want - Number(oRow.has), because: 'built the row right, then compared the number of pictures in the two rows instead of the votes they stand for' },
    ] : [
      { says: asOnes, because: 'counted each picture as one vote instead of the number in the key, and added one picture for each new card' },
    ];
    const misrules = raw.filter((m, i, all) => Number.isInteger(m.says) && m.says > 0 && m.says !== answer && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(answer, misrules);
  }, []);

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      key: 'each ' + pic + ' stands for ' + key + (key === 1 ? ' vote' : ' votes'),
      newVoteCards: cards + ' cards for ' + tRow.name,
      rows: rows.map(r => ({ choice: r.name, picturesInRow: total(r.id) })),
    });
  }, [units, goalMet]);

  const rowTop = i => ROW_Y + i * ROW_GAP;
  const grab = (kind, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ kind }); };
  const move = e => { if (drag && svgRef.current) { const p = svgPoint(svgRef.current, e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const drop = e => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e), kind = drag.kind;
    setDrag(null);
    const i = rows.findIndex((r, k) => p.y >= rowTop(k) - 4 && p.y <= rowTop(k) + ROW_H + 4 && p.x >= TRACK_X - 20);
    if (i < 0) return;
    const id = rows[i].id;
    setUnits(u => ((u[id] || []).length >= MAX ? u : { ...u, [id]: [...(u[id] || []), kind === 'half' ? 0.5 : 1] }));
  };
  const remove = (id, k) => setUnits(u => ({ ...u, [id]: u[id].filter((_, j) => j !== k) }));

  const picture = (half, size) => (
    <g>
      <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize={size} clipPath={half ? 'url(#half-clip)' : undefined}>{pic}</text>
    </g>
  );

  const row = (r, i) => {
    const y = rowTop(i), cy = y + ROW_H / 2;
    return (
      <g key={r.id}>
        <rect x="20" y={y} width="138" height={ROW_H} rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x="44" y={cy + 2} textAnchor="middle" dominantBaseline="middle" fontSize="30">{r.icon}</text>
        <text x="64" y={cy + 1} dominantBaseline="middle" fontSize="16" fill="#e2e8f0">{r.name}</text>
        <rect id={'row-' + r.id} x={TRACK_X - 4} y={y} width={MAX * SLOT + 8} height={ROW_H} rx="10" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
        {(units[r.id] || []).map((u, k) => (
          <g key={k} id={'pic-' + r.id + '-' + k} transform={`translate(${TRACK_X + SLOT / 2 + k * SLOT}, ${cy})`} onClick={() => remove(r.id, k)} style={{ cursor: 'pointer' }}>
            <rect x={-SLOT / 2} y={-ROW_H / 2 + 4} width={SLOT} height={ROW_H - 8} fill="#0f172a" opacity="0.01" />
            {picture(u === 0.5, 32)}
          </g>
        ))}
      </g>
    );
  };

  const cardAt = k => ({ x: 40 + k * 60, y: 52 });
  const chartBottom = rowTop(rows.length - 1) + ROW_H;
  const KEY_Y = chartBottom + 26, H = KEY_Y + 104;
  const stamp = (kind, x) => (
    <g key={kind} id={'stamp-' + kind} transform={`translate(${x}, ${KEY_Y + 40})`} onPointerDown={e => grab(kind, e)} onPointerUp={drop}
      onPointerCancel={() => setDrag(null)} style={{ cursor: 'grab', touchAction: 'none' }}>
      <rect x="-30" y="-30" width="60" height="60" rx="12" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      {picture(kind === 'half', 34)}
    </g>
  );

  return (
    <Panel title="Picture Key" caption="Drag a picture or a half picture into a row. Tap a picture in a row to take it off.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <defs><clipPath id="half-clip"><rect x="-30" y="-30" width="30" height="60" /></clipPath></defs>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="20" y="14" width="640" height="100" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x="36" y="38" fontSize="16" fill="#cbd5e1">New votes</text>
        {Array.from({ length: cards }, (_, k) => {
          const c = cardAt(k);
          return <g key={k} transform={`translate(${c.x}, ${c.y})`}>
            <rect width="50" height="52" rx="8" fill="#334155" stroke="#64748b" strokeWidth="2" />
            <text x="25" y="28" textAnchor="middle" dominantBaseline="middle" fontSize="30">{tRow.icon}</text>
          </g>;
        })}
        {rows.map(row)}
        <rect x="20" y={KEY_Y} width="250" height="80" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x="40" y={KEY_Y + 26} fontSize="15" fill="#cbd5e1">Key</text>
        <text x="58" y={KEY_Y + 54} textAnchor="middle" dominantBaseline="middle" fontSize="30">{pic}</text>
        <text x="84" y={KEY_Y + 55} dominantBaseline="middle" fontSize="22" fill="#e2e8f0">{'= ' + key + (key === 1 ? ' vote' : ' votes')}</text>
        {stamp('whole', 440)}
        {stamp('half', 540)}
        <text x="440" y={KEY_Y + 90} textAnchor="middle" fontSize="14" fill="#cbd5e1">picture</text>
        <text x="540" y={KEY_Y + 90} textAnchor="middle" fontSize="14" fill="#cbd5e1">half</text>
        {drag && drag.x !== undefined && <g transform={`translate(${drag.x}, ${drag.y})`} pointerEvents="none" opacity="0.9">{picture(drag.kind === 'half', 34)}</g>}
      </svg>
    </Panel>
  );
}
