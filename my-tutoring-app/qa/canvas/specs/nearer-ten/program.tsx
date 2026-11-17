// Nearer ten (3.NBT.A.1). A number line between two tens (or two hundreds on the transfer), with only its two ends
// written and the ticks between them unlabelled. The child drags the number card onto the line; it snaps to the nearest
// tick. Once the card is on the line, an arc runs from it to each end (no numbers on the arcs), so the child can see
// which end is nearer. The goal is placing the number on its own tick; the rounding is the spoken answer.
// Say and show: the nearer ten (or hundred) is one sayable number, computed from params (halfway rounds up).
function Display({ params, lumina }) {
  const num = (v, d) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? d : Number(v));
  const place = num(params.place, 10) === 100 ? 100 : 10;
  const n = num(params.n, 37);
  const lo = num(params.lo, Math.floor(n / place) * place), hi = lo + place;
  const [placed, setPlaced] = useState(null);
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    const nearest = (v, p) => Math.floor((v + p / 2) / p) * p;
    const answer = nearest(n, place);
    const misrules = [
      { says: Math.floor(n / place) * place, because: 'dropped the ones instead of finding the nearer ten' },
      ...(place === 100 ? [{ says: nearest(nearest(n, 10), 100), because: 'rounded to the ten first, then rounded that' }] : []),
    ].filter((m, i, all) => m.says !== answer && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(answer, misrules);
  }, []);
  useEffect(() => {
    // On the hundreds line one step is under 6px, too fine for a finger: a drop within 4 steps of the number counts,
    // but only on the number's own side of halfway, so 350 (the round-twice miss) is still refused for 349.
    const nearest = (v, p) => Math.floor((v + p / 2) / p) * p;
    const tol = place === 100 ? 4 : 0;
    lumina.goal(placed !== null && Math.abs(placed - n) <= tol && nearest(placed, place) === nearest(n, place));
    lumina.scene({ lineLeftEnd: lo, lineRightEnd: hi, equalStepsBetweenEnds: place, numberOnCard: n,
      cardOnLine: placed !== null, ...(placed !== null ? { cardOnTickFor: placed } : {}) });
  }, [placed]);

  const X0 = 60, X1 = 620, Y = 150, tickX = v => X0 + ((X1 - X0) * (v - lo)) / place;
  const TRAY = { x: 260, y: 232, w: 160, h: 68 }, HOME = { x: TRAY.x + TRAY.w / 2, y: TRAY.y + TRAY.h / 2 };
  const valueAt = p => (p.y > Y - 90 && p.y < Y + 60 && p.x > X0 - 30 && p.x < X1 + 30
    ? Math.max(lo, Math.min(hi, lo + Math.round(((p.x - X0) / (X1 - X0)) * place))) : null);
  const onDrag = p => setDrag(p);
  const onDrop = p => { setDrag(null); setPlaced(valueAt(p)); };
  const at = drag ? drag : placed !== null ? { x: tickX(placed), y: Y - 56 } : HOME;

  const tickH = v => {
    const k = v - lo;
    if (k === 0 || k === place) return 22;
    if (place === 100) return k === 50 ? 16 : k % 10 === 0 ? 12 : 5;
    return k === 5 ? 15 : 10;
  };
  const arc = (a, b, key) => {
    const xa = tickX(a), xb = tickX(b), depth = Math.min(58, 14 + Math.abs(xb - xa) * 0.16);
    return <path key={key} d={'M ' + xa + ' ' + (Y + 4) + ' Q ' + (xa + xb) / 2 + ' ' + (Y + 4 + depth * 2) + ' ' + xb + ' ' + (Y + 4)}
      fill="none" stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round" />;
  };
  const values = Array.from({ length: place + 1 }, (_, i) => lo + i);

  return (
    <Panel title="Nearer Ten" caption="Drag the number card onto the line.">
      <svg viewBox="0 0 680 316" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="316" fill="#0f172a" />
        {placed !== null && !drag && placed > lo && arc(lo, placed, 'left')}
        {placed !== null && !drag && placed < hi && arc(placed, hi, 'right')}
        <line x1={X0 - 16} y1={Y} x2={X1 + 16} y2={Y} stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
        {values.map(v => (
          <g key={v}>
            <line x1={tickX(v)} y1={Y - tickH(v)} x2={tickX(v)} y2={Y + tickH(v)} stroke="#cbd5e1" strokeWidth={v === lo || v === hi ? 4 : place === 100 && (v - lo) % 10 ? 1.2 : 2} />
            <circle id={'tick-' + v} cx={tickX(v)} cy={Y} r="1" fill="transparent" pointerEvents="none" />
          </g>
        ))}
        <text x={X0} y={Y + 56} textAnchor="middle" fontSize="24" fontWeight="700" fill="#e2e8f0">{lo}</text>
        <text x={X1} y={Y + 56} textAnchor="middle" fontSize="24" fontWeight="700" fill="#e2e8f0">{hi}</text>
        {placed !== null && !drag && <circle cx={tickX(placed)} cy={Y} r="7" fill="#fbbf24" stroke="#f8fafc" strokeWidth="2" />}

        <rect x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx="14" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
        <Handle id="token" x={at.x} y={at.y} r={30} onDrag={onDrag} onDrop={onDrop}>
          <g>
            {placed !== null && !drag && <path d="M -9 25 L 9 25 L 0 44 Z" fill="#fbbf24" />}
            <rect x="-48" y="-27" width="96" height="54" rx="12" fill={drag ? '#334155' : '#1e293b'} stroke="#fbbf24" strokeWidth="3" />
            <text y="10" textAnchor="middle" fontSize="28" fontWeight="700" fill="#e2e8f0">{n}</text>
          </g>
        </Handle>
      </svg>
    </Panel>
  );
}
