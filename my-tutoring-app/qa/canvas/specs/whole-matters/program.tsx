// The whole matters (3.NF.A.3d). The first rectangle is fixed with a fraction of it shaded. The child's rectangle is
// cut into its own equal parts with some shaded, and the child stretches or shrinks the WHOLE until the two shaded
// amounts are the same. The size of the whole is the thing the rule is about, so it is the thing the child moves.
// Say and show: how many squares wide the rectangle must be is one sayable number.
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  const first = { wide: num(params.firstWide, 4), parts: num(params.firstParts, 2), shaded: num(params.firstShaded, 1) };
  const mine = { parts: num(params.parts, 4), shaded: num(params.shaded, 1) };
  const start = num(params.startWide, first.wide), MAX = 12;
  const [wide, setWide] = useState(start);

  // The width at which the two shaded amounts match, in squares.
  const need = (first.wide * first.shaded * mine.parts) / (first.parts * mine.shaded);

  useEffect(() => {
    const wrongWay = (first.wide * first.parts * mine.shaded) / (first.shaded * mine.parts);
    const misrules = [
      { says: start, because: 'left the whole the size it was: thinks the fraction alone sets the amount, whatever the size of the whole' },
      { says: wrongWay, because: wrongWay < need ? 'made the whole smaller when it had to be bigger' : 'made the whole bigger when it had to be smaller' },
    ].filter((m, i, all) => Number.isInteger(m.says) && m.says > 0 && m.says !== need && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(need, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(wide === need);
    lumina.scene({ firstSquaresWide: first.wide, firstEqualParts: first.parts, firstShadedParts: first.shaded,
      yourEqualParts: mine.parts, yourShadedParts: mine.shaded, yourSquaresWide: wide });
  }, [wide]);

  const U = 48, X0 = 52, H = 64, TOP_A = 36, RULER = 114, TOP_B = 160;
  const strips = (y, w, parts, shaded, fill) => Array.from({ length: parts }, (_, i) => (
    <rect key={i} x={X0 + (i * w * U) / parts} y={y} width={(w * U) / parts} height={H} fill={i < shaded ? fill : '#1e293b'} stroke="#64748b" strokeWidth="2" />
  ));
  const drag = ({ x }) => setWide(Math.max(1, Math.min(MAX, Math.round((x - X0) / U))));

  return (
    <Panel title="Stretch the Whole" caption="Drag the blue handle to make your rectangle wider or narrower.">
      <svg viewBox="0 0 680 250" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="250" fill="#0f172a" />
        <text x={X0} y="26" fontSize="16" fill="#cbd5e1">First rectangle</text>
        {strips(TOP_A, first.wide, first.parts, first.shaded, '#94a3b8')}
        <rect x={X0} y={TOP_A} width={first.wide * U} height={H} fill="none" stroke="#cbd5e1" strokeWidth="3" />

        {Array.from({ length: MAX }, (_, i) => (
          <rect key={i} x={X0 + i * U} y={RULER} width={U} height="16" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
        ))}

        <text x={X0} y={TOP_B - 10} fontSize="16" fill="#cbd5e1">Your rectangle</text>
        {strips(TOP_B, wide, mine.parts, mine.shaded, '#fbbf24')}
        <rect x={X0} y={TOP_B} width={wide * U} height={H} fill="none" stroke="#cbd5e1" strokeWidth="3" />
        {Array.from({ length: MAX }, (_, i) => (
          <circle key={i} id={'wide-' + (i + 1)} cx={X0 + (i + 1) * U} cy={TOP_B + H / 2} r="2" fill="transparent" pointerEvents="none" />
        ))}
        <Handle id="edge" x={X0 + wide * U} y={TOP_B + H / 2} r={22} onDrag={drag} onDrop={drag}>
          <g>
            <rect x="-9" y={-H / 2 - 6} width="18" height={H + 12} rx="9" fill="#22d3ee" stroke="#f8fafc" strokeWidth="2" />
            <line x1="-3" y1="-10" x2="-3" y2="10" stroke="#0f172a" strokeWidth="2" />
            <line x1="3" y1="-10" x2="3" y2="10" stroke="#0f172a" strokeWidth="2" />
          </g>
        </Handle>
      </svg>
    </Panel>
  );
}
