// Add like parts (4.NF.B.3a). Two bars of the same length, each cut into the same equal parts, some shaded. Below them
// an empty bar starts uncut; the child cuts it with plus and minus and taps each shaded piece to move it into the next
// part of the bottom bar. A moved piece fills one part of the bottom bar, so it keeps its size only when the bottom bar
// is cut like the top bars: cut into twice as many parts (the add-the-bottoms misrule), the pieces shrink against
// their dashed places above and fill 3/8, not 3/4. A sum past one whole spills into a second bottom bar, cut the same.
// Say and show: the filled amount is one fraction; Check judges every piece moved and the bottom bar cut like the top.
function Display({ params, lumina }) {
  const parts = Number(params.parts) || 4, a = Number(params.a) || 1, b = Number(params.b) || 2;
  const total = a + b, sumBars = total > parts ? 2 : 1;
  const MAX_CUT = 16; // the same on every problem, so where the plus dims tells nothing about the answer's cut
  const [moved, setMoved] = useState([]); // piece ids in the order they reached the bottom bar(s)
  const [cut, setCut] = useState(1); // the bottom bars start uncut, never at the answer's cut
  const room = cut * sumBars;

  useEffect(() => {
    const frac = (n, d) => n + '/' + d, said = frac(total, parts);
    const misrules = [{ says: frac(total, 2 * parts), because: 'added the top numbers and added the bottom numbers' }]
      .filter(m => m.says !== said);
    lumina.answer(said, misrules);
  }, []);
  useEffect(() => {
    const left = p => Array.from({ length: p === 'a' ? a : b }, (_, i) => p + '-' + i).filter(id => !moved.includes(id)).length;
    lumina.goal(moved.length === total && cut === parts);
    lumina.scene({ equalPartsInEachTopBar: parts, shadedPiecesLeftOnFirstBar: left('a'), shadedPiecesLeftOnSecondBar: left('b'),
      bottomBars: sumBars, bottomBarCutInto: cut, piecesInFirstBottomBar: Math.min(moved.length, cut), piecesInSecondBottomBar: Math.max(0, moved.length - cut) });
  }, [moved, cut]);

  const X0 = 60, W = 560, H = 48, w = W / parts, cw = W / cut;
  const TOP_A = 32, TOP_B = 110, TOP_S = [192, 256];
  const STEP_Y = TOP_S[sumBars - 1] + H + 52;
  const height = STEP_Y + 40;
  const colour = id => (id[0] === 'a' ? '#fbbf24' : '#22d3ee');
  const take = id => setMoved(m => (m.includes(id) || m.length >= room ? m : [...m, id]));
  const sendBack = () => setMoved(m => m.slice(0, -1));
  // A coarser cut has fewer parts: pieces past the new room go back to their bars.
  const recut = d => {
    const c = Math.max(1, Math.min(MAX_CUT, cut + d));
    setCut(c);
    setMoved(m => m.slice(0, c * sumBars));
  };

  const addend = (p, y, shaded) => Array.from({ length: parts }, (_, i) => {
    const id = p + '-' + i, here = i < shaded && !moved.includes(id);
    if (here) return (
      <rect key={id} id={id} x={X0 + i * w} y={y} width={w} height={H} fill={colour(id)} stroke="#0f172a" strokeWidth="2"
        onPointerDown={() => take(id)} style={{ cursor: 'pointer' }} />
    );
    if (i < shaded) return (
      <rect key={id} x={X0 + i * w + 4} y={y + 4} width={w - 8} height={H - 8} rx="4" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
    );
    return <rect key={id} x={X0 + i * w} y={y} width={w} height={H} fill="#1e293b" stroke="#64748b" strokeWidth="2" />;
  });
  const sumBar = k => Array.from({ length: cut }, (_, i) => {
    const place = k * cut + i, piece = moved[place];
    return piece ? (
      <rect key={place} id={'sum-' + place} x={X0 + i * cw} y={TOP_S[k]} width={cw} height={H} fill={colour(piece)} stroke="#0f172a" strokeWidth="2"
        onPointerDown={sendBack} style={{ cursor: 'pointer' }} />
    ) : (
      <g key={place} id={'sum-' + place}>
        <rect x={X0 + i * cw} y={TOP_S[k]} width={cw} height={H} fill="#0f172a" stroke="#64748b" strokeWidth="2" />
        {cw > 16 ? <rect x={X0 + i * cw + 4} y={TOP_S[k] + 4} width={cw - 8} height={H - 8} rx="4" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" /> : null}
      </g>
    );
  });
  const outline = y => <rect x={X0} y={y} width={W} height={H} fill="none" stroke="#cbd5e1" strokeWidth="3" pointerEvents="none" />;
  const step = (id, x, sign, d, can) => (
    <g id={id} onPointerDown={() => can && recut(d)} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={STEP_Y} r="24" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={STEP_Y + 10} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );

  return (
    <Panel title="Join the Pieces" caption="Tap plus or minus to cut the bottom bar. Tap a shaded piece to move it down; tap the bottom bar to send the last piece back.">
      <svg viewBox={'0 0 680 ' + height} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={height} fill="#0f172a" />
        <text x={X0} y={TOP_A - 9} fontSize="15" fill="#cbd5e1">First bar</text>
        {addend('a', TOP_A, a)}
        {outline(TOP_A)}
        <text x={X0} y={TOP_B - 9} fontSize="15" fill="#cbd5e1">Second bar</text>
        {addend('b', TOP_B, b)}
        {outline(TOP_B)}
        <text x={X0} y={TOP_S[0] - 9} fontSize="15" fill="#cbd5e1">{sumBars === 2 ? 'Bottom bars' : 'Bottom bar'}</text>
        {Array.from({ length: sumBars }, (_, k) => (
          <g key={k}>
            {sumBar(k)}
            {outline(TOP_S[k])}
          </g>
        ))}
        {step('cut-minus', 340 - 70, '−', -1, cut > 1)}
        <text x="340" y={STEP_Y + 6} textAnchor="middle" fontSize="16" fill="#cbd5e1">cut</text>
        {step('cut-plus', 340 + 70, '+', 1, cut < MAX_CUT)}
      </svg>
    </Panel>
  );
}
