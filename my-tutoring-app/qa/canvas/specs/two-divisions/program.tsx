// Two divisions (3.OA.A.2). A yard of crates, an order card and a row of trucks. The child chooses how many trucks to
// bring (a stepper) and loads crates onto them one at a time, so the child can build either picture of a division:
// a given number of trucks with the same load on each (how many in each group), or trucks that each carry a given
// load (how many groups). The order card says which one is fixed; the goal checks the structure the child built
// (number of trucks and crates on each), so the misrule build, the number in the question used as the trucks either
// way, fails Check even when the number the child says is right. Say and show: the answer is one number.
function Display({ params, lumina }) {
  const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : d);
  // params.total: crates in the yard. params.given: the number the order fixes.
  // params.mode: 'trucks' (the order fixes how many trucks: how many crates on each?) or 'per' (the order fixes the
  // crates on each truck: how many trucks?). params.start: trucks parked at the start.
  const total = Math.min(18, num(params.total, 12));
  const given = num(params.given, 3);
  const mode = params.mode === 'per' ? 'per' : 'trucks';
  const MAX_TRUCKS = 7, MAX_LOAD = 8;
  const start = Math.min(MAX_TRUCKS, num(params.start, 1));

  const [loads, setLoads] = useState(() => Array.from({ length: start }, () => 0));
  const onTrucks = loads.reduce((s, x) => s + x, 0);
  const yard = total - onTrucks;

  // The structure the order asks for.
  const wantTrucks = mode === 'trucks' ? given : total / given;
  const wantEach = mode === 'trucks' ? total / given : given;
  const answer = mode === 'trucks' ? wantEach : wantTrucks;

  useEffect(() => {
    // The misrule: the number in the question taken as the other kind of group, and that number read back off the build.
    const says = given;
    const because = mode === 'trucks'
      ? 'put ' + given + ' crates on each truck instead of using ' + given + ' trucks, then said the crates on a truck'
      : 'brought ' + given + ' trucks instead of putting ' + given + ' crates on each, then counted the trucks';
    lumina.answer(answer, says !== answer ? [{ says, because }] : []);
  }, []);

  useEffect(() => {
    const met = yard === 0 && loads.length === wantTrucks && loads.every(x => x === wantEach);
    lumina.goal(met);
    lumina.scene({
      order: mode === 'trucks' ? 'use ' + given + ' trucks with the same load on each' : 'put ' + given + ' crates on each truck',
      cratesInYard: yard,
      trucksBrought: loads.length,
      cratesOnEachTruck: loads,
    });
  }, [loads]);

  // ---------- what the child does ----------
  const load = i => {
    if (yard <= 0 || loads[i] >= MAX_LOAD) return;
    setLoads(l => l.map((x, k) => (k === i ? x + 1 : x)));
  };
  const unload = i => {
    if (!loads[i]) return;
    setLoads(l => l.map((x, k) => (k === i ? x - 1 : x)));
  };
  // Sending a truck away puts its crates back in the yard.
  const more = () => { if (loads.length < MAX_TRUCKS) setLoads(l => l.concat([0])); };
  const fewer = () => { if (loads.length > 1) setLoads(l => l.slice(0, -1)); };

  // ---------- the drawing ----------
  const W = 720, H = 432, GROUND = 340, C = 32;
  const crate = (x, y, key, s = C) => (
    <g key={key}>
      <rect x={x} y={y} width={s - 2} height={s - 2} rx="3" fill="#b45309" stroke="#78350f" strokeWidth="2" />
      <path d={'M ' + (x + 3) + ' ' + (y + 3) + ' L ' + (x + s - 5) + ' ' + (y + s - 5) + ' M ' + (x + s - 5) + ' ' + (y + 3) + ' L ' + (x + 3) + ' ' + (y + s - 5)} stroke="#78350f" strokeWidth="2" />
    </g>
  );

  // The yard: crates in rows of nine, the ones left after loading.
  const yardCrates = Array.from({ length: yard }, (_, i) => crate(36 + (i % 9) * 34, 52 + Math.floor(i / 9) * 34, 'y' + i));

  // The trucks, centred in a row.
  const SLOT = 98, n = loads.length, x0 = (W - n * SLOT) / 2 + 2;
  const BED_Y = GROUND - 46, BED_W = 70;
  const truck = (i) => {
    const x = x0 + i * SLOT, k = loads[i];
    const rows = Math.ceil(k / 2), stackTop = BED_Y - Math.max(rows * 34, 46);
    const canLoad = yard > 0 && k < MAX_LOAD;
    return (
      <g key={'t' + i}>
        <g id={'crates-' + i} onPointerDown={k ? () => unload(i) : undefined} style={{ cursor: k ? 'pointer' : 'default' }}>
          {k ? <rect x={x - 2} y={stackTop} width={BED_W + 4} height={BED_Y - stackTop} fill="transparent" /> : null}
          {Array.from({ length: k }, (_, j) => crate(x + 2 + (j % 2) * 34, BED_Y - 34 - Math.floor(j / 2) * 34, 'c' + i + '-' + j))}
        </g>
        <g id={'truck-' + i} onPointerDown={() => load(i)} style={{ cursor: canLoad ? 'pointer' : 'default' }}>
          <rect x={x - 2} y={BED_Y - 26} width={SLOT - 6} height={GROUND - BED_Y + 26} fill="transparent" />
          <rect x={x} y={BED_Y} width={BED_W} height="18" rx="3" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
          <rect x={x + BED_W} y={BED_Y - 26} width="22" height="44" rx="5" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
          <rect x={x + BED_W + 5} y={BED_Y - 20} width="12" height="12" rx="2" fill="#bae6fd" />
          <circle cx={x + 16} cy={GROUND - 12} r="10" fill="#111827" stroke="#6b7280" strokeWidth="2" />
          <circle cx={x + BED_W + 8} cy={GROUND - 12} r="10" fill="#111827" stroke="#6b7280" strokeWidth="2" />
        </g>
      </g>
    );
  };

  const step = (id, cx, sign, act, can) => (
    <g id={id} onPointerDown={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={cx} cy={GROUND + 50} r="24" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={cx} y={GROUND + 59} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );

  const orderLines = mode === 'trucks'
    ? ['Use ' + given + ' trucks.', 'The same load on each.']
    : ['Put ' + given + ' crates', 'on each truck.'];

  return (
    <Panel title="Crate Yard" caption="Tap plus or minus to bring trucks. Tap a truck to load a crate; tap its crates to take one off.">
      <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="20" y="22" width="340" height="122" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x="36" y="44" fontSize="15" fill="#cbd5e1">Yard</text>
        <g id="yard">{yardCrates}</g>

        <g id="order">
          <rect x="430" y="22" width="270" height="104" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          <text x="448" y="48" fontSize="15" fill="#94a3b8">Order</text>
          <text x="448" y="78" fontSize="20" fontWeight="700" fill="#e2e8f0">{orderLines[0]}</text>
          <text x="448" y="106" fontSize="20" fontWeight="700" fill="#e2e8f0">{orderLines[1]}</text>
        </g>

        <rect x="0" y={GROUND} width={W} height="4" fill="#475569" />
        {loads.map((_, i) => truck(i))}

        {step('fewer', W / 2 - 80, '−', fewer, n > 1)}
        <text x={W / 2} y={GROUND + 56} textAnchor="middle" fontSize="16" fill="#cbd5e1">trucks</text>
        {step('more', W / 2 + 80, '+', more, n < MAX_TRUCKS)}
      </svg>
    </Panel>
  );
}
