// Shift the places (4.NBT.A.1, 5.NBT.A.2). A place-value chart from thousands to thousandths with a fixed decimal
// point. The starting number's digits sit as tiles in their places. The child moves all the digit tiles together one
// place left or right per tap; the point never moves. The child cannot add a tile: a 0 shows only where it holds a
// place between the last digit and the point (250) or between the point and the first digit (0.25), and is drawn
// from the tiles' position, never placed. The digits' place is the thing the rule is about, so it is what the child
// changes. Say and show: the new number is one sayable value.
function Display({ params, lumina }) {
  const start = String(params.start ?? '2.5');
  const op = params.op === 'divide' ? 'divide' : 'times';
  const power = Number(params.places) || 1;
  const TOP = 3, BOTTOM = -3; // thousands .. thousandths

  // The starting number as its significant digits and the place of the first one (10^lead).
  const raw = start.replace('.', ''), intLen = start.includes('.') ? start.indexOf('.') : start.length;
  const lz = raw.length - raw.replace(/^0+/, '').length;
  const digits = raw.replace(/^0+/, '').replace(/0+$/, '') || '0';
  const lead0 = intLen - 1 - lz;

  // The number the tiles show when the first digit is in place 10^lead.
  const written = lead => {
    const low = lead - digits.length + 1, hi = Math.max(lead, 0), lo = Math.min(low, 0);
    let s = '';
    for (let e = hi; e >= lo; e--) {
      s += e <= lead && e >= low ? digits[lead - e] : '0';
      if (e === 0 && lo < 0) s += '.';
    }
    return s;
  };

  const [shift, setShift] = useState(0); // places moved left; negative is right
  const lead = lead0 + shift, low = lead - digits.length + 1;
  const need = op === 'times' ? power : -power;

  useEffect(() => {
    const key = written(lead0 + need);
    const misrules = [
      // Times ten as "write a zero on the end": 2.5 becomes 2.50. On a whole number this is right, so it is filtered.
      op === 'times' ? { says: start + '0'.repeat(power), because: 'wrote a zero on the end instead of moving the digits; after the point that leaves the number the same' } : null,
      { says: Number(written(lead0 - need)), because: op === 'times' ? 'moved the digits the wrong way: to the right, as for dividing' : 'moved the digits the wrong way: to the left, as for multiplying' },
      power > 1 ? { says: Number(written(lead0 + Math.sign(need))), because: 'moved the digits only one place for ' + (op === 'times' ? 'times' : 'divided by') + ' one hundred' } : null,
    ].filter((m, i, all) => m && Number(m.says) !== Number(key) && all.findIndex(x => x && String(x.says) === String(m.says)) === i);
    lumina.answer(Number(key), misrules);
  }, []);

  const NAMES = { 3: 'thousands', 2: 'hundreds', 1: 'tens', 0: 'ones', '-1': 'tenths', '-2': 'hundredths', '-3': 'thousandths' };
  const tileAt = e => {
    if (e <= lead && e >= low) return digits[lead - e];
    if ((e < low && e >= 0) || (e > lead && e <= 0)) return '0';
    return '';
  };
  useEffect(() => {
    lumina.goal(shift === need);
    const places = {};
    for (let e = TOP; e >= BOTTOM; e--) if (tileAt(e)) places[NAMES[e]] = tileAt(e);
    lumina.scene({ startingNumber: start, digitTilesByPlace: places, decimalPointBetween: 'ones and tenths' });
  }, [shift]);

  // Layout: seven place columns and a narrow column for the point between ones and tenths.
  const X0 = 20, CW = 88, PW = 24, HY = 22, HH = 40, BY = 70, BH = 96;
  const colX = e => X0 + (e >= 0 ? (TOP - e) * CW : (TOP + 1) * CW + PW + (-e - 1) * CW);
  const pointX = X0 + (TOP + 1) * CW + PW / 2;
  const canLeft = lead + 1 <= TOP, canRight = low - 1 >= BOTTOM;

  const tile = (key, x, ch, moving) => (
    <g key={key} style={{ transform: 'translate(' + x + 'px, 0px)', transition: moving ? 'transform 220ms ease-out' : 'none' }}>
      <rect x={(CW - 64) / 2} y={BY + (BH - 64) / 2} width="64" height="64" rx="12" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <text x={CW / 2} y={BY + BH / 2 + 12} textAnchor="middle" fontSize="34" fontWeight="600" fill="#e2e8f0">{ch}</text>
    </g>
  );
  const arrow = (id, x, dir, act, can) => (
    <g id={id} onPointerDown={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={236} r="27" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <path d={dir < 0 ? `M ${x + 8} 222 L ${x - 10} 236 L ${x + 8} 250 Z` : `M ${x - 8} 222 L ${x + 10} 236 L ${x - 8} 250 Z`} fill="#e2e8f0" />
    </g>
  );
  const places = [];
  for (let e = TOP; e >= BOTTOM; e--) places.push(e);

  return (
    <Panel title="Place Chart" caption="Tap an arrow to move every digit one place left or right.">
      <svg viewBox="0 0 680 280" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="280" fill="#0f172a" />
        {places.map(e => (
          <g key={'col' + e}>
            <rect x={colX(e) + 2} y={HY} width={CW - 4} height={HH} rx="8" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <text x={colX(e) + CW / 2} y={HY + HH / 2 + 5} textAnchor="middle" fontSize="13.5" fill="#cbd5e1">{NAMES[e]}</text>
            <rect x={colX(e) + 2} y={BY} width={CW - 4} height={BH} rx="10" fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 5" />
          </g>
        ))}
        <circle cx={pointX} cy={BY + BH / 2 + 22} r="7" fill="#e2e8f0" />
        {Array.from(digits).map((ch, i) => tile('d' + i, colX(lead - i), ch, true))}
        {places.filter(e => (e < low && e >= 0) || (e > lead && e <= 0)).map(e => tile('z' + e, colX(e), '0', false))}
        {arrow('shift-left', 276, -1, () => setShift(s => s + 1), canLeft)}
        <text x="340" y="241" textAnchor="middle" fontSize="15" fill="#cbd5e1">move</text>
        {arrow('shift-right', 404, 1, () => setShift(s => s - 1), canRight)}
      </svg>
    </Panel>
  );
}
