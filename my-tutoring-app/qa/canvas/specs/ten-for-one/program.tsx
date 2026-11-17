// Ten for One (1.NBT.B.2). Loose cubes lie scattered on a mat (seeded places, turned a little, never in rows of ten,
// so the count is not read by eye). The child taps cubes to pick them up and snaps the picked cubes into a rod; a rod
// is whatever was picked, so a rod of nine is possible and is the child's own work. Tap a rod you made to take it
// apart. The goal is the property: every rod holds ten and fewer than ten cubes are left loose, in any order.
// Say and show: the child says how many cubes in all; the misrules are computed (each ten counted as one; only the
// loose cubes counted). Some problems start with tens already made (param madeTens), which cannot be taken apart, so
// a large number fits the mat.
function Display({ params, lumina }) {
  const n = Number(params?.n ?? 34);
  const madeTens = Number(params?.madeTens ?? 0);
  const layout = Number(params?.layout ?? 1);
  const looseAtStart = Math.max(0, n - madeTens * 10);

  const COLS = 8, ROWS = 7, CELL = 50, MX = 12, MY = 12;
  const SHELF_X = 424, SHELF_W = 244, ROD_PITCH = 46, ROD_W = 24, ROD_H = 190;

  // Each loose cube has a home cell on the mat, picked by a seeded shuffle, and a small seeded turn and shift.
  const homes = useMemo(() => {
    let s = (layout * 9973 + looseAtStart * 131) >>> 0 || 1;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const cells = Array.from({ length: COLS * ROWS }, (_, k) => k);
    for (let i = cells.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const t = cells[i]; cells[i] = cells[j]; cells[j] = t;
    }
    return cells.slice(0, Math.min(looseAtStart, cells.length)).map((k) => ({
      x: MX + (k % COLS) * CELL + CELL / 2,
      y: MY + Math.floor(k / COLS) * CELL + CELL / 2,
      dx: Math.round((rand() - 0.5) * 12),
      dy: Math.round((rand() - 0.5) * 12),
      turn: Math.round((rand() - 0.5) * 40),
    }));
  }, [looseAtStart, layout]);

  // rods: the tens already made (fixed) and the rods the child snapped, in the order made.
  const [rods, setRods] = useState(() => Array.from({ length: madeTens }, (_, i) => ({ id: 'given-' + i, cubes: null, size: 10 })));
  const [picked, setPicked] = useState([]);
  const nextId = useRef(0);

  const inRods = new Set();
  rods.forEach((r) => { if (r.cubes) r.cubes.forEach((c) => inRods.add(c)); });
  const loose = homes.map((_, i) => i).filter((i) => !inRods.has(i));

  useEffect(() => {
    const tens = Math.floor(n / 10), ones = n % 10;
    const misrules = [
      { says: tens + ones, because: 'counted each ten as one, not as ten' },
      ones > 0 ? { says: ones, because: 'counted only the loose cubes and left out the tens' } : null,
    ].filter((m, i, all) => m && m.says !== n && all.findIndex((x) => x && x.says === m.says) === i);
    lumina.answer(n, misrules);
  }, []);

  useEffect(() => {
    lumina.goal(rods.every((r) => r.size === 10) && loose.length < 10);
    lumina.scene({
      cubesLooseOnMat: loose.length,
      cubesPickedUp: picked.length,
      rodsOnShelf: rods.length,
      cubesInEachRod: rods.map((r) => r.size),
      rodsMadeBeforeTheChildStarted: madeTens,
    });
  }, [rods, picked]);

  const toggle = (i) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.concat(i)));
  const snap = () => {
    if (!picked.length || rods.length >= 10) return;
    const id = 'rod-' + nextId.current;
    nextId.current += 1;
    setRods((r) => r.concat({ id, cubes: picked, size: picked.length }));
    setPicked([]);
  };
  const breakRod = (id) => setRods((r) => r.filter((x) => x.id !== id || !x.cubes));

  const CUBE = '#60a5fa', CUBE_EDGE = '#1e3a8a', CUBE_TOP = '#93c5fd';

  const cube = (i) => {
    const h = homes[i];
    const up = picked.includes(i);
    return (
      <g key={'cube-' + i} id={'cube-' + i} onClick={() => toggle(i)} style={{ cursor: 'pointer' }} transform={'translate(' + h.x + ',' + h.y + ')'}>
        <rect x={-22} y={-22} width={44} height={44} fill="transparent" />
        <g transform={'translate(' + h.dx + ',' + (h.dy - (up ? 5 : 0)) + ') rotate(' + h.turn + ')'} pointerEvents="none">
          {up ? <rect x={-17} y={-13} width={34} height={34} rx={5} fill="#020617" opacity={0.5} /> : null}
          <rect x={-15} y={-15} width={30} height={30} rx={4} fill={CUBE} stroke={up ? '#fbbf24' : CUBE_EDGE} strokeWidth={up ? 4 : 2} />
          <rect x={-10} y={-10} width={20} height={20} rx={3} fill="none" stroke={CUBE_TOP} strokeWidth={1.5} opacity={0.7} />
        </g>
      </g>
    );
  };

  const rod = (r, slot) => {
    const cx = SHELF_X + 12 + ROD_PITCH / 2 + (slot % 5) * ROD_PITCH;
    const top = MY + 10 + Math.floor(slot / 5) * (ROD_H + 16);
    // One cube is always the same height, so a rod's length is its count: 9 is shorter than a ten and 11 longer. Past
    // 12 cubes the rod would reach the next row, so it squeezes to the row's height (still longer than a ten).
    const seg = r.size <= 12 ? 17 : (ROD_H + 14) / r.size;
    const h = seg * r.size;
    const body = (
      <g pointerEvents="none">
        {Array.from({ length: r.size }, (_, k) => (
          <rect key={k} x={cx - ROD_W / 2} y={top + k * seg} width={ROD_W} height={seg} fill={CUBE} stroke={CUBE_EDGE} strokeWidth={1.5} />
        ))}
        <rect x={cx - ROD_W / 2 - 2} y={top + h / 2 - 3} width={ROD_W + 4} height={6} rx={3} fill="#94a3b8" />
      </g>
    );
    if (!r.cubes) return <g key={r.id}>{body}</g>;
    return (
      <g key={r.id} id={r.id} onClick={() => breakRod(r.id)} style={{ cursor: 'pointer' }}>
        <rect x={cx - 22} y={top - 4} width={44} height={Math.max(44, h + 8)} fill="transparent" />
        {body}
      </g>
    );
  };

  const canSnap = picked.length > 0 && rods.length < 10;
  const VH = 432;

  return (
    <Panel title="Ten for One" caption="Tap cubes to pick them up, then snap them into a rod. Tap a rod you made to take it apart.">
      <svg viewBox={'0 0 680 ' + VH} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'manipulation' }}>
        <rect width="680" height={VH} fill="#0f172a" />
        <rect x={MX - 4} y={MY - 4} width={COLS * CELL + 8} height={ROWS * CELL + 8} rx={14} fill="#1e293b" stroke="#475569" strokeWidth={2} />
        <rect x={SHELF_X} y={MY - 4} width={SHELF_W} height={VH - MY - 4} rx={14} fill="#1e293b" stroke="#475569" strokeWidth={2} />
        {rods.map((r, slot) => rod(r, slot))}
        {loose.map((i) => cube(i))}
        {canSnap ? (
          <g id="snap" onClick={snap} style={{ cursor: 'pointer' }}>
            <rect x={MX + COLS * CELL / 2 - 110} y={MY + ROWS * CELL + 14} width={220} height={48} rx={12} fill="#334155" stroke="#64748b" strokeWidth={2} />
            <text x={MX + COLS * CELL / 2} y={MY + ROWS * CELL + 44} textAnchor="middle" fontSize={19} fontWeight={700} fill="#e2e8f0">Snap into a rod</text>
          </g>
        ) : null}
      </svg>
    </Panel>
  );
}
