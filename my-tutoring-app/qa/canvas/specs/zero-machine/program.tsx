function Display({ params, lumina }) {
  const rule = params?.rule ?? 0;
  const cards = params?.cards ?? [3, 6, 8, 1];
  const minTests = params?.minTests ?? 3;
  const predict = params?.predict ?? null;

  const [fed, setFed] = useState([]);
  const [last, setLast] = useState(null);
  const [adds, setAdds] = useState(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const distinct = new Set(fed).size;
    const predicted = predict === null || typed === String(predict + rule);
    lumina.goal(distinct >= minTests && adds === rule && predicted);
    lumina.scene({ numberCards: cards, numbersFedIn: fed, cameOut: fed.map((v) => v + rule), machineAddsChosen: adds, askedForNumber: predict, numberTyped: typed });
  }, [fed, adds, typed, cards, rule, predict, minTests]);

  const feed = (v) => {
    setFed((list) => list.concat(v));
    setLast(v);
  };
  const pressDigit = (d) => setTyped((t) => (t.length < 3 ? t + d : t));
  const erase = () => setTyped((t) => t.slice(0, -1));

  const W = 680;
  const H = predict !== null ? 440 : 310;
  const CW = 80, CG = 12, cx0 = (W - (cards.length * CW + (cards.length - 1) * CG)) / 2;
  const MY = 112, BH = 84;
  const CHIP = 60, chipGap = 10, chip0 = (W - (6 * CHIP + 5 * chipGap)) / 2, CHY = 240;
  const KY = 334, KW = 50, KH = 44, KG = 6, kx0 = 300;

  const tile = (x, y, w, h, fill, stroke, sw) => <rect x={x} y={y} width={w} height={h} rx="12" fill={fill} stroke={stroke} strokeWidth={sw || 2} />;
  const label = (x, y, s, anchor) => <text x={x} y={y} textAnchor={anchor || 'middle'} fontSize="15" fill="#cbd5e1">{s}</text>;
  const big = (x, y, s, fs) => <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={fs || 34} fontWeight="800" fill="#e2e8f0">{s}</text>;
  const arrow = (x) => <text x={x} y={MY + BH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="26" fill="#94a3b8">→</text>;

  return (
    <Panel title="Mystery Machine" caption="Tap a number card to send it through the machine. Tap a number under the machine to choose what it adds.">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />

        {cards.map((v, i) => {
          const x = cx0 + i * (CW + CG);
          return (
            <g key={i} id={'card-' + i} onClick={() => feed(v)} style={{ cursor: 'pointer' }}>
              {tile(x, 18, CW, 62, '#1e293b', '#818cf8', 2.5)}
              {big(x + CW / 2, 50, v, 28)}
            </g>
          );
        })}

        {label(115, MY - 10, 'In')}
        <g id="in-box">{tile(60, MY, 110, BH, '#1e293b', '#475569')}{last !== null && big(115, MY + BH / 2 + 2, last)}</g>
        {arrow(192)}
        {label(280, MY - 10, 'Machine')}
        {tile(215, MY, 130, BH, '#312e81', '#818cf8', 2.5)}
        {big(280, MY + BH / 2 + 2, '?')}
        {arrow(368)}
        {label(445, MY - 10, 'Out')}
        <g id="out-box">{tile(390, MY, 110, BH, '#1e293b', '#475569')}{last !== null && big(445, MY + BH / 2 + 2, last + rule)}</g>

        {label(596, MY - 10, 'What you tried')}
        <g id="log">
          {tile(528, MY, 136, 104, '#1e293b', '#475569')}
          {fed.slice(-4).map((v, i) => (
            <text key={i} x={596} y={MY + 26 + i * 22} textAnchor="middle" fontSize="17" fontWeight="700" fill="#e2e8f0">{v} → {v + rule}</text>
          ))}
        </g>

        {label(W / 2, CHY - 12, 'This machine adds:')}
        {[0, 1, 2, 3, 4, 5].map((n, i) => {
          const x = chip0 + i * (CHIP + chipGap), on = adds === n;
          return (
            <g key={n} id={'adds-' + n} onClick={() => setAdds(n)} style={{ cursor: 'pointer' }}>
              {tile(x, CHY, CHIP, 52, on ? '#334155' : '#1e293b', on ? '#22d3ee' : '#64748b', on ? 3 : 2)}
              {big(x + CHIP / 2, CHY + 28, n, 24)}
            </g>
          );
        })}

        {predict !== null && (
          <g>
            {label(40, KY - 12, `If ${predict} goes in, what comes out?`, 'start')}
            <g id="typed">
              <rect x="40" y={KY} width="220" height="64" rx="12" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray={typed ? undefined : '6 5'} />
              {typed && big(150, KY + 34, typed, 32)}
            </g>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => {
              const x = kx0 + (i % 6) * (KW + KG), y = KY - 18 + Math.floor(i / 6) * (KH + KG);
              return (
                <g key={d} id={'key-' + d} onClick={() => pressDigit(String(d))} style={{ cursor: 'pointer' }}>
                  {tile(x, y, KW, KH, '#334155', '#64748b', 1.5)}
                  {big(x + KW / 2, y + KH / 2 + 1, d, 21)}
                </g>
              );
            })}
            <g id="key-erase" onClick={erase} style={{ cursor: 'pointer' }}>
              {tile(kx0 + 4 * (KW + KG), KY - 18 + KH + KG, 2 * KW + KG, KH, '#334155', '#64748b', 1.5)}
              <text x={kx0 + 4 * (KW + KG) + (2 * KW + KG) / 2} y={KY - 18 + KH + KG + KH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="700" fill="#e2e8f0">Erase</text>
            </g>
          </g>
        )}
      </svg>
    </Panel>
  );
}
