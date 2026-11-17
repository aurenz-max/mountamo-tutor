// Undo it (1.OA.B.4, 2.OA.A.1). A machine ran a number through one or two steps (add, take away, double) and printed
// what came out; the number that went in is hidden. Under it is a backwards machine with an empty step under each
// forward step. The child sets each backwards step (an operation card and an amount), then runs the output back
// through it, right to left. The goal is that the backwards machine undoes the forward one for every number, so
// "+ 3 again" (the misrule) and a lucky mix that only fits this one number are both refused. Say and show: the number
// that went in is one sayable number.
function Display({ params, lumina }) {
  const stages = Array.isArray(params.stages) && params.stages.length ? params.stages : [{ op: '+', n: 3 }];
  const out = Number(params.out) || 8;
  const n = stages.length;

  const [rev, setRev] = useState(() => stages.map(() => ({ op: null, amt: 1 })));
  const [sel, setSel] = useState(n - 1); // the backwards step that runs first starts picked
  const [ran, setRan] = useState(false);

  const apply = (op, k, v) => (op === '+' ? v + k : op === '-' ? v - k : op === 'double' ? v * 2 : op === 'half' ? v / 2 : NaN);
  const undoOp = { '+': '-', '-': '+', double: 'half', half: 'double' };
  const fwd = x => stages.reduce((v, s) => apply(s.op, Number(s.n) || 0, v), x);
  // Backwards runs right to left: the step under the last forward step goes first.
  const back = (steps, v) => { const mids = []; for (let i = n - 1; i >= 0; i--) { v = apply(steps[i].op, steps[i].amt, v); mids[i] = v; } return mids; };
  const allSet = rev.every(r => r.op);
  const mids = allSet ? back(rev, out) : [];
  const result = allSet ? mids[0] : null;
  const isWhole = v => Number.isInteger(v) && v >= 0;

  useEffect(() => {
    const undo = (list, v) => list.slice().reverse().reduce((x, s) => apply(undoOp[s.op], Number(s.n) || 0, x), v);
    const input = undo(stages, out);
    const ok = v => Number.isInteger(v) && v >= 0;
    const misrules = [
      { says: fwd(out), because: 'ran the machine\'s own steps again on the number that came out, instead of undoing them' },
      n > 1 ? { says: undo([stages[n - 1]], out), because: 'undid only the last step and forgot the first one' } : null,
      n > 1 ? { says: undo([stages[0]], out), because: 'undid only the first step and forgot the last one' } : null,
      n === 1 && stages[0].op === 'double' ? { says: out - 2, because: 'thinks taking two away undoes doubling' } : null,
    ].filter((m, i, all) => m && ok(m.says) && m.says !== input && all.findIndex(x => x && x.says === m.says) === i).slice(0, 3);
    lumina.answer(input, misrules);
  }, []);

  useEffect(() => {
    // The backwards machine is right when it undoes the forward machine for every number, not only this one.
    const undoes = allSet && Array.from({ length: 21 }, (_, x) => x).every(x => Math.abs(back(rev, fwd(x))[0] - x) < 1e-9);
    lumina.goal(ran && undoes);
    lumina.scene({
      machineSteps: stages.map(s => label(s.op, s.n)), numberThatCameOut: out, numberThatWentIn: 'hidden',
      backwardsSteps: rev.map(r => (r.op ? label(r.op, r.amt) : 'not set')),
      backwardsStepBeingSet: n > 1 ? sel + 1 : 1,
      backwardsMachineRun: ran, backwardsMachineGave: ran ? (isWhole(result) ? result : 'no whole number') : null,
    });
  }, [rev, ran, sel]);

  function label(op, k) { return op === '+' ? '+ ' + k : op === '-' ? '− ' + k : op; }
  const usesAmount = op => op === '+' || op === '-';
  const cur = rev[sel];
  const change = fn => { setRev(list => list.map((r, i) => (i === sel ? fn(r) : r))); setRan(false); };
  const pickOp = op => change(r => ({ ...r, op }));
  const canDown = usesAmount(cur.op) && cur.amt > 1, canUp = usesAmount(cur.op) && cur.amt < 9;
  const step = d => { if (d < 0 ? canDown : canUp) change(r => ({ ...r, amt: r.amt + d })); };
  const run = () => { if (allSet) setRan(true); };

  // Layout: the forward machine on top, the backwards machine under it, each backwards step under the step it undoes.
  const IO = 100, ST = 150, GAP = 50, BH = 76;
  const total = 2 * IO + n * ST + (n + 1) * GAP, x0 = (680 - total) / 2;
  const xStage = i => x0 + IO + GAP + i * (ST + GAP), xOut = x0 + IO + GAP + n * (ST + GAP);
  const FY = 40, RY = 184, CY = 296, H = 368;
  const box = (x, y, w, fill, stroke, sw, dash) => <rect x={x} y={y} width={w} height={BH} rx="14" fill={fill} stroke={stroke} strokeWidth={sw || 2} strokeDasharray={dash ? '6 5' : undefined} />;
  const big = (x, y, s, fs, fill) => <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={fs || 30} fontWeight="800" fill={fill || '#e2e8f0'}>{s}</text>;
  const small = (x, y, s, anchor) => <text x={x} y={y} textAnchor={anchor || 'middle'} fontSize="15" fill="#cbd5e1">{s}</text>;
  const arrow = (x, y, s) => <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="26" fill="#94a3b8">{s}</text>;
  const ops = [['double', 'double'], ['half', 'half'], ['+', '+'], ['-', '−']];
  const CHIP = 96, CG = 12, cx0 = 40;

  return (
    <Panel title="Backwards Machine" caption={(n > 1 ? 'Tap a backwards step to pick it. ' : '') + 'Tap a card and the arrows to set it. Tap Run to send the number back.'}>
      <svg viewBox={`0 0 680 ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />

        {small(x0, FY - 12, 'Machine', 'start')}
        {small(x0 + IO / 2, FY + BH + 22, 'In')}
        {box(x0, FY, IO, '#1e293b', '#475569')}
        {big(x0 + IO / 2, FY + BH / 2 + 2, '?', 32, '#94a3b8')}
        {stages.map((s, i) => (
          <g key={'f' + i}>
            {arrow(xStage(i) - GAP / 2, FY + BH / 2, '→')}
            {box(xStage(i), FY, ST, '#312e81', '#818cf8', 2.5)}
            {big(xStage(i) + ST / 2, FY + BH / 2 + 2, label(s.op, s.n), 28)}
          </g>
        ))}
        {arrow(xOut - GAP / 2, FY + BH / 2, '→')}
        {box(xOut, FY, IO, '#1e293b', '#475569')}
        {big(xOut + IO / 2, FY + BH / 2 + 2, out, 32)}
        {small(xOut + IO / 2, FY + BH + 22, 'Out')}

        {small(x0, RY - 12, 'Backwards machine', 'start')}
        <g id="back-in">
          {box(x0, RY, IO, '#1e293b', '#475569', 2, !ran)}
          {ran && big(x0 + IO / 2, RY + BH / 2 + 2, isWhole(result) ? result : 'can\'t', isWhole(result) ? 32 : 17)}
        </g>
        {stages.map((s, i) => {
          const r = rev[i], picked = n > 1 && i === sel;
          return (
            <g key={'r' + i}>
              {i === 0 ? arrow(xStage(0) - GAP / 2, RY + BH / 2, '←') : (
                <g>
                  {arrow(xStage(i) - GAP / 2, RY + BH / 2 - (ran ? 14 : 0), '←')}
                  {ran && (isWhole(mids[i]) ? big(xStage(i) - GAP / 2, RY + BH / 2 + 20, mids[i], 18) : null)}
                </g>
              )}
              <g id={n > 1 ? 'back-step-' + i : 'back-step'} onPointerDown={n > 1 ? () => setSel(i) : undefined} style={{ cursor: n > 1 ? 'pointer' : 'default' }}>
                {box(xStage(i), RY, ST, picked ? '#334155' : '#1e293b', picked ? '#22d3ee' : r.op ? '#64748b' : '#475569', picked ? 3 : 2, !r.op)}
                {r.op ? big(xStage(i) + ST / 2, RY + BH / 2 + 2, label(r.op, r.amt), 28) : big(xStage(i) + ST / 2, RY + BH / 2 + 2, '?', 28, '#94a3b8')}
              </g>
            </g>
          );
        })}
        {arrow(xOut - GAP / 2, RY + BH / 2, '←')}
        <path d={`M ${xOut + IO / 2} ${FY + BH + 30} L ${xOut + IO / 2} ${RY - 8}`} stroke="#94a3b8" strokeWidth="2.5" />
        <path d={`M ${xOut + IO / 2 - 7} ${RY - 15} L ${xOut + IO / 2} ${RY - 5} L ${xOut + IO / 2 + 7} ${RY - 15}`} fill="none" stroke="#94a3b8" strokeWidth="2.5" />
        <g id="run" onPointerDown={run} style={{ cursor: allSet ? 'pointer' : 'default' }} opacity={allSet ? 1 : 0.35}>
          {box(xOut, RY, IO, '#1e293b', '#64748b')}
          <text x={xOut + IO / 2} y={RY + BH / 2 + 2} textAnchor="middle" dominantBaseline="middle" fontSize="20" fontWeight="700" fill="#e2e8f0">Run</text>
        </g>

        {ops.map(([op, face], i) => {
          const x = cx0 + i * (CHIP + CG), on = cur.op === op;
          return (
            <g key={op} id={'op-' + (op === '+' ? 'plus' : op === '-' ? 'minus' : op)} onPointerDown={() => pickOp(op)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={CY} width={CHIP} height="56" rx="12" fill={on ? '#334155' : '#1e293b'} stroke={on ? '#22d3ee' : '#64748b'} strokeWidth={on ? 3 : 2} />
              {big(x + CHIP / 2, CY + 29, face, face.length > 1 ? 19 : 30)}
            </g>
          );
        })}
        <rect x="478" y={CY - 4} width="170" height="64" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <g id="amt-down" onPointerDown={() => step(-1)} style={{ cursor: canDown ? 'pointer' : 'default' }} opacity={canDown ? 1 : 0.35}>
          <circle cx="508" cy={CY + 28} r="24" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <path d={`M 498 ${CY + 23} L 508 ${CY + 35} L 518 ${CY + 23} Z`} fill="#e2e8f0" />
        </g>
        <text x="563" y={CY + 33} textAnchor="middle" fontSize="15" fill="#cbd5e1" opacity={usesAmount(cur.op) ? 1 : 0.5}>amount</text>
        <g id="amt-up" onPointerDown={() => step(1)} style={{ cursor: canUp ? 'pointer' : 'default' }} opacity={canUp ? 1 : 0.35}>
          <circle cx="618" cy={CY + 28} r="24" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <path d={`M 608 ${CY + 33} L 618 ${CY + 21} L 628 ${CY + 33} Z`} fill="#e2e8f0" />
        </g>
      </svg>
    </Panel>
  );
}
