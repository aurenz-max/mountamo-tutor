// Biggest place first (2.NBT.A.4). Two numbers sit face down in a place chart, one row each: a card per digit, under
// the place it is in (thousands, hundreds, tens, ones, and tenths on the transfer). A place a number does not have
// shows no card, so 999 has an empty slot where 1,002 has a thousands card. The child turns cards over, one at a time,
// to find which number is bigger; a turned card stays turned. The rule is which place the child looks at, so the goal
// is the rule as an action: every place from the biggest down to the deciding place is turned on both numbers (an
// empty slot counts as already showing: nothing is there), and no card to the right of the deciding place is turned.
// Turning a ones card first makes the goal unreachable on that try; Start over resets.
// Say and show: "first" or "second" is the said answer; Check judges which cards are turned.
function Display({ params, lumina }) {
  const clean = (v, d) => { const s = String(v ?? d).replace(/[^0-9.]/g, ''); return /^\d+(\.\d+)?$/.test(s) ? s : d; };
  const nums = { first: clean(params.first, '52'), second: clean(params.second, '39') };
  const emoji = String(params.emoji || '🐚');
  const thing = String(params.thing || 'shells');
  const ROWS = ['first', 'second'];

  // The places the chart shows, biggest first: as many whole places as the longer whole part, then tenths.
  const split = s => { const [w, f = ''] = s.split('.'); return { w: w.replace(/^0+(?=\d)/, ''), f }; };
  const parts = { first: split(nums.first), second: split(nums.second) };
  const wholeLen = Math.max(parts.first.w.length, parts.second.w.length);
  const fracLen = Math.min(1, Math.max(parts.first.f.length, parts.second.f.length));
  const NAMES = ['ones', 'tens', 'hundreds', 'thousands'];
  const places = [
    ...Array.from({ length: wholeLen }, (_, i) => ({ name: NAMES[wholeLen - 1 - i] || 'place' + (wholeLen - 1 - i), whole: true, k: wholeLen - 1 - i })),
    ...(fracLen ? [{ name: 'tenths', whole: false, k: 0 }] : []),
  ];
  // The digit a number has in a place, or null when it has no card there.
  const digitAt = (row, p) => {
    const { w, f } = parts[row];
    if (p.whole) { const i = w.length - 1 - p.k; return i >= 0 ? Number(w[i]) : null; }
    return f.length ? Number(f[0]) : null;
  };
  const value = (row, p) => digitAt(row, p) ?? 0;
  // The deciding place: the biggest place where the two numbers differ (a missing card is nothing, so zero).
  const decide = places.findIndex(p => value('first', p) !== value('second', p));
  const key = decide >= 0 && value('first', places[decide]) > value('second', places[decide]) ? 'first' : 'second';

  const [turned, setTurned] = useState([]);

  useEffect(() => {
    const other = key === 'first' ? 'second' : 'first';
    const lastDigit = s => Number(s.replace('.', '').slice(-1));
    const digitSum = s => s.replace('.', '').split('').reduce((t, d) => t + Number(d), 0);
    const pick = (a, b) => (a > b ? 'first' : a < b ? 'second' : null);
    const wrong = [
      pick(lastDigit(nums.first), lastDigit(nums.second)) === other ? 'compared the last digits, not the biggest place' : null,
      pick(digitSum(nums.first), digitSum(nums.second)) === other ? 'added up the digits of each number' : null,
    ].filter(Boolean);
    const misrules = wrong.length ? [{ says: other, because: wrong.join(', or ') }] : [];
    lumina.answer(key, misrules, ['first', 'second']);
  }, []);

  useEffect(() => {
    const isTurned = (row, i) => turned.includes(row + '-' + places[i].name);
    const has = (row, i) => digitAt(row, places[i]) !== null;
    const upToDeciding = places.every((_, i) => i > decide || ROWS.every(r => !has(r, i) || isTurned(r, i)));
    const nothingPast = places.every((_, i) => i <= decide || ROWS.every(r => !isTurned(r, i)));
    lumina.goal(decide >= 0 && turned.length > 0 && upToDeciding && nothingPast);
    const scene = { itemsCounted: thing, placesInChart: places.map(p => p.name), cardsTurnedInOrder: turned.map(t => t.replace('-', ' number ')) };
    ROWS.forEach(r => {
      scene[r + 'NumberHasCardsIn'] = places.filter(p => digitAt(r, p) !== null).map(p => p.name);
      const up = {};
      places.forEach(p => { if (turned.includes(r + '-' + p.name)) up[p.name] = digitAt(r, p); });
      scene[r + 'NumberFaceUp'] = up;
    });
    lumina.scene(scene);
  }, [turned]);

  const turn = id => setTurned(t => (t.includes(id) ? t : [...t, id]));

  // Layout: a label column on the left, one column per place, a narrow point column before tenths.
  const W = 680, H = 360, LABEL = 128, CW = 100, CH = 116, ROW_Y = { first: 62, second: 214 };
  const DOT = fracLen ? 30 : 0;
  const pitch = Math.min(150, (W - LABEL - 20 - DOT) / places.length);
  const gridW = pitch * places.length + DOT;
  const x0 = LABEL + (W - LABEL - gridW) / 2;
  const colX = i => x0 + pitch * i + pitch / 2 + (fracLen && !places[i].whole ? DOT : 0);
  const dotX = x0 + pitch * wholeLen + DOT / 2;

  const card = (row, p, i) => {
    const id = row + '-' + p.name, d = digitAt(row, p), x = colX(i) - CW / 2, y = ROW_Y[row];
    if (d === null) {
      return <rect key={id} x={x} y={y} width={CW} height={CH} rx="14" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />;
    }
    const up = turned.includes(id);
    return (
      <g key={id} id={'card-' + id} onPointerDown={up ? undefined : () => turn(id)} style={{ cursor: up ? 'default' : 'pointer' }}>
        <rect x={x} y={y} width={CW} height={CH} rx="14" fill={up ? '#1e293b' : '#334155'} stroke={up ? '#94a3b8' : '#64748b'} strokeWidth="2.5" />
        {up ? (
          <text x={colX(i)} y={y + CH / 2 + 22} textAnchor="middle" fontSize="64" fontWeight="800" fill="#e2e8f0">{d}</text>
        ) : (
          <g pointerEvents="none">
            <rect x={x + 10} y={y + 10} width={CW - 20} height={CH - 20} rx="9" fill="none" stroke="#475569" strokeWidth="2" />
            <text x={colX(i)} y={y + CH / 2 + 2} textAnchor="middle" dominantBaseline="middle" fontSize="34">{emoji}</text>
          </g>
        )}
      </g>
    );
  };

  return (
    <Panel title="Card Count" caption="Tap a card to turn it over. A turned card stays face up.">
      <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        {places.map((p, i) => (
          <text key={p.name} x={colX(i)} y="40" textAnchor="middle" fontSize="17" fill="#cbd5e1">{p.name}</text>
        ))}
        {ROWS.map(r => (
          <g key={r}>
            <text x="24" y={ROW_Y[r] + CH / 2 + 2} dominantBaseline="middle" fontSize="32">{emoji}</text>
            <text x="66" y={ROW_Y[r] + CH / 2 + 2} dominantBaseline="middle" fontSize="20" fontWeight="700" fill="#e2e8f0">{r}</text>
            {places.map((p, i) => card(r, p, i))}
            {fracLen ? <circle cx={dotX} cy={ROW_Y[r] + CH - 14} r="6" fill="#e2e8f0" /> : null}
          </g>
        ))}
      </svg>
    </Panel>
  );
}
