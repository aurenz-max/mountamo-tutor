// Longer is not bigger (4.NF.C.7, 5.NBT.A.3b). Two decimals are written on cards. Under each card is an EMPTY hundred
// grid. The child shades each grid to show its card's decimal: a whole column is a tenth, a single square a hundredth.
// Past one whole, each card also has a small whole grid beside it, shaded in one tap. The rule work is in the build:
// a child who thinks more digits make a bigger number shades 5 squares for 0.5 and 35 for 0.35. No count or decimal is
// printed for what is shaded.
// Say and show: "first", "second" or "same" is the said answer; Check judges that each card's grids hold its amount.
function Display({ params, lumina }) {
  const cards = [String(params.first ?? '0.5'), String(params.second ?? '0.35')];
  const hundredths = s => Math.round(Number(s) * 100);
  const want = cards.map(hundredths);
  // Whole grids beside each card: as many as the bigger card needs past its last whole, the same for both cards, so the
  // layout tells nothing.
  const wholes = Math.max(0, ...want.map(v => Math.ceil(v / 100) - 1));

  const [cells, setCells] = useState([[], []]); // 'c-r' keys shaded in each card's hundred grid
  const [whole, setWhole] = useState([Array(wholes).fill(false), Array(wholes).fill(false)]);
  const paint = useRef(null); // { card, kind: 'cell' | 'col', fill } while a finger is down

  useEffect(() => {
    const tail = s => (s.split('.')[1] || '');
    const pick = d => (d > 0 ? 'first' : d < 0 ? 'second' : 'same');
    const answer = pick(want[0] - want[1]);
    const len = cards.map(s => tail(s).length);
    const longer = len[0] > len[1] ? 0 : len[1] > len[0] ? 1 : -1;
    const misrules = [
      longer >= 0 ? {
        says: longer === 0 ? 'first' : 'second',
        because: 'thinks more digits after the point make a bigger number: ' + cards[longer] + ' looks bigger than ' + cards[1 - longer]
          + ' because ' + Number(tail(cards[longer])) + ' is more than ' + Number(tail(cards[1 - longer])),
      } : null,
      longer >= 0 ? {
        says: longer === 0 ? 'second' : 'first',
        because: 'thinks fewer digits after the point make a bigger number, because tenths are bigger pieces than hundredths, whatever the digits say',
      } : null,
    ].filter((m, i, all) => m && m.says !== answer && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(answer, misrules, ['first', 'second', 'same']);
  }, []);

  const colKeys = c => Array.from({ length: 10 }, (_, r) => c + '-' + r);
  const colFull = (k, c) => colKeys(c).every(x => cells[k].includes(x));
  useEffect(() => {
    const total = k => cells[k].length + 100 * whole[k].filter(Boolean).length;
    lumina.goal([0, 1].every(k => total(k) === want[k]));
    lumina.scene({
      squaresInAHundredGrid: 100,
      cards: [0, 1].map(k => ({
        card: k === 0 ? 'first' : 'second', number: cards[k],
        ...(wholes ? { wholeGridsBeside: wholes, wholeGridsShaded: whole[k].filter(Boolean).length } : {}),
        squaresShadedInHundredGrid: cells[k].length,
        fullColumnsInHundredGrid: Array.from({ length: 10 }, (_, c) => c).filter(c => colFull(k, c)).length,
      })),
    });
  }, [cells, whole]);

  const setCell = (k, key, fill) => setCells(cs => cs.map((list, i) => {
    if (i !== k || fill === list.includes(key)) return list;
    return fill ? [...list, key] : list.filter(x => x !== key);
  }));
  const setCol = (k, c, fill) => setCells(cs => cs.map((list, i) => {
    if (i !== k) return list;
    const col = colKeys(c), rest = list.filter(x => !col.includes(x));
    return fill ? [...rest, ...col] : rest;
  }));
  const flipWhole = (k, w) => setWhole(ws => ws.map((list, i) => (i === k ? list.map((on, j) => (j === w ? !on : on)) : list)));
  const free = e => { if (e.currentTarget.releasePointerCapture) e.currentTarget.releasePointerCapture(e.pointerId); };

  // Two columns, one per card: the card (and any whole grids beside it), then its hundred grid with 32px squares.
  const W = 680, S = 320, CELL = S / 10, TAB = 40, MINI = 100;
  const TOP = wholes ? 140 : 96;
  const H = TOP + TAB + S + 14;
  const colX = k => 10 + k * (S + 20);
  const ink = ['#22d3ee', '#fbbf24'];

  const grid = k => {
    const x = colX(k), y = TOP + TAB, list = cells[k];
    return (
      <g key={'grid' + k}>
        {Array.from({ length: 10 }, (_, c) => (
          <g key={'tab' + c} id={`col-${k}-${c}`} style={{ cursor: 'pointer' }}
            onPointerDown={e => { free(e); const fill = !colFull(k, c); paint.current = { card: k, kind: 'col', fill }; setCol(k, c, fill); }}
            onPointerEnter={e => { const p = paint.current; if (p && p.card === k && p.kind === 'col' && e.buttons) setCol(k, c, p.fill); }}>
            <rect x={x + c * CELL} y={y - TAB} width={CELL} height={TAB} fill="transparent" />
            <rect x={x + c * CELL + 1.5} y={y - TAB + 3} width={CELL - 3} height={TAB - 8} rx="5" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <path d={`M ${x + c * CELL + CELL / 2 - 5} ${y - TAB / 2 - 3} l 5 7 l 5 -7`} stroke="#cbd5e1" strokeWidth="2" fill="none" pointerEvents="none" />
          </g>
        ))}
        <rect x={x - 3} y={y - 3} width={S + 6} height={S + 6} rx="5" fill="#475569" />
        {Array.from({ length: 100 }, (_, n) => {
          const c = Math.floor(n / 10), r = n % 10, key = c + '-' + r, on = list.includes(key);
          return (
            <rect key={key} id={`cell-${k}-${c}-${r}`} x={x + c * CELL} y={y + r * CELL} width={CELL} height={CELL}
              fill={on ? ink[k] : '#1e293b'} stroke="#0f172a" strokeWidth="1" style={{ cursor: 'pointer' }}
              onPointerDown={e => { free(e); paint.current = { card: k, kind: 'cell', fill: !on }; setCell(k, key, !on); }}
              onPointerEnter={e => { const p = paint.current; if (p && p.card === k && p.kind === 'cell' && e.buttons) setCell(k, key, p.fill); }} />
          );
        })}
      </g>
    );
  };
  // A whole grid: the same hundred grid drawn small, shaded or cleared as one piece.
  const mini = (k, w) => {
    const x = colX(k) + 186 + w * (MINI + 10), y = 22, on = whole[k][w], c = MINI / 10;
    return (
      <g key={'whole' + k + w} id={`whole-${k}-${w}`} onPointerDown={e => { free(e); flipWhole(k, w); }} style={{ cursor: 'pointer' }}>
        <rect x={x - 3} y={y - 3} width={MINI + 6} height={MINI + 6} rx="5" fill="#475569" />
        {Array.from({ length: 100 }, (_, n) => (
          <rect key={n} x={x + Math.floor(n / 10) * c} y={y + (n % 10) * c} width={c} height={c}
            fill={on ? ink[k] : '#1e293b'} stroke="#0f172a" strokeWidth="0.75" />
        ))}
      </g>
    );
  };
  const card = k => {
    const w = 150, cx = wholes ? colX(k) + 8 + w / 2 : colX(k) + S / 2, cy = wholes ? 80 : 58;
    return (
      <g key={'card' + k}>
        <text x={cx} y={cy - 38} textAnchor="middle" fontSize="16" fill="#cbd5e1">{k === 0 ? 'First' : 'Second'}</text>
        <rect x={cx - w / 2} y={cy - 28} width={w} height="56" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="30" fontWeight="700" fill="#e2e8f0">{cards[k]}</text>
      </g>
    );
  };

  const caption = 'Tap or drag across squares to shade them; tap the arrow over a column to shade the whole column'
    + (wholes ? '; tap a small grid to shade a whole.' : '.');
  return (
    <Panel title="Decimal Cards" caption={caption}>
      <svg viewBox={`0 0 ${W} ${H}`} onPointerUp={() => { paint.current = null; }} onPointerLeave={() => { paint.current = null; }}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        {[0, 1].map(k => card(k))}
        {[0, 1].flatMap(k => Array.from({ length: wholes }, (_, w) => mini(k, w)))}
        {[0, 1].map(k => grid(k))}
      </svg>
    </Panel>
  );
}
