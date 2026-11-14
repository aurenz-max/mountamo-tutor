function Display({ params, lumina }) {
  const a = Math.max(2, Math.min(12, Number(params.frog) || 3));
  const b = Math.max(2, Math.min(12, Number(params.hopper) || 4));
  const N = Math.max(10, Math.min(40, Number(params.pads) || 30));
  const hops = params.hops !== false;
  const find = params.find === 'all' ? 'all' : 'first';

  const [fa, setFa] = useState(0); // frog's pad
  const [fb, setFb] = useState(0); // grasshopper's pad
  const [flowers, setFlowers] = useState([]);

  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  const lcm = (a * b) / gcd(a, b);
  const common = [];
  for (let n = lcm; n <= N; n += lcm) common.push(n);

  const landedA = [], landedB = [];
  for (let n = a; n <= fa; n += a) landedA.push(n);
  for (let n = b; n <= fb; n += b) landedB.push(n);

  useEffect(() => {
    const set = flowers.slice().sort((x, y) => x - y);
    const met = find === 'first'
      ? set.length === 1 && set[0] === lcm
      : set.length === common.length && set.every((v, i) => v === common[i]);
    lumina.goal(met);
    lumina.scene({
      frogJumpsBy: a,
      grasshopperJumpsBy: b,
      padsNumbered: `1 to ${N}`,
      ...(hops ? { padsTheFrogLandedOn: landedA, padsTheGrasshopperLandedOn: landedB } : { hopButtons: 'none: the animals are asleep on the start log' }),
      flowersOnPads: set,
    });
  }, [fa, fb, flowers]);

  const W = 680, PER = 10, SP = 58, X0 = 112, Y0 = 150, RG = 80;
  const rows = Math.ceil(N / PER);
  const H = Y0 + (rows - 1) * RG + 60;
  const pos = n => (n === 0 ? [44, Y0] : [X0 + ((n - 1) % PER) * SP, Y0 + Math.floor((n - 1) / PER) * RG]);
  const toggle = n => setFlowers(f => (f.includes(n) ? f.filter(x => x !== n) : [...f, n]));

  const btn = (id, x, label, onClick, dim) => (
    <g id={id} onClick={dim ? undefined : onClick} style={{ cursor: dim ? 'default' : 'pointer' }} opacity={dim ? 0.35 : 1}>
      <rect x={x} y={26} width="190" height="48" rx="12" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <text x={x + 95} y={57} textAnchor="middle" fontSize="18" fill="#e2e8f0">{label}</text>
    </g>
  );

  const [ax, ay] = pos(fa), [bx, by] = pos(fb);
  return (
    <Panel title="Lily Pad Pond" caption={hops ? 'Tap a hop button to make that animal jump. Tap a pad to put a flower on it or take it off.' : 'Tap a pad to put a flower on it or take it off.'}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="14" y={Y0 - 44} width={W - 28} height={H - Y0 + 34} rx="18" fill="#0c4a6e" opacity="0.55" />
        {hops && btn('hop-frog', 40, `🐸 hop ${a}`, () => setFa(p => p + a), fa + a > N)}
        {hops && btn('hop-hopper', 250, `🦗 hop ${b}`, () => setFb(p => p + b), fb + b > N)}
        {!hops && <text x="40" y="58" fontSize="18" fill="#cbd5e1">{`🐸 jumps ${a} pads each hop.  🦗 jumps ${b} pads each hop.`}</text>}

        {/* start log */}
        <rect x="18" y={Y0 - 16} width="54" height="32" rx="12" fill="#78350f" stroke="#451a03" strokeWidth="2" />
        <text x="45" y={Y0 + 36} textAnchor="middle" fontSize="13" fill="#94a3b8">start</text>

        {Array.from({ length: N }, (_, k) => {
          const n = k + 1, [x, y] = pos(n);
          return (
            <g key={'pad' + n} id={'pad-' + n} onClick={() => toggle(n)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r="25" fill="#166534" stroke="#14532d" strokeWidth="2" />
              <path d={`M ${x} ${y} L ${x + 25} ${y - 6} A 25 25 0 0 0 ${x + 22} ${y - 13} Z`} fill="#0c4a6e" opacity="0.55" />
              <text x={x} y={y + 6} textAnchor="middle" fontSize="16" fontWeight="600" fill="#e2e8f0">{n}</text>
              {landedA.includes(n) && <circle cx={x - 15} cy={y + 17} r="6" fill="#34d399" stroke="#0f172a" strokeWidth="1.5" />}
              {landedB.includes(n) && <circle cx={x + 15} cy={y + 17} r="6" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.5" />}
              {flowers.includes(n) && <text x={x} y={y + 36} textAnchor="middle" fontSize="20">🌸</text>}
            </g>
          );
        })}

        {hops && <text x={ax - 12} y={ay - 18} textAnchor="middle" fontSize="24" pointerEvents="none">🐸</text>}
        {hops && <text x={bx + 13} y={by - 18} textAnchor="middle" fontSize="22" pointerEvents="none">🦗</text>}
        {!hops && <text x="34" y={Y0 - 6} textAnchor="middle" fontSize="24" pointerEvents="none">🐸</text>}
        {!hops && <text x="56" y={Y0 - 6} textAnchor="middle" fontSize="22" pointerEvents="none">🦗</text>}
      </svg>
    </Panel>
  );
}
