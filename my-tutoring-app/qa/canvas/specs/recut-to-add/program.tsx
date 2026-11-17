// Recut to add (5.NF.A.1). Two bars of the same length, each cut into its own equal parts with an amount shaded, and an
// empty bottom bar. Parts of different sizes cannot be counted together, so the child recuts each bar with its own
// stepper. A recut keeps the shaded amount and only splits it: a bar can be cut only into a multiple of its starting
// parts, so the shaded amount always ends on a cut line. When both bars have parts of the same size the join control
// acts and puts both amounts (or the first minus the second) into the bottom bar, cut the same way.
// Say and show: the sum or difference is one sayable fraction; Check judges that the join was made with matching parts.
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  const aParts0 = num(params.aParts, 2), aShaded0 = num(params.aShaded, 1);
  const bParts0 = num(params.bParts, 4), bShaded0 = num(params.bShaded, 1);
  const takeAway = params.op === 'subtract', MAX = 12;
  const [aParts, setAParts] = useState(aParts0);
  const [bParts, setBParts] = useState(bParts0);
  const [joined, setJoined] = useState(null); // { parts, first, second } when the join was made
  const aShaded = aShaded0 * (aParts / aParts0), bShaded = bShaded0 * (bParts / bParts0);
  const same = aParts === bParts;

  useEffect(() => {
    const gcd = (x, y) => (y ? gcd(y, x % y) : x);
    const frac = (n, d) => { const g = gcd(n, d) || 1; return n / g + '/' + d / g; };
    const raw = (n, d) => n + '/' + d;
    const d = (aParts0 * bParts0) / gcd(aParts0, bParts0);
    const n = takeAway ? aShaded0 * (d / aParts0) - bShaded0 * (d / bParts0) : aShaded0 * (d / aParts0) + bShaded0 * (d / bParts0);
    const said = frac(n, d);
    const tops = takeAway ? aShaded0 - bShaded0 : aShaded0 + bShaded0;
    const bottoms = takeAway ? aParts0 - bParts0 : aParts0 + bParts0;
    const misrules = [
      { says: bottoms > 0 && tops >= 0 ? raw(tops, bottoms) : null,
        because: takeAway ? 'took the top numbers away and the bottom numbers away, counting parts of different sizes together'
          : 'added the top numbers and the bottom numbers, counting parts of different sizes together' },
      { says: tops > 0 ? raw(tops, Math.max(aParts0, bParts0)) : null,
        because: takeAway ? 'took shaded pieces away from shaded pieces though they are different sizes'
          : 'counted the shaded pieces though they are different sizes' },
    ].filter((m, i, all) => m.says && m.says !== said && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(said, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(!!joined);
    lumina.scene({ joinOrTakeAway: takeAway ? 'take the second amount away from the first' : 'put both amounts together',
      firstBarEqualParts: aParts, firstBarShadedParts: aShaded, secondBarEqualParts: bParts, secondBarShadedParts: bShaded,
      bottomBarEqualParts: joined ? joined.parts : 0,
      bottomBarShadedParts: joined ? (takeAway ? joined.first - joined.second : joined.first + joined.second) : 0 });
  }, [aParts, bParts, joined]);

  // A recut clears the bottom bar: it holds only a join made from what the bars show now.
  const recut = (set, start, dir) => {
    set(v => { const next = v + dir * start; return next >= start && next <= MAX ? next : v; });
    setJoined(null);
  };
  const join = () => { if (same) setJoined({ parts: aParts, first: aShaded, second: bShaded }); };

  const X0 = 40, W = 440, H = 52, TOP_A = 34, TOP_B = 124, TOP_S = 262;
  const AMBER = '#fbbf24', CYAN = '#22d3ee';
  const bar = (y, parts, shaded, fill) => Array.from({ length: parts }, (_, i) => (
    <rect key={parts + '-' + i} x={X0 + (i * W) / parts} y={y} width={W / parts} height={H}
      fill={i < shaded ? fill : '#1e293b'} stroke="#64748b" strokeWidth="2" />
  ));
  const outline = y => <rect x={X0} y={y} width={W} height={H} fill="none" stroke="#cbd5e1" strokeWidth="3" pointerEvents="none" />;
  // A stepper dims at its end (the starting cut, or twelve parts), where a press does nothing. Twelve is the largest cut
  // on every problem, so a dim plus there points at nothing the child has not already reached.
  const step = (id, x, y, sign, act, can) => (
    <g id={id} onPointerDown={act} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={y} r="23" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={y + 9} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );
  const stepper = (p, y, set, start, now) => (
    <g>
      <rect x="500" y={y - 4} width="160" height={H + 8} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      {step(p + '-minus', 530, y + H / 2, '−', () => recut(set, start, -1), now - start >= start)}
      <text x="580" y={y + H / 2 + 6} textAnchor="middle" fontSize="16" fill="#cbd5e1">parts</text>
      {step(p + '-plus', 630, y + H / 2, '+', () => recut(set, start, 1), now + start <= MAX)}
    </g>
  );
  const bottom = () => {
    if (!joined) return <rect x={X0} y={TOP_S} width={W} height={H} fill="#0f172a" />;
    const { parts, first, second } = joined;
    return Array.from({ length: parts }, (_, i) => {
      const x = X0 + (i * W) / parts, w = W / parts;
      if (takeAway && i < first - second) return <rect key={i} x={x} y={TOP_S} width={w} height={H} fill={AMBER} stroke="#0f172a" strokeWidth="2" />;
      if (takeAway && i < first) return (
        <g key={i}>
          <rect x={x} y={TOP_S} width={w} height={H} fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <rect x={x + 4} y={TOP_S + 4} width={w - 8} height={H - 8} rx="4" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
        </g>
      );
      if (!takeAway && i < first + second) return <rect key={i} x={x} y={TOP_S} width={w} height={H} fill={i < first ? AMBER : CYAN} stroke="#0f172a" strokeWidth="2" />;
      return <rect key={i} x={x} y={TOP_S} width={w} height={H} fill="#1e293b" stroke="#64748b" strokeWidth="2" />;
    });
  };

  return (
    <Panel title="Recut and Join" caption={'Tap plus or minus to recut a bar. Tap ' + (takeAway ? 'Take away' : 'Join') + ' when it lights up.'}>
      <svg viewBox="0 0 680 330" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="330" fill="#0f172a" />
        <text x={X0} y={TOP_A - 10} fontSize="15" fill="#cbd5e1">First bar</text>
        {bar(TOP_A, aParts, aShaded, AMBER)}
        {outline(TOP_A)}
        {stepper('a', TOP_A, setAParts, aParts0, aParts)}
        <text x={X0} y={TOP_B - 10} fontSize="15" fill="#cbd5e1">Second bar</text>
        {bar(TOP_B, bParts, bShaded, takeAway ? '#94a3b8' : CYAN)}
        {outline(TOP_B)}
        {stepper('b', TOP_B, setBParts, bParts0, bParts)}

        <g id="join" onPointerDown={join} style={{ cursor: same ? 'pointer' : 'default' }} opacity={same ? 1 : 0.35}>
          <rect x="250" y="192" width="180" height="46" rx="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <text x="340" y="221" textAnchor="middle" fontSize="18" fill="#e2e8f0">{takeAway ? 'Take away' : 'Join'}</text>
        </g>

        <text x={X0} y={TOP_S - 10} fontSize="15" fill="#cbd5e1">Bottom bar</text>
        {bottom()}
        {outline(TOP_S)}
      </svg>
    </Panel>
  );
}
