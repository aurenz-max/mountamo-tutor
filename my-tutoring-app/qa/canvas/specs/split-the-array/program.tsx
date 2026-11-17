// Split the array (3.OA.B.5, the distributive property). An array of dots, `down` rows of `across`. The child drags a
// line that snaps between columns and splits the array into two smaller arrays, then says how many dots in all: the
// big product is the two smaller products added.
// "A fact you know" (the goal): each part is at most ten columns wide and is a times-1, 2, 5 or 10 fact (its column
// count or the shared row count is 1, 2, 5 or 10). Check accepts every split with that property, not only the proof's.
// Nothing prints a product or the total. While `labels` is on, each part shows its own fact as rows x columns ("6 x 5")
// so the child knows which facts to recall; later problems drop it and the child reads the parts off the dots.
// Say and show: the total is one sayable number. Misrules: one part only, and the two parts multiplied.
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  const down = num(params.down, 6), across = num(params.across, 7);
  const labels = params.labels !== false;
  const [cut, setCut] = useState(0);

  const easy = n => n === 1 || n === 2 || n === 5 || n === 10;
  const known = cols => cols >= 1 && cols <= 10 && (easy(cols) || easy(down));
  const splits = Array.from({ length: across - 1 }, (_, i) => i + 1).filter(c => known(c) && known(across - c));

  useEffect(() => {
    const total = down * across;
    // The misrules use the split with the widest easy part on the left (at ten when there is one).
    const c = splits.slice().sort((a, b) => (easy(b) ? b : 0) - (easy(a) ? a : 0) || b - a)[0] || 1;
    const a = down * c, b = down * (across - c);
    const misrules = [
      { says: a, because: 'gave one part only and did not add the other part' },
      { says: a * b, because: 'multiplied the two parts instead of adding them' },
      { says: b, because: 'gave one part only and did not add the other part' },
    ].filter((m, i, all) => m.says !== total && m.says <= 9999 && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(total, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(splits.includes(cut));
    lumina.scene(cut > 0 && cut < across
      ? { rows: down, columns: across, split: 'after column ' + cut, leftPart: down + ' rows of ' + cut, rightPart: down + ' rows of ' + (across - cut), factsWritten: labels }
      : { rows: down, columns: across, split: 'none: the line is at the edge' });
  }, [cut]);

  const cell = Math.floor(Math.min(48, 600 / across, 330 / down));
  const X0 = Math.round((680 - across * cell) / 2), Y0 = 78, W = across * cell, Hh = down * cell;
  const H = Y0 + Hh + (labels ? 70 : 30);
  const split = cut > 0 && cut < across;
  const fillOf = col => (!split ? '#94a3b8' : col < cut ? '#22d3ee' : '#fbbf24');
  const drag = ({ x }) => setCut(Math.max(0, Math.min(across, Math.round((x - X0) / cell))));
  const lx = X0 + cut * cell;

  return (
    <Panel title="Split the Array" caption="Drag the line sideways to split the dots into two parts.">
      <svg viewBox={'0 0 680 ' + H} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />
        <rect x={X0 - 8} y={Y0 - 8} width={W + 16} height={Hh + 16} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {Array.from({ length: down * across }, (_, k) => {
          const r = Math.floor(k / across), col = k % across;
          return <circle key={k} cx={X0 + col * cell + cell / 2} cy={Y0 + r * cell + cell / 2} r={cell * 0.3} fill={fillOf(col)} />;
        })}
        {Array.from({ length: across + 1 }, (_, i) => (
          <g key={i}>
            <line x1={X0 + i * cell} y1={Y0 - 22} x2={X0 + i * cell} y2={Y0 - 12} stroke="#64748b" strokeWidth="2" />
            <circle id={'gap-' + i} cx={X0 + i * cell} cy={Y0 + Hh / 2} r="2" fill="transparent" pointerEvents="none" />
          </g>
        ))}
        {split && labels && [[0, cut], [cut, across]].map(([a, b], i) => (
          <text key={i} x={X0 + ((a + b) / 2) * cell} y={Y0 + Hh + 44} textAnchor="middle" fontSize="20" fontWeight="700" fill="#e2e8f0">
            {down + ' × ' + (b - a)}
          </text>
        ))}
        <Handle id="split" x={lx} y={Y0 - 40} r={22} onDrag={drag} onDrop={drag}>
          <g>
            <rect x="-22" y="-22" width="44" height={Hh + 62} fill="transparent" />
            <line x1="0" y1="18" x2="0" y2={Hh + 48} stroke="#f8fafc" strokeWidth="4" strokeDasharray="10 6" strokeLinecap="round" />
            <circle r="20" fill="#818cf8" stroke="#f8fafc" strokeWidth="2.5" />
            <path d="M -9 0 L -3 -6 L -3 6 Z M 9 0 L 3 -6 L 3 6 Z" fill="#0f172a" />
          </g>
        </Handle>
      </svg>
    </Panel>
  );
}
