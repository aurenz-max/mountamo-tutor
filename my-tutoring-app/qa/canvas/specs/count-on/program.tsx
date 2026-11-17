// Count on (1.OA.C.5). Two piles of counters on a table; a cup covers one pile and shows its number. The child counts
// on: taps each loose counter once and says how many in all. The cup can be tapped to peek (lifted, the pile shows and
// can be tapped, which is counting all from one) and dragged onto the other pile (a fresh count). The goal is the
// cup down on the bigger pile with exactly the loose counters tapped. No running count is printed: the child says it.
function Display({ params, lumina }) {
  const left = Number(params.left) || 5, right = Number(params.right) || 2;
  const startOn = params.cup === 'right' ? 'R' : 'L';
  const size = { L: left, R: right };
  const other = p => (p === 'L' ? 'R' : 'L');
  const [cupOn, setCupOn] = useState(startOn);
  const [lifted, setLifted] = useState(false);
  const [marks, setMarks] = useState([]);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const total = left + right, seen = size[other(startOn)];
    const misrules = [
      { says: seen, because: 'counted only the counters that can be seen, not the ones under the cup' },
      { says: total - 1, because: 'said the cup\'s number on the first loose counter, so counted on one too few' },
    ].filter((m, i, all) => m.says !== total && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(total, misrules);
  }, []);

  const ids = p => Array.from({ length: size[p] }, (_, i) => 'counter-' + p + i);
  useEffect(() => {
    const loose = other(cupOn);
    const want = ids(loose);
    const exact = marks.length === want.length && want.every(id => marks.includes(id));
    lumina.goal(!lifted && !drag && size[cupOn] > size[loose] && exact);
    lumina.scene({
      cupIsOn: cupOn === 'L' ? 'the left pile' : 'the right pile',
      numberOnTheCup: size[cupOn],
      cupLiftedToPeek: lifted,
      looseCountersBesideTheCup: size[loose],
      countersTapped: marks.length,
      cupStartedOn: startOn === 'L' ? 'the left pile' : 'the right pile',
    });
  }, [cupOn, lifted, marks, drag]);

  // Layout: counters in rows of at most five, the cup sized to cover the bigger pile, room above it to lift.
  const S = 56, R = 25;
  const cols = n => (n <= 5 ? n : n <= 10 ? Math.ceil(n / 2) : 5);
  const rows = n => Math.ceil(n / cols(n));
  const maxRows = Math.max(rows(left), rows(right));
  const cupW = Math.max(cols(left), cols(right)) * S + 34, cupH = maxRows * S + 34;
  const TOP = 12, LIFT = 56, pileTop = TOP + LIFT + 17, H = pileTop + maxRows * S + 24;
  const CX = { L: 175, R: 505 };
  const spot = (p, i) => {
    const c = cols(size[p]), r = Math.floor(i / c), k = i % c, inRow = Math.min(c, size[p] - r * c);
    const off = ((maxRows - rows(size[p])) * S) / 2;
    return { x: CX[p] + (k - (inRow - 1) / 2) * S, y: pileTop + off + S / 2 + r * S };
  };

  const tap = id => setMarks(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]));
  const grab = e => { e.currentTarget.setPointerCapture(e.pointerId); const p = svgPoint(svgRef.current, e); setDrag({ x0: p.x, x: p.x, moved: false }); };
  const move = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e);
    setDrag({ ...drag, x: p.x, moved: drag.moved || Math.abs(p.x - drag.x0) > 10 });
  };
  const drop = () => {
    if (!drag) return;
    if (drag.moved) {
      const cx = CX[cupOn] + (drag.x - drag.x0);
      const to = cx < 340 ? 'L' : 'R';
      if (to !== cupOn) { setCupOn(to); setMarks([]); }
      else setMarks(m => m.filter(id => !id.startsWith('counter-' + cupOn)));
      setLifted(false);
    } else if (lifted) {
      setLifted(false);
      setMarks(m => m.filter(id => !id.startsWith('counter-' + cupOn)));
    } else setLifted(true);
    setDrag(null);
  };

  const pile = p => {
    if (p === cupOn && !lifted && !drag) return null;
    return ids(p).map((id, i) => {
      const s = spot(p, i), on = marks.includes(id);
      return (
        <g key={id} id={id} transform={`translate(${s.x}, ${s.y})`} onPointerDown={() => tap(id)} style={{ cursor: 'pointer' }}>
          <circle r={R + 2} fill="#0f172a" />
          <circle r={R} fill="#ef4444" stroke={on ? '#22d3ee' : '#7f1d1d'} strokeWidth={on ? 5 : 2} />
          <circle r={R - 11} fill="none" stroke="#fca5a5" strokeWidth="2" opacity="0.6" />
        </g>
      );
    });
  };

  const cupX = CX[cupOn] + (drag && drag.moved ? drag.x - drag.x0 : 0);
  const up = lifted || (drag && drag.moved);
  const cupY = pileTop - 17 - (up ? LIFT : 0);
  const w2 = cupW / 2;
  const cupPath = `M ${-w2} ${cupH} L ${-w2 + 22} 8 Q ${-w2 + 24} 0 ${-w2 + 34} 0 L ${w2 - 34} 0 Q ${w2 - 24} 0 ${w2 - 22} 8 L ${w2} ${cupH} Z`;

  return (
    <Panel title="Cup Count" caption="Tap a counter to count it. Tap the cup to peek, or drag it.">
      <svg ref={svgRef} viewBox={`0 0 680 ${H}`} onPointerMove={move} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />
        <rect x="16" y={pileTop - 26} width="648" height={maxRows * S + 40} rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {!up && pile('L')}
        {!up && pile('R')}
        <g id="cup" transform={`translate(${cupX}, ${cupY})`} onPointerDown={grab} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
          <g opacity={up ? 0.3 : 1} style={{ pointerEvents: up ? 'none' : 'auto' }}>
            <path d={cupPath} fill="#b45309" stroke="#78350f" strokeWidth="3" />
            <rect x={-w2 - 4} y={cupH - 10} width={cupW + 8} height="12" rx="6" fill="#92400e" stroke="#78350f" strokeWidth="2" />
          </g>
          <circle cx="0" cy="38" r="29" fill="#fef3c7" stroke="#78350f" strokeWidth="2" />
          <text x="0" y="40" textAnchor="middle" dominantBaseline="middle" fontSize="32" fontWeight="800" fill="#451a03">{size[cupOn]}</text>
        </g>
        {up && pile('L')}
        {up && pile('R')}
      </svg>
    </Panel>
  );
}
