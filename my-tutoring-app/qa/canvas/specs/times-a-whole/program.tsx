// Times a whole (4.NF.B.4). A number line from 0 cut into equal spaces of one unit (thirds, fourths, fifths, halves),
// with only the whole numbers written. A card shows ONE jump drawn to the line's scale. The child sets the number of
// jumps with a stepper; the arcs leap from 0 and the landing point is marked. Multiplying a fraction by a whole number
// is counting more jumps of the same part: the part (the bottom number) never changes.
// Say and show: in "land" problems the child says where the jumps land (a fraction of one, or a whole number when the
// landing is a whole); in "count" problems the child says how many jumps reach a target.
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  const unit = num(params.unit, 5), jump = num(params.jump, 2), n = num(params.n, 3), wholes = num(params.wholes, 2);
  const say = params.say === 'count' ? 'count' : 'land';
  const total = wholes * unit, maxJumps = Math.floor(total / jump);
  const [jumps, setJumps] = useState(0);

  useEffect(() => {
    const frac = (a, b) => a + '/' + b;
    const landing = n * jump;
    // A landing on a whole number is said as the whole number the line writes there.
    const answer = say === 'count' ? n : landing % unit === 0 ? landing / unit : frac(landing, unit);
    const misrules = (say === 'count'
      ? [
          { says: landing / unit, because: 'named where the jumps land, not how many jumps' },
          { says: landing, because: 'counted the small spaces, not the jumps' },
        ]
      : [
          { says: frac(landing, n * unit), because: 'multiplied the bottom number too, as if the parts changed size' },
          { says: frac(jump, unit), because: 'named one jump, not where the jumps land' },
        ]
    ).filter((m, i, all) => String(m.says) !== String(answer) && all.findIndex(x => String(x.says) === String(m.says)) === i);
    lumina.answer(answer, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(jumps === n);
    lumina.scene({ equalSpacesFrom0To1: unit, lineEndsAt: wholes, numbersWritten: Array.from({ length: wholes + 1 }, (_, i) => i),
      spacesInOneJump: jump, jumpsMade: jumps });
  }, [jumps]);

  const X0 = 60, X1 = 620, Y = 128, tickX = i => X0 + ((X1 - X0) * i) / total, sp = (X1 - X0) / total;
  const arc = (a, b, y, h, key, stroke, dash) => {
    const xa = tickX(a), xb = tickX(b), mid = (xa + xb) / 2;
    return <path key={key} d={'M ' + xa + ' ' + y + ' Q ' + mid + ' ' + (y - h) + ' ' + xb + ' ' + y} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={dash} />;
  };
  const H = Math.min(90, 26 + jump * sp * 0.45);
  const step = (id, x, y, sign, act, can) => (
    <g id={id} onPointerDown={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={y} r="23" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={y + 9} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );

  // The one-jump card: the same jump at the line's own scale, over its own little spaces.
  const CX = 60, CY = 278, cw = jump * sp;
  return (
    <Panel title="Jump Line" caption="Tap plus or minus to add or take away a jump.">
      <svg viewBox="0 0 680 320" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="320" fill="#0f172a" />
        {Array.from({ length: jumps }, (_, k) => arc(k * jump, (k + 1) * jump, Y - 4, H, 'j' + k, '#22d3ee'))}
        <line x1={X0 - 20} y1={Y} x2={X1 + 20} y2={Y} stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
        {Array.from({ length: total + 1 }, (_, i) => {
          const whole = i % unit === 0;
          return (
            <g key={i}>
              <line x1={tickX(i)} y1={Y - (whole ? 18 : 11)} x2={tickX(i)} y2={Y + (whole ? 18 : 11)} stroke="#cbd5e1" strokeWidth={whole ? 4 : 2} />
              {whole && <text x={tickX(i)} y={Y + 46} textAnchor="middle" fontSize="20" fontWeight="700" fill="#e2e8f0">{i / unit}</text>}
            </g>
          );
        })}
        {jumps > 0 && <circle cx={tickX(jumps * jump)} cy={Y} r="11" fill="#fbbf24" stroke="#f8fafc" strokeWidth="2.5" />}

        <rect x={CX - 20} y={CY - 70} width={Math.max(150, cw + 40)} height="104" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x={CX - 4} y={CY - 46} fontSize="16" fill="#cbd5e1">one jump</text>
        <path d={'M ' + CX + ' ' + (CY - 2) + ' Q ' + (CX + cw / 2) + ' ' + (CY - 2 - Math.min(40, H * 0.6)) + ' ' + (CX + cw) + ' ' + (CY - 2)} fill="none" stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round" />
        <line x1={CX} y1={CY} x2={CX + cw} y2={CY} stroke="#64748b" strokeWidth="3" />
        {Array.from({ length: jump + 1 }, (_, i) => (
          <line key={i} x1={CX + i * sp} y1={CY - 9} x2={CX + i * sp} y2={CY + 9} stroke="#cbd5e1" strokeWidth="2" />
        ))}

        <rect x="400" y="236" width="240" height="64" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {step('jumps-minus', 442, 268, '−', () => setJumps(v => Math.max(0, v - 1)), jumps > 0)}
        <text x="520" y="274" textAnchor="middle" fontSize="16" fill="#cbd5e1">jumps</text>
        {step('jumps-plus', 598, 268, '+', () => setJumps(v => Math.min(maxJumps, v + 1)), jumps < maxJumps)}
      </svg>
    </Panel>
  );
}
