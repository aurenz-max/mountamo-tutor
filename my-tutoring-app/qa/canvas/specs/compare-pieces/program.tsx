// Beat the Card (3.NF.A.3d). A card shows a fraction written as numbers only (3/4): no bar, no picture of it. The
// child's bar is cut into a different number of equal parts (or the same number on the first problem). The child taps
// parts in any order to shade the FEWEST parts that make MORE than the card, then says how many parts. Nothing on
// screen shows the card's amount as a length, so the child must think about the size of the parts: three fourths is
// six eighths, so seven eighths is the fewest that is more. The named misrule (bigger top number, bigger fraction) can
// happen because the card is a number. Say and show: the count of parts is one sayable number.
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  const cardTop = num(params.cardTop, 3), cardBottom = num(params.cardBottom, 4), parts = num(params.parts, 8);
  const [shaded, setShaded] = useState([]);

  // The fewest n with n/parts > cardTop/cardBottom, in integers: n * cardBottom > cardTop * parts.
  let need = parts;
  for (let n = 1; n <= parts; n++) if (n * cardBottom > cardTop * parts) { need = n; break; }

  useEffect(() => {
    const misrules = [
      // Compares the top numbers only: one more part than the card's top number beats it.
      { says: cardTop + 1, because: 'compared only the top numbers: shaded one more part than the top number on the card, but the parts are not the same size' },
      // Reads the bigger bottom number as the bigger fraction: the same top number over more parts "beats" the card.
      parts > cardBottom ? { says: cardTop, because: 'thinks the bigger bottom number makes the bigger fraction, but more parts in the whole means smaller parts' } : null,
    ].filter((m, i, all) => m && m.says >= 1 && m.says <= parts && m.says !== need && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(need, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(shaded.length === need);
    lumina.scene({ cardFraction: cardTop + '/' + cardBottom, yourBarEqualParts: parts, yourBarShadedParts: shaded.length });
  }, [shaded]);

  const toggle = i => setShaded(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i]));

  const X0 = 40, W = 600, H = 84, TOP = 196;
  const CARD = { x: 280, y: 24, w: 120, h: 132 };
  const bar = () => Array.from({ length: parts }, (_, i) => (
    <rect key={i} id={'part-' + i} x={X0 + (i * W) / parts} y={TOP} width={W / parts} height={H}
      fill={shaded.includes(i) ? '#fbbf24' : '#1e293b'} stroke="#64748b" strokeWidth="2" onPointerDown={() => toggle(i)} style={{ cursor: 'pointer' }} />
  ));

  return (
    <Panel title="Beat the Card" caption="Tap a part of your bar to shade it. Tap it again to clear it.">
      <svg viewBox="0 0 680 300" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="300" fill="#0f172a" />
        <rect x={CARD.x} y={CARD.y} width={CARD.w} height={CARD.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x={CARD.x + CARD.w / 2} y={CARD.y + 56} textAnchor="middle" fontSize="44" fontWeight="600" fill="#e2e8f0">{cardTop}</text>
        <line x1={CARD.x + 30} y1={CARD.y + 70} x2={CARD.x + CARD.w - 30} y2={CARD.y + 70} stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
        <text x={CARD.x + CARD.w / 2} y={CARD.y + 116} textAnchor="middle" fontSize="44" fontWeight="600" fill="#e2e8f0">{cardBottom}</text>

        <text x={X0} y={TOP - 14} fontSize="16" fill="#cbd5e1">Your bar</text>
        {bar()}
        <rect x={X0} y={TOP} width={W} height={H} fill="none" stroke="#cbd5e1" strokeWidth="3" pointerEvents="none" />
      </svg>
    </Panel>
  );
}
