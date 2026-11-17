// Turn the array (3.OA.B.5, commutative property). The first tray holds an array of cookies, rows by columns; on some
// problems a cloth hides part of it, and its frame always shows how many rows and columns it has. The child builds
// that tray after a quarter turn on their own tray with two steppers (rows, columns). A cloth lies fixed over part of
// the child's tray, so after the turn only some cookies show. The rule: turning the array does not change the total.
// The misrule treats the turned array as a new problem and counts the cookies that show.
// Say and show: the total is one sayable number; Check judges that the built tray is the first tray turned (its rows
// are the first tray's columns and its columns the first tray's rows). The cloth on the child's tray is the same
// whatever the child builds, so it tells nothing about the turn.
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  // A cloth starts at a cell and runs to the far edge; a missing value means no cloth. 0 is a real start cell.
  const at = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
  const rows = num(params.rows, 3), cols = num(params.cols, 5), MAX = 9;
  const firstCloth = at(params.firstClothRow) === null ? null : { row: at(params.firstClothRow), col: at(params.firstClothCol) ?? 0 };
  const yourCloth = { row: at(params.yourClothRow) ?? 2, col: at(params.yourClothCol) ?? 1 };
  const [R, setR] = useState(1);
  const [C, setC] = useState(1);

  const under = (cloth, i, j) => !!cloth && i >= cloth.row && j >= cloth.col;
  const showing = (cloth, nr, nc) => {
    let n = 0;
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (!under(cloth, i, j)) n++;
    return n;
  };

  useEffect(() => {
    const total = rows * cols;
    const misrules = [
      { says: showing(yourCloth, cols, rows), because: 'treated the turned tray as a new problem and counted only the cookies that show after the turn' },
      firstCloth ? { says: showing(firstCloth, rows, cols), because: 'counted only the cookies that show on the first tray, not the ones under the cloth' } : null,
      { says: rows + cols, because: 'added the rows and the columns instead of counting every cookie' },
    ].filter((m, i, all) => m && Number.isInteger(m.says) && m.says > 0 && m.says !== total && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(total, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(R === cols && C === rows);
    lumina.scene({
      firstTrayRows: rows, firstTrayColumns: cols, firstTrayPartUnderCloth: !!firstCloth,
      yourTrayRows: R, yourTrayColumns: C, yourTrayPartUnderCloth: R > yourCloth.row && C > yourCloth.col,
    });
  }, [R, C]);

  const CELL = 26, TOP = 52, LX = 36, RX = 412, AREA = CELL * MAX;
  const cookie = (x, y, key) => (
    <g key={key}>
      <circle cx={x} cy={y} r="10.5" fill="#b7793f" stroke="#7c4a1e" strokeWidth="1.5" />
      <circle cx={x - 4} cy={y - 3} r="2" fill="#4a2c12" />
      <circle cx={x + 3} cy={y + 4} r="2" fill="#4a2c12" />
      <circle cx={x + 4} cy={y - 4} r="1.6" fill="#4a2c12" />
    </g>
  );
  const cookies = (x0, nr, nc, cloth, tag) => {
    const out = [];
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++)
      if (!under(cloth, i, j)) out.push(cookie(x0 + j * CELL + CELL / 2, TOP + i * CELL + CELL / 2, tag + i + '-' + j));
    return out;
  };
  // A cloth: a linen towel with fold lines, from its start cell to the given far edge.
  const towel = (x0, cloth, w, h) => {
    if (!cloth || cloth.col * CELL >= w || cloth.row * CELL >= h) return null;
    const x = x0 + cloth.col * CELL, y = TOP + cloth.row * CELL, cw = w - cloth.col * CELL, ch = h - cloth.row * CELL;
    return (
      <g pointerEvents="none">
        <rect x={x} y={y} width={cw} height={ch} rx="6" fill="#a8a29e" stroke="#78716c" strokeWidth="2" />
        <line x1={x + 8} y1={y + ch * 0.35} x2={x + cw - 8} y2={y + ch * 0.35} stroke="#78716c" strokeWidth="1.5" />
        <line x1={x + cw * 0.6} y1={y + 8} x2={x + cw * 0.6} y2={y + ch - 8} stroke="#78716c" strokeWidth="1.5" />
      </g>
    );
  };
  const frame = (x0, nr, nc) => (
    <rect x={x0} y={TOP} width={nc * CELL} height={nr * CELL} fill="none" stroke="#e2e8f0" strokeWidth="2.5" rx="4" pointerEvents="none" />
  );
  const step = (id, x, y, sign, act, can) => (
    <g id={id} onPointerDown={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={y} r="23" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={y + 9} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );
  const stepper = (p, x, w, label, val, set) => (
    <g>
      <rect x={x} y="306" width={w} height="60" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      {step(p + '-minus', x + 28, 336, '−', () => set(v => Math.max(1, v - 1)), val > 1)}
      <text x={x + w / 2} y="342" textAnchor="middle" fontSize="16" fill="#cbd5e1">{label}</text>
      {step(p + '-plus', x + w - 28, 336, '+', () => set(v => Math.min(MAX, v + 1)), val < MAX)}
    </g>
  );

  return (
    <Panel title="Cookie Trays" caption="Tap plus or minus to add or take away a row or a column on your tray.">
      <svg viewBox="0 0 680 376" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="376" fill="#0f172a" />

        <text x={LX} y={TOP - 14} fontSize="16" fill="#cbd5e1">First tray</text>
        <rect x={LX - 8} y={TOP - 8} width={AREA + 16} height={AREA + 16} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {cookies(LX, rows, cols, firstCloth, 'a')}
        {towel(LX, firstCloth, cols * CELL, rows * CELL)}
        {frame(LX, rows, cols)}

        <path d="M 296 182 A 48 48 0 0 1 344 134" fill="none" stroke="#94a3b8" strokeWidth="3" />
        <path d="M 334 123 L 346 134 L 334 145" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <text x="341" y="216" textAnchor="middle" fontSize="15" fill="#cbd5e1">quarter turn</text>

        <text x={RX} y={TOP - 14} fontSize="16" fill="#cbd5e1">Your tray</text>
        <rect x={RX - 8} y={TOP - 8} width={AREA + 16} height={AREA + 16} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {cookies(RX, R, C, yourCloth, 'b')}
        {towel(RX, yourCloth, AREA, AREA)}
        {frame(RX, R, C)}

        {stepper('rows', 300, 170, 'rows', R, setR)}
        {stepper('cols', 484, 186, 'columns', C, setC)}
      </svg>
    </Panel>
  );
}
