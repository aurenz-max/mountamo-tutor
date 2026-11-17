// Left over (3.OA, 4.OA.A.3). A pile of apples (or children) and a row of empty baskets (or cars), each with seats
// for one group. The child taps a basket to put one more in it and taps one in a basket to take it out, so a short
// group can be built. The rule: the remainder is what cannot make another full group. Apples: every basket used is
// full and fewer than a basket's worth stay loose; the child says how many are left over. Cars (transfer): everyone
// rides, in the fewest cars; the child says how many cars, and the left-over children force one more car.
// Say and show: one sayable number per problem, computed from params; Check judges the build.
function Display({ params, lumina }) {
  const cars = params.story === 'cars';
  const N = Math.max(1, Math.min(30, Number(params.items) || 13));
  const d = Math.max(2, Math.min(6, Number(params.per) || 4));
  const B = Math.max(2, Math.min(6, Number(params.groups) || 5)); // a fixed count, more than the build needs
  const LOOK = cars
    ? { item: '🧒', box: '🚗', title: 'Car Park', caption: 'Tap a car to seat a child in it. Tap a child in a car to send them back.' }
    : { item: '🍎', box: '🧺', title: 'Apple Packing', caption: 'Tap a basket to put an apple in it. Tap an apple in a basket to take it out.' };

  const [inBox, setInBox] = useState(() => Array(B).fill(0));
  const placed = inBox.reduce((a, b) => a + b, 0);
  const loose = N - placed;

  useEffect(() => {
    const full = Math.floor(N / d), r = N % d;
    const answer = cars ? full + (r ? 1 : 0) : r;
    const misrules = (cars
      ? [
        { says: r, because: 'gave the children left over, not the cars they need' },
        { says: full, because: 'counted only the full cars and left the last children behind' },
      ]
      : [
        r ? { says: 0, because: 'put the left-over apples in a short last basket and said none were left over' } : null,
        { says: full, because: 'gave the number of full baskets, not the apples left over' },
      ]
    ).filter((m, i, all) => m && m.says !== answer && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(answer, misrules);
  }, []);

  useEffect(() => {
    const used = inBox.filter(c => c > 0).length;
    const met = cars
      ? loose === 0 && used === Math.ceil(N / d)
      : inBox.every(c => c === 0 || c === d) && loose < d;
    lumina.goal(met);
    lumina.scene(cars
      ? { children: N, seatsInEachCar: d, carsOnScreen: B, childrenInEachCar: inBox, childrenStillWaiting: loose }
      : { apples: N, seatsInEachBasket: d, basketsOnScreen: B, applesInEachBasket: inBox, applesNotInABasket: loose });
  }, [inBox]);

  const add = b => setInBox(s => (s.reduce((a, c) => a + c, 0) < N && s[b] < d ? s.map((c, i) => (i === b ? c + 1 : c)) : s));
  const take = (b, e) => { e.stopPropagation(); setInBox(s => s.map((c, i) => (i === b && c > 0 ? c - 1 : c))); };

  const W = 680, SEAT = 44, PAD = 7, BAND = 50, GAP = 10;
  const rows = Math.ceil(d / 2);
  const BW = 2 * SEAT + 2 * PAD, BH = rows * SEAT + 2 * PAD + BAND;
  const perRow = Math.max(1, Math.floor((W - 16 + GAP) / (BW + GAP)));
  const IT = 40, perLine = 15;
  const PILE_Y = 16, PILE_H = Math.max(2, Math.ceil(N / perLine)) * IT + 20;
  const BOX_Y = PILE_Y + PILE_H + 22;
  const boxRows = Math.ceil(B / perRow);
  const H = BOX_Y + boxRows * (BH + 12) + 6;

  // The loose ones in reading order, centred on the tray.
  const lineW = Math.min(N, perLine) * IT;
  const pile = Array.from({ length: loose }, (_, k) => (
    <text key={'p' + k} x={(W - lineW) / 2 + (k % perLine) * IT + IT / 2} y={PILE_Y + 10 + Math.floor(k / perLine) * IT + 31}
      textAnchor="middle" fontSize="30">{LOOK.item}</text>
  ));

  const boxOf = b => {
    const inRow = Math.min(perRow, B - Math.floor(b / perRow) * perRow);
    const rowW = inRow * BW + (inRow - 1) * GAP;
    const x = (W - rowW) / 2 + (b % perRow) * (BW + GAP), y = BOX_Y + Math.floor(b / perRow) * (BH + 12);
    return (
      <g key={'box' + b}>
        <rect x={x} y={y} width={BW} height={BH} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {Array.from({ length: d }, (_, s) => {
          const sx = x + PAD + (s % 2) * SEAT, sy = y + PAD + Math.floor(s / 2) * SEAT;
          const here = s < inBox[b];
          return (
            <g key={s}>
              <rect x={sx + 2} y={sy + 2} width={SEAT - 4} height={SEAT - 4} rx="8" fill="#0f172a" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 5" />
              {here && (
                <g id={'item-' + b + '-' + s} onClick={e => take(b, e)} style={{ cursor: 'pointer' }}>
                  <rect x={sx} y={sy} width={SEAT} height={SEAT} fill="transparent" />
                  <text x={sx + SEAT / 2} y={sy + SEAT / 2 + 11} textAnchor="middle" fontSize="30" pointerEvents="none">{LOOK.item}</text>
                </g>
              )}
            </g>
          );
        })}
        <g id={'box-' + b} onClick={() => add(b)} style={{ cursor: 'pointer' }}>
          <rect x={x + 4} y={y + BH - BAND} width={BW - 8} height={BAND - 4} rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
          <text x={x + BW / 2} y={y + BH - BAND + 34} textAnchor="middle" fontSize="30" pointerEvents="none">{LOOK.box}</text>
        </g>
      </g>
    );
  };

  return (
    <Panel title={LOOK.title} caption={LOOK.caption}>
      <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'manipulation' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="16" y={PILE_Y} width={W - 32} height={PILE_H} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {pile}
        {Array.from({ length: B }, (_, b) => boxOf(b))}
      </svg>
    </Panel>
  );
}
