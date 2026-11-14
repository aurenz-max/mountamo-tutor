function Display({ params, lumina }) {
  const mode = params.mode === 'share' ? 'share' : 'servings';
  const pans = Math.max(1, Math.min(4, Number(params.pans) || 2));
  const b = Math.max(2, Math.min(6, Number(params.serving) || 3)); // a serving, or what is left, is 1/b of a pan
  const friends = Math.max(2, Math.min(6, Number(params.friends) || 4));
  const cuttable = Math.max(0, Math.min(pans, params.cuttable === undefined ? pans : Number(params.cuttable)));
  const guides = params.guides !== false;

  const [cuts, setCuts] = useState(() => Array.from({ length: mode === 'share' ? 1 : pans }, () => 1)); // pieces per pan (or in the leftover)
  const [sign, setSign] = useState(0);

  useEffect(() => {
    const met = mode === 'servings' ? sign === pans * b : sign === b * friends;
    lumina.goal(met);
    lumina.scene(mode === 'servings'
      ? {
          pans,
          oneServing: `1/${b} of a pan`,
          pansUnderFoil: pans - cuttable,
          piecesEachOpenPanIsCutInto: cuts.slice(0, cuttable),
          servingsSign: sign === 0 ? 'not set' : sign,
        }
      : {
          leftInPan: `1/${b} of the pan`,
          friends,
          piecesTheLeftoverIsCutInto: cuts[0],
          dottedGuidesAcrossTheEmptyPan: guides,
          eachFriendGetsSign: sign === 0 ? 'not set' : `1/${sign} of the whole pan`,
        });
  }, [cuts, sign]);

  const setCut = (i, d) => setCuts(c => c.map((v, k) => (k === i ? Math.max(1, Math.min(12, v + d)) : v)));
  const W = 680, H = 430;

  const stepper = (id, x, y, onMinus, onPlus, label, minusDim, plusDim) => (
    <g>
      <g id={id + '-minus'} onClick={onMinus} style={{ cursor: 'pointer' }} opacity={minusDim ? 0.35 : 1}>
        <rect x={x - 70} y={y - 22} width="44" height="44" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
        <text x={x - 48} y={y + 8} textAnchor="middle" fontSize="24" fill="#e2e8f0">−</text>
      </g>
      <text x={x} y={y + 7} textAnchor="middle" fontSize="18" fill="#cbd5e1">{label}</text>
      <g id={id + '-plus'} onClick={onPlus} style={{ cursor: 'pointer' }} opacity={plusDim ? 0.35 : 1}>
        <rect x={x + 26} y={y - 22} width="44" height="44" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
        <text x={x + 48} y={y + 8} textAnchor="middle" fontSize="24" fill="#e2e8f0">+</text>
      </g>
    </g>
  );
  const brownie = (x, y, w, h, key) => (
    <g key={key}>
      <rect x={x} y={y} width={w} height={h} fill="#78350f" />
      <rect x={x + 3} y={y + 3} width={Math.max(0, w - 6)} height={Math.max(0, h - 6)} fill="#92400e" />
    </g>
  );
  const panFrame = (x, y, w, h) => <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx="8" fill="#94a3b8" opacity="0.25" stroke="#64748b" strokeWidth="2" />;

  const signCard = (y, text1, text2) => (
    <g>
      <rect x="60" y={y - 40} width="570" height="80" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <text x="80" y={y + 7} fontSize="20" fill="#e2e8f0">{text1}</text>
      <g id="sign-minus" onClick={() => setSign(s => Math.max(0, s - 1))} style={{ cursor: 'pointer' }} opacity={sign > 0 ? 1 : 0.35}>
        <rect x="346" y={y - 22} width="44" height="44" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
        <text x="368" y={y + 8} textAnchor="middle" fontSize="24" fill="#e2e8f0">−</text>
      </g>
      <rect x="398" y={y - 26} width="64" height="52" rx="10" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
      <text x="430" y={y + 9} textAnchor="middle" fontSize="26" fontWeight="700" fill="#22d3ee">{sign === 0 ? '?' : sign}</text>
      <g id="sign-plus" onClick={() => setSign(s => Math.min(48, s + 1))} style={{ cursor: 'pointer' }}>
        <rect x="470" y={y - 22} width="44" height="44" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
        <text x="492" y={y + 8} textAnchor="middle" fontSize="24" fill="#e2e8f0">+</text>
      </g>
      {text2 && <text x="524" y={y + 7} fontSize="18" fill="#cbd5e1">{text2}</text>}
    </g>
  );

  if (mode === 'servings') {
    const PW = 112, PH = 90, PY = 70;
    const gap = 30, plateW = PW / b + 40;
    const total = pans * PW + (pans - 1) * gap + 40 + plateW;
    const left = (W - total) / 2;
    const px = i => left + i * (PW + gap);
    const plateX = left + pans * (PW + gap) + 10;
    return (
      <Panel title="Brownie Bake Sale" caption="Tap − or + under a pan to cut it. Tap − or + on the sign to set it.">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
          <rect width={W} height={H} fill="#0f172a" />
          <rect x="14" y="22" width={W - 28} height="240" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          {Array.from({ length: pans }, (_, i) => {
            const x = px(i), open = i < cuttable, n = cuts[i];
            return (
              <g key={'pan' + i}>
                {panFrame(x, PY, PW, PH)}
                {brownie(x, PY, PW, PH, 'b' + i)}
                {open && Array.from({ length: n - 1 }, (_, k) => (
                  <line key={k} x1={x + (PW * (k + 1)) / n} y1={PY} x2={x + (PW * (k + 1)) / n} y2={PY + PH} stroke="#fde68a" strokeWidth="2.5" />
                ))}
                {!open && (
                  <g>
                    <rect x={x - 6} y={PY - 6} width={PW + 12} height={PH + 12} rx="8" fill="#cbd5e1" />
                    <path d={`M ${x + 6} ${PY + 20} l 30 18 l 24 -12 l 30 22 l 16 -8`} stroke="#94a3b8" strokeWidth="2" fill="none" />
                    <text x={x + PW / 2} y={PY + PH - 12} textAnchor="middle" fontSize="15" fill="#334155">foil</text>
                  </g>
                )}
                {open && stepper(`cut-${i}`, x + PW / 2, PY + PH + 50, () => setCut(i, -1), () => setCut(i, 1), `🔪 ${n}`, n <= 1, n >= 12)}
              </g>
            );
          })}
          {/* one serving, to scale */}
          <rect x={plateX} y={PY - 6} width={plateW} height={PH + 12} rx="12" fill="#334155" stroke="#64748b" strokeWidth="2" />
          {brownie(plateX + 20, PY, PW / b, PH, 'serving')}
          <text x={plateX + plateW / 2} y={PY + PH + 30} textAnchor="middle" fontSize="15" fill="#cbd5e1">1 serving</text>
          <text x={plateX + plateW / 2} y={PY + PH + 50} textAnchor="middle" fontSize="15" fill="#cbd5e1">{`1/${b} pan`}</text>
          {signCard(340, 'Servings we can sell:', null)}
        </svg>
      </Panel>
    );
  }

  // share: 1/b of one pan is left, and `friends` friends share it
  const PX = 150, PY = 50, PW = 300, PH = 190;
  const stripW = PW / b, n = cuts[0];
  const faces = ['🧒', '👧', '👦', '🧑', '👩', '👨'];
  return (
    <Panel title="Leftover Brownies" caption="Tap − or + beside the pan to cut the brownie that is left. Tap − or + on the sign to set it.">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="14" y="22" width={W - 28} height="300" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {panFrame(PX, PY, PW, PH)}
        <rect x={PX} y={PY} width={PW} height={PH} fill="#0f172a" opacity="0.6" />
        {Array.from({ length: 14 }, (_, k) => (
          <circle key={'cr' + k} cx={PX + stripW + ((k * 53) % (PW - stripW - 12)) + 6} cy={PY + 14 + ((k * 37) % (PH - 24))} r="2.5" fill="#78350f" opacity="0.7" />
        ))}
        {brownie(PX, PY, stripW, PH, 'left')}
        {Array.from({ length: n - 1 }, (_, k) => (
          <line key={'c' + k} x1={PX} y1={PY + (PH * (k + 1)) / n} x2={PX + stripW} y2={PY + (PH * (k + 1)) / n} stroke="#fde68a" strokeWidth="2.5" />
        ))}
        {guides && Array.from({ length: n - 1 }, (_, k) => (
          <line key={'gh' + k} x1={PX + stripW} y1={PY + (PH * (k + 1)) / n} x2={PX + PW} y2={PY + (PH * (k + 1)) / n} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 5" />
        ))}
        {guides && Array.from({ length: b - 1 }, (_, k) => (
          <line key={'gv' + k} x1={PX + stripW * (k + 1)} y1={PY} x2={PX + stripW * (k + 1)} y2={PY + PH} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 5" />
        ))}
        <rect x={PX} y={PY} width={PW} height={PH} fill="none" stroke="#64748b" strokeWidth="2" />
        {stepper('cut-0', PX + PW + 110, PY + PH / 2, () => setCut(0, -1), () => setCut(0, 1), `🔪 ${n}`, n <= 1, n >= 12)}
        <text x={PX + PW / 2} y={PY + PH + 28} textAnchor="middle" fontSize="16" fill="#cbd5e1">{'one whole pan'}</text>
        <g>
          {Array.from({ length: friends }, (_, k) => (
            <text key={'f' + k} x={W / 2 - ((friends - 1) * 44) / 2 + k * 44} y={PY + PH + 68} textAnchor="middle" fontSize="32">{faces[k % faces.length]}</text>
          ))}
        </g>
        {signCard(375, 'Each friend gets 1 /', 'of the pan')}
      </svg>
    </Panel>
  );
}
