function Display({ params, lumina }) {
  // Two class tasks on one page.
  // mode 'vote': the class's votes lie on the carpet (a child holding a picture of their choice). Drag each vote into
  //   the column under its choice to make a picture graph, then tap the star under the choice that won, or the
  //   handshake when two choices have the same. Cards on the carpet can be drawn at different sizes (params.bigFor);
  //   in a column every card is the same size, so only the count matters.
  // mode 'turns': children wait by one swing. Drag a child into each turn box, in order, to plan the turns.
  // params: mode, choices [{id, pic, name}], votes [choiceId...], bigFor, kids [{id, pic, name}], turnsEach, story.
  const mode = params.mode === 'turns' ? 'turns' : 'vote';
  const story = params.story || 'a class vote';
  const W = 680, H = 560;
  const svgRef = useRef(null);
  const pointOf = e => svgPoint(svgRef.current, e);
  const [drag, setDrag] = useState(null);
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };

  // ---------- vote ----------
  const choices = (Array.isArray(params.choices) ? params.choices : [
    { id: 'apple', pic: '🍎', name: 'apples' }, { id: 'grape', pic: '🍇', name: 'grapes' },
  ]).slice(0, 4);
  const votes = (Array.isArray(params.votes) ? params.votes : ['apple', 'grape', 'apple']).slice(0, 14);
  const faces = ['🧒', '👧', '👦', '🧒🏽', '👧🏾', '👦🏻', '🧒🏿', '👧🏼', '👦🏽', '🧒🏻', '👧🏽', '👦🏾', '🧒🏼', '👧🏿'];
  const bigFor = params.bigFor || null;
  const [col, setCol] = useState({});
  const [pick, setPick] = useState(null);
  const colW = W / choices.length, BASE = 450, CELL = 40;
  const counts = choices.map(c => votes.filter(v => v === c.id).length);
  const max = Math.max(...counts), leaders = choices.filter((c, i) => counts[i] === max);
  const allSorted = votes.every((v, i) => col[i] === v);
  const pickRight = leaders.length > 1 ? pick === 'tie' : pick === leaders[0].id;

  // ---------- turns ----------
  const kids = (Array.isArray(params.kids) ? params.kids : [
    { id: 'ana', pic: '👧', name: 'Ana' }, { id: 'ben', pic: '👦', name: 'Ben' },
  ]).slice(0, 4);
  const each = Math.max(1, Math.min(3, Number(params.turnsEach) || 2));
  const nSlots = Math.min(8, kids.length * each);
  const [slots, setSlots] = useState(() => Array(nSlots).fill(null));
  const fairTurns = slots.every(s => s) && Array.from({ length: Math.ceil(nSlots / kids.length) }, (_, r) => slots.slice(r * kids.length, r * kids.length + kids.length))
    .every(round => kids.every(k => round.filter(s => s === k.id).length === 1));

  const goalMet = mode === 'vote' ? allSorted && pickRight : fairTurns;

  useEffect(() => {
    lumina.goal(goalMet);
    if (mode === 'vote') {
      lumina.scene({
        story,
        choices: choices.map(c => c.name),
        votesOnCarpet: votes.filter((v, i) => col[i] === undefined).length,
        columns: choices.map(c => ({ choice: c.name, cardsInColumn: votes.filter((v, i) => col[i] === c.id).length })),
        starTapped: pick === 'tie' ? 'same (a tie)' : pick ? choices.find(c => c.id === pick).name : null,
      });
    } else {
      lumina.scene({
        story,
        children: kids.map(k => k.name),
        turnsEach: each,
        turnBoxes: slots.map((s, i) => (i + 1) + ': ' + (s ? kids.find(k => k.id === s).name : 'empty')),
      });
    }
  }, [col, pick, slots, goalMet]);

  if (mode === 'vote') {
    const carpetAt = i => {
      const perRow = Math.min(7, Math.ceil(votes.length / 2));
      const r = Math.floor(i / perRow), k = i % perRow;
      const jx = ((i * 37) % 23) - 11, jy = ((i * 53) % 19) - 9;
      return { x: 60 + k * ((W - 120) / Math.max(1, perRow - 1)) + jx, y: 70 + r * 100 + jy };
    };
    const inCol = (i) => {
      const c = col[i];
      const ci = choices.findIndex(x => x.id === c);
      const k = votes.filter((v, j) => j < i && col[j] === c).length;
      return { x: ci * colW + colW / 2, y: BASE - CELL / 2 - k * CELL };
    };
    const grab = (i, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ i }); };
    const onUp = e => {
      if (!drag || !svgRef.current) return;
      const p = pointOf(e), i = drag.i;
      setDrag(null);
      if (p.y > 220 && p.y < BASE + 10) {
        const ci = Math.max(0, Math.min(choices.length - 1, Math.floor(p.x / colW)));
        setCol(m => ({ ...m, [i]: choices[ci].id }));
      } else if (p.y <= 220) setCol(m => { const n = { ...m }; delete n[i]; return n; });
    };
    const card = (v, i) => {
      const held = drag && drag.i === i && drag.x !== undefined;
      const sorted = col[i] !== undefined;
      const p = held ? { x: drag.x, y: drag.y } : sorted ? inCol(i) : carpetAt(i);
      const s = held ? 1 : sorted ? 0.62 : (bigFor === v ? 1.35 : 0.9);
      const pic = choices.find(c => c.id === v).pic;
      return <g key={i} id={'vote-' + i} transform={`translate(${p.x}, ${p.y}) scale(${s})`}
        style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={e => grab(i, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        <rect x="-36" y="-30" width="72" height="60" rx="10" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
        <text x="-14" y="2" textAnchor="middle" dominantBaseline="middle" fontSize="28">{faces[i % faces.length]}</text>
        <text x="16" y="4" textAnchor="middle" dominantBaseline="middle" fontSize="28">{pic}</text>
      </g>;
    };
    const star = (id, x, label) => (
      <g key={id} id={'pick-' + id} transform={`translate(${x}, 516)`} style={{ cursor: 'pointer' }} onClick={() => setPick(p => (p === id ? null : id))}>
        <circle r="24" fill={pick === id ? '#334155' : '#1e293b'} stroke={pick === id ? '#e2e8f0' : '#475569'} strokeWidth={pick === id ? 4 : 2} />
        <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="24">{label}</text>
      </g>);
    return (
      <Panel>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
          <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
          <rect x="10" y="10" width={W - 20} height="205" rx="18" fill="#3b0764" opacity="0.55" />
          {choices.map((c, ci) => <g key={c.id} id={'col-' + c.id}>
            <rect x={ci * colW + 14} y="230" width={colW - 28} height={BASE - 230} rx="8" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            {Array.from({ length: Math.floor((BASE - 236) / CELL) }, (_, k) => <line key={k} x1={ci * colW + 18} x2={(ci + 1) * colW - 18} y1={BASE - k * CELL} y2={BASE - k * CELL} stroke="#334155" />)}
            <text x={ci * colW + colW / 2} y={BASE + 24} textAnchor="middle" dominantBaseline="middle" fontSize="30">{c.pic}</text>
          </g>)}
          {choices.map((c, ci) => star(c.id, ci * colW + colW / 2 - (ci === choices.length - 1 ? 0 : 0), '⭐'))}
          {star('tie', W - 34, '🤝')}
          {votes.map((v, i) => (drag && drag.i === i ? null : card(v, i)))}
          {votes.map((v, i) => (drag && drag.i === i ? card(v, i) : null))}
        </svg>
      </Panel>
    );
  }

  // ---------- turns view ----------
  const SLOT_Y = 330, slotW = Math.min(80, (W - 40) / nSlots), sx = i => (W - nSlots * slotW) / 2 + i * slotW + slotW / 2;
  const kidX = i => W / 2 + (i - (kids.length - 1) / 2) * 120;
  const grabKid = (id, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ kid: id }); };
  const onUpKid = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e), id = drag.kid;
    setDrag(null);
    if (Math.abs(p.y - SLOT_Y) < 50) {
      const i = Math.floor((p.x - (W - nSlots * slotW) / 2) / slotW);
      if (i >= 0 && i < nSlots) setSlots(s => s.map((v, j) => (j === i ? id : v)));
    }
  };
  const kidFace = (k, i) => {
    const held = drag && drag.kid === k.id && drag.x !== undefined;
    return <g key={k.id}>
      <g transform={`translate(${kidX(i)}, 120)`}>
        <circle r="34" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="40">{k.pic}</text>
        <text y="56" textAnchor="middle" fontSize="18" fill="#cbd5e1">{k.name}</text>
      </g>
      <g id={'kid-' + k.id} transform={`translate(${held ? drag.x : kidX(i)}, ${held ? drag.y : 120})`} style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => grabKid(k.id, e)} onPointerUp={onUpKid} onPointerCancel={() => setDrag(null)} opacity={held ? 1 : 0.001}>
        <circle r="34" fill="#1e293b" />
        <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="40">{k.pic}</text>
      </g>
    </g>;
  };
  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} 460`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height="460" fill="#0f172a" />
        {/* the swing */}
        <g transform="translate(60, 250)">
          <line x1="-30" y1="-60" x2="30" y2="-60" stroke="#94a3b8" strokeWidth="6" />
          <line x1="-20" y1="-60" x2="-20" y2="-10" stroke="#94a3b8" strokeWidth="2" />
          <line x1="20" y1="-60" x2="20" y2="-10" stroke="#94a3b8" strokeWidth="2" />
          <rect x="-26" y="-12" width="52" height="8" rx="3" fill="#f59e0b" />
        </g>
        <line x1={sx(0) - slotW / 2} y1={SLOT_Y + 52} x2={sx(nSlots - 1) + slotW / 2 - 10} y2={SLOT_Y + 52} stroke="#64748b" strokeWidth="3" markerEnd="url(#arr)" />
        <defs><marker id="arr" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#64748b" /></marker></defs>
        {slots.map((s, i) => <g key={i} id={'slot-' + i} onClick={() => setSlots(v => v.map((x, j) => (j === i ? null : x)))} style={{ cursor: 'pointer' }}>
          <rect x={sx(i) - slotW / 2 + 4} y={SLOT_Y - 36} width={slotW - 8} height="72" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" strokeDasharray={s ? '0' : '6 4'} />
          <text x={sx(i)} y={SLOT_Y - 48} textAnchor="middle" fontSize="16" fill="#94a3b8">{i + 1}</text>
          {s && <text x={sx(i)} y={SLOT_Y + 2} textAnchor="middle" dominantBaseline="middle" fontSize="36">{kids.find(k => k.id === s).pic}</text>}
        </g>)}
        {kids.map(kidFace)}
      </svg>
    </Panel>
  );
}
