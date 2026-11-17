// Past one whole (3.NF.A.2b, 4.NF.B.3). Two or three same-size pies, each cut into the same number of equal slices,
// none shaded. The child shades slices for an amount named in words (one whole pie and one fourth of the next) and
// says the fraction of ONE pie that is shaded. The bottom number stays the slices in one pie, even past one whole.
// Say and show: the improper fraction is one sayable value; Check judges the number of shaded slices and that the
// whole pies the ask names are full (one whole pie is a full pie, not four slices spread over three pies).
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  const parts = num(params.parts, 4), numerator = num(params.numerator, 5), pies = num(params.pies, 2);
  const [shaded, setShaded] = useState([]);

  useEffect(() => {
    const frac = (a, b) => a + '/' + b, answer = frac(numerator, parts);
    const misrules = [
      { says: frac(numerator, parts * pies), because: 'counted the slices of all the pies as the whole, not the slices of one pie' },
      numerator > parts ? { says: frac(parts, parts), because: 'stopped at one whole pie: thinks a fraction cannot be more than one whole' } : null,
    ].filter((m, i, all) => m && m.says !== answer && all.findIndex(x => x && x.says === m.says) === i);
    lumina.answer(answer, misrules);
  }, []);
  useEffect(() => {
    const perPie = Array.from({ length: pies }, (_, p) => shaded.filter(k => k.startsWith(p + '-')).length);
    // The amount, made the way the ask names it: as many full pies as the whole number in it (any pie, any slices).
    lumina.goal(shaded.length === numerator && perPie.filter(n => n === parts).length >= Math.floor(numerator / parts));
    lumina.scene({ pies, equalSlicesInEachPie: parts, shadedSlicesInEachPie: perPie, shadedSlicesInAll: shaded.length });
  }, [shaded]);

  const W = 680, H = 290, CY = 150;
  const R = pies >= 4 ? 72 : pies === 3 ? 96 : 110;
  const gap = (W - pies * 2 * R) / (pies + 1);
  const cx = p => gap + R + p * (2 * R + gap);
  const toggle = k => setShaded(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]));
  // Slice i of a pie runs clockwise from the top.
  const wedge = (x, i) => {
    const a0 = -Math.PI / 2 + (2 * Math.PI * i) / parts, a1 = -Math.PI / 2 + (2 * Math.PI * (i + 1)) / parts;
    const p = a => (x + R * Math.cos(a)).toFixed(2) + ' ' + (CY + R * Math.sin(a)).toFixed(2);
    return 'M ' + x + ' ' + CY + ' L ' + p(a0) + ' A ' + R + ' ' + R + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + p(a1) + ' Z';
  };
  const pie = p => (
    <g key={p}>
      {Array.from({ length: parts }, (_, i) => {
        const k = p + '-' + i;
        return (
          <path key={k} id={'slice-' + k} d={wedge(cx(p), i)} onPointerDown={() => toggle(k)}
            fill={shaded.includes(k) ? '#fbbf24' : '#1e293b'} stroke="#64748b" strokeWidth="2.5" strokeLinejoin="round" style={{ cursor: 'pointer' }} />
        );
      })}
      <circle cx={cx(p)} cy={CY} r={R} fill="none" stroke="#cbd5e1" strokeWidth="3" pointerEvents="none" />
    </g>
  );

  return (
    <Panel title="Pie Shop" caption="Tap a slice to shade it. Tap it again to clear it.">
      <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        {Array.from({ length: pies }, (_, p) => pie(p))}
      </svg>
    </Panel>
  );
}
