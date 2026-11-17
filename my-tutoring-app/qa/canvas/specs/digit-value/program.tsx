// Digit value (2.NBT.A.1). A number is printed in large digits with one digit underlined. Below it an empty tray and
// one stepper per block kind the number has places for (thousands cubes, hundreds flats, tens rods, ones cubes). The
// child builds the value of the underlined digit alone, so the thing the rule is about (which place the digit sits in)
// decides which block they take. No count or value is printed: the tray shows blocks, the steppers name block kinds.
// Say and show: the digit's value is one sayable whole number; Check judges the tray (the place's block, that many).
function Display({ params, lumina }) {
  const digits = String(params.number ?? 38).replace(/\D/g, '') || '38';
  const at = Math.min(digits.length - 1, Math.max(0, Number(params.underline) || 0));
  const len = digits.length, digit = Number(digits[at]);
  const KINDS = [
    { key: 'thousands', size: 1000, color: '#818cf8' },
    { key: 'hundreds', size: 100, color: '#fbbf24' },
    { key: 'tens', size: 10, color: '#22d3ee' },
    { key: 'ones', size: 1, color: '#34d399' },
  ].slice(4 - Math.min(4, len));
  const place = KINDS.find(k => k.size === 10 ** (len - 1 - at));
  const MAX = 9;
  const [built, setBuilt] = useState({ thousands: 0, hundreds: 0, tens: 0, ones: 0 });

  useEffect(() => {
    const value = digit * 10 ** (len - 1 - at);
    const misrules = [
      { says: digit, because: 'said the digit, not what its place makes it worth' },
      { says: digit * 10 ** at, because: 'counted the places from the left, as if the first digit were the ones' },
      { says: Number(digits), because: 'said the whole number, not the underlined digit\'s value' },
    ].filter((m, i, all) => m.says !== value && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(value, misrules);
  }, []);
  useEffect(() => {
    const onlyPlace = KINDS.every(k => (k.key === place.key ? built[k.key] === digit : built[k.key] === 0));
    lumina.goal(digit > 0 && onlyPlace);
    const scene = { numberShown: Number(digits), underlinedDigit: digit, underlinedDigitPositionFromLeft: at + 1, digitsInNumber: len };
    KINDS.forEach(k => { scene[k.key + 'BlocksInTray'] = built[k.key]; });
    lumina.scene(scene);
  }, [built]);

  const change = (key, d) => setBuilt(b => ({ ...b, [key]: Math.min(MAX, Math.max(0, b[key] + d)) }));

  // The number: each character placed on its own, so the underline sits under exactly one digit.
  const chars = [];
  digits.split('').forEach((c, i) => {
    chars.push({ c, i });
    if (len > 3 && i === len - 4) chars.push({ c: ',', i: -1 });
  });
  const widthOf = ch => (ch.c === ',' ? 26 : 58);
  const totalW = chars.reduce((s, ch) => s + widthOf(ch), 0);
  let cursor = 340 - totalW / 2;
  const placed = chars.map(ch => { const x = cursor + widthOf(ch) / 2; cursor += widthOf(ch); return { ...ch, x }; });
  const under = placed.find(ch => ch.i === at);

  // Blocks, drawn flat in the tray. Each kind sits in its own column of the tray, largest on the left.
  const TRAY = { x: 20, y: 124, w: 640, h: 178 };
  // Bigger blocks get wider columns; the steppers below are spaced evenly.
  const WEIGHT = { thousands: 1.4, hundreds: 1.25, tens: 0.9, ones: 0.8 };
  const weightSum = KINDS.reduce((s, k) => s + WEIGHT[k.key], 0);
  const cols = KINDS.reduce((out, k) => {
    const x = out.length ? out[out.length - 1].x + out[out.length - 1].w : TRAY.x;
    return out.concat({ x, w: (TRAY.w * WEIGHT[k.key]) / weightSum });
  }, []);
  const sx = i => TRAY.x + (TRAY.w / KINDS.length) * (i + 0.5), CY = TRAY.y + TRAY.h / 2;
  const cells = (x, y, n, cell, color) => Array.from({ length: n }, (_, r) => Array.from({ length: n }, (__, c) => (
    <rect key={r + '-' + c} x={x + c * cell} y={y + r * cell} width={cell} height={cell} fill={color} stroke="#0f172a" strokeWidth="1" />
  )));
  const thousand = (x, y, s, color, k) => {
    const d = s * 0.22;
    return (
      <g key={k}>
        <polygon points={`${x},${y} ${x + d},${y - d} ${x + s + d},${y - d} ${x + s},${y}`} fill={color} stroke="#0f172a" strokeWidth="1.5" opacity="0.8" />
        <polygon points={`${x + s},${y} ${x + s + d},${y - d} ${x + s + d},${y + s - d} ${x + s},${y + s}`} fill={color} stroke="#0f172a" strokeWidth="1.5" opacity="0.6" />
        {cells(x, y, 10, s / 10, color)}
        {edge(x, y, s)}
      </g>
    );
  };
  const edge = (x, y, s) => <rect x={x} y={y} width={s} height={s} fill="none" stroke="#0f172a" strokeWidth="2.5" />;
  const hundred = (x, y, s, color, k) => <g key={k}>{cells(x, y, 10, s / 10, color)}{edge(x, y, s)}</g>;
  const ten = (x, y, w, color, k) => (
    <g key={k}>{Array.from({ length: 10 }, (_, r) => <rect key={r} x={x} y={y + r * w} width={w} height={w} fill={color} stroke="#0f172a" strokeWidth="1" />)}</g>
  );
  const pile = (kind, n, i) => {
    const col = cols[i], x0 = col.x + col.w / 2, out = [];
    // Cubes and flats sit side by side while they fit in the column, then overlap, so each one still shows.
    const spread = (w, gap) => (n > 1 ? Math.min(w + gap, (col.w - w - 12) / (n - 1)) : 0);
    if (kind.key === 'thousands') {
      const s = 50, d = s * 0.22, st = spread(s + d, 7), span = s + d + st * (n - 1);
      for (let j = 0; j < n; j += 1) out.push(thousand(x0 - span / 2 + j * st, CY - s / 2 + d / 2, s, kind.color, j));
    } else if (kind.key === 'hundreds') {
      const s = col.w > 220 ? 70 : 54, st = spread(s, 8), span = s + st * (n - 1);
      for (let j = 0; j < n; j += 1) out.push(hundred(x0 - span / 2 + j * st, CY - s / 2, s, kind.color, j));
    } else if (kind.key === 'tens') {
      const w = 10, gap = 4, span = n * w + Math.max(0, n - 1) * gap;
      for (let j = 0; j < n; j += 1) out.push(ten(x0 - span / 2 + j * (w + gap), CY - 5 * w, w, kind.color, j));
    } else {
      const w = 16, gap = 6, per = Math.min(n, 5), rows = Math.ceil(n / 5);
      for (let j = 0; j < n; j += 1) {
        const r = Math.floor(j / 5), c = j % 5;
        out.push(<rect key={j} x={x0 - (per * w + (per - 1) * gap) / 2 + c * (w + gap)} y={CY - (rows * w + (rows - 1) * gap) / 2 + r * (w + gap)}
          width={w} height={w} fill={kind.color} stroke="#0f172a" strokeWidth="1" />);
      }
    }
    return <g key={kind.key}>{out}</g>;
  };

  // The supply: a small block of each kind between its minus and plus.
  const icon = (kind, x, y) => {
    if (kind.key === 'thousands') return thousand(x - 15, y - 13, 26, kind.color, 'i');
    if (kind.key === 'hundreds') return hundred(x - 14, y - 14, 28, kind.color, 'i');
    if (kind.key === 'tens') return ten(x - 2.5, y - 25, 5, kind.color, 'i');
    return <rect x={x - 6} y={y - 6} width="12" height="12" fill={kind.color} stroke="#0f172a" strokeWidth="1" />;
  };
  const step = (id, x, y, sign, act, can) => (
    <g id={id} onPointerDown={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={y} r="23" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={y + 9} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );
  const stepper = (kind, i) => {
    const x = sx(i), y = 352, n = built[kind.key];
    return (
      <g key={kind.key}>
        <rect x={x - 74} y="318" width="148" height="92" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {step(kind.key + '-minus', x - 45, y, '−', () => change(kind.key, -1), n > 0)}
        {icon(kind, x, y)}
        {step(kind.key + '-plus', x + 45, y, '+', () => change(kind.key, 1), n < MAX)}
        <text x={x} y="399" textAnchor="middle" fontSize="16" fill="#cbd5e1">{kind.key}</text>
      </g>
    );
  };

  return (
    <Panel title="Digit Builder" caption="Tap plus or minus to put blocks in the tray or take them out.">
      <svg viewBox="0 0 680 420" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="420" fill="#0f172a" />
        {placed.map((ch, k) => (
          <text key={k} x={ch.x} y="88" textAnchor="middle" fontSize="80" fontWeight="800" fill="#e2e8f0">{ch.c}</text>
        ))}
        {under ? <line x1={under.x - 22} x2={under.x + 22} y1="102" y2="102" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" /> : null}
        <rect id="tray" x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
        {KINDS.map((k, i) => (built[k.key] ? pile(k, built[k.key], i) : null))}
        {KINDS.map((k, i) => stepper(k, i))}
      </svg>
    </Panel>
  );
}
