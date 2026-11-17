// Same on both sides (1.OA.D.7). The equation is printed over a pan balance: the left side's numbers over the left pan,
// the right side's over the right pan. Each pan holds its side's known numbers as trays of dots; the empty box in the
// equation is a dashed tray on its pan, and the child adds or takes dots there with plus and minus. The beam tilts by
// the true totals of the two pans: that is the world reacting, the same in every state, and nothing changes colour
// when it is level. From the third problem on (`peg`), blocks hold the beam still until the child presses Let go; a
// change to the dots puts the blocks back, so the child decides first and tests after.
// A `build` problem prints every number (5 = 5): the dashed tray stands for that printed number, the child puts it in,
// and the ask is whether the equation is true (yes or no).
// Say and show: the missing number (or yes / no) is said; Check judges the dots in the box.
function Display({ params, lumina }) {
  const terms = s => String(s || '').split('+').map(t => t.trim()).filter(Boolean);
  const left = terms(params.left || '3 + 4'), right = terms(params.right || '_');
  const build = params.build === 'right' || params.build === 'left' ? params.build : null;
  const peg = !!params.peg;
  const MAX = 20;
  // The child's tray: the blank's side, or the built number's side (its last term).
  const slotSide = build || (left.includes('_') ? 'left' : 'right');
  const sideTerms = side => (side === 'left' ? left : right);
  const slotIndex = build ? sideTerms(build).length - 1 : sideTerms(slotSide).indexOf('_');
  const known = side => sideTerms(side).reduce((a, t, i) => (side === slotSide && i === slotIndex ? a : a + (Number(t) || 0)), 0);
  const other = slotSide === 'left' ? 'right' : 'left';
  const target = build ? Number(sideTerms(build)[slotIndex]) || 0 : known(other) - known(slotSide);

  const [dots, setDots] = useState(0);
  const [held, setHeld] = useState(peg);
  const L = known('left') + (slotSide === 'left' ? dots : 0);
  const R = known('right') + (slotSide === 'right' ? dots : 0);
  const angle = held ? 0 : Math.max(-10, Math.min(10, (R - L) * 2));

  useEffect(() => {
    if (build) {
      const total = s => sideTerms(s).reduce((a, t) => a + (Number(t) || 0), 0);
      const yes = total('left') === total('right');
      const misrules = [{ says: 'no', because: 'thought an equals sign needs an adding problem before it, with the answer after it' }]
        .filter(m => m.says !== (yes ? 'yes' : 'no'));
      lumina.answer(yes ? 'yes' : 'no', misrules, ['yes', 'no']);
      return;
    }
    const all = left.concat(right).reduce((a, t) => a + (Number(t) || 0), 0);
    const afterEquals = slotSide === 'right' && slotIndex === 0;
    const misrules = [
      { says: known(other), because: afterEquals
        ? 'thought the equals sign means the answer comes next, so put what the other side makes right after it'
        : 'put what the other side makes in the box, as if the box holds the answer, not the missing part' },
      { says: all, because: 'added every number shown, as if the equals sign were another plus' },
    ].filter((m, i, list) => m.says > 0 && m.says !== target && list.findIndex(x => x.says === m.says) === i);
    lumina.answer(target, misrules);
  }, []);

  useEffect(() => {
    lumina.goal(dots === target);
    const said = side => sideTerms(side).map((t, i) => (side === slotSide && i === slotIndex ? (build ? 'the dashed tray (empty to start)' : 'the box') : t)).join(' and ');
    lumina.scene({
      equation: left.join(' + ') + ' = ' + right.join(' + '),
      leftPanHolds: said('left'),
      rightPanHolds: said('right'),
      dotsInTheChildsTray: dots,
      balance: held ? 'held still by blocks' : angle === 0 ? 'level' : angle > 0 ? 'right pan lower' : 'left pan lower',
    });
  }, [dots, held]);

  const change = d => {
    setDots(n => Math.max(0, Math.min(MAX, n + d)));
    if (peg) setHeld(true);
  };

  const CX = 340, PIVOT = 262, ARM = 170, PAN_W = 290;
  const panX = side => (side === 'left' ? CX - ARM : CX + ARM);
  const rad = (angle * Math.PI) / 180;
  const drop = side => (side === 'left' ? -1 : 1) * ARM * Math.sin(rad);
  const PITCH = 22, PAD = 8;
  const trayW = n => Math.min(Math.max(n, 1), 5) * PITCH + PAD * 2 - 4;
  const trayH = n => Math.ceil(Math.max(n, 1) / 5) * PITCH + PAD * 2 - 4;
  const SLOT_W = trayW(5), SLOT_H = trayH(MAX);
  const dotGrid = (n, x, y, fill, key) => Array.from({ length: n }, (_, i) => (
    <circle key={key + i} cx={x + PAD + 9 + (i % 5) * PITCH} cy={y + PAD + 9 + Math.floor(i / 5) * PITCH} r="8.5" fill={fill} />
  ));
  const pan = side => {
    const list = sideTerms(side);
    const widths = list.map((t, i) => (side === slotSide && i === slotIndex ? SLOT_W : trayW(Number(t) || 0)));
    const total = widths.reduce((a, w) => a + w, 0) + 14 * (widths.length - 1);
    let x = panX(side) - total / 2;
    const TOP = 238;
    return (
      <g style={{ transform: `translateY(${drop(side)}px)`, transition: 'transform 0.35s ease' }}>
        <line x1={panX(side)} y1={TOP + 10} x2={panX(side)} y2={PIVOT} stroke="#64748b" strokeWidth="4" />
        <rect x={panX(side) - PAN_W / 2} y={TOP} width={PAN_W} height="12" rx="6" fill="#334155" stroke="#64748b" strokeWidth="2" />
        {list.map((t, i) => {
          const x0 = x; x += widths[i] + 14;
          if (side === slotSide && i === slotIndex) return (
            <g key={'s' + i}>
              <rect id="box-tray" x={x0} y={TOP - SLOT_H - 4} width={SLOT_W} height={SLOT_H} rx="10" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="6 5" />
              {dotGrid(dots, x0, TOP - SLOT_H - 4, '#22d3ee', 'd')}
            </g>
          );
          const n = Number(t) || 0, h = trayH(n);
          return (
            <g key={'g' + i}>
              <rect x={x0} y={TOP - h - 4} width={widths[i]} height={h} rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              {dotGrid(n, x0, TOP - h - 4, '#fbbf24', 'k' + i)}
            </g>
          );
        })}
      </g>
    );
  };

  // The printed equation: the left side over the left pan, the right side over the right pan, = over the post.
  const eqSide = side => {
    const list = sideTerms(side);
    const tokens = [];
    list.forEach((t, i) => { if (i) tokens.push('+'); tokens.push(side === slotSide && i === slotIndex && !build ? '_' : t); });
    const w = t => (t === '_' ? 52 : t === '+' ? 40 : 24 * t.length);
    const total = tokens.reduce((a, t) => a + w(t) + 8, -8);
    let x = panX(side) - total / 2;
    return tokens.map((t, i) => {
      const x0 = x; x += w(t) + 8;
      if (t === '_') return <rect key={side + i} x={x0} y="18" width="52" height="46" rx="8" fill="none" stroke="#e2e8f0" strokeWidth="2.5" strokeDasharray="6 5" />;
      return <text key={side + i} x={x0 + w(t) / 2} y="54" textAnchor="middle" fontSize="38" fill="#e2e8f0">{t}</text>;
    });
  };

  const sx = panX(slotSide);
  const step = (id, x, sign, d, can) => (
    <g id={id} onPointerDown={() => can && change(d)} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy="368" r="24" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y="378" textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );

  return (
    <Panel title="Pan Balance" caption={'Tap plus or minus to put dots in the dashed tray or take them out.' + (peg ? ' Tap Let go to let the balance move.' : '')}>
      <svg viewBox="0 0 680 400" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="400" fill="#0f172a" />
        {eqSide('left')}
        {eqSide('right')}
        <text x={CX} y="54" textAnchor="middle" fontSize="38" fill="#e2e8f0">=</text>

        {pan('left')}
        {pan('right')}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${PIVOT}px`, transition: 'transform 0.35s ease' }}>
          <rect x={CX - ARM - 12} y={PIVOT - 6} width={2 * ARM + 24} height="12" rx="6" fill="#94a3b8" />
        </g>
        <polygon points={`${CX},${PIVOT} ${CX - 30},322 ${CX + 30},322`} fill="#64748b" />
        <rect x={CX - 90} y="322" width="180" height="12" rx="6" fill="#475569" />
        <circle cx={CX} cy={PIVOT} r="7" fill="#e2e8f0" />
        {held && ['left', 'right'].map(s => (
          <rect key={s} x={panX(s) - 14} y={PIVOT + 8} width="28" height={334 - PIVOT - 8} rx="4" fill="#8b5e3c" stroke="#5c3d24" strokeWidth="2" />
        ))}

        {step('minus', sx - 52, '−', -1, dots > 0)}
        <text x={sx} y="374" textAnchor="middle" fontSize="16" fill="#cbd5e1">dots</text>
        {step('plus', sx + 52, '+', 1, dots < MAX)}
        {held && (
          <g id="let-go" onPointerDown={() => setHeld(false)} style={{ cursor: 'pointer' }}>
            <rect x={CX - 60} y="346" width="120" height="44" rx="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
            <text x={CX} y="374" textAnchor="middle" fontSize="18" fill="#e2e8f0">Let go</text>
          </g>
        )}
      </svg>
    </Panel>
  );
}
