// Same Turn (4.MD.C.5). A card shows an angle drawn with arms of one length (or, on the last problem, a pie slice).
// The child has their own angle with arms of a different length: one arm stays put, the other starts lying on it, and
// the child turns it one step at a time (15 degrees, or an hour of a clock face on the last problem). Each step leaves
// a small wedge, the same size whatever the arm length, so the turn can be counted. The child makes the same turn as
// the card, or the fewest steps that make a bigger turn, and says how many steps the arm turned.
// The rule: an angle's size is how far one arm has turned from the other. The misrule (longer arms make a bigger angle)
// matches how far apart the arm ends are instead of the turn, so with arms of another length it turns a different
// number of steps. No degrees, no readout, no colour that changes when the goal is met.
function Display({ params, lumina }) {
  const num = (v, d) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? d : Number(v));
  const LONG = 140, SHORT = 90;
  const len = v => (v === 'short' ? SHORT : v === 'long' ? LONG : num(v, LONG));
  const cardArm = len(params.cardArms), yourArm = len(params.yourArms);
  const stepDeg = num(params.stepDeg, 15);
  const cardSteps = num(params.cardSteps, 4);
  const cardTurn = cardSteps * stepDeg;
  const cardBase = num(params.cardBase, 0);
  const cardShape = params.cardShape === 'pie' ? 'pie' : 'angle';
  const clock = params.yourShape === 'clock';
  const beat = params.task === 'beat';
  const yourBase = clock ? 90 : 0, dir = clock ? -1 : 1;
  const maxSteps = Math.round(180 / stepDeg);
  const [n, setN] = useState(0);

  const rad = d => (d * Math.PI) / 180;
  const chord = (L, deg) => 2 * L * Math.sin(rad(deg) / 2);
  const key = beat ? cardSteps + 1 : cardSteps;

  useEffect(() => {
    // The long-arms misrule: how far apart the arm ends are stands for the size of the angle.
    const target = chord(cardArm, cardTurn);
    let says = null;
    if (beat) {
      for (let k = 1; k <= maxSteps; k++) if (chord(yourArm, k * stepDeg) > target + 0.5) { says = k; break; }
    } else {
      let best = Infinity;
      for (let k = 1; k <= maxSteps; k++) { const d = Math.abs(chord(yourArm, k * stepDeg) - target); if (d < best) { best = d; says = k; } }
    }
    const misrules = [
      says === null ? null : {
        says,
        because: yourArm < cardArm
          ? 'thinks longer arms make a bigger angle, so turned the shorter arm until its end was as far from the other arm as on the card'
          : 'thinks longer arms make a bigger angle, so stopped turning the longer arm once its end was as far from the other arm as on the card',
      },
    ].filter((m, i, all) => m && m.says !== key && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(key, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(n === key);
    lumina.scene({
      card: cardShape === 'pie' ? 'a pie slice' : 'an angle',
      cardArms: cardArm === yourArm ? 'the same length as yours' : cardArm > yourArm ? 'longer than yours' : 'shorter than yours',
      yourAngle: clock ? 'a clock hand that turns one hour mark per step' : 'two arms, one turns a step at a time',
      yourArmSteps: n,
      makes: beat ? 'the fewest steps that make a bigger turn than the card' : 'the same turn as the card',
    });
  }, [n]);

  const pt = (v, a, L) => ({ x: v.x + L * Math.cos(rad(a)), y: v.y - L * Math.sin(rad(a)) });
  const sector = (v, a0, a1, r) => {
    const p0 = pt(v, a0, r), p1 = pt(v, a1, r);
    const sweep = a1 > a0 ? 0 : 1, large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return `M ${v.x} ${v.y} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y} Z`;
  };
  // Put a vertex so the points drawn from it sit in the middle of a box.
  const place = (box, pts) => {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return { x: box.x + box.w / 2 - cx, y: box.y + box.h / 2 - cy };
  };

  const CARD = { x: 24, y: 48, w: 300, h: 300 }, YOURS = { x: 348, y: 48, w: 308, h: 300 };
  const o = { x: 0, y: 0 };
  const cardV = place(CARD, [o, pt(o, cardBase, cardArm), pt(o, cardBase + cardTurn, cardArm),
    ...Array.from({ length: 9 }, (_, i) => pt(o, cardBase + (cardTurn * i) / 8, cardShape === 'pie' ? cardArm : 0))]);
  const yourV = clock ? { x: YOURS.x + YOURS.w / 2, y: YOURS.y + YOURS.h / 2 }
    : place(YOURS, [o, ...Array.from({ length: maxSteps + 1 }, (_, k) => pt(o, yourBase + dir * k * stepDeg, yourArm))]);

  const arm = (v, a, L, w, c) => { const p = pt(v, a, L); return <line x1={v.x} y1={v.y} x2={p.x} y2={p.y} stroke={c} strokeWidth={w} strokeLinecap="round" />; };
  const turned = yourBase + dir * n * stepDeg;
  const W = 58;
  const wedges = () => Array.from({ length: n }, (_, i) => (
    <path key={i} d={sector(yourV, yourBase + dir * i * stepDeg, yourBase + dir * (i + 1) * stepDeg, W)}
      fill={i % 2 ? '#b45309' : '#fbbf24'} stroke="#0f172a" strokeWidth="1.5" />
  ));
  const clockFace = () => {
    const R = yourArm + 22;
    return (
      <g pointerEvents="none">
        <circle cx={yourV.x} cy={yourV.y} r={R} fill="#1e293b" stroke="#64748b" strokeWidth="3" />
        {Array.from({ length: 12 }, (_, i) => { const p = pt(yourV, 90 - i * 30, R - 10); return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#94a3b8" />; })}
      </g>
    );
  };
  const can = { more: n < maxSteps, back: n > 0 };
  const btn = (id, x, label, arrow, act, ok) => (
    <g id={id} onPointerDown={ok ? act : undefined} style={{ cursor: ok ? 'pointer' : 'default' }} opacity={ok ? 1 : 0.35}>
      <rect x={x} y="368" width="140" height="56" rx="16" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x + 36} y="406" textAnchor="middle" fontSize="28" fill="#e2e8f0">{arrow}</text>
      <text x={x + 88} y="402" textAnchor="middle" fontSize="18" fill="#e2e8f0">{label}</text>
    </g>
  );
  const moreArrow = dir > 0 ? '↺' : '↻', backArrow = dir > 0 ? '↻' : '↺';

  return (
    <Panel title="Same Turn" caption="Tap turn to move your arm one step. Tap back to undo a step.">
      <svg viewBox="0 0 680 436" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="436" fill="#0f172a" />

        <text x={CARD.x} y="34" fontSize="18" fill="#cbd5e1">Card</text>
        <rect x={CARD.x} y={CARD.y} width={CARD.w} height={CARD.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {cardShape === 'pie' ? (
          <g>
            <path d={sector(cardV, cardBase, cardBase + cardTurn, cardArm)} fill="#e9b872" stroke="#a16207" strokeWidth="6" strokeLinejoin="round" />
            <circle cx={cardV.x + cardArm * 0.4 * Math.cos(rad(cardBase + cardTurn / 2))} cy={cardV.y - cardArm * 0.4 * Math.sin(rad(cardBase + cardTurn / 2))} r="9" fill="#dc2626" />
            <circle cx={cardV.x + cardArm * 0.7 * Math.cos(rad(cardBase + cardTurn / 3))} cy={cardV.y - cardArm * 0.7 * Math.sin(rad(cardBase + cardTurn / 3))} r="8" fill="#dc2626" />
          </g>
        ) : (
          <g>
            {arm(cardV, cardBase, cardArm, 7, '#e2e8f0')}
            {arm(cardV, cardBase + cardTurn, cardArm, 7, '#e2e8f0')}
            <circle cx={cardV.x} cy={cardV.y} r="7" fill="#e2e8f0" />
          </g>
        )}

        <text x={YOURS.x} y="34" fontSize="18" fill="#cbd5e1">{clock ? 'Your clock hand' : 'Your angle'}</text>
        <rect x={YOURS.x} y={YOURS.y} width={YOURS.w} height={YOURS.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {clock ? clockFace() : null}
        {wedges()}
        {arm(yourV, yourBase, yourArm, 7, clock ? '#64748b' : '#e2e8f0')}
        {arm(yourV, turned, yourArm, 8, '#22d3ee')}
        <circle cx={yourV.x} cy={yourV.y} r="8" fill="#e2e8f0" />

        {btn('turn-back', 360, 'back', backArrow, () => setN(v => Math.max(0, v - 1)), can.back)}
        {btn('turn-more', 512, 'turn', moreArrow, () => setN(v => Math.min(maxSteps, v + 1)), can.more)}
      </svg>
    </Panel>
  );
}
