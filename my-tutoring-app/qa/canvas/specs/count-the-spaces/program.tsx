// Count the spaces (3.NF.A.2). A number line cut into equal spaces, with a dot on one mark and only the whole
// numbers written. The child names the fraction at the dot. Say and show: the fraction is one sayable value, and the
// child shows it by setting the top and bottom numbers of a fraction.
function Display({ params, lumina }) {
  const parts = Number(params.parts) || 4, n = Number(params.n) || 3;
  const from = Number(params.from) || 0, to = Number(params.to) || 1;
  const [top, setTop] = useState(1);
  const [bottom, setBottom] = useState(2);

  const wholes = to - from, total = wholes * parts, at = n - from * parts; // `at`: spaces from the left end to the dot

  useEffect(() => {
    const frac = (a, b) => a + '/' + b, answer = frac(n, parts);
    const misrules = [
      { says: frac(at + 1, parts + 1), because: 'counted the marks, not the spaces between them' },
      wholes > 1 ? { says: frac(n, total), because: 'counted the spaces on the whole line, not the spaces from 0 to 1' } : null,
      from > 0 ? { says: frac(at, parts), because: 'counted from the left end of the line, not from 0' } : null,
    ].filter((m, i, all) => m && m.says !== answer && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(answer, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(top * parts === n * bottom);
    lumina.scene({ lineStartsAt: from, lineEndsAt: to, numbersWritten: Array.from({ length: wholes + 1 }, (_, i) => from + i),
      marksOnLine: total + 1, dotAtMarkFromLeft: at + 1, yourTopNumber: top, yourBottomNumber: bottom });
  }, [top, bottom]);

  const X0 = 70, X1 = 610, Y = 96, tickX = i => X0 + ((X1 - X0) * i) / total;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const step = (id, x, y, sign, act) => (
    <g id={id} onPointerDown={act} style={{ cursor: 'pointer' }}>
      <circle cx={x} cy={y} r="23" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={y + 8} textAnchor="middle" fontSize="26" fill="#e2e8f0">{sign}</text>
    </g>
  );

  return (
    <Panel title="Number Line Dot" caption="Use plus and minus to set the top and bottom numbers of your fraction.">
      <svg viewBox="0 0 680 310" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="310" fill="#0f172a" />
        <line x1={X0 - 24} y1={Y} x2={X1 + 24} y2={Y} stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
        {Array.from({ length: total + 1 }, (_, i) => {
          const whole = i % parts === 0;
          return (
            <g key={i}>
              <line x1={tickX(i)} y1={Y - (whole ? 18 : 11)} x2={tickX(i)} y2={Y + (whole ? 18 : 11)} stroke="#cbd5e1" strokeWidth={whole ? 4 : 2} />
              {whole && <text x={tickX(i)} y={Y + 46} textAnchor="middle" fontSize="20" fontWeight="700" fill="#e2e8f0">{from + i / parts}</text>}
            </g>
          );
        })}
        <circle cx={tickX(at)} cy={Y} r="11" fill="#fbbf24" stroke="#f8fafc" strokeWidth="2.5" />

        <rect x="170" y="166" width="340" height="132" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {step('top-minus', 250, 203, '−', () => setTop(v => clamp(v - 1, 0, 12)))}
        {step('top-plus', 430, 203, '+', () => setTop(v => clamp(v + 1, 0, 12)))}
        {step('bottom-minus', 250, 261, '−', () => setBottom(v => clamp(v - 1, 1, 12)))}
        {step('bottom-plus', 430, 261, '+', () => setBottom(v => clamp(v + 1, 1, 12)))}
        <text x="340" y="214" textAnchor="middle" fontSize="32" fontWeight="700" fill="#22d3ee">{top}</text>
        <line x1="306" y1="232" x2="374" y2="232" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
        <text x="340" y="272" textAnchor="middle" fontSize="32" fontWeight="700" fill="#22d3ee">{bottom}</text>
      </svg>
    </Panel>
  );
}
