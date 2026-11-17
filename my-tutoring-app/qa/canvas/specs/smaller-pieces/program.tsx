// Smaller pieces (3.NF.A.3d). Two bars of the same length. The first bar is fixed, cut into equal parts with one
// piece shaded. The child cuts their own bar into more or fewer equal parts with a stepper and watches their shaded
// piece shrink or grow against the first bar's piece. The number of parts is the thing the rule is about, so it is
// the thing the child changes. Say and show: how many parts the bar needs is one sayable number.
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  const firstParts = num(params.firstParts, 4), factor = num(params.factor, 2);
  const direction = params.direction === 'bigger' ? 'bigger' : 'smaller';
  const start = num(params.startParts, firstParts), MIN = 1, MAX = 12;
  const [parts, setParts] = useState(start);

  // Smaller pieces need more parts; bigger pieces need fewer.
  const need = direction === 'smaller' ? firstParts * factor : firstParts / factor;

  useEffect(() => {
    const wrongWay = direction === 'smaller' ? firstParts / factor : firstParts * factor;
    const misrules = [
      { says: wrongWay, because: direction === 'smaller'
        ? 'went the wrong way: thinks fewer parts make smaller pieces'
        : 'went the wrong way: thinks a bigger number of parts makes bigger pieces' },
      direction === 'smaller' ? { says: factor, because: 'cut the bar into as many parts as the size word names, not that many times as many parts as the first bar' } : null,
    ].filter((m, i, all) => m && Number.isInteger(m.says) && m.says >= 1 && m.says !== need && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(need, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(parts === need);
    lumina.scene({ firstBarEqualParts: firstParts, firstBarShadedPieces: 1, yourBarEqualParts: parts, yourBarShadedPieces: 1 });
  }, [parts]);

  const X0 = 80, W = 520, H = 62, TOP_A = 40, TOP_B = 148;
  const bar = (y, n, fill) => Array.from({ length: n }, (_, i) => (
    <rect key={n + '-' + i} x={X0 + (i * W) / n} y={y} width={W / n} height={H} fill={i === 0 ? fill : '#1e293b'} stroke="#64748b" strokeWidth="2" />
  ));
  const step = (id, x, y, sign, act, can) => (
    <g id={id} onPointerDown={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={y} r="23" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={y + 9} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );

  return (
    <Panel title="Cut the Bar" caption="Tap plus or minus to cut your bar into more or fewer equal parts.">
      <svg viewBox="0 0 680 310" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="310" fill="#0f172a" />
        <text x={X0} y={TOP_A - 12} fontSize="16" fill="#cbd5e1">First bar</text>
        {bar(TOP_A, firstParts, '#94a3b8')}
        <rect x={X0} y={TOP_A} width={W} height={H} fill="none" stroke="#cbd5e1" strokeWidth="3" />

        <text x={X0} y={TOP_B - 12} fontSize="16" fill="#cbd5e1">Your bar</text>
        {bar(TOP_B, parts, '#fbbf24')}
        <rect x={X0} y={TOP_B} width={W} height={H} fill="none" stroke="#cbd5e1" strokeWidth="3" />

        <rect x="220" y="236" width="240" height="64" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {step('parts-minus', 262, 268, '−', () => setParts(v => Math.max(MIN, v - 1)), parts > MIN)}
        <text x="340" y="274" textAnchor="middle" fontSize="16" fill="#cbd5e1">parts</text>
        {step('parts-plus', 418, 268, '+', () => setParts(v => Math.min(MAX, v + 1)), parts < MAX)}
      </svg>
    </Panel>
  );
}
