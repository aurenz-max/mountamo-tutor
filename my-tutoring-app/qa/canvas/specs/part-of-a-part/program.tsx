// Part of a part (5.NF.B.4). One square, no labels. The child cuts it into equal columns with a stepper and taps
// column tabs to shade the first fraction; then cuts it into equal rows with a second stepper and taps row tabs to
// shade the second fraction across it. The cells shaded twice (amber under cyan stripes) are the second fraction of the
// first, as a part of the WHOLE square. The cuts are the thing the rule is about, so the child makes them.
// Say and show: the fraction of the whole square shaded twice is one sayable value, written as the picture the cuts
// make (columns x rows cells), so 2/3 of 1/2 is said "2/6", 3/4 of 2/3 is "6/12".
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  const a = num(params.firstNum, 1), b = num(params.firstDen, 2);   // the first fraction: columns
  const c = num(params.secondNum, 1), d = num(params.secondDen, 2); // the second fraction, of the first: rows
  const MIN = 1, MAX = 6;
  const [cols, setCols] = useState(Math.min(MAX, Math.max(MIN, num(params.startCols, 1))));
  const [rows, setRows] = useState(1);
  const [shadedCols, setShadedCols] = useState([]);
  const [shadedRows, setShadedRows] = useState([]);

  useEffect(() => {
    const gcd = (x, y) => (y ? gcd(y, x % y) : x);
    const answer = a * c + '/' + b * d;
    const sumTop = a * d + c * b, sumBottom = b * d, g = gcd(sumTop, sumBottom);
    const misrules = [
      { says: c + '/' + d, because: 'named the fraction of the shaded part, not of the whole square' },
      { says: a + c + '/' + (b + d), because: 'added the fractions instead of taking a part of a part' },
      { says: sumBottom / g === 1 ? String(sumTop / g) : sumTop / g + '/' + sumBottom / g, because: 'thought taking a part makes more' },
    ].filter((m, i, all) => m.says !== answer && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(answer, misrules);
  }, []);

  const rowsOpen = shadedCols.length > 0;
  useEffect(() => {
    const sc = shadedCols.length, sr = rowsOpen ? shadedRows.length : 0;
    // Any equal cut that shades the same fraction counts (2 of 4 columns is half). The rows stripe the whole square,
    // so the cells shaded twice are the product whichever fraction went in columns: either way round is met.
    const fits = (n1, d1, n2, d2) => sc * d1 === n1 * cols && sr * d2 === n2 * rows;
    lumina.goal(sc > 0 && sr > 0 && (fits(a, b, c, d) || fits(c, d, a, b)));
    lumina.scene({ equalColumns: cols, shadedColumns: sc, equalRows: rows, shadedRows: sr, cellsInSquare: cols * rows, cellsShadedTwice: sc * sr });
  }, [cols, rows, shadedCols, shadedRows]);

  const recutCols = n => { setCols(n); setShadedCols([]); };
  const recutRows = n => { setRows(n); setShadedRows([]); };
  const toggle = (set, i) => set(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i]));

  const SX = 110, SY = 74, S = 316, TAB = 46;
  const cw = S / cols, rh = S / rows;
  const step = (id, x, y, sign, act, can) => (
    <g id={id} onPointerDown={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={y} r="23" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={y + 9} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );
  const stepper = (key, y, label, value, set, can) => (
    <g opacity={can ? 1 : 0.45}>
      <rect x="462" y={y - 32} width="196" height="64" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      {step(key + '-minus', 494, y, '−', () => set(value - 1), can && value > MIN)}
      <text x="560" y={y + 6} textAnchor="middle" fontSize="16" fill="#cbd5e1">{label}</text>
      {step(key + '-plus', 626, y, '+', () => set(value + 1), can && value < MAX)}
    </g>
  );

  return (
    <Panel title="Square Cutter" caption="Tap plus or minus to cut columns or rows. Tap a tab beside a column or row to shade it.">
      <svg viewBox="0 0 680 410" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <defs>
          <pattern id="stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="14" fill="#22d3ee" opacity="0.85" />
          </pattern>
        </defs>
        <rect width="680" height="410" fill="#0f172a" />
        <rect x={SX} y={SY} width={S} height={S} fill="#1e293b" />
        {shadedCols.map(i => <rect key={'sc' + i} x={SX + i * cw} y={SY} width={cw} height={S} fill="#fbbf24" opacity="0.8" pointerEvents="none" />)}
        {rowsOpen && shadedRows.map(j => <rect key={'sr' + j} x={SX} y={SY + j * rh} width={S} height={rh} fill="url(#stripes)" pointerEvents="none" />)}
        {Array.from({ length: cols - 1 }, (_, i) => <line key={'vc' + i} x1={SX + (i + 1) * cw} y1={SY} x2={SX + (i + 1) * cw} y2={SY + S} stroke="#64748b" strokeWidth="2.5" />)}
        {Array.from({ length: rows - 1 }, (_, j) => <line key={'hr' + j} x1={SX} y1={SY + (j + 1) * rh} x2={SX + S} y2={SY + (j + 1) * rh} stroke="#64748b" strokeWidth="2.5" />)}
        <rect x={SX} y={SY} width={S} height={S} fill="none" stroke="#cbd5e1" strokeWidth="3" />

        {Array.from({ length: cols }, (_, i) => (
          <rect key={'ct' + cols + '-' + i} id={'col-' + i} x={SX + i * cw + 3} y={SY - TAB - 8} width={cw - 6} height={TAB} rx="10"
            fill={shadedCols.includes(i) ? '#fbbf24' : '#1e293b'} stroke="#64748b" strokeWidth="2"
            onPointerDown={() => toggle(setShadedCols, i)} style={{ cursor: 'pointer' }} />
        ))}
        {Array.from({ length: rows }, (_, j) => (
          <rect key={'rt' + rows + '-' + j} id={'row-' + j} x={SX - TAB - 8} y={SY + j * rh + 3} width={TAB} height={rh - 6} rx="10"
            fill={rowsOpen && shadedRows.includes(j) ? '#22d3ee' : '#1e293b'} stroke="#64748b" strokeWidth="2"
            opacity={rowsOpen ? 1 : 0.35} onPointerDown={rowsOpen ? () => toggle(setShadedRows, j) : undefined}
            style={{ cursor: rowsOpen ? 'pointer' : 'default' }} />
        ))}

        {stepper('cols', 150, 'columns', cols, recutCols, true)}
        {stepper('rows', 300, 'rows', rows, recutRows, rowsOpen)}
      </svg>
    </Panel>
  );
}
