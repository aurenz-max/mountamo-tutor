// Same amount, cut different ways (3.NF.A.3). Two same-size squares: the first is cut and partly shaded; the child
// shades the second, which is cut another way, until the same AMOUNT is shaded. Say and show: the number of parts to
// shade is one sayable value, so the program reports it with lumina.answer and the tutor can judge it said.
function Display({ params, lumina }) {
  const refCols = Number(params.refCols) || 4, refRows = Number(params.refRows) || 2, refShaded = Number(params.refShaded) || 2;
  const cols = Number(params.cols) || 4, rows = Number(params.rows) || 1;
  const refTotal = refCols * refRows, total = cols * rows;
  const [shaded, setShaded] = useState([]);

  // The parts of this square that make the same amount as the first square's shaded parts.
  const need = (refShaded * total) / refTotal;
  useEffect(() => {
    lumina.answer(need, refShaded !== need ? [{ says: refShaded, because: 'shaded the same number of parts as the first square, not the same amount of the square' }] : []);
  }, []);
  useEffect(() => {
    lumina.goal(shaded.length * refTotal === refShaded * total);
    lumina.scene({ firstSquareParts: refTotal, firstSquareCut: refCols + ' across by ' + refRows + ' down', firstSquareShadedParts: refShaded,
      yourSquareParts: total, yourSquareCut: cols + ' across by ' + rows + ' down', yourSquareShadedParts: shaded.length });
  }, [shaded]);

  const SIDE = 220, TOP = 78, REF_X = 70, MINE_X = 390;
  const toggle = i => setShaded(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i]));
  // Parts are numbered down each column, so the first square's shaded parts fill it from the left.
  const cell = (x0, c, r, nc, nr) => ({ x: x0 + (c * SIDE) / nc, y: TOP + (r * SIDE) / nr, w: SIDE / nc, h: SIDE / nr });
  const refCells = [], myCells = [];
  for (let c = 0; c < refCols; c++) for (let r = 0; r < refRows; r++) refCells.push({ i: c * refRows + r, ...cell(REF_X, c, r, refCols, refRows) });
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) myCells.push({ i: c * rows + r, ...cell(MINE_X, c, r, cols, rows) });

  return (
    <Panel title="Same Amount Squares" caption="Tap a part to shade it. Tap it again to clear it.">
      <svg viewBox="0 0 680 330" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="330" fill="#0f172a" />
        <text x={REF_X + SIDE / 2} y="52" textAnchor="middle" fontSize="18" fill="#e2e8f0">First square</text>
        <text x={MINE_X + SIDE / 2} y="52" textAnchor="middle" fontSize="18" fill="#e2e8f0">Your square</text>
        {refCells.map(k => (
          <rect key={'r' + k.i} x={k.x} y={k.y} width={k.w} height={k.h} fill={k.i < refShaded ? '#94a3b8' : '#1e293b'} stroke="#475569" strokeWidth="2" />
        ))}
        <rect x={REF_X} y={TOP} width={SIDE} height={SIDE} fill="none" stroke="#cbd5e1" strokeWidth="3" />
        {myCells.map(k => (
          <rect key={'m' + k.i} id={'part-' + k.i} x={k.x} y={k.y} width={k.w} height={k.h} onPointerDown={() => toggle(k.i)}
            fill={shaded.includes(k.i) ? '#fbbf24' : '#1e293b'} stroke="#64748b" strokeWidth="2" style={{ cursor: 'pointer' }} />
        ))}
        <rect x={MINE_X} y={TOP} width={SIDE} height={SIDE} fill="none" stroke="#cbd5e1" strokeWidth="3" pointerEvents="none" />
      </svg>
    </Panel>
  );
}
