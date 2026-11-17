// Tenths are hundredths (4.NF.C.6). A card shows a decimal; two hundred grids (each one whole) are always on screen.
// The child shades the amount on the card, a square at a time or a whole column (a tenth) at a time, and says how
// many small squares are shaded. Each place to the right is ten times smaller: 0.3 is 3 columns, 30 squares.
// Nothing printed counts the shaded squares or shows the decimal of what is shaded. Adapted from decimal-garden's
// plot (column tabs, tap-or-drag paint); its trophy and order tasks are dropped.
function Display({ params, lumina }) {
  const label = String(params.amount ?? '0.3');
  const m = /^(\d*)\.(\d+)$/.exec(label) || ['', '0', '3'];
  const whole = Number(m[1] || 0), frac = m[2];
  const key = Math.round(Number(label) * 100);

  const [cells, setCells] = useState(() => [[], []]); // shaded cell keys 'c-r' per grid
  const paint = useRef(null); // { grid, fill } while a finger is down

  useEffect(() => {
    const trimmed = frac.replace(/0+$/, '') || '0';
    const cands = [
      // 0.3 -> 3, 1.4 -> 104: the digits after the point counted as single small squares (hundredths).
      { says: whole * 100 + Number(trimmed), because: 'counted the digits after the point as single small squares, not as tenths (whole columns)' },
      // 0.03 -> 30: the zero after the point skipped, so the 3 read as 3 tenths.
      /^0+[1-9]$/.test(frac) ? { says: whole * 100 + Number(frac) * 10, because: 'skipped the zero after the point and read the hundredths digit as tenths (whole columns)' } : null,
      // 1.4 -> 14: the point ignored, the digits read as one whole number.
      whole > 0 ? { says: Number(m[1] + frac), because: 'ignored the point and read the digits as one number' } : null,
      // 0.25 -> 7: each digit after the point counted as that many single squares (2 squares and 5 squares).
      { says: whole * 100 + frac.split('').reduce((t, d) => t + Number(d), 0), because: 'counted each digit after the point as that many single small squares and added them' },
    ];
    const misrules = cands.filter((c, i, all) => c && c.says !== key && all.findIndex(x => x && x.says === c.says) === i).slice(0, 3);
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    const total = cells[0].length + cells[1].length;
    // Each grid is one whole: the amount sits in one grid, or one grid is full and the rest is in the other, so
    // 7 + 7 columns is not 1.4 and 0.3 is accepted in either grid.
    lumina.goal(total === key && cells.some(l => l.length === 0 || l.length === 100));
    lumina.scene({
      amountOnCard: label, grids: 2, smallSquaresInEachGrid: 100, eachGridIs: 'one whole',
      shadedSquaresInEachGrid: cells.map(l => l.length),
      fullColumnsInEachGrid: cells.map(l => Array.from({ length: 10 }, (_, c) => c).filter(c => Array.from({ length: 10 }, (_, r) => c + '-' + r).every(k => l.includes(k))).length),
    });
  }, [cells]);

  const setCell = (g, k, fill) => setCells(cs => cs.map((list, i) => {
    if (i !== g) return list;
    const has = list.includes(k);
    if (fill && !has) return [...list, k];
    if (!fill && has) return list.filter(x => x !== k);
    return list;
  }));
  const toggleCol = (g, c) => setCells(cs => cs.map((list, i) => {
    if (i !== g) return list;
    const col = Array.from({ length: 10 }, (_, r) => c + '-' + r);
    const full = col.every(k => list.includes(k));
    return full ? list.filter(k => !col.includes(k)) : [...list.filter(k => !col.includes(k)), ...col];
  }));

  const W = 680, S = 324, CELL = S / 10, PY = 138, H = PY + S + 46;
  const gx = g => 10 + g * (S + 12);

  const grid = g => {
    const x = gx(g), list = cells[g];
    return (
      <g key={'grid' + g}>
        {Array.from({ length: 10 }, (_, c) => (
          <g key={'tab' + c} id={`col-${g}-${c}`} onClick={() => toggleCol(g, c)} style={{ cursor: 'pointer' }}>
            <rect x={x + c * CELL} y={PY - 46} width={CELL} height="44" fill="transparent" />
            <rect x={x + c * CELL + 1} y={PY - 38} width={CELL - 2} height="32" rx="5" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <path d={`M ${x + c * CELL + CELL / 2 - 5} ${PY - 26} l 5 8 l 5 -8`} stroke="#cbd5e1" strokeWidth="2" fill="none" />
          </g>
        ))}
        {Array.from({ length: 100 }, (_, k) => {
          const c = Math.floor(k / 10), r = k % 10, id = c + '-' + r, on = list.includes(id);
          return (
            <rect key={id} id={`cell-${g}-${c}-${r}`} x={x + c * CELL} y={PY + r * CELL} width={CELL} height={CELL}
              fill={on ? '#fbbf24' : '#1e293b'} stroke="#475569" strokeWidth="1"
              onPointerDown={e => { e.currentTarget.releasePointerCapture && e.currentTarget.releasePointerCapture(e.pointerId); paint.current = { grid: g, fill: !on }; setCell(g, id, !on); }}
              onPointerEnter={e => { if (paint.current && paint.current.grid === g && e.buttons) setCell(g, id, paint.current.fill); }}
              style={{ cursor: 'pointer' }} />
          );
        })}
        <rect x={x} y={PY} width={S} height={S} fill="none" stroke="#cbd5e1" strokeWidth="3" pointerEvents="none" />
      </g>
    );
  };

  return (
    <Panel title="Hundred Grids" caption="Tap or drag across squares to shade them; tap the arrow over a column to shade the whole column.">
      <svg viewBox={`0 0 ${W} ${H}`} onPointerUp={() => { paint.current = null; }} onPointerLeave={() => { paint.current = null; }}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x={W / 2 - 80} y="10" width="160" height="62" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x={W / 2} y="53" textAnchor="middle" fontSize="32" fontWeight="700" fill="#e2e8f0">{label}</text>
        {[0, 1].map(grid)}
        <text x={W / 2} y={H - 14} textAnchor="middle" fontSize="15" fill="#94a3b8">Each grid is 1 whole.</text>
      </svg>
    </Panel>
  );
}
