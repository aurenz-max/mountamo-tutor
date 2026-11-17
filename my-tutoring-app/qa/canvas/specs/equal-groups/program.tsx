// Equal Groups (3.OA.A.1). Apples lie unevenly on a row of plates. The child taps a plate to pick up one apple and taps
// a plate (or the left-over tray) to put it down, until every plate holds the same number. The left-over tray has one
// spot fewer than there are plates, on every problem, so it can hold only what cannot be shared out: with the tray's
// cap, "every plate the same and nothing in the hand" has one solution, the most equal groups. On a problem whose
// apples share out evenly the tray ends empty; on one that does not (13 on 3 plates) the spare apple has to go there.
// Say and show: on a count problem the child says how many are in each group; on the uneven problem the child says
// whether every apple can go on a plate with all plates the same ("yes" / "no"). Misrules are computed from params.
// Nothing prints a count, and no colour changes when the plates are equal.
function Display({ params, lumina }) {
  const start = (Array.isArray(params?.start) ? params.start : String(params?.start ?? '5,3,4').split(','))
    .map((v) => Math.max(0, Math.round(Number(v) || 0)));
  const P = Math.max(2, Math.min(4, start.length));
  const plates0 = start.slice(0, P);
  const total = plates0.reduce((a, b) => a + b, 0);
  const ask = String(params?.ask ?? 'count') === 'share' ? 'share' : 'count';
  const SPOTS = P - 1;

  const [plates, setPlates] = useState(plates0);
  const [tray, setTray] = useState(0);
  const [hand, setHand] = useState(null); // null, a plate index, or 'tray'

  useEffect(() => {
    const each = Math.floor(total / P);
    if (ask === 'share') {
      const even = total % P === 0;
      lumina.answer(even ? 'yes' : 'no', [{
        says: even ? 'no' : 'yes',
        because: even ? 'thought the plates could not be made the same' : 'counted unequal plates as equal groups: any groups count',
      }], ['yes', 'no']);
      return;
    }
    const misrules = [
      { says: plates0[0], because: 'took one plate\'s count when the plates were not the same: any groups count' },
      { says: P, because: 'counted the plates, not how many are on each plate' },
      { says: total, because: 'counted every apple, not the apples in one group' },
    ].filter((m, i, all) => m.says !== each && all.findIndex((x) => x.says === m.says) === i);
    lumina.answer(each, misrules);
  }, []);

  useEffect(() => {
    const allSame = plates.every((c) => c === plates[0]);
    lumina.goal(hand === null && allSame && tray < P);
    lumina.scene({
      plates: P,
      applesOnEachPlate: plates,
      applesInLeftOverTray: tray,
      leftOverTraySpots: SPOTS,
      holdingAnAppleFrom: hand === null ? 'nothing' : hand === 'tray' ? 'the left-over tray' : 'plate ' + (hand + 1),
    });
  }, [plates, tray, hand]);

  const tapPlate = (i) => {
    if (hand === null) {
      if (plates[i] === 0) return;
      setPlates((p) => p.map((c, k) => (k === i ? c - 1 : c)));
      setHand(i);
      return;
    }
    setPlates((p) => p.map((c, k) => (k === i ? c + 1 : c)));
    setHand(null);
  };
  const tapTray = () => {
    if (hand === null) {
      if (tray === 0) return;
      setTray((t) => t - 1);
      setHand('tray');
      return;
    }
    if (tray >= SPOTS) return;
    setTray((t) => t + 1);
    setHand(null);
  };

  const W = 680, VH = 420;
  const pitch = W / P;
  const RX = P <= 3 ? 86 : 74, RY = 92, CY = 182;
  const cx = (i) => pitch * i + pitch / 2;

  const apple = (x, y, s, key, lifted) => (
    <g key={key} transform={'translate(' + x + ',' + y + ')'} pointerEvents="none">
      {lifted ? <circle r={s * 0.62} fill="#334155" stroke="#fbbf24" strokeWidth={4} /> : null}
      <circle r={s * 0.4} fill="#ef4444" stroke="#7f1d1d" strokeWidth={1.5} />
      <line x1={0} y1={-s * 0.38} x2={s * 0.06} y2={-s * 0.55} stroke="#78350f" strokeWidth={2} strokeLinecap="round" />
      <ellipse cx={s * 0.17} cy={-s * 0.48} rx={s * 0.13} ry={s * 0.07} fill="#22c55e" />
    </g>
  );

  // Apples on a plate: a centred grid sized to the count, so a small pile sits in the middle of the plate.
  const pile = (i) => {
    const k = plates[i];
    if (!k) return null;
    const cols = k <= 1 ? 1 : k <= 4 ? 2 : k <= 9 ? 3 : 4;
    const rows = Math.ceil(k / cols);
    const s = Math.min(38, (2 * RY - 34) / rows, (2 * RX - 34) / cols);
    const out = [];
    for (let n = 0; n < k; n += 1) {
      const r = Math.floor(n / cols), c = n % cols;
      const inRow = r === rows - 1 ? k - r * cols : cols;
      const x = cx(i) + (c - (inRow - 1) / 2) * s;
      const y = CY + (r - (rows - 1) / 2) * s;
      out.push(apple(x, y, s, 'a-' + i + '-' + n, false));
    }
    return out;
  };

  const plate = (i) => (
    <g key={'plate-' + i} id={'plate-' + i} onClick={() => tapPlate(i)} style={{ cursor: 'pointer' }}>
      <rect x={pitch * i + 4} y={24} width={pitch - 8} height={CY + RY + 10 - 24} fill="transparent" />
      <ellipse cx={cx(i)} cy={CY + 6} rx={RX} ry={RY} fill="#020617" opacity={0.35} pointerEvents="none" />
      <ellipse cx={cx(i)} cy={CY} rx={RX} ry={RY} fill="#e2e8f0" stroke="#64748b" strokeWidth={2.5} pointerEvents="none" />
      <ellipse cx={cx(i)} cy={CY} rx={RX - 14} ry={RY - 14} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={1.5} pointerEvents="none" />
      {pile(i)}
      {hand === i ? apple(cx(i), 52, 40, 'held-' + i, true) : null}
    </g>
  );

  const TRAY_W = 150 + SPOTS * 62, TRAY_X = (W - TRAY_W) / 2, TRAY_Y = 316, TRAY_H = 76;
  const spotX = (k) => TRAY_X + 150 + k * 62;

  return (
    <Panel title="Equal Groups" caption="Tap a plate to pick up an apple. Tap a plate or the left-over tray to put it down.">
      <svg viewBox={'0 0 ' + W + ' ' + VH} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'manipulation' }}>
        <rect width={W} height={VH} fill="#0f172a" />
        {plates.map((_, i) => plate(i))}
        <g id="basket" onClick={tapTray} style={{ cursor: 'pointer' }}>
          <rect x={TRAY_X} y={TRAY_Y} width={TRAY_W} height={TRAY_H} rx={14} fill="#1e293b" stroke="#475569" strokeWidth={2} />
          <text x={TRAY_X + 22} y={TRAY_Y + TRAY_H / 2 + 6} fontSize={18} fill="#cbd5e1">left over</text>
          {Array.from({ length: SPOTS }, (_, k) => (
            <g key={'spot-' + k} pointerEvents="none">
              <circle cx={spotX(k)} cy={TRAY_Y + TRAY_H / 2} r={24} fill="none" stroke="#475569" strokeWidth={2} strokeDasharray="6 5" />
              {k < tray ? apple(spotX(k), TRAY_Y + TRAY_H / 2 + 2, 40, 'tray-' + k, false) : null}
            </g>
          ))}
          {hand === 'tray' ? apple(TRAY_X + TRAY_W + 40, TRAY_Y + TRAY_H / 2, 40, 'held-tray', true) : null}
        </g>
      </svg>
    </Panel>
  );
}
