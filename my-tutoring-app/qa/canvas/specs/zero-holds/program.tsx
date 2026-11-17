// Zero holds an empty place (2.NBT.A.3). Base-ten blocks lie loose on a mat: thousands cubes, hundreds flats, tens
// rods and ones cubes, not sorted into columns, so the child reads each kind. Beside them a row of digit dials, one per
// place, each starting blank or at a wrong digit. The child turns the dials to write the number the blocks show. A
// blank dial writes no digit, so leaving the empty place blank writes the misrule number (3 _ 5 reads 35). Nothing
// prints a count, a place name or the number. Say and show: the number is one sayable value.
function Display({ params, lumina }) {
  const num = (v, d) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? d : Number(v));
  const th = num(params.thousands, 0), hu = num(params.hundreds, 0), te = num(params.tens, 0), on = num(params.ones, 0);
  const n = th * 1000 + hu * 100 + te * 10 + on;
  const key = String(n);
  const dialCount = Math.max(1, Math.min(4, num(params.dials, key.length)));
  const startRaw = Array.isArray(params.start) ? params.start : [];
  const seed = num(params.layout, 1);
  const PLACES = ['ones', 'tens', 'hundreds', 'thousands'];
  const placeOf = (i) => PLACES[dialCount - 1 - i];

  // A dial holds -1 (blank, no digit) or a digit 0-9.
  const [dials, setDials] = useState(() => Array.from({ length: dialCount }, (_, i) => {
    const v = startRaw[i];
    return v === null || v === undefined || v === '' ? -1 : Math.max(-1, Math.min(9, Number(v)));
  }));
  const written = dials.filter((d) => d >= 0).join('');

  useEffect(() => {
    // Misrules, each computed from the number and filtered against the answer and each other.
    const slid = (s) => PLACES[s.length - 1];
    const empties = (key.match(/0/g) || []).length;
    const cands = [];
    const allOut = key.replace(/0/g, '');
    if (allOut) cands.push({ says: allOut, because: 'left out the empty place' + (empties > 1 ? 's' : '') + ', so the ' + key[0] + ' slid into the ' + slid(allOut) });
    const oneZero = key.replace(/0+/g, '0');
    cands.push({ says: oneZero, because: 'wrote one zero for ' + (['', 'one', 'two', 'three'][empties] || empties) + ' empty places, so the ' + key[0] + ' slid into the ' + slid(oneZero) });
    const innerOut = key.replace(/0+(?=[1-9])/g, '');
    cands.push({ says: innerOut, because: 'kept the zero at the end but left out the empty place in the middle, so the ' + key[0] + ' slid into the ' + slid(innerOut) });
    const endOut = key.replace(/0+$/, '');
    if (endOut) cands.push({ says: endOut, because: 'left off the zero at the end, so the ' + endOut[endOut.length - 1] + ' slid into the ones' });
    if (!key.includes('0') && key.length > 1) {
      const extra = key[0] + '0' + key.slice(1);
      cands.push({ says: extra, because: 'put a zero where no place is empty, so the ' + key[0] + ' jumped into the ' + slid(extra) });
    }
    const misrules = [];
    for (const m of cands) {
      if (m.says === key || misrules.some((x) => x.says === Number(m.says))) continue;
      misrules.push({ says: Number(m.says), because: m.because });
    }
    lumina.answer(n, misrules.slice(0, 3));
  }, []);

  useEffect(() => {
    // A blank only on the left: 3, blank, 5 writes no number in the tens place, so it is not 35.
    const firstDigit = dials.findIndex((d) => d >= 0);
    const gapAfterDigit = firstDigit >= 0 && dials.slice(firstDigit).some((d) => d < 0);
    lumina.goal(written === key && !gapAfterDigit);
    lumina.scene({
      blocksOnTheMat: { thousandsCubes: th, hundredsFlats: hu, tensRods: te, onesCubes: on },
      blocksAreSortedIntoColumns: false,
      dialsLeftToRight: dials.map((d) => (d < 0 ? 'blank' : d)),
    });
  }, [dials]);

  const turn = (i, by) => setDials((ds) => ds.map((d, k) => (k === i ? Math.max(-1, Math.min(9, d + by)) : d)));

  // ---- Loose layout of the blocks, seeded so each problem's mat differs ----
  const U = 9, S = U * 10, DEP = 28;
  const FIELD = { x: 34, y: 30, w: 612, h: 262 };
  const pieces = useMemo(() => {
    let a = (seed * 2654435761) >>> 0 || 1;
    const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const list = [];
    for (let k = 0; k < th; k += 1) list.push({ kind: 'thousand', w: S + DEP, h: S + DEP });
    for (let k = 0; k < hu; k += 1) list.push({ kind: 'hundred', w: S + 4, h: S + 4 });
    for (let k = 0; k < te; k += 1) { const up = rnd() < 0.5; list.push({ kind: 'ten', up, w: up ? U + 3 : S + 3, h: up ? S + 3 : U + 3 }); }
    for (let k = 0; k < on; k += 1) list.push({ kind: 'one', w: U + 3, h: U + 3 });
    const placed = [];
    const hits = (p, pad) => placed.some((q) => p.x < q.x + q.w + pad && q.x < p.x + p.w + pad && p.y < q.y + q.h + pad && q.y < p.y + p.h + pad);
    for (const b of list) {
      let spot = null;
      for (const pad of [22, 12, 4]) {
        for (let t = 0; t < 400 && !spot; t += 1) {
          const p = { ...b, x: FIELD.x + rnd() * (FIELD.w - b.w), y: FIELD.y + rnd() * (FIELD.h - b.h) };
          if (!hits(p, pad)) spot = p;
        }
        if (spot) break;
      }
      placed.push(spot || { ...b, x: FIELD.x + rnd() * (FIELD.w - b.w), y: FIELD.y + rnd() * (FIELD.h - b.h) });
    }
    return placed;
  }, [th, hu, te, on, seed]);

  const FACE = '#f2c879', TOP = '#f9dfab', SIDE = '#d39f4f', EDGE = '#7c4a14', GRID = '#a8742f';
  const grid = (x, y, w, h, cols, rows) => {
    const out = [];
    for (let i = 1; i < cols; i += 1) out.push(<line key={'v' + i} x1={x + (i * w) / cols} y1={y} x2={x + (i * w) / cols} y2={y + h} stroke={GRID} strokeWidth="0.8" />);
    for (let j = 1; j < rows; j += 1) out.push(<line key={'h' + j} x1={x} y1={y + (j * h) / rows} x2={x + w} y2={y + (j * h) / rows} stroke={GRID} strokeWidth="0.8" />);
    return out;
  };
  const block = (p, i) => {
    const { x, y } = p;
    if (p.kind === 'thousand') {
      const fy = y + DEP;
      const topLines = [], sideLines = [];
      for (let k = 1; k < 10; k += 1) {
        topLines.push(<line key={'t' + k} x1={x + k * U} y1={fy} x2={x + k * U + DEP} y2={y} stroke={GRID} strokeWidth="0.7" />);
        sideLines.push(<line key={'s' + k} x1={x + S} y1={fy + k * U} x2={x + S + DEP} y2={y + k * U} stroke={GRID} strokeWidth="0.7" />);
        const o = (k * DEP) / 10;
        topLines.push(<line key={'tt' + k} x1={x + o} y1={fy - o} x2={x + S + o} y2={fy - o} stroke={GRID} strokeWidth="0.7" />);
        sideLines.push(<line key={'ss' + k} x1={x + S + o} y1={fy - o} x2={x + S + o} y2={fy + S - o} stroke={GRID} strokeWidth="0.7" />);
      }
      return (
        <g key={i}>
          <polygon points={`${x},${fy} ${x + DEP},${y} ${x + DEP + S},${y} ${x + S},${fy}`} fill={TOP} stroke={EDGE} strokeWidth="1.5" />
          <polygon points={`${x + S},${fy} ${x + S + DEP},${y} ${x + S + DEP},${y + S} ${x + S},${fy + S}`} fill={SIDE} stroke={EDGE} strokeWidth="1.5" />
          {topLines}{sideLines}
          <rect x={x} y={fy} width={S} height={S} fill={FACE} stroke={EDGE} strokeWidth="1.5" />
          {grid(x, fy, S, S, 10, 10)}
        </g>
      );
    }
    if (p.kind === 'hundred') {
      return (
        <g key={i}>
          <rect x={x + 4} y={y + 4} width={S} height={S} fill={SIDE} stroke={EDGE} strokeWidth="1.2" />
          <rect x={x} y={y} width={S} height={S} fill={FACE} stroke={EDGE} strokeWidth="1.5" />
          {grid(x, y, S, S, 10, 10)}
        </g>
      );
    }
    if (p.kind === 'ten') {
      const w = p.up ? U : S, h = p.up ? S : U;
      return (
        <g key={i}>
          <rect x={x + 3} y={y + 3} width={w} height={h} fill={SIDE} stroke={EDGE} strokeWidth="1" />
          <rect x={x} y={y} width={w} height={h} fill={FACE} stroke={EDGE} strokeWidth="1.3" />
          {grid(x, y, w, h, p.up ? 1 : 10, p.up ? 10 : 1)}
        </g>
      );
    }
    return (
      <g key={i}>
        <rect x={x + 3} y={y + 3} width={U} height={U} fill={SIDE} stroke={EDGE} strokeWidth="1" />
        <rect x={x} y={y} width={U} height={U} fill={FACE} stroke={EDGE} strokeWidth="1.3" />
      </g>
    );
  };

  // ---- The dials ----
  const DW = 96, DG = 22, DY = 322, BTN = 50;
  const dx0 = (680 - (dialCount * DW + (dialCount - 1) * DG)) / 2;
  const arrow = (id, cx, cy, up, act, can) => (
    <g id={id} onPointerDown={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.3}>
      <rect x={cx - 34} y={cy - BTN / 2} width="68" height={BTN} rx="12" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <polygon points={up ? `${cx - 13},${cy + 8} ${cx + 13},${cy + 8} ${cx},${cy - 10}` : `${cx - 13},${cy - 8} ${cx + 13},${cy - 8} ${cx},${cy + 10}`} fill="#e2e8f0" />
    </g>
  );
  const dial = (i) => {
    const x = dx0 + i * (DW + DG), cx = x + DW / 2, d = dials[i], place = placeOf(i);
    return (
      <g key={place} id={'dial-' + place}>
        <rect x={x} y={DY} width={DW} height="206" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {arrow('dial-' + place + '-up', cx, DY + 36, true, () => turn(i, 1), d < 9)}
        <rect x={cx - 34} y={DY + 70} width="68" height="66" rx="10" fill="#0f172a" stroke="#475569" strokeWidth="2" strokeDasharray={d < 0 ? '6 5' : undefined} />
        {d >= 0 ? <text x={cx} y={DY + 104} textAnchor="middle" dominantBaseline="middle" fontSize="44" fontWeight="800" fill="#e2e8f0">{d}</text> : null}
        {arrow('dial-' + place + '-down', cx, DY + 170, false, () => turn(i, -1), d > -1)}
      </g>
    );
  };

  return (
    <Panel title="Block Number" caption="Tap the arrows on a dial to turn its digit up or down.">
      <svg viewBox="0 0 680 540" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="540" fill="#0f172a" />
        <rect id="mat" x="16" y="12" width="648" height="298" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {pieces.map(block)}
        {dials.map((_, i) => dial(i))}
      </svg>
    </Panel>
  );
}
