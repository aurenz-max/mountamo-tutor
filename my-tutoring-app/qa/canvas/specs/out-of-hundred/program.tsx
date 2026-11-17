// A percent is that many out of each hundred of the whole (6.RP.A.3c). A hundred grid is one whole, and the whole is
// worth a printed amount (a brace over the grid: "whole = 80"). A card shows a percent to shade (or, on the inverse
// problem, an amount to shade). The child shades squares by tapping or dragging: a tap fills every square up to that one,
// column by column, so the child works in squares and columns of ten. The child says the amount shaded (or the percent).
// Nothing prints the amount shaded, a count of squares, or the value of one square or one column.
function Display({ params, lumina }) {
  const whole = Number(params.whole ?? 80);
  const grids = Math.max(1, Math.min(2, Number(params.grids ?? 1)));
  const amountMode = params.amount !== undefined && params.amount !== null;
  const percent = Number(params.percent ?? 50);
  const amount = Number(params.amount ?? 0);
  const squaresWanted = amountMode ? Math.round(amount * 100 / whole) : percent;
  const card = amountMode ? String(amount) : percent + '%';
  const max = grids * 100;

  const [count, setCount] = useState(0); // squares shaded, filled in order: grid, column, row
  const painting = useRef(false);

  useEffect(() => {
    let key, cands;
    if (amountMode) {
      key = squaresWanted;
      cands = [
        { says: amount, because: 'took the amount as the percent, not as that many out of each hundred of the whole' },
      ];
    } else {
      key = percent * whole / 100;
      cands = [
        { says: percent, because: 'took the percent as the amount, not as that many out of each hundred of the whole' },
        percent > 100 ? { says: whole, because: 'stopped at one whole: thought a percent cannot be more than the whole' } : null,
        percent > 100 ? { says: (percent - 100) * whole / 100, because: 'counted only the part past the first whole' } : null,
      ];
    }
    const misrules = cands.filter((c, i, all) => c && c.says !== key && all.findIndex(x => x && x.says === c.says) === i).slice(0, 3);
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    lumina.goal(count === squaresWanted);
    const inGrid = Array.from({ length: grids }, (_, g) => Math.max(0, Math.min(100, count - g * 100)));
    lumina.scene({
      card: card, cardIs: amountMode ? 'an amount to shade' : 'a percent to shade',
      grids: grids, squaresInEachGrid: 100, eachGridIsOneWholeWorth: whole,
      shadedSquaresInEachGrid: inGrid,
      fullColumnsInEachGrid: inGrid.map(n => Math.floor(n / 10)),
    });
  }, [count]);

  const tapTo = idx => setCount(c => (c === idx + 1 ? idx : idx + 1));
  const paintTo = idx => setCount(idx + 1);

  const W = 680;
  const one = grids === 1;
  const CELL = one ? 46 : 32;
  const S = CELL * 10;
  const PY = one ? 58 : 136;
  const H = PY + S + (one ? 8 : 22);
  const gx = g => (one ? 212 : 10 + g * (S + 12));

  const brace = g => {
    const x = gx(g), y = PY - 14;
    return (
      <g key={'brace' + g} pointerEvents="none">
        <path d={`M ${x + 2} ${y + 8} L ${x + 2} ${y} L ${x + S - 2} ${y} L ${x + S - 2} ${y + 8}`} stroke="#94a3b8" strokeWidth="2.5" fill="none" />
        <rect x={x + S / 2 - 78} y={y - 34} width="156" height="34" rx="8" fill="#0f172a" />
        <text x={x + S / 2} y={y - 10} textAnchor="middle" fontSize="22" fontWeight="600" fill="#e2e8f0">{'whole = ' + whole}</text>
      </g>
    );
  };

  const grid = g => {
    const x = gx(g);
    return (
      <g key={'grid' + g}>
        {Array.from({ length: 100 }, (_, k) => {
          const c = Math.floor(k / 10), r = k % 10, idx = g * 100 + k, on = idx < count;
          return (
            <rect key={k} id={`cell-${g}-${c}-${r}`} x={x + c * CELL} y={PY + r * CELL} width={CELL} height={CELL}
              fill={on ? '#22d3ee' : '#1e293b'} stroke="#475569" strokeWidth="1"
              onPointerDown={e => { e.currentTarget.releasePointerCapture && e.currentTarget.releasePointerCapture(e.pointerId); painting.current = true; tapTo(idx); }}
              onPointerEnter={e => { if (painting.current && e.buttons) paintTo(idx); }}
              style={{ cursor: 'pointer' }} />
          );
        })}
        {Array.from({ length: 9 }, (_, c) => (
          <line key={'cl' + c} x1={x + (c + 1) * CELL} y1={PY} x2={x + (c + 1) * CELL} y2={PY + S} stroke="#64748b" strokeWidth="1.5" pointerEvents="none" />
        ))}
        <rect x={x} y={PY} width={S} height={S} fill="none" stroke="#cbd5e1" strokeWidth="3" pointerEvents="none" />
      </g>
    );
  };

  const cardBox = one
    ? { x: 20, y: PY + 40, w: 170, h: 110 }
    : { x: W / 2 - 85, y: 8, w: 170, h: 74 };

  return (
    <Panel title="Percent Grid" caption="Tap a square to shade up to it, or drag across the squares. Tap the last shaded square to take it back.">
      <svg viewBox={`0 0 ${W} ${H}`} onPointerUp={() => { painting.current = false; }} onPointerLeave={() => { painting.current = false; }}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x={cardBox.x} y={cardBox.y} width={cardBox.w} height={cardBox.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {one && <text x={cardBox.x + cardBox.w / 2} y={cardBox.y + 30} textAnchor="middle" fontSize="18" fill="#cbd5e1">shade</text>}
        <text x={cardBox.x + cardBox.w / 2} y={cardBox.y + (one ? 84 : 52)} textAnchor="middle" fontSize={one ? 44 : 36} fontWeight="700" fill="#e2e8f0">{card}</text>
        {!one && <text x={cardBox.x - 14} y={cardBox.y + 46} textAnchor="end" fontSize="18" fill="#cbd5e1">shade</text>}
        {Array.from({ length: grids }, (_, g) => brace(g))}
        {Array.from({ length: grids }, (_, g) => grid(g))}
      </svg>
    </Panel>
  );
}
