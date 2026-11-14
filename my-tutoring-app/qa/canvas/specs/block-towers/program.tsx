function Display({ params, lumina }) {
  const mode = ['build', 'buildUnit', 'sign'].includes(params.mode) ? params.mode : 'build';
  const ref = Number(params.ref) || 4; // the first tower (build, sign)
  const big = Number(params.big) || 12; // the given tall tower (buildUnit, sign)
  const target = Number(params.target) || 12;
  const chunks = params.chunks === true;
  const names = params.names || ['Ana', 'Ben', 'You'];

  const [h, setH] = useState(Number(params.start) || 1); // the child's tower, in blocks
  const [sign, setSign] = useState(0);

  useEffect(() => {
    lumina.goal(mode === 'sign' ? sign === target : h === target);
    lumina.scene({
      ...(mode !== 'buildUnit' ? { [names[0] + 'Tower']: ref + ' blocks' } : {}),
      ...(mode !== 'build' ? { [names[1] + 'Tower']: big + ' blocks' } : {}),
      ...(mode !== 'sign' ? { towerTheChildBuilt: h + ' blocks' } : { timesSign: sign === 0 ? 'not set' : sign }),
      dashedMarks: chunks ? (mode === 'build' ? `every ${ref} blocks on the child's tower` : `every ${h} blocks on ${names[1]}'s tower`) : 'none',
    });
  }, [h, sign]);

  const W = 680, H = 470, GROUND = 430, B = 12, TW = 66, MAXB = 32;
  const yOf = n => GROUND - n * B;

  const tower = (x, n, fill, edge, name, id, marksEvery) => (
    <g key={id}>
      {Array.from({ length: n }, (_, k) => (
        <rect key={k} x={x} y={yOf(k + 1)} width={TW} height={B} fill={fill} stroke={edge} strokeWidth="1.2" />
      ))}
      {marksEvery > 0 && Array.from({ length: Math.floor(n / marksEvery) }, (_, k) => {
        const y = yOf((k + 1) * marksEvery);
        return <line key={'m' + k} x1={x - 10} y1={y} x2={x + TW + 10} y2={y} stroke="#e2e8f0" strokeWidth="2" strokeDasharray="6 5" />;
      })}
      <text x={x + TW / 2} y={GROUND + 28} textAnchor="middle" fontSize="18" fill="#e2e8f0">{name}</text>
    </g>
  );

  const ladder = 600; // invisible level marks the plays aim at
  const XA = 110, XB = 270, XC = 430;
  const refX = mode === 'sign' ? XA : 200;
  const childX = 400;
  const bigX = mode === 'buildUnit' ? 200 : XB + 40;
  const onDrag = p => setH(Math.max(1, Math.min(MAXB, Math.round((GROUND - p.y) / B))));

  return (
    <Panel title="Block Towers" caption={mode === 'sign' ? 'Tap − or + on the sign to set it.' : 'Drag the top of your tower up or down to add or take away blocks.'}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="14" y={GROUND} width={W - 28} height="10" rx="4" fill="#475569" />
        {Array.from({ length: MAXB + 1 }, (_, n) => <circle key={'lv' + n} id={'level-' + n} cx={ladder} cy={yOf(n) - B / 2 + B / 2} r="2" fill="transparent" pointerEvents="none" />)}

        {mode !== 'buildUnit' && tower(refX, ref, '#fbbf24', '#92400e', names[0], 'ref', 0)}
        {mode !== 'build' && tower(bigX, big, '#f472b6', '#831843', names[1], 'big', mode === 'buildUnit' && chunks ? h : 0)}
        {mode !== 'sign' && (
          <g>
            {tower(childX, h, '#22d3ee', '#155e75', names[2], 'mine', mode === 'build' && chunks ? ref : 0)}
            <Handle id="tower-top" x={childX + TW / 2} y={yOf(h) - 4} r={22} color="cyan" onDrag={onDrag} onDrop={onDrag}>
              <g>
                <rect x="-26" y="-10" width="52" height="16" rx="6" fill="#0891b2" stroke="#e2e8f0" strokeWidth="2" />
                <path d="M -8 -14 L 0 -22 L 8 -14 Z" fill="#e2e8f0" />
              </g>
            </Handle>
          </g>
        )}
        {mode === 'sign' && (
          <g>
            <rect x="440" y="150" width="220" height="150" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <text x="550" y="182" textAnchor="middle" fontSize="16" fill="#cbd5e1">{`${names[1]}'s tower is`}</text>
            <g id="sign-minus" onClick={() => setSign(s => Math.max(0, s - 1))} style={{ cursor: 'pointer' }} opacity={sign > 0 ? 1 : 0.35}>
              <rect x="456" y="198" width="44" height="44" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
              <text x="478" y="228" textAnchor="middle" fontSize="24" fill="#e2e8f0">−</text>
            </g>
            <rect x="518" y="194" width="64" height="52" rx="10" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
            <text x="550" y="230" textAnchor="middle" fontSize="26" fontWeight="700" fill="#22d3ee">{sign === 0 ? '?' : sign}</text>
            <g id="sign-plus" onClick={() => setSign(s => Math.min(30, s + 1))} style={{ cursor: 'pointer' }}>
              <rect x="600" y="198" width="44" height="44" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
              <text x="622" y="228" textAnchor="middle" fontSize="24" fill="#e2e8f0">+</text>
            </g>
            <text x="550" y="276" textAnchor="middle" fontSize="16" fill="#cbd5e1">{`times as tall as ${names[0]}'s`}</text>
          </g>
        )}
      </svg>
    </Panel>
  );
}
