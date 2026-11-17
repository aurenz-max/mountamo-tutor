// Wholes as fractions (3.NF.A.3c). Same-size whole bars, uncut or all cut the same way. The child steps how many
// equal parts EVERY whole is cut into, and every bar redraws at once. Cutting changes the parts, never the amount:
// 3 wholes are 6 halves. Say and show: the number of parts in all is one sayable number.
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  const wholes = Math.max(1, Math.min(4, num(params.wholes, 2)));
  const target = num(params.parts, 2);
  const start = num(params.startParts, 1), MIN = 1, MAX = 12;
  const [parts, setParts] = useState(start);

  useEffect(() => {
    const total = wholes * target;
    const misrules = [
      { says: wholes, because: 'counted the wholes, not the parts' },
      { says: target, because: 'counted the parts of one whole, not of all the wholes' },
    ].filter((m, i, all) => m.says !== total && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(total, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(parts === target);
    lumina.scene({ wholeBars: wholes, barsAreSameSize: true, equalPartsInEachWhole: parts });
  }, [parts]);

  const W = 680, H = 320, BAR_X = 100, BAR_W = 480, BAR_H = 52, GAP = 16, AREA_TOP = 22, AREA_H = 200;
  const stackH = wholes * BAR_H + (wholes - 1) * GAP;
  const top = AREA_TOP + (AREA_H - stackH) / 2;
  const STEP_Y = 272;

  const bar = i => {
    const y = top + i * (BAR_H + GAP);
    return (
      <g key={i}>
        {Array.from({ length: parts }, (_, k) => (
          <rect key={k} x={BAR_X + (k * BAR_W) / parts} y={y} width={BAR_W / parts} height={BAR_H}
            fill="#fbbf24" stroke="#0f172a" strokeWidth="3" style={{ transition: 'x 0.2s, width 0.2s' }} />
        ))}
        <rect x={BAR_X} y={y} width={BAR_W} height={BAR_H} rx="3" fill="none" stroke="#e2e8f0" strokeWidth="3" />
      </g>
    );
  };
  const step = (id, x, sign, act, can) => (
    <g id={id} onPointerDown={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={STEP_Y} r="24" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={STEP_Y + 9} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );

  return (
    <Panel title="Cut the Wholes" caption="Tap minus or plus to cut every whole into fewer or more equal parts.">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        {Array.from({ length: wholes }, (_, i) => bar(i))}
        <rect x="236" y={STEP_Y - 36} width="208" height="72" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x="340" y={STEP_Y + 6} textAnchor="middle" fontSize="15" fill="#94a3b8">parts</text>
        {step('parts-minus', 284, '−', () => setParts(v => Math.max(MIN, v - 1)), parts > MIN)}
        {step('parts-plus', 396, '+', () => setParts(v => Math.min(MAX, v + 1)), parts < MAX)}
      </svg>
    </Panel>
  );
}
